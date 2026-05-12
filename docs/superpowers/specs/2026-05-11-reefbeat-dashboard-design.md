# ReefBeat Dashboard — Design Spec
**Date:** 2026-05-11  
**Status:** Approved

---

## Overview

A local web dashboard for monitoring and controlling three Red Sea ReefBeat aquarium devices on the home network. Runs as a small Node.js/Express server that proxies HTTP requests to the devices and serves a single-page UI.

---

## Devices

| Device | IP | Model | Chip |
|--------|-----|-------|------|
| Reef Lights | 172.16.0.21 | Reef Lights | RSLED60 |
| Reef Wave | 172.16.0.19 | Reef Wave | RSWAVE25 |
| Reef ATO+ | 172.16.0.20 | Reef ATO+ | RSATO+ |

---

## Architecture

```
Browser (localhost:3000)
        │
        ▼
  Express Server (server.js)
  ├── GET  /api/:device/*   → proxy GET  to device IP
  ├── POST /api/:device/*   → proxy POST to device IP
  └── GET  /                → serve public/index.html

  Device map (devices.js):
  ├── lights  → 172.16.0.21
  ├── wave    → 172.16.0.19
  └── ato     → 172.16.0.20
```

**Stack:**
- **Backend:** Node.js + Express — proxy layer only, no database, no auth
- **Frontend:** Vanilla HTML/CSS/JS (single `index.html` + `app.js` + `style.css`)
- **No build step** — `npm install && node server.js`

---

## File Structure

```
reefbeat-dashboard/
├── server.js          # Express server + proxy routes
├── devices.js         # Device name → IP mapping
├── package.json
└── public/
    ├── index.html     # App shell (sidebar + detail pane)
    ├── app.js         # All UI logic, fetch calls, state
    └── style.css      # Deep ocean dark theme
```

---

## Backend (server.js)

One generic proxy route handles all device communication:

```
GET  /api/:device/:endpoint        → GET  http://<device-ip>/<endpoint>
POST /api/:device/:endpoint        → POST http://<device-ip>/<endpoint>  (body forwarded)
```

`:device` is one of `lights`, `wave`, `ato` — mapped to IPs in `devices.js`.

Returns device JSON as-is, or a `{error}` JSON with the appropriate HTTP status on failure. No transformation of device payloads — the frontend speaks the device API directly through the proxy.

---

## Frontend

### Layout

- **Top bar:** App name, per-device online status dots (green/amber/red), last-refresh timestamp
- **Sidebar (180px):** Device list with icon, name, model, and current mode badge (AUTO/MANUAL). Clicking a device loads its detail pane.
- **Detail pane:** Scrollable, shows all controls for the selected device

### Auto-refresh

Poll all three devices every **10 seconds** to update status dots, mode badges, and current values. Polling only updates state — it does not overwrite values the user is currently editing.

### Device Detail Views

#### 💡 Reef Lights (172.16.0.21)

**Reads on load:** `/`, `/lights`, `/mode`, `/moonphase`, `/acclimation`, `/timer`, `/firmware`, `/wifi`

**Sections:**

1. **Mode switcher** — three pills: AUTO / MANUAL / TIMER. Clicking sends `POST /mode {"mode":"auto"|"manual"|"timer"}`.

2. **Light Channels** — sliders + numeric inputs for WHITE, BLUE, MOON (0–100%). The device's `GET /lights` returns integers × 100 (e.g. 8850 = 88.5%) — the UI divides by 100 for display. `POST /manual` accepts plain 0–100 values. Editable only when mode is MANUAL or TIMER. "Send to Device" sends `POST /manual {"white": X, "blue": X, "moon": X}`. "Reset to Current" re-fetches `/lights`.

3. **Timer** — duration input (minutes) + channel sliders. "Start Timer" sends `POST /timer {"white": X, "blue": X, "moon": X, "duration": N}`. Only shown/enabled when mode is TIMER.

4. **Moon Phase** — displays current phase name, day in cycle, days to next full/new moon. Toggle to enable/disable moonphase simulation (`POST /moonphase {"moon_day": N}` to enable, or mode switch to re-engage auto).

5. **Acclimation** — shows status (enabled/disabled), current intensity factor, remaining days. Toggle to enable/disable.

6. **Device Info** — read-only grid: IP, firmware version, uptime, free heap, RTC status.

---

#### 🌊 Reef Wave (172.16.0.19)

**Reads on load:** `/`, `/mode`, `/firmware`, `/wifi`

**Sections:**

1. **Mode switcher** — AUTO / MANUAL pills. Sends `POST /mode {"mode":"auto"|"manual"}`.
2. **Status** — uptime, firmware version, signal strength, RTC status.
3. **Device Info** — IP, firmware, heap, wifi SSID, channel.

*Note: The Reef Wave does not expose wave pattern or speed via the local API — those are app-only. The dashboard shows what's available.*

---

#### 💧 Reef ATO+ (172.16.0.20)

**Reads on load:** `/`, `/mode`, `/firmware`, `/wifi`

**Sections:**

1. **Mode switcher** — AUTO / MANUAL pills. Sends `POST /mode {"mode":"auto"|"manual"}`.
2. **Status** — uptime, RTC warning (this device has no RTC connected), firmware version.
3. **Device Info** — IP, firmware, heap, wifi SSID, signal strength.

*Note: Water level sensor data is not exposed via the local API.*

---

## API Reference (Device Endpoints)

### All devices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | System info (heap, uptime, uuid, RTC) |
| GET | `/mode` | Current mode |
| POST | `/mode` | Set mode: `{"mode": "auto"\|"manual"}` |
| GET | `/firmware` | Firmware version, update server |
| GET | `/wifi` | IP, SSID, signal, MAC |
| GET | `/time` | Current time, NTP sync status |

### Reef Lights only
| Method | Path | Description |
|--------|------|-------------|
| GET | `/lights` | Current channel levels (x100 integers) |
| POST | `/manual` | Set channels: `{"white": 0-100, "blue": 0-100, "moon": 0-100}` |
| POST | `/timer` | Timed override: `{"white", "blue", "moon", "duration": minutes}` |
| GET/POST | `/moonphase` | GET current phase; POST `{"moon_day": N}` to set |
| GET/POST | `/acclimation` | GET status; POST `{"duration": days}` to enable |

---

## Visual Design

- **Theme:** Deep ocean dark — `#050e1a` base, `#071525` sidebar/topbar, `#071e2e` cards
- **Accent:** Cyan `#0096c7` (primary), Blue `#4361ee` (blue channel), Purple `#9b72cf` (moon)
- **Status colors:** Green `#22c55e` (online/auto), Amber `#f59e0b` (warning), Red `#ef4444` (error)
- **Typography:** System UI, 13px base, tight letter-spacing on labels

---

## Error Handling

- Device unreachable: status dot turns red, detail pane shows "Device offline" banner, controls disabled
- Failed command: inline error message below the relevant control, auto-clears after 4 seconds
- Partial data (some endpoints 404): section is hidden, not crashed

---

## Out of Scope

- Authentication (local network only)
- Wave pattern / speed control (not in local API)
- ATO+ water level history (not in local API)
- OTA firmware updates
- Mobile layout (desktop only)
