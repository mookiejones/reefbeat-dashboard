# ReefBeat Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Node.js/Express dashboard to monitor and control three Red Sea ReefBeat aquarium devices via their local HTTP APIs.

**Architecture:** Express server proxies all device API calls (GET/POST) from the browser to device IPs, eliminating CORS issues. The frontend is vanilla HTML/CSS/JS served as static files — no build step. State is held in a single JS object; the UI re-renders sections on data changes.

**Tech Stack:** Node.js, Express 4, node-fetch 2 (CommonJS), Jest, Supertest, Nock

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, test script |
| `devices.js` | Device name → IP map (single source of truth) |
| `server.js` | Express app: static serving + proxy routes |
| `public/index.html` | App shell: topbar, sidebar, detail pane markup |
| `public/style.css` | Deep ocean dark theme, all visual styles |
| `public/app.js` | State object, API fetch wrappers, all render functions |
| `tests/devices.test.js` | Unit tests for devices.js |
| `tests/server.test.js` | Integration tests for proxy routes |

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "reefbeat-dashboard",
  "version": "1.0.0",
  "description": "Local dashboard for Red Sea ReefBeat devices",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "express": "^4.18.2",
    "node-fetch": "^2.7.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4",
    "nock": "^13.5.4"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.superpowers/
```

- [ ] **Step 3: Install dependencies**

```bash
cd ~/Documents/reefbeat-dashboard
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Verify Jest works**

```bash
npx jest --version
```

Expected: prints a version number like `29.x.x`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: project setup with Express and Jest"
```

---

## Task 2: Device Configuration

**Files:**
- Create: `devices.js`
- Create: `tests/devices.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/devices.test.js`:

```js
const devices = require('../devices');

test('exports an object with lights, wave, and ato keys', () => {
  expect(devices).toHaveProperty('lights');
  expect(devices).toHaveProperty('wave');
  expect(devices).toHaveProperty('ato');
});

test('each device has ip, name, icon, and model fields', () => {
  for (const key of ['lights', 'wave', 'ato']) {
    expect(devices[key]).toHaveProperty('ip');
    expect(devices[key]).toHaveProperty('name');
    expect(devices[key]).toHaveProperty('icon');
    expect(devices[key]).toHaveProperty('model');
  }
});

test('device IPs match known values', () => {
  expect(devices.lights.ip).toBe('172.16.0.21');
  expect(devices.wave.ip).toBe('172.16.0.19');
  expect(devices.ato.ip).toBe('172.16.0.20');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/devices.test.js
```

Expected: FAIL — `Cannot find module '../devices'`

- [ ] **Step 3: Implement devices.js**

```js
module.exports = {
  lights: {
    ip: '172.16.0.21',
    name: 'Reef Lights',
    icon: '💡',
    model: 'RSLED60',
  },
  wave: {
    ip: '172.16.0.19',
    name: 'Reef Wave',
    icon: '🌊',
    model: 'RSWAVE25',
  },
  ato: {
    ip: '172.16.0.20',
    name: 'Reef ATO+',
    icon: '💧',
    model: 'RSATO+',
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/devices.test.js
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add devices.js tests/devices.test.js
git commit -m "feat: add device configuration"
```

---

## Task 3: Express Server — Static Serving

**Files:**
- Create: `server.js`
- Create: `public/index.html` (placeholder)

- [ ] **Step 1: Create placeholder index.html**

Create `public/index.html`:

```html
<!DOCTYPE html>
<html><body><h1>ReefBeat Dashboard</h1></body></html>
```

- [ ] **Step 2: Create server.js with static serving**

```js
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ReefBeat Dashboard running at http://localhost:${PORT}`);
  });
}

module.exports = app;
```

- [ ] **Step 3: Verify server starts**

```bash
node server.js
```

Expected output: `ReefBeat Dashboard running at http://localhost:3000`

Open `http://localhost:3000` in browser — should show "ReefBeat Dashboard". Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add server.js public/index.html
git commit -m "feat: Express server with static file serving"
```

---

## Task 4: Proxy Routes

**Files:**
- Modify: `server.js`
- Create: `tests/server.test.js`

- [ ] **Step 1: Write failing proxy tests**

Create `tests/server.test.js`:

```js
const request = require('supertest');
const nock = require('nock');
const app = require('../server');

afterEach(() => nock.cleanAll());

describe('GET /api/:device/:endpoint', () => {
  test('proxies GET to correct device IP and returns JSON', async () => {
    nock('http://172.16.0.21').get('/mode').reply(200, { mode: 'auto' });

    const res = await request(app).get('/api/lights/mode');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mode: 'auto' });
  });

  test('returns 404 for unknown device', async () => {
    const res = await request(app).get('/api/unknown/mode');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 502 when device is unreachable', async () => {
    nock('http://172.16.0.19').get('/mode').replyWithError('ECONNREFUSED');

    const res = await request(app).get('/api/wave/mode');
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/:device/:endpoint', () => {
  test('proxies POST with body to correct device IP', async () => {
    nock('http://172.16.0.20')
      .post('/mode', { mode: 'manual' })
      .reply(200, { success: true, message: '' });

    const res = await request(app)
      .post('/api/ato/mode')
      .send({ mode: 'manual' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: '' });
  });

  test('forwards non-200 device response status', async () => {
    nock('http://172.16.0.21')
      .post('/manual', { white: 50, blue: 50, moon: 0 })
      .reply(400, { success: false, message: 'not all channels are in body' });

    const res = await request(app)
      .post('/api/lights/manual')
      .send({ white: 50, blue: 50, moon: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/server.test.js
```

Expected: FAIL — routes not defined yet.

- [ ] **Step 3: Add proxy routes to server.js**

Replace `server.js` content with:

```js
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const devices = require('./devices');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy GET /api/:device/:endpoint -> GET http://<device-ip>/<endpoint>
app.get('/api/:device/:endpoint(*)', async (req, res) => {
  const device = devices[req.params.device];
  if (!device) return res.status(404).json({ error: `Unknown device: ${req.params.device}` });

  try {
    const upstream = await fetch(`http://${device.ip}/${req.params.endpoint}`);
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    res.status(502).json({ error: `Device unreachable: ${err.message}` });
  }
});

// Proxy POST /api/:device/:endpoint -> POST http://<device-ip>/<endpoint>
app.post('/api/:device/:endpoint(*)', async (req, res) => {
  const device = devices[req.params.device];
  if (!device) return res.status(404).json({ error: `Unknown device: ${req.params.device}` });

  try {
    const upstream = await fetch(`http://${device.ip}/${req.params.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    res.status(502).json({ error: `Device unreachable: ${err.message}` });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ReefBeat Dashboard running at http://localhost:${PORT}`);
  });
}

module.exports = app;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/server.test.js
```

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Run all tests**

```bash
npx jest
```

Expected: PASS — all 8 tests passing.

- [ ] **Step 6: Commit**

```bash
git add server.js tests/server.test.js
git commit -m "feat: proxy routes for device API (GET and POST)"
```

---

## Task 5: HTML Shell

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace placeholder with full app shell**

Replace `public/index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReefBeat Dashboard</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- Top bar -->
  <header class="topbar">
    <div class="topbar-logo">🐠 REEFBEAT</div>
    <div class="topbar-right">
      <div id="status-bar" class="status-bar"></div>
      <span id="last-refresh" class="last-refresh">—</span>
    </div>
  </header>

  <div class="app">

    <!-- Sidebar -->
    <nav class="sidebar">
      <div class="sidebar-label">DEVICES</div>
      <div id="device-list"></div>
    </nav>

    <!-- Detail pane -->
    <main id="detail-pane" class="detail-pane">
      <div class="loading-hint">Select a device from the sidebar</div>
    </main>

  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

```bash
node server.js
```

Open `http://localhost:3000` — should show a bare page with "🐠 REEFBEAT" in the header and "Select a device" in the main area. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: HTML app shell with topbar, sidebar, detail pane"
```

---

## Task 6: CSS — Deep Ocean Dark Theme

**Files:**
- Create: `public/style.css`

- [ ] **Step 1: Create style.css**

```css
/* ── Reset & base ─────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:          #050e1a;
  --bg-mid:      #071525;
  --bg-card:     #071e2e;
  --bg-input:    #0d2137;
  --border:      #0d2a3e;
  --border-mid:  #1e4060;
  --text:        #cdd9e5;
  --text-dim:    #4a6880;
  --text-muted:  #2d4a62;
  --accent:      #0096c7;
  --accent-blue: #4361ee;
  --accent-moon: #9b72cf;
  --green:       #22c55e;
  --amber:       #f59e0b;
  --red:         #ef4444;
  --font:        system-ui, -apple-system, sans-serif;
}

html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); font-size: 13px; }

/* ── Layout ───────────────────────────────────────────── */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; background: var(--bg-mid);
  border-bottom: 1px solid var(--border); height: 44px;
}
.topbar-logo { color: var(--accent); font-weight: 700; font-size: 14px; letter-spacing: 2px; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.status-bar { display: flex; gap: 14px; }
.last-refresh { font-size: 11px; color: var(--text-muted); }

.app { display: flex; height: calc(100vh - 44px); overflow: hidden; }

.sidebar {
  width: 190px; background: var(--bg-mid); border-right: 1px solid var(--border);
  padding: 16px 10px; display: flex; flex-direction: column; gap: 3px; flex-shrink: 0;
}
.sidebar-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; color: var(--text-muted); padding: 4px 8px 10px; }

.detail-pane { flex: 1; padding: 28px 32px; overflow-y: auto; }
.loading-hint { color: var(--text-muted); margin-top: 60px; text-align: center; }

/* ── Sidebar items ────────────────────────────────────── */
.device-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px;
  border-radius: 6px; cursor: pointer; color: var(--text-dim);
  border-left: 3px solid transparent; transition: all 0.15s;
}
.device-item:hover { background: var(--bg-input); color: #7ec8e3; }
.device-item.active { background: #0d2a3e; color: var(--accent); border-left-color: var(--accent); }
.device-item .di-icon { font-size: 17px; }
.device-item .di-info { flex: 1; min-width: 0; }
.device-item .di-name { font-size: 12px; font-weight: 600; }
.device-item .di-model { font-size: 10px; color: var(--text-muted); margin-top: 1px; }
.device-item .di-badge { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 10px; white-space: nowrap; }
.badge-auto   { background: #062a1a; color: var(--green); }
.badge-manual { background: #2a1a06; color: var(--amber); }
.badge-offline{ background: #2a0606; color: var(--red); }

/* ── Status dots (topbar) ─────────────────────────────── */
.status-dot { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-dim); }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.dot-green  { background: var(--green);  box-shadow: 0 0 6px var(--green); }
.dot-amber  { background: var(--amber);  box-shadow: 0 0 6px var(--amber); }
.dot-red    { background: var(--red);    box-shadow: 0 0 6px var(--red); }

/* ── Detail pane sections ─────────────────────────────── */
.detail-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.detail-title { font-size: 18px; font-weight: 700; color: #e2edf5; display: flex; align-items: center; gap: 10px; }
.detail-ip { font-size: 12px; color: var(--text-muted); font-weight: 400; }
.detail-subtitle { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

.section-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 16px; }
.section-title { font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; }

.offline-banner { background: #2a060611; border: 1px solid var(--red); border-radius: 8px; color: var(--red); padding: 14px 18px; margin-bottom: 16px; font-weight: 600; }

/* ── Mode pills ───────────────────────────────────────── */
.mode-row { display: flex; gap: 8px; margin-bottom: 20px; }
.mode-pill {
  padding: 6px 18px; border-radius: 20px; font-size: 11px; font-weight: 700;
  letter-spacing: 1px; cursor: pointer; border: 1px solid var(--border-mid);
  background: var(--bg-input); color: var(--text-muted); transition: all 0.15s;
}
.mode-pill:hover { color: var(--text); border-color: var(--accent); }
.mode-pill.pill-active-auto   { background: #062a1a; color: var(--green);  border-color: #166534; }
.mode-pill.pill-active-manual { background: #2a1a06; color: var(--amber);  border-color: #854d0e; }
.mode-pill.pill-active-timer  { background: #0a1a2e; color: var(--accent); border-color: var(--accent); }

/* ── Channel sliders ──────────────────────────────────── */
.channel-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.channel-label { width: 44px; font-size: 11px; color: var(--text-dim); font-weight: 600; }
.channel-slider { flex: 1; height: 6px; -webkit-appearance: none; appearance: none; border-radius: 10px; outline: none; cursor: pointer; background: var(--bg-input); }
.channel-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; cursor: pointer; }
.slider-white::-webkit-slider-thumb { background: #90e0ef; }
.slider-blue::-webkit-slider-thumb  { background: var(--accent-blue); }
.slider-moon::-webkit-slider-thumb  { background: var(--accent-moon); }
.channel-num { width: 42px; background: var(--bg-input); border: 1px solid var(--border-mid); border-radius: 4px; color: #7ec8e3; font-size: 12px; padding: 3px 6px; text-align: right; }
.channel-num:focus { outline: none; border-color: var(--accent); }

/* ── Buttons ──────────────────────────────────────────── */
.btn-row { display: flex; gap: 8px; margin-top: 8px; }
.btn { padding: 7px 16px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
.btn-primary   { background: var(--accent); color: #fff; }
.btn-primary:hover { background: #0077a3; }
.btn-secondary { background: var(--bg-input); color: var(--text-dim); border-color: var(--border-mid); }
.btn-secondary:hover { color: var(--text); border-color: var(--accent); }
.btn:disabled  { opacity: 0.35; cursor: not-allowed; }

/* ── Toggle switch ────────────────────────────────────── */
.toggle-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
.toggle-label { font-size: 11px; color: var(--text-dim); }
.toggle { width: 38px; height: 22px; background: var(--bg-input); border-radius: 11px; position: relative; cursor: pointer; border: 1px solid var(--border-mid); transition: background 0.2s; }
.toggle.on { background: #062a1a; border-color: #166534; }
.toggle-knob { width: 14px; height: 14px; background: var(--text-muted); border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: all 0.2s; }
.toggle.on .toggle-knob { background: var(--green); left: 19px; }

/* ── Info grid ────────────────────────────────────────── */
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.info-cell { background: var(--bg); border-radius: 6px; padding: 10px 12px; }
.info-cell .ic-label { font-size: 10px; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
.info-cell .ic-value { font-size: 13px; color: #7ec8e3; font-weight: 600; }
.ic-value-warn { color: var(--amber) !important; }
.ic-value-ok   { color: var(--green) !important; }

/* ── Timer section ────────────────────────────────────── */
.timer-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.timer-label { font-size: 11px; color: var(--text-dim); }
.timer-input { width: 60px; background: var(--bg-input); border: 1px solid var(--border-mid); border-radius: 4px; color: #7ec8e3; font-size: 12px; padding: 4px 8px; text-align: center; }
.timer-input:focus { outline: none; border-color: var(--accent); }
.timer-status { font-size: 11px; color: var(--text-muted); margin-top: 8px; }

/* ── Moon phase ───────────────────────────────────────── */
.moon-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.moon-emoji { font-size: 28px; }
.moon-phase-name { font-size: 13px; color: var(--accent-moon); font-weight: 600; margin-bottom: 3px; }
.moon-meta { font-size: 11px; color: var(--text-muted); }

/* ── Inline error ─────────────────────────────────────── */
.inline-error { font-size: 11px; color: var(--red); margin-top: 8px; min-height: 16px; }

/* ── Two-column grid for side-by-side cards ───────────── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 800px) { .two-col { grid-template-columns: 1fr; } }

/* ── Refresh button ───────────────────────────────────── */
.btn-refresh { font-size: 13px; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.btn-refresh:hover { color: var(--accent); }
```

- [ ] **Step 2: Verify in browser**

```bash
node server.js
```

Open `http://localhost:3000` — the page should now have a dark navy background and "🐠 REEFBEAT" in cyan. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat: deep ocean dark CSS theme"
```

---

## Task 7: app.js — State, API Layer, and Boot

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Create public/app.js with state and API helpers**

```js
// ── State ──────────────────────────────────────────────────────────────────
const DEVICES = {
  lights: { name: 'Reef Lights', icon: '💡', model: 'RSLED60',  ip: '172.16.0.21' },
  wave:   { name: 'Reef Wave',   icon: '🌊', model: 'RSWAVE25', ip: '172.16.0.19' },
  ato:    { name: 'Reef ATO+',   icon: '💧', model: 'RSATO+',   ip: '172.16.0.20' },
};

const state = {
  selected: 'lights',       // currently shown device key
  data: {                   // latest fetched data per device
    lights: null,
    wave:   null,
    ato:    null,
  },
  online: {                 // per-device reachability
    lights: null,           // null = unknown, true = online, false = offline
    wave:   null,
    ato:    null,
  },
  editing: false,           // true while user is dragging a slider or typing
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

  // Normalise: store each endpoint's raw response under its name too
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
document.addEventListener('DOMContentLoaded', () => {
  fetchAllDevices();
  setInterval(fetchAllDevices, 10000);
});
```

- [ ] **Step 2: Verify no console errors**

```bash
node server.js
```

Open `http://localhost:3000`, open DevTools Console — should see no errors. Network tab should show 10 `/api/` requests firing. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: app state, API helpers, device polling"
```

---

## Task 8: Topbar Status Dots and Sidebar

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add renderTopbar and renderSidebar to app.js**

Append to `public/app.js`:

```js
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
```

- [ ] **Step 2: Verify in browser**

```bash
node server.js
```

Open `http://localhost:3000` — the sidebar should show all three devices with green dots and AUTO badges. Status dots should appear in the topbar. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: topbar status dots and sidebar device list"
```

---

## Task 9: renderDetail Dispatcher + Shared Helpers

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Append renderDetail dispatcher and shared helpers to app.js**

```js
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

// Shared: section card wrapper
function sectionCard(title, content) {
  return `<div class="section-card"><div class="section-title">${title}</div>${content}</div>`;
}

// Shared: info grid
function infoGrid(cells) {
  return `<div class="info-grid">${cells.map(([label, value, cls]) =>
    `<div class="info-cell">
       <div class="ic-label">${label}</div>
       <div class="ic-value ${cls || ''}">${value}</div>
     </div>`
  ).join('')}</div>`;
}

// Shared: mode pills
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

// Shared: show inline error that clears after 4s
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { if (el) el.textContent = ''; }, 4000);
}

// Shared: send mode command
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
```

- [ ] **Step 2: Verify no console errors**

```bash
node server.js
```

Open `http://localhost:3000`, click each sidebar item — pane should show "Loading…" briefly then update. No console errors. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: detail pane dispatcher, shared helpers, mode command"
```

---

## Task 10: Reef Lights Detail View

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Append renderLights and its helpers to app.js**

```js
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
  const mp = d.moonphase || {};
  const acc = d.acclimation || {};
  const timer = d.timer || {};
  const wifi = d.wifi || {};
  const uptime = sys.uptime ?? '—';
  const isManual = mode === 'manual';
  const isTimer  = mode === 'timer';
  const canEdit  = isManual || isTimer;

  const moonEmoji = moonPhaseEmoji(mp.name ?? mp.todays_moon_day);

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
      ${channelRow('WHITE', 'white', white, canEdit, 'lights')}
      ${channelRow('BLUE',  'blue',  blue,  canEdit, 'lights')}
      ${channelRow('MOON',  'moon',  moon,  canEdit, 'lights')}
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
          <div class="toggle ${mp.enabled ? 'on' : ''}" onclick="toggleMoonphase()" id="moon-toggle"></div>
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
          <div class="toggle ${acc.enabled ? 'on' : ''}" onclick="toggleAcclimation()" id="acc-toggle"></div>
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

  // Mark editing false when user focuses a channel input or slider
  pane.querySelectorAll('input').forEach(el => {
    el.addEventListener('focus', () => { state.editing = true; });
    el.addEventListener('blur',  () => { state.editing = false; });
  });
}

function channelRow(label, key, value, enabled, device) {
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

function moonPhaseEmoji(nameOrDay) {
  const phases = { 'New Moon':'🌑','Waxing Crescent':'🌒','First Quarter':'🌓','Waxing Gibbous':'🌔','Full Moon':'🌕','Waning Gibbous':'🌖','Last Quarter':'🌗','Waning Crescent':'🌘' };
  return phases[nameOrDay] ?? '🌙';
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
      const day = mp.todays_moon_day ?? 1;
      await apiPost('lights', 'moonphase', { moon_day: day });
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
```

- [ ] **Step 2: Verify in browser**

```bash
node server.js
```

Open `http://localhost:3000`, click "Reef Lights" in sidebar. You should see:
- Mode pills (AUTO highlighted green)
- Channel sliders showing ~88–90% (sliders disabled in AUTO mode)
- Moon phase card showing Waning Gibbous
- Acclimation card showing Disabled
- Device info grid

Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: Reef Lights detail view with channels, moon, acclimation"
```

---

## Task 11: Reef Wave and Reef ATO+ Detail Views

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Append renderWave and renderAto to app.js**

```js
// ── Render: Reef Wave ──────────────────────────────────────────────────────
function renderWave(pane) {
  const d = state.data.wave;
  const fw = d.firmware || {};
  const sys = d.root || d;
  const mode = d.mode?.mode ?? 'auto';
  const wifi = d.wifi || {};

  pane.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-title">🌊 Reef Wave <span class="detail-ip">· 172.16.0.19</span></div>
        <div class="detail-subtitle">${fw.chip_revision ?? 'RSWAVE25'} · v${fw.version ?? '—'} · Uptime ${sys.uptime ?? '—'}</div>
      </div>
      <button class="btn-refresh" onclick="refreshDevice('wave')" title="Refresh">⟳</button>
    </div>

    ${modePills(mode, ['auto', 'manual'], 'wave', 'wave-mode-err')}

    ${sectionCard('Status', infoGrid([
      ['MODE',     mode.toUpperCase(), mode === 'auto' ? 'ic-value-ok' : 'ic-value-warn'],
      ['UPTIME',   sys.uptime ?? '—', ''],
      ['FIRMWARE', 'v' + (fw.version ?? '—'), ''],
      ['SIGNAL',   wifi.signal_dBm != null ? wifi.signal_dBm + ' dBm' : '—', ''],
    ]))}

    ${sectionCard('Note', `
      <p style="font-size:12px;color:var(--text-muted);line-height:1.6">
        Wave pattern and flow speed are configured in the ReefBeat mobile app.
        This dashboard can toggle between AUTO and MANUAL mode only.
      </p>
    `)}

    ${sectionCard('Device Info', infoGrid([
      ['IP ADDRESS', '172.16.0.19', ''],
      ['CHIP',       fw.chip_revision ?? 'RSWAVE25', ''],
      ['FREE HEAP',  sys.free_heap ? sys.free_heap.toLocaleString() + ' B' : '—', ''],
      ['RTC',        sys.rtc_connected ? 'Connected' : 'Not connected', sys.rtc_connected ? 'ic-value-ok' : 'ic-value-warn'],
      ['SSID',       wifi.ssid ?? '—', ''],
      ['MAC',        wifi.mac ?? '—', ''],
    ]))}
  `;
}

// ── Render: Reef ATO+ ─────────────────────────────────────────────────────
function renderAto(pane) {
  const d = state.data.ato;
  const fw = d.firmware || {};
  const sys = d.root || d;
  const mode = d.mode?.mode ?? 'auto';
  const wifi = d.wifi || {};
  const hasRtc = !!sys.rtc_connected;

  pane.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-title">💧 Reef ATO+ <span class="detail-ip">· 172.16.0.20</span></div>
        <div class="detail-subtitle">${fw.chip_revision ?? 'RSATO+'} · v${fw.version ?? '—'} · Uptime ${sys.uptime ?? '—'}</div>
      </div>
      <button class="btn-refresh" onclick="refreshDevice('ato')" title="Refresh">⟳</button>
    </div>

    ${!hasRtc ? `<div class="offline-banner" style="border-color:var(--amber);color:var(--amber)">⚠ No RTC connected — time-based schedules may be affected</div>` : ''}

    ${modePills(mode, ['auto', 'manual'], 'ato', 'ato-mode-err')}

    ${sectionCard('Status', infoGrid([
      ['MODE',     mode.toUpperCase(), mode === 'auto' ? 'ic-value-ok' : 'ic-value-warn'],
      ['UPTIME',   sys.uptime ?? '—', ''],
      ['FIRMWARE', 'v' + (fw.version ?? '—'), ''],
      ['SIGNAL',   wifi.signal_dBm != null ? wifi.signal_dBm + ' dBm' : '—', ''],
    ]))}

    ${sectionCard('Note', `
      <p style="font-size:12px;color:var(--text-muted);line-height:1.6">
        Water level sensor readings and top-off history are not exposed by the local API.
        Use the ReefBeat app to view sensor data and configure top-off thresholds.
      </p>
    `)}

    ${sectionCard('Device Info', infoGrid([
      ['IP ADDRESS', '172.16.0.20', ''],
      ['CHIP',       fw.chip_revision ?? 'RSATO+', ''],
      ['FREE HEAP',  sys.free_heap ? sys.free_heap.toLocaleString() + ' B' : '—', ''],
      ['RTC',        hasRtc ? 'Connected' : 'Not connected', hasRtc ? 'ic-value-ok' : 'ic-value-warn'],
      ['SSID',       wifi.ssid ?? '—', ''],
      ['MAC',        wifi.mac ?? '—', ''],
    ]))}
  `;
}
```

- [ ] **Step 2: Verify in browser**

```bash
node server.js
```

Open `http://localhost:3000`:
- Click "Reef Wave" — should show mode pills + status grid + device info. Note about app-only controls visible.
- Click "Reef ATO+" — should show amber RTC warning banner, mode pills, status grid.

Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: Reef Wave and Reef ATO+ detail views"
```

---

## Task 12: Final Polish and End-to-End Verification

**Files:**
- Modify: `public/app.js` (select Lights by default on boot)

- [ ] **Step 1: Auto-select Lights on first load**

In the `DOMContentLoaded` listener in `app.js`, after `fetchAllDevices()` completes, select the lights view. Replace the boot block:

```js
document.addEventListener('DOMContentLoaded', async () => {
  await fetchAllDevices();
  renderDetail('lights');           // show Lights on first load
  setInterval(fetchAllDevices, 10000);
});
```

- [ ] **Step 2: Run all tests one final time**

```bash
npx jest
```

Expected: PASS — all 8 tests passing.

- [ ] **Step 3: Full end-to-end browser check**

```bash
node server.js
```

Open `http://localhost:3000` and verify:

1. **Topbar** — three green status dots appear within a second
2. **Sidebar** — all three devices listed with AUTO badges; Reef Lights highlighted
3. **Lights detail** — white/blue sliders showing ~88–90%, disabled in AUTO mode
4. **Switch to MANUAL** — click MANUAL pill, sliders become enabled
5. **Adjust a slider** — drag WHITE to 50%, click "Send to Device" — no error appears
6. **Click "Reset to Current"** — sliders return to device values
7. **Switch back to AUTO** — click AUTO pill
8. **Click Reef Wave** — detail pane shows Wave view with mode pills
9. **Click Reef ATO+** — amber RTC warning banner visible
10. **Refresh button** — click ⟳ on any device, last-refresh timestamp updates
11. **Auto-poll** — wait 10 seconds, timestamp updates automatically

Stop with Ctrl+C.

- [ ] **Step 4: Final commit**

```bash
git add public/app.js
git commit -m "feat: auto-select Lights on boot, complete dashboard"
```

---

## Task 13: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# ReefBeat Dashboard

Local web dashboard for monitoring and controlling Red Sea ReefBeat aquarium devices.

## Devices

| Device | IP | Model |
|--------|----|-------|
| Reef Lights | 172.16.0.21 | RSLED60 |
| Reef Wave | 172.16.0.19 | RSWAVE25 |
| Reef ATO+ | 172.16.0.20 | RSATO+ |

## Setup

```bash
npm install
node server.js
```

Open http://localhost:3000

## Running Tests

```bash
npm test
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```
