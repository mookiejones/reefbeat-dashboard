const request = require('supertest');
const { catalog } = require('../devices');
const { createApp, listen } = require('../server');

function response(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { status, text: async () => text };
}

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const href = String(url);
    calls.push({ url: href, method: (options.method || 'GET').toUpperCase(), options });
    if (typeof handler === 'function') return handler(href, options, calls);
    throw new Error('connect ECONNREFUSED');
  };
  return { calls, fetchImpl };
}

describe('GET /api/:device/:endpoint', () => {
  test('proxies GET to the device IP and returns JSON', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, { mode: 'auto' }));
    const app = createApp({ fetchImpl });
    const res = await request(app).get('/api/lights/mode');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mode: 'auto' });
    expect(calls[0].url).toBe(`http://${catalog.lights.ip}/mode`);
    expect(calls[0].options.redirect).toBe('manual');
  });

  test('forwards the query string', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, { ok: 1 }));
    const app = createApp({ fetchImpl });
    const res = await request(app).get('/api/lights/time?tz=UTC&offset=1');
    expect(res.status).toBe(200);
    const forwarded = new URL(calls[0].url);
    expect(forwarded.hostname).toBe(catalog.lights.ip);
    expect(forwarded.pathname).toBe('/time');
    expect(forwarded.searchParams.get('tz')).toBe('UTC');
    expect(forwarded.searchParams.get('offset')).toBe('1');
  });

  test('proxies the device root', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, { uptime: 5 }));
    const app = createApp({ fetchImpl });
    const res = await request(app).get('/api/ato');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uptime: 5 });
    expect(calls[0].url).toBe(`http://${catalog.ato.ip}/`);
  });

  test('returns 404 for an unknown device without calling fetch', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, {}));
    const app = createApp({ fetchImpl });
    const res = await request(app).get('/api/unknown/mode');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(calls).toHaveLength(0);
  });

  test('rejects paths that are not on the allowlist', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, { ok: true }));
    const app = createApp({ fetchImpl });
    const nested = await request(app).post('/api/lights/firmware/update').send({ url: 'http://evil/fw' });
    const waveManual = await request(app).post('/api/wave/manual').send({ white: 1 });
    const lightsGetManual = await request(app).get('/api/lights/manual');
    expect(nested.status).toBe(404);
    expect(nested.body).toEqual({ error: 'Unknown endpoint' });
    expect(waveManual.status).toBe(404);
    expect(lightsGetManual.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  test('returns 502 when the device is unreachable', async () => {
    const { fetchImpl } = mockFetch();
    const app = createApp({ fetchImpl });
    const res = await request(app).get('/api/wave/mode');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Device unreachable' });
  });

  test('refuses to follow an upstream redirect', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(302, ''));
    const app = createApp({ fetchImpl });
    const res = await request(app).get('/api/lights/mode');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Upstream redirect refused' });
    expect(calls).toHaveLength(1);
    expect(calls[0].options.redirect).toBe('manual');
  });

  test('wraps a non-JSON device body', async () => {
    const { fetchImpl } = mockFetch(() => response(200, '<html>ssid</html>'));
    const app = createApp({ fetchImpl });
    const res = await request(app).get('/api/lights/wifi');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ raw: '<html>ssid</html>' });
  });

  test('returns 502 when the device times out', async () => {
    const fetchImpl = (url, options) => new Promise((resolve, reject) => {
      const fail = () => {
        const err = new Error('The operation was aborted');
        err.name = 'TimeoutError';
        reject(err);
      };
      if (options.signal?.aborted) fail();
      else options.signal?.addEventListener('abort', fail, { once: true });
    });
    const app = createApp({ fetchImpl, timeoutMs: 30 });
    const res = await request(app).get('/api/lights/mode');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Device unreachable');
  });
});

describe('POST /api/:device/:endpoint', () => {
  test('proxies POST with the JSON body and does not forward the dashboard secret', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, { success: true, message: '' }));
    const app = createApp({ fetchImpl });
    const res = await request(app)
      .post('/api/ato/mode')
      .set('Authorization', 'Bearer super-secret')
      .send({ mode: 'manual' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: '' });
    expect(JSON.parse(calls[0].options.body)).toEqual({ mode: 'manual' });
    expect(calls[0].options.headers.Authorization).toBeUndefined();
    expect(JSON.stringify(calls[0].options.headers)).not.toContain('super-secret');
  });

  test('forwards channel tenths unchanged', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, { success: true }));
    const app = createApp({ fetchImpl });
    const res = await request(app).post('/api/lights/manual').send({ white: 88.5, blue: 50, moon: 0 });
    expect(res.status).toBe(200);
    expect(JSON.parse(calls[0].options.body)).toEqual({ white: 88.5, blue: 50, moon: 0 });
  });

  test('forwards a non-200 device status', async () => {
    const { fetchImpl } = mockFetch(() => response(400, { success: false, message: 'not all channels are in body' }));
    const app = createApp({ fetchImpl });
    const res = await request(app).post('/api/lights/manual').send({ white: 50, blue: 50, moon: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('DELETE disable endpoints', () => {
  test('lights may DELETE moonphase and acclimation only', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, { success: true }));
    const app = createApp({ fetchImpl });
    const moon = await request(app).delete('/api/lights/moonphase');
    const acc = await request(app).delete('/api/lights/acclimation');
    const mode = await request(app).delete('/api/lights/mode');
    const wave = await request(app).delete('/api/wave/moonphase');
    expect(moon.status).toBe(200);
    expect(acc.status).toBe(200);
    expect(mode.status).toBe(404);
    expect(wave.status).toBe(404);
    expect(calls.map(call => call.method + ' ' + new URL(call.url).pathname)).toEqual([
      'DELETE /moonphase',
      'DELETE /acclimation',
    ]);
    expect(calls.every(call => call.options.body === undefined)).toBe(true);
  });
});

describe('request errors', () => {
  test('rejects malformed JSON instead of an HTML error page', async () => {
    const { fetchImpl } = mockFetch(() => response(200, {}));
    const app = createApp({ fetchImpl });
    const res = await request(app)
      .post('/api/lights/mode')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON' });
  });
});

describe('dashboard auth and device list', () => {
  test('GET /api/devices returns the catalog and does not call a device', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, {}));
    const app = createApp({ fetchImpl });
    const res = await request(app).get('/api/devices');
    expect(res.status).toBe(200);
    expect(res.body.lights).toMatchObject({
      ip: catalog.lights.ip,
      model: catalog.lights.model,
      reads: catalog.lights.allow.GET,
    });
    expect(res.body.wave.reads).not.toContain('manual');
    expect(Object.keys(res.body).sort()).toEqual(['ato', 'lights', 'wave']);
    expect(calls).toHaveLength(0);
  });

  test('a configured secret is required on /api and is not required for the page', async () => {
    const { calls, fetchImpl } = mockFetch(() => response(200, { mode: 'auto' }));
    const app = createApp({ fetchImpl, secret: 'tank-secret' });
    const page = await request(app).get('/');
    const missing = await request(app).get('/api/lights/mode');
    const wrong = await request(app).get('/api/devices').set('Authorization', 'Bearer no');
    const ok = await request(app).get('/api/lights/mode').set('Authorization', 'Bearer tank-secret');
    expect(page.status).toBe(200);
    expect(page.text).toContain('REEFBEAT');
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(ok.status).toBe(200);
    expect(calls).toHaveLength(1);
  });
});

describe('bind address', () => {
  test('listens on 127.0.0.1 when asked', async () => {
    const app = createApp({ fetchImpl: async () => response(200, {}) });
    const { server } = await listen(app, { HOST: '127.0.0.1', PORT: '0' });
    try {
      expect(server.address().address).toBe('127.0.0.1');
    } finally {
      await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    }
  });
});
