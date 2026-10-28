const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { publicCatalog } = require('../devices');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const formatScript = fs.readFileSync(path.join(__dirname, '../public/format.js'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

function jsonResponse(status, body) {
  const text = JSON.stringify(body);
  return { status, ok: status >= 200 && status < 300, text: async () => text };
}

function catalog() {
  return publicCatalog();
}

function defaultBody(pathname) {
  if (pathname === '/api/devices') return { status: 200, body: catalog() };
  if (pathname === '/api/lights/mode') return { status: 200, body: { mode: 'manual' } };
  if (pathname === '/api/wave/mode' || pathname === '/api/ato/mode') return { status: 200, body: { mode: 'auto' } };
  if (pathname === '/api/lights/lights') return { status: 200, body: { white: 8850, blue: 5000, moon: 100 } };
  if (pathname === '/api/lights/moonphase') {
    return { status: 200, body: { enabled: false, name: 'Full Moon', todays_moon_day: 14, next_full_moon: 0 } };
  }
  if (pathname === '/api/lights/acclimation') {
    return { status: 200, body: { enabled: true, duration: 50, remaining_days: 10, current_intensity_factor: 70 } };
  }
  if (pathname.endsWith('/firmware')) return { status: 200, body: { version: '1.2.3', chip_revision: 'RSLED60' } };
  if (pathname.endsWith('/wifi')) return { status: 200, body: { ssid: 'reef', signal_dBm: -40, mac: 'aa:bb' } };
  if (pathname === '/api/lights/timer') return { status: 200, body: { timer_status: 'idle' } };
  if (pathname === '/api/lights' || pathname === '/api/wave' || pathname === '/api/ato') {
    return { status: 200, body: { uptime: 12, free_heap: 2048, rtc_connected: false } };
  }
  return { status: 404, body: { error: 'not found' } };
}

async function bootPage(mutate = () => {}) {
  const calls = [];
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:3000/', runScripts: 'dangerously' });
  dom.window.fetch = async (url, options = {}) => {
    const pathname = new URL(String(url), 'http://127.0.0.1:3000').pathname;
    const method = (options.method || 'GET').toUpperCase();
    calls.push({ pathname, method, options });
    const custom = mutate(pathname, method, options);
    if (custom) return jsonResponse(custom.status, custom.body);
    if (method !== 'GET') return jsonResponse(200, { success: true });
    const found = defaultBody(pathname);
    return jsonResponse(found.status, found.body);
  };
  dom.window.eval(formatScript);
  dom.window.eval(script);
  await dom.window.__reefbeatReady;
  dom.window.stopPolling();
  return { dom, calls, window: dom.window };
}

async function waitFor(fn) {
  const start = Date.now();
  while (Date.now() - start < 1000) {
    if (fn()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('timed out waiting for UI');
}

describe('dashboard UI', () => {
  let current;

  afterEach(() => {
    current?.window.stopPolling?.();
    current?.dom.window.close();
    current = null;
  });

  test('daysUntil treats device day-counts as day-counts', async () => {
    current = await bootPage();
    const { daysUntil } = current.window;
    expect(daysUntil(0)).toBe(0);
    expect(daysUntil(14)).toBe(14);
    expect(daysUntil('14')).toBe(14);
    expect(daysUntil(-3)).toBe('?');
    expect(daysUntil('<script>')).toBe('?');
    expect(daysUntil('nope')).toBe('?');
    expect(daysUntil('2026-11-02', new Date(2026, 9, 28))).toBe(5);
    expect(daysUntil('2026-10-01', new Date(2026, 9, 28))).toBe('?');
  });

  test('shows channel tenths and posts them back without rounding to an integer', async () => {
    current = await bootPage();
    const { document } = current.window;
    expect(document.getElementById('num-white').value).toBe('88.5');
    expect(document.getElementById('num-blue').value).toBe('50.0');
    expect(document.getElementById('num-moon').value).toBe('1.0');
    document.querySelector('[data-action="send-manual"]').click();
    await waitFor(() => current.calls.some(call => call.method === 'POST' && call.pathname === '/api/lights/manual'));
    const sent = current.calls.find(call => call.method === 'POST' && call.pathname === '/api/lights/manual');
    expect(JSON.parse(sent.options.body)).toEqual({ white: 88.5, blue: 50, moon: 1 });
  });

  test('escapes device fields instead of inserting HTML', async () => {
    const hostile = '<img src=x onerror="window.__xss=1">';
    current = await bootPage((pathname) => {
      if (pathname === '/api/lights/firmware') return { status: 200, body: { version: hostile, chip_revision: 'RSLED60' } };
      if (pathname === '/api/wave/wifi') return { status: 200, body: { ssid: hostile, signal_dBm: -40, mac: hostile } };
      return null;
    });
    const { document } = current.window;
    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect(current.window.__xss).toBeUndefined();
    expect(document.querySelector('.detail-subtitle').textContent).toContain(hostile);
    document.querySelector('[data-device="wave"]').click();
    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect(document.getElementById('detail-pane').textContent).toContain(hostile);
  });

  test('styles TIMER on its own and hides a section whose endpoint 404s', async () => {
    current = await bootPage((pathname) => {
      if (pathname === '/api/lights/mode') return { status: 200, body: { mode: 'timer' } };
      if (pathname === '/api/lights/moonphase') return { status: 404, body: { error: 'missing' } };
      return null;
    });
    const { document } = current.window;
    const badge = document.querySelector('[data-device="lights"] .di-badge');
    expect(badge.textContent).toBe('TIMER');
    expect(badge.classList.contains('badge-timer')).toBe(true);
    expect(badge.classList.contains('badge-auto')).toBe(false);
    expect(document.getElementById('detail-pane').textContent).not.toContain('Moon Phase');
    expect(document.getElementById('detail-pane').textContent).toContain('Acclimation');
    expect(document.getElementById('detail-pane').textContent).toContain('Timer');
  });

  test('disabling acclimation sends DELETE and does not change light mode', async () => {
    current = await bootPage((pathname, method) => {
      if (method === 'DELETE' && pathname === '/api/lights/acclimation') {
        return { status: 500, body: { message: 'not supported' } };
      }
      return null;
    });
    const { document } = current.window;
    document.querySelector('[data-action="toggle-acclimation"]').click();
    await waitFor(() => document.getElementById('lights-acc-err').textContent.includes('not supported'));
    expect(current.calls.some(call => call.method === 'DELETE' && call.pathname === '/api/lights/acclimation')).toBe(true);
    expect(current.calls.some(call => call.method === 'POST' && call.pathname === '/api/lights/mode')).toBe(false);
  });

  test('shows an offline banner when every endpoint fails', async () => {
    current = await bootPage((pathname) => {
      if (pathname === '/api/devices') return { status: 200, body: catalog() };
      throw new Error('connect ECONNREFUSED');
    });
    expect(current.window.document.querySelector('.offline-banner').textContent).toContain('Device offline');
    expect(current.window.document.querySelector('.dot-red')).not.toBeNull();
  });

  test('asks for the shared secret when the API returns 401', async () => {
    let allow = false;
    current = await bootPage((pathname, method, options) => {
      if (!allow) return { status: 401, body: { error: 'Unauthorized' } };
      return null;
    });
    const { document } = current.window;
    expect(document.getElementById('auth-gate').classList.contains('hidden')).toBe(false);
    document.getElementById('auth-secret').value = 'tank-secret';
    allow = true;
    document.getElementById('auth-form').dispatchEvent(new current.window.Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => document.querySelector('[data-device="lights"]'));
    expect(document.getElementById('auth-gate').classList.contains('hidden')).toBe(true);
    const authed = current.calls.find(call => call.pathname === '/api/devices' && call.options.headers?.Authorization);
    expect(authed.options.headers.Authorization).toBe('Bearer tank-secret');
  });
});
