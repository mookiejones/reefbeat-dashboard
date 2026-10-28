// Device records come from GET /api/devices. That payload is devices.js
// (name, address, and the GET paths in `reads`). esc, daysUntil, and the
// channel helpers live in format.js, loaded first.
let devices = {};

const state = {
  selected: 'lights',
  data: {},
  status: {},
  online: {},
  lastComm: {},
  editing: false,
  locked: false,
};

let pollTimer = null;
let listenersBound = false;

function authHeaders() {
  const secret = sessionStorage.getItem('dashboardSecret');
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}

function devicePath(key, endpoint) {
  return endpoint ? `/api/${encodeURIComponent(key)}/${encodeURIComponent(endpoint)}` : `/api/${encodeURIComponent(key)}`;
}

function showAuthGate(message) {
  state.locked = true;
  stopPolling();
  const gate = document.getElementById('auth-gate');
  if (gate) gate.classList.remove('hidden');
  const err = document.getElementById('auth-error');
  if (err) err.textContent = message || '';
}

function hideAuthGate() {
  state.locked = false;
  const gate = document.getElementById('auth-gate');
  if (gate) gate.classList.add('hidden');
  const err = document.getElementById('auth-error');
  if (err) err.textContent = '';
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function loadDevices() {
  let res;
  try {
    res = await fetch('/api/devices', { headers: authHeaders() });
  } catch (err) {
    console.error('Device list request failed', err);
    showPaneMessage('Cannot reach the dashboard server');
    return false;
  }
  if (res.status === 401) {
    showAuthGate(sessionStorage.getItem('dashboardSecret') ? 'Incorrect secret' : '');
    return false;
  }
  if (!res.ok) {
    showPaneMessage('Device list failed: ' + res.status);
    return false;
  }
  devices = await readJson(res);
  hideAuthGate();
  if (!devices[state.selected]) state.selected = Object.keys(devices)[0] || 'lights';
  for (const key of Object.keys(devices)) {
    if (!(key in state.online)) state.online[key] = null;
    if (!(key in state.data)) state.data[key] = null;
    if (!(key in state.status)) state.status[key] = {};
    if (!(key in state.lastComm)) state.lastComm[key] = null;
  }
  return true;
}

async function readEndpoint(key, endpoint) {
  const name = endpoint || 'root';
  try {
    const res = await fetch(devicePath(key, endpoint), { headers: authHeaders() });
    if (res.status === 401) {
      showAuthGate(sessionStorage.getItem('dashboardSecret') ? 'Incorrect secret' : '');
      return { name, status: 401 };
    }
    const body = await readJson(res);
    return { name, status: res.status, body };
  } catch {
    return { name, status: 'error' };
  }
}

function endpointsFor(key) {
  const reads = devices[key]?.reads;
  return Array.isArray(reads) && reads.length ? reads : [''];
}

function showPaneMessage(text) {
  const pane = document.getElementById('detail-pane');
  if (!pane) return;
  pane.replaceChildren();
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.textContent = text;
  pane.appendChild(banner);
}

async function fetchDevice(key) {
  const endpoints = endpointsFor(key);

  const results = await Promise.all(endpoints.map(ep => readEndpoint(key, ep)));
  if (state.locked) return;

  const data = {};
  const status = {};
  for (const result of results) {
    status[result.name] = result.status;
    if (result.status === 200) data[result.name] = result.body;
  }
  state.data[key] = data;
  state.status[key] = status;
  const reachable = Object.values(status).some(code => code === 200 || code === 404);
  state.online[key] = reachable;
  if (reachable) state.lastComm[key] = new Date();
}

async function fetchAllDevices() {
  if (state.locked || !Object.keys(devices).length) return;
  await Promise.all(Object.keys(devices).map(key => fetchDevice(key)));
  if (state.locked) return;
  renderTopbar();
  renderSidebar();
  if (!state.editing) renderDetail(state.selected);
  const stamp = document.getElementById('last-refresh');
  if (stamp) stamp.textContent = 'Last refresh: ' + new Date().toLocaleTimeString();
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function boot() {
  stopPolling();
  bindStaticListeners();
  const loaded = await loadDevices();
  if (!loaded) return;
  await fetchAllDevices();
  if (state.locked) return;
  pollTimer = setInterval(() => {
    fetchAllDevices().catch(err => console.error('Refresh failed', err));
  }, 10000);
}

function bindStaticListeners() {
  if (listenersBound) return;
  listenersBound = true;
  document.getElementById('device-list').addEventListener('click', (event) => {
    const item = event.target.closest('[data-device]');
    if (!item || !devices[item.dataset.device]) return;
    selectDevice(item.dataset.device);
  });
  document.getElementById('detail-pane').addEventListener('click', onDetailClick);
  const form = document.getElementById('auth-form');
  if (form) form.addEventListener('submit', onAuthSubmit);
}

async function onAuthSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('auth-secret');
  sessionStorage.setItem('dashboardSecret', input ? input.value : '');
  state.locked = false;
  await boot();
}

function onDetailClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (action === 'set-mode') setMode(target.dataset.device, target.dataset.mode, target.dataset.error);
  else if (action === 'refresh') refreshDevice(target.dataset.device);
  else if (action === 'send-manual') sendManual();
  else if (action === 'reset-channels') resetChannels();
  else if (action === 'send-timer') sendTimer();
  else if (action === 'toggle-moonphase') toggleMoonphase();
  else if (action === 'toggle-acclimation') toggleAcclimation();
}

async function sendCommand(device, endpoint, { method = 'POST', body } = {}) {
  const options = { method, headers: { ...authHeaders() } };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(devicePath(device, endpoint), options);
  const json = await readJson(res);
  if (res.status === 401) {
    showAuthGate('Incorrect secret');
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(json.message || json.error || `${res.status}`);
  state.lastComm[device] = new Date();
  return json;
}

function renderTopbar() {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  bar.innerHTML = Object.entries(devices).map(([key, dev]) => {
    const online = state.online[key];
    const cls = online === null || online === undefined ? 'dot-amber' : online ? 'dot-green' : 'dot-red';
    const label = online === null || online === undefined ? 'connecting' : online ? 'online' : 'offline';
    return `<div class="status-dot"><div class="dot ${cls}"></div>${esc(dev.icon)} ${esc(label)}</div>`;
  }).join('');
}

function badgeClassFor(online, mode) {
  if (online === false) return 'badge-offline';
  if (mode === 'manual') return 'badge-manual';
  if (mode === 'timer') return 'badge-timer';
  return 'badge-auto';
}

function modeText(online, mode) {
  if (online === false) return 'OFFLINE';
  if (typeof mode !== 'string' || !mode) return '…';
  return mode.toUpperCase();
}

function renderSidebar() {
  const list = document.getElementById('device-list');
  if (!list) return;
  list.innerHTML = Object.entries(devices).map(([key, dev]) => {
    const mode = state.data[key]?.mode?.mode;
    const online = state.online[key];
    const label = modeText(online, mode);
    const activeClass = state.selected === key ? 'active' : '';
    return `
      <div class="device-item ${activeClass}" data-device="${esc(key)}">
        <span class="di-icon">${esc(dev.icon)}</span>
        <div class="di-info">
          <div class="di-name">${esc(dev.name)}</div>
          <div class="di-model">${esc(dev.model)}</div>
        </div>
        <span class="di-badge ${badgeClassFor(online, mode)}">${esc(label)}</span>
      </div>`;
  }).join('');
}

function selectDevice(key) {
  state.selected = key;
  renderSidebar();
  renderDetail(key);
}

function renderDetail(key) {
  const pane = document.getElementById('detail-pane');
  if (!pane) return;
  if (!devices[key]) {
    pane.innerHTML = '<div class="loading-hint">No devices configured</div>';
    return;
  }
  if (state.online[key] === false) {
    pane.innerHTML = offlineBanner(key);
    return;
  }
  if (!state.data[key]) {
    pane.innerHTML = '<div class="loading-hint">Loading…</div>';
    return;
  }
  if (key === 'lights') renderLights(pane);
  else if (key === 'wave') renderWave(pane);
  else if (key === 'ato') renderAto(pane);
  else pane.innerHTML = offlineBanner(key);
  bindEditors(pane);
}

function missing(key, endpoint) {
  return state.status[key]?.[endpoint] === 404;
}

function offlineBanner(key) {
  const dev = devices[key];
  return `
    <div class="detail-header">
      <div>
        <div class="detail-title">${esc(dev.icon)} ${esc(dev.name)} <span class="detail-ip">${esc(dev.ip)}</span></div>
      </div>
    </div>
    <div class="offline-banner">⚠ Device offline — cannot reach ${esc(dev.ip)}</div>`;
}

function sectionCard(title, content) {
  return `<div class="section-card"><div class="section-title">${esc(title)}</div>${content}</div>`;
}

function infoGrid(cells) {
  return `<div class="info-grid">${cells.map(([label, value, cls]) =>
    `<div class="info-cell">
       <div class="ic-label">${esc(label)}</div>
       <div class="ic-value ${esc(cls || '')}">${esc(value)}</div>
     </div>`
  ).join('')}</div>`;
}

function modePills(currentMode, pills, device, errorId) {
  return `
    <div class="mode-row">
      ${pills.map(m => `
        <div class="mode-pill ${currentMode === m ? 'pill-active-' + m : ''}"
             data-action="set-mode" data-device="${esc(device)}" data-mode="${esc(m)}" data-error="${esc(errorId)}">
          ${esc(m.toUpperCase())}
        </div>`).join('')}
    </div>
    <div id="${esc(errorId)}" class="inline-error"></div>`;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { if (el) el.textContent = ''; }, 4000);
}

async function refreshAfter(device) {
  await fetchDevice(device);
  renderTopbar();
  renderSidebar();
  renderDetail(device);
}

async function setMode(device, mode, errorId) {
  try {
    await sendCommand(device, 'mode', { body: { mode } });
    if (state.data[device]?.mode) state.data[device].mode.mode = mode;
    await refreshAfter(device);
  } catch (e) {
    showError(errorId, `Failed to set mode: ${e.message}`);
  }
}

function readChannel(key) {
  return channelValue(document.getElementById('num-' + key)?.value);
}

function renderLights(pane) {
  const d = state.data.lights || {};
  const fw = d.firmware || {};
  const sys = d.root || {};
  const mode = typeof d.mode?.mode === 'string' ? d.mode.mode : null;
  const lights = d.lights || {};
  const white = channelPercent(lights.white ?? 0);
  const blue = channelPercent(lights.blue ?? 0);
  const moon = channelPercent(lights.moon ?? 0);
  const mp = d.moonphase || {};
  const acc = d.acclimation || {};
  const timer = d.timer || {};
  const wifi = d.wifi || {};
  const uptime = sys.uptime ?? '—';
  const isManual = mode === 'manual';
  const isTimer = mode === 'timer';
  const canEdit = isManual || isTimer;
  const dev = devices.lights;

  const parts = [`
    <div class="detail-header">
      <div>
        <div class="detail-title">${esc(dev.icon)} ${esc(dev.name)} <span class="detail-ip">· ${esc(dev.ip)}</span></div>
        <div class="detail-subtitle">${esc(fw.chip_revision ?? dev.model)} · v${esc(fw.version ?? '—')} · Uptime ${esc(uptime)}</div>
        <div class="last-comm-time">${state.lastComm.lights ? '↻ ' + esc(state.lastComm.lights.toLocaleTimeString()) : ''}</div>
      </div>
      <button class="btn-refresh" data-action="refresh" data-device="lights" title="Refresh">⟳</button>
    </div>
  `];

  if (!missing('lights', 'mode')) parts.push(modePills(mode, ['auto', 'manual', 'timer'], 'lights', 'lights-mode-err'));

  if (!missing('lights', 'lights')) {
    parts.push(sectionCard('Light Channels', `
      ${channelRow('WHITE', 'white', white, canEdit)}
      ${channelRow('BLUE', 'blue', blue, canEdit)}
      ${channelRow('MOON', 'moon', moon, canEdit)}
      <div class="btn-row">
        <button class="btn btn-primary" ${canEdit ? '' : 'disabled'} data-action="send-manual">Send to Device</button>
        <button class="btn btn-secondary" ${canEdit ? '' : 'disabled'} data-action="reset-channels">Reset to Current</button>
      </div>
      <div id="lights-manual-err" class="inline-error"></div>
    `));
  }

  if (isTimer && !missing('lights', 'timer')) {
    parts.push(sectionCard('Timer', `
      <div class="timer-row">
        <span class="timer-label">Duration</span>
        <input class="timer-input" id="timer-duration" type="number" min="1" max="1440" value="30">
        <span class="timer-label">minutes</span>
        <button class="btn btn-primary" data-action="send-timer">Start Timer</button>
      </div>
      <div class="timer-status">${esc(timer.timer_status ?? '')}</div>
      <div id="lights-timer-err" class="inline-error"></div>
    `));
  }

  const moonCard = missing('lights', 'moonphase') ? '' : sectionCard('Moon Phase', `
    <div class="moon-row">
      <span class="moon-emoji">${moonPhaseEmoji(mp.name)}</span>
      <div>
        <div class="moon-phase-name">${esc(mp.name ?? '—')}</div>
        <div class="moon-meta">Day ${esc(mp.todays_moon_day ?? '—')} · Full moon in ${esc(daysUntil(mp.next_full_moon))} days</div>
      </div>
    </div>
    <div class="toggle-row">
      <span class="toggle-label">Enable moonphase simulation</span>
      <div class="toggle ${mp.enabled ? 'on' : ''}" data-action="toggle-moonphase"><div class="toggle-knob"></div></div>
    </div>
    <div id="lights-moon-err" class="inline-error"></div>
  `);

  const accCard = missing('lights', 'acclimation') ? '' : sectionCard('Acclimation', `
    ${infoGrid([
      ['STATUS', acc.enabled ? 'Enabled' : 'Disabled', acc.enabled ? 'ic-value-ok' : ''],
      ['INTENSITY', (acc.current_intensity_factor ?? 100) + '%', ''],
      ['REMAINING', acc.enabled ? (acc.remaining_days ?? 0) + ' days' : '—', ''],
      ['DURATION', (acc.duration ?? 60) + ' days', ''],
    ])}
    <div class="toggle-row">
      <span class="toggle-label">Enable acclimation mode</span>
      <div class="toggle ${acc.enabled ? 'on' : ''}" data-action="toggle-acclimation"><div class="toggle-knob"></div></div>
    </div>
    <div id="lights-acc-err" class="inline-error"></div>
  `);

  const pair = [moonCard, accCard].filter(Boolean);
  if (pair.length === 2) parts.push(`<div class="two-col">${pair.join('')}</div>`);
  else if (pair.length === 1) parts.push(pair[0]);

  if (!missing('lights', 'root') || !missing('lights', 'firmware') || !missing('lights', 'wifi')) {
    const rtcKnown = state.status.lights?.root === 200;
    parts.push(sectionCard('Device Info', infoGrid([
      ['IP ADDRESS', dev.ip, ''],
      ['FIRMWARE', 'v' + (fw.version ?? '—'), ''],
      ['UPTIME', uptime, ''],
      ['FREE HEAP', sys.free_heap != null ? Number(sys.free_heap).toLocaleString() + ' B' : '—', ''],
      ['RTC', !rtcKnown ? '—' : (sys.rtc_connected ? 'Connected' : 'Not connected'), !rtcKnown ? '' : (sys.rtc_connected ? 'ic-value-ok' : 'ic-value-warn')],
      ['SIGNAL', wifi.signal_dBm != null ? wifi.signal_dBm + ' dBm' : '—', ''],
    ])));
  }

  pane.innerHTML = parts.join('');
}

function channelRow(label, key, value, enabled) {
  const shown = Number(value).toFixed(1);
  return `
    <div class="channel-row">
      <span class="channel-label">${esc(label)}</span>
      <input type="range" class="channel-slider slider-${esc(key)}"
             id="slider-${esc(key)}" data-num="num-${esc(key)}" min="0" max="100" step="0.1" value="${esc(shown)}"
             ${enabled ? '' : 'disabled'}>
      <input type="number" class="channel-num" id="num-${esc(key)}" data-slider="slider-${esc(key)}"
             min="0" max="100" step="0.1" value="${esc(shown)}" ${enabled ? '' : 'disabled'}>
      <span style="font-size:11px;color:var(--text-muted)">%</span>
    </div>`;
}

function bindEditors(pane) {
  pane.querySelectorAll('input').forEach(el => {
    el.addEventListener('focus', () => { state.editing = true; });
    el.addEventListener('blur', () => { state.editing = false; });
  });
  pane.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('input', () => {
      const num = document.getElementById(slider.dataset.num);
      if (num) num.value = Number(slider.value).toFixed(1);
      state.editing = true;
    });
    slider.addEventListener('change', () => { state.editing = false; });
  });
  pane.querySelectorAll('.channel-num').forEach(num => {
    num.addEventListener('input', () => {
      const slider = document.getElementById(num.dataset.slider);
      if (slider) slider.value = num.value;
      state.editing = true;
    });
  });
}

function moonPhaseEmoji(name) {
  const phases = {
    'New Moon': '🌑', 'Waxing Crescent': '🌒', 'First Quarter': '🌓',
    'Waxing Gibbous': '🌔', 'Full Moon': '🌕', 'Waning Gibbous': '🌖',
    'Last Quarter': '🌗', 'Waning Crescent': '🌘',
  };
  return phases[name] ?? '🌙';
}

async function refreshDevice(key) {
  try {
    await fetchDevice(key);
  } catch (err) {
    console.error(`Refresh failed for ${key}`, err);
    state.online[key] = false;
  }
  renderTopbar();
  renderSidebar();
  renderDetail(key);
}

async function sendManual() {
  const white = readChannel('white');
  const blue = readChannel('blue');
  const moon = readChannel('moon');
  try {
    await sendCommand('lights', 'manual', { body: { white, blue, moon } });
    await refreshAfter('lights');
  } catch (e) {
    showError('lights-manual-err', `Failed: ${e.message}`);
  }
}

async function resetChannels() {
  try {
    await fetchDevice('lights');
    renderDetail('lights');
  } catch (e) {
    showError('lights-manual-err', `Failed to refresh: ${e.message}`);
  }
}

async function sendTimer() {
  const white = readChannel('white');
  const blue = readChannel('blue');
  const moon = readChannel('moon');
  const duration = parseInt(document.getElementById('timer-duration')?.value, 10) || 30;
  try {
    await sendCommand('lights', 'timer', { body: { white, blue, moon, duration } });
    await refreshAfter('lights');
  } catch (e) {
    showError('lights-timer-err', `Failed: ${e.message}`);
  }
}

// Disable sends DELETE /moonphase or DELETE /acclimation and does not touch
// /mode. That is what the ReefBeat Home Assistant integration does on ReefLED
// hardware. It has not been confirmed on this tank's RSLED60: a rejected
// DELETE shows an inline error instead of forcing AUTO.
async function toggleMoonphase() {
  const mp = state.data.lights?.moonphase || {};
  try {
    if (mp.enabled) {
      await sendCommand('lights', 'moonphase', { method: 'DELETE' });
    } else {
      await sendCommand('lights', 'moonphase', { body: { moon_day: mp.todays_moon_day ?? 1 } });
    }
    await refreshAfter('lights');
  } catch (e) {
    showError('lights-moon-err', `Failed: ${e.message}`);
  }
}

async function toggleAcclimation() {
  const acc = state.data.lights?.acclimation || {};
  try {
    if (acc.enabled) {
      await sendCommand('lights', 'acclimation', { method: 'DELETE' });
    } else {
      await sendCommand('lights', 'acclimation', { body: { duration: acc.duration ?? 60 } });
    }
    await refreshAfter('lights');
  } catch (e) {
    showError('lights-acc-err', `Failed: ${e.message}`);
  }
}

function signalText(wifi) {
  return wifi.signal_dBm != null ? wifi.signal_dBm + ' dBm' : '—';
}

function renderWave(pane) {
  const d = state.data.wave || {};
  const fw = d.firmware || {};
  const sys = d.root || {};
  const mode = typeof d.mode?.mode === 'string' ? d.mode.mode : null;
  const wifi = d.wifi || {};
  const dev = devices.wave;
  const rtcKnown = state.status.wave?.root === 200;

  const parts = [`
    <div class="detail-header">
      <div>
        <div class="detail-title">${esc(dev.icon)} ${esc(dev.name)} <span class="detail-ip">· ${esc(dev.ip)}</span></div>
        <div class="detail-subtitle">${esc(fw.chip_revision ?? dev.model)} · v${esc(fw.version ?? '—')} · Uptime ${esc(sys.uptime ?? '—')}</div>
        <div class="last-comm-time">${state.lastComm.wave ? '↻ ' + esc(state.lastComm.wave.toLocaleTimeString()) : ''}</div>
      </div>
      <button class="btn-refresh" data-action="refresh" data-device="wave" title="Refresh">⟳</button>
    </div>
  `];

  if (!missing('wave', 'mode')) parts.push(modePills(mode, ['auto', 'manual'], 'wave', 'wave-mode-err'));

  parts.push(sectionCard('Status', infoGrid([
    ['MODE', mode ? mode.toUpperCase() : '—', mode === 'auto' ? 'ic-value-ok' : mode === 'manual' ? 'ic-value-warn' : ''],
    ['UPTIME', sys.uptime ?? '—', ''],
    ['FIRMWARE', 'v' + (fw.version ?? '—'), ''],
    ['SIGNAL', signalText(wifi), ''],
  ])));

  parts.push(sectionCard('Note', `
    <p style="font-size:12px;color:var(--text-muted);line-height:1.6">
      Wave pattern and flow speed are configured in the ReefBeat mobile app.
      This dashboard can toggle between AUTO and MANUAL mode only.
    </p>
  `));

  if (!missing('wave', 'root') || !missing('wave', 'firmware') || !missing('wave', 'wifi')) {
    parts.push(sectionCard('Device Info', infoGrid([
      ['IP ADDRESS', dev.ip, ''],
      ['CHIP', fw.chip_revision ?? dev.model, ''],
      ['FREE HEAP', sys.free_heap != null ? Number(sys.free_heap).toLocaleString() + ' B' : '—', ''],
      ['RTC', !rtcKnown ? '—' : (sys.rtc_connected ? 'Connected' : 'Not connected'), !rtcKnown ? '' : (sys.rtc_connected ? 'ic-value-ok' : 'ic-value-warn')],
      ['SSID', wifi.ssid ?? '—', ''],
      ['MAC', wifi.mac ?? '—', ''],
    ])));
  }

  pane.innerHTML = parts.join('');
}

function renderAto(pane) {
  const d = state.data.ato || {};
  const fw = d.firmware || {};
  const sys = d.root || {};
  const mode = typeof d.mode?.mode === 'string' ? d.mode.mode : null;
  const wifi = d.wifi || {};
  const dev = devices.ato;
  const rtcKnown = state.status.ato?.root === 200;
  const hasRtc = !!sys.rtc_connected;

  const parts = [`
    <div class="detail-header">
      <div>
        <div class="detail-title">${esc(dev.icon)} ${esc(dev.name)} <span class="detail-ip">· ${esc(dev.ip)}</span></div>
        <div class="detail-subtitle">${esc(fw.chip_revision ?? dev.model)} · v${esc(fw.version ?? '—')} · Uptime ${esc(sys.uptime ?? '—')}</div>
        <div class="last-comm-time">${state.lastComm.ato ? '↻ ' + esc(state.lastComm.ato.toLocaleTimeString()) : ''}</div>
      </div>
      <button class="btn-refresh" data-action="refresh" data-device="ato" title="Refresh">⟳</button>
    </div>
  `];

  if (rtcKnown && !hasRtc) {
    parts.push('<div class="offline-banner rtc-warn">⚠ No RTC connected — time-based schedules may be affected</div>');
  }

  if (!missing('ato', 'mode')) parts.push(modePills(mode, ['auto', 'manual'], 'ato', 'ato-mode-err'));

  parts.push(sectionCard('Status', infoGrid([
    ['MODE', mode ? mode.toUpperCase() : '—', mode === 'auto' ? 'ic-value-ok' : mode === 'manual' ? 'ic-value-warn' : ''],
    ['UPTIME', sys.uptime ?? '—', ''],
    ['FIRMWARE', 'v' + (fw.version ?? '—'), ''],
    ['SIGNAL', signalText(wifi), ''],
  ])));

  parts.push(sectionCard('Note', `
    <p style="font-size:12px;color:var(--text-muted);line-height:1.6">
      Water level sensor readings and top-off history are not exposed by the local API.
      Use the ReefBeat app to view sensor data and configure top-off thresholds.
    </p>
  `));

  if (!missing('ato', 'root') || !missing('ato', 'firmware') || !missing('ato', 'wifi')) {
    parts.push(sectionCard('Device Info', infoGrid([
      ['IP ADDRESS', dev.ip, ''],
      ['CHIP', fw.chip_revision ?? dev.model, ''],
      ['FREE HEAP', sys.free_heap != null ? Number(sys.free_heap).toLocaleString() + ' B' : '—', ''],
      ['RTC', !rtcKnown ? '—' : (hasRtc ? 'Connected' : 'Not connected'), !rtcKnown ? '' : (hasRtc ? 'ic-value-ok' : 'ic-value-warn')],
      ['SSID', wifi.ssid ?? '—', ''],
      ['MAC', wifi.mac ?? '—', ''],
    ])));
  }

  pane.innerHTML = parts.join('');
}

window.stopPolling = stopPolling;
window.__reefbeatReady = boot();
