// ── State ──────────────────────────────────────────────────────────────────
const DEVICES = {
  lights: { name: 'Reef Lights', icon: '💡', model: 'RSLED60',  ip: '172.16.0.21' },
  wave:   { name: 'Reef Wave',   icon: '🌊', model: 'RSWAVE25', ip: '172.16.0.19' },
  ato:    { name: 'Reef ATO+',   icon: '💧', model: 'RSATO+',   ip: '172.16.0.20' },
};

const state = {
  selected: 'lights',
  data: { lights: null, wave: null, ato: null },
  online: { lights: null, wave: null, ato: null },
  editing: false,
};

// ── API helpers ────────────────────────────────────────────────────────────
async function apiGet(device, endpoint) {
  const res = await fetch(`/api/${device}/${endpoint}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPost(device, endpoint, body) {
  const res = await fetch(`/api/${device}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `${res.status}`);
  return json;
}

// ── Fetch all data for a single device ────────────────────────────────────
async function fetchDevice(key) {
  const endpoints = ['', 'mode', 'firmware', 'wifi'];
  if (key === 'lights') endpoints.push('lights', 'moonphase', 'acclimation', 'timer');

  const results = await Promise.allSettled(
    endpoints.map(ep => apiGet(key, ep || '').then(data => ({ ep: ep || 'root', data })))
  );

  const merged = {};
  for (const r of results) {
    if (r.status === 'fulfilled') merged[r.value.ep] = r.value.data;
  }

  state.data[key] = merged;
  state.online[key] = true;
}

async function fetchAllDevices() {
  await Promise.allSettled(
    Object.keys(DEVICES).map(key =>
      fetchDevice(key).catch(() => { state.online[key] = false; })
    )
  );
  renderTopbar();
  renderSidebar();
  if (!state.editing) renderDetail(state.selected);
  document.getElementById('last-refresh').textContent = 'Last refresh: ' + new Date().toLocaleTimeString();
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await fetchAllDevices();
  setInterval(fetchAllDevices, 10000);
});

// ── Render: topbar ─────────────────────────────────────────────────────────
function renderTopbar() {
  const bar = document.getElementById('status-bar');
  bar.innerHTML = Object.entries(DEVICES).map(([key, dev]) => {
    const online = state.online[key];
    const cls = online === null ? 'dot-amber' : online ? 'dot-green' : 'dot-red';
    const label = online === null ? 'connecting' : online ? 'online' : 'offline';
    return `<div class="status-dot"><div class="dot ${cls}"></div>${dev.icon} ${label}</div>`;
  }).join('');
}

// ── Render: sidebar ────────────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('device-list');
  list.innerHTML = Object.entries(DEVICES).map(([key, dev]) => {
    const d = state.data[key];
    const online = state.online[key];
    const mode = d?.mode?.mode ?? (online === false ? 'offline' : '…');
    const badgeClass = online === false ? 'badge-offline' : mode === 'manual' ? 'badge-manual' : 'badge-auto';
    const activeClass = state.selected === key ? 'active' : '';
    return `
      <div class="device-item ${activeClass}" onclick="selectDevice('${key}')">
        <span class="di-icon">${dev.icon}</span>
        <div class="di-info">
          <div class="di-name">${dev.name}</div>
          <div class="di-model">${dev.model}</div>
        </div>
        <span class="di-badge ${badgeClass}">${mode.toUpperCase()}</span>
      </div>`;
  }).join('');
}

function selectDevice(key) {
  state.selected = key;
  renderSidebar();
  renderDetail(key);
}

// ── Render: detail pane dispatcher ────────────────────────────────────────
function renderDetail(key) {
  const pane = document.getElementById('detail-pane');
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
}

function offlineBanner(key) {
  const dev = DEVICES[key];
  return `
    <div class="detail-header">
      <div>
        <div class="detail-title">${dev.icon} ${dev.name} <span class="detail-ip">${dev.ip}</span></div>
      </div>
    </div>
    <div class="offline-banner">⚠ Device offline — cannot reach ${dev.ip}</div>`;
}

function sectionCard(title, content) {
  return `<div class="section-card"><div class="section-title">${title}</div>${content}</div>`;
}

function infoGrid(cells) {
  return `<div class="info-grid">${cells.map(([label, value, cls]) =>
    `<div class="info-cell">
       <div class="ic-label">${label}</div>
       <div class="ic-value ${cls || ''}">${value}</div>
     </div>`
  ).join('')}</div>`;
}

function modePills(currentMode, pills, device, errorId) {
  return `
    <div class="mode-row">
      ${pills.map(m => `
        <div class="mode-pill ${currentMode === m ? 'pill-active-' + m : ''}"
             onclick="setMode('${device}', '${m}', '${errorId}')">
          ${m.toUpperCase()}
        </div>`).join('')}
    </div>
    <div id="${errorId}" class="inline-error"></div>`;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { if (el) el.textContent = ''; }, 4000);
}

async function setMode(device, mode, errorId) {
  try {
    await apiPost(device, 'mode', { mode });
    if (state.data[device]?.mode) state.data[device].mode.mode = mode;
    await fetchDevice(device);
    renderTopbar();
    renderSidebar();
    renderDetail(device);
  } catch (e) {
    showError(errorId, `Failed to set mode: ${e.message}`);
  }
}

// ── Render: Reef Lights ────────────────────────────────────────────────────
function renderLights(pane) {
  const d = state.data.lights;
  const fw = d.firmware || {};
  const sys = d.root || d;
  const mode = d.mode?.mode ?? 'auto';
  const lights = d.lights || {};
  const white = (lights.white ?? 0) / 100;
  const blue  = (lights.blue  ?? 0) / 100;
  const moon  = (lights.moon  ?? 0) / 100;
  const mp  = d.moonphase   || {};
  const acc = d.acclimation || {};
  const timer = d.timer     || {};
  const wifi = d.wifi       || {};
  const uptime = sys.uptime ?? '—';
  const isManual = mode === 'manual';
  const isTimer  = mode === 'timer';
  const canEdit  = isManual || isTimer;
  const moonEmoji = moonPhaseEmoji(mp.name);

  pane.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-title">💡 Reef Lights <span class="detail-ip">· 172.16.0.21</span></div>
        <div class="detail-subtitle">${fw.chip_revision ?? 'RSLED60'} · v${fw.version ?? '—'} · Uptime ${uptime}</div>
      </div>
      <button class="btn-refresh" onclick="refreshDevice('lights')" title="Refresh">⟳</button>
    </div>

    ${modePills(mode, ['auto', 'manual', 'timer'], 'lights', 'lights-mode-err')}

    ${sectionCard('Light Channels', `
      ${channelRow('WHITE', 'white', white, canEdit)}
      ${channelRow('BLUE',  'blue',  blue,  canEdit)}
      ${channelRow('MOON',  'moon',  moon,  canEdit)}
      <div class="btn-row">
        <button class="btn btn-primary" ${canEdit ? '' : 'disabled'} onclick="sendManual()">Send to Device</button>
        <button class="btn btn-secondary" ${canEdit ? '' : 'disabled'} onclick="resetChannels()">Reset to Current</button>
      </div>
      <div id="lights-manual-err" class="inline-error"></div>
    `)}

    ${isTimer ? sectionCard('Timer', `
      <div class="timer-row">
        <span class="timer-label">Duration</span>
        <input class="timer-input" id="timer-duration" type="number" min="1" max="1440" value="30">
        <span class="timer-label">minutes</span>
        <button class="btn btn-primary" onclick="sendTimer()">Start Timer</button>
      </div>
      <div class="timer-status">${timer.timer_status ?? ''}</div>
      <div id="lights-timer-err" class="inline-error"></div>
    `) : ''}

    <div class="two-col">
      ${sectionCard('Moon Phase', `
        <div class="moon-row">
          <span class="moon-emoji">${moonEmoji}</span>
          <div>
            <div class="moon-phase-name">${mp.name ?? '—'}</div>
            <div class="moon-meta">Day ${mp.todays_moon_day ?? '—'} · Full moon in ${daysUntil(mp.next_full_moon)} days</div>
          </div>
        </div>
        <div class="toggle-row">
          <span class="toggle-label">Enable moonphase simulation</span>
          <div class="toggle ${mp.enabled ? 'on' : ''}" onclick="toggleMoonphase()"></div>
        </div>
        <div id="lights-moon-err" class="inline-error"></div>
      `)}

      ${sectionCard('Acclimation', `
        ${infoGrid([
          ['STATUS',    acc.enabled ? 'Enabled' : 'Disabled', acc.enabled ? 'ic-value-ok' : ''],
          ['INTENSITY', (acc.current_intensity_factor ?? 100) + '%', ''],
          ['REMAINING', acc.enabled ? (acc.remaining_days ?? 0) + ' days' : '—', ''],
          ['DURATION',  (acc.duration ?? 60) + ' days', ''],
        ])}
        <div class="toggle-row">
          <span class="toggle-label">Enable acclimation mode</span>
          <div class="toggle ${acc.enabled ? 'on' : ''}" onclick="toggleAcclimation()"></div>
        </div>
        <div id="lights-acc-err" class="inline-error"></div>
      `)}
    </div>

    ${sectionCard('Device Info', infoGrid([
      ['IP ADDRESS', '172.16.0.21', ''],
      ['FIRMWARE',   'v' + (fw.version ?? '—'), ''],
      ['UPTIME',     uptime, ''],
      ['FREE HEAP',  sys.free_heap ? sys.free_heap.toLocaleString() + ' B' : '—', ''],
      ['RTC',        sys.rtc_connected ? 'Connected' : 'Not connected', sys.rtc_connected ? 'ic-value-ok' : 'ic-value-warn'],
      ['SIGNAL',     wifi.signal_dBm != null ? wifi.signal_dBm + ' dBm' : '—', ''],
    ]))}
  `;

  pane.querySelectorAll('input').forEach(el => {
    el.addEventListener('focus', () => { state.editing = true; });
    el.addEventListener('blur',  () => { state.editing = false; });
  });
}

function channelRow(label, key, value, enabled) {
  return `
    <div class="channel-row">
      <span class="channel-label">${label}</span>
      <input type="range" class="channel-slider slider-${key.toLowerCase()}"
             id="slider-${key}" min="0" max="100" step="0.1" value="${value.toFixed(1)}"
             ${enabled ? '' : 'disabled'}
             oninput="document.getElementById('num-${key}').value=parseFloat(this.value).toFixed(1);state.editing=true"
             onchange="state.editing=false">
      <input type="number" class="channel-num" id="num-${key}" min="0" max="100" step="0.1"
             value="${value.toFixed(1)}" ${enabled ? '' : 'disabled'}
             oninput="document.getElementById('slider-${key}').value=this.value;state.editing=true"
             onblur="state.editing=false">
      <span style="font-size:11px;color:var(--text-muted)">%</span>
    </div>`;
}

function moonPhaseEmoji(name) {
  const phases = {
    'New Moon': '🌑', 'Waxing Crescent': '🌒', 'First Quarter': '🌓',
    'Waxing Gibbous': '🌔', 'Full Moon': '🌕', 'Waning Gibbous': '🌖',
    'Last Quarter': '🌗', 'Waning Crescent': '🌘',
  };
  return phases[name] ?? '🌙';
}

function daysUntil(futureDay) {
  if (!futureDay) return '?';
  const today = new Date().getDate();
  return futureDay >= today ? futureDay - today : 30 - today + futureDay;
}

async function refreshDevice(key) {
  try { await fetchDevice(key); } catch (_) { state.online[key] = false; }
  renderTopbar(); renderSidebar(); renderDetail(key);
}

async function sendManual() {
  const white = parseFloat(document.getElementById('num-white')?.value ?? 0);
  const blue  = parseFloat(document.getElementById('num-blue')?.value  ?? 0);
  const moon  = parseFloat(document.getElementById('num-moon')?.value  ?? 0);
  try {
    await apiPost('lights', 'manual', { white, blue, moon });
    await fetchDevice('lights');
    renderDetail('lights');
  } catch (e) {
    showError('lights-manual-err', `Failed: ${e.message}`);
  }
}

async function resetChannels() {
  await fetchDevice('lights');
  renderDetail('lights');
}

async function sendTimer() {
  const white    = parseFloat(document.getElementById('num-white')?.value ?? 0);
  const blue     = parseFloat(document.getElementById('num-blue')?.value  ?? 0);
  const moon     = parseFloat(document.getElementById('num-moon')?.value  ?? 0);
  const duration = parseInt(document.getElementById('timer-duration')?.value ?? 30, 10);
  try {
    await apiPost('lights', 'timer', { white, blue, moon, duration });
    await fetchDevice('lights');
    renderDetail('lights');
  } catch (e) {
    showError('lights-timer-err', `Failed: ${e.message}`);
  }
}

async function toggleMoonphase() {
  const mp = state.data.lights?.moonphase || {};
  try {
    if (mp.enabled) {
      await apiPost('lights', 'mode', { mode: 'auto' });
    } else {
      await apiPost('lights', 'moonphase', { moon_day: mp.todays_moon_day ?? 1 });
    }
    await fetchDevice('lights');
    renderDetail('lights');
  } catch (e) {
    showError('lights-moon-err', `Failed: ${e.message}`);
  }
}

async function toggleAcclimation() {
  const acc = state.data.lights?.acclimation || {};
  try {
    if (acc.enabled) {
      await apiPost('lights', 'mode', { mode: 'auto' });
    } else {
      await apiPost('lights', 'acclimation', { duration: acc.duration ?? 60 });
    }
    await fetchDevice('lights');
    renderDetail('lights');
  } catch (e) {
    showError('lights-acc-err', `Failed: ${e.message}`);
  }
}

// Stubs for Wave/ATO — implemented in Task 11
function renderWave(pane)   { pane.innerHTML = '<div class="loading-hint">Wave view coming soon…</div>'; }
function renderAto(pane)    { pane.innerHTML = '<div class="loading-hint">ATO view coming soon…</div>'; }
