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
    if (r.status === 'fulfilled') Object.assign(merged, r.value.data, { [r.value.ep]: r.value.data });
  }

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
  renderDetail('lights');
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
