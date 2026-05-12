# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ReefBeat Dashboard — a local Node.js/Express web app for monitoring and controlling three Red Sea ReefBeat aquarium devices on a home network. The full design spec lives at [docs/superpowers/specs/2026-05-11-reefbeat-dashboard-design.md](docs/superpowers/specs/2026-05-11-reefbeat-dashboard-design.md).

## Commands

```bash
npm install       # install dependencies
node server.js    # start server on localhost:3000
```

No build step. No transpilation. The app runs directly with Node.js.

## Architecture

```
Browser (localhost:3000)
        │
        ▼
  Express server (server.js)
  ├── GET  /api/:device/*  → proxy GET  to device IP
  ├── POST /api/:device/*  → proxy POST to device IP
  └── GET  /               → serve public/index.html

  Device map (devices.js):
  ├── lights  → 172.16.0.21  (Reef Lights, RSLED60)
  ├── wave    → 172.16.0.19  (Reef Wave, RSWAVE25)
  └── ato     → 172.16.0.20  (Reef ATO+, RSATO+)
```

**Stack:** Node.js + Express backend (proxy only — no DB, no auth), vanilla HTML/CSS/JS frontend (no framework, no bundler).

**Files to create:**
- `server.js` — Express server + generic proxy routes
- `devices.js` — device name → IP mapping
- `package.json`
- `public/index.html` — app shell (top bar + sidebar + detail pane)
- `public/app.js` — all UI logic, fetch calls, state management
- `public/style.css` — deep ocean dark theme

## Key Implementation Details

**Proxy layer:** One generic route handles all device communication. The frontend speaks the device API directly through the proxy — no payload transformation on the server.

**Lights channel scaling:** `GET /lights` returns integers ×100 (e.g. 8850 = 88.5%). Divide by 100 for display; send plain 0–100 values to `POST /manual`.

**Auto-refresh:** Poll all three devices every 10 seconds. Polling must not overwrite values the user is actively editing.

**Status indicators:** Each device shows green (online/auto), amber (warning), or red (offline) — derived from polling results.

**Mode badges:** Sidebar shows current mode (AUTO/MANUAL/TIMER) for each device, updated by polling.

**Device detail sections:**
- *Reef Lights*: mode switcher (AUTO/MANUAL/TIMER), channel sliders (WHITE/BLUE/MOON), timer, moon phase, acclimation, device info
- *Reef Wave*: mode switcher (AUTO/MANUAL), status, device info — no wave pattern/speed (not in local API)
- *Reef ATO+*: mode switcher (AUTO/MANUAL), status (RTC warning: no RTC on this device), device info — no water level data (not in local API)

**Visual theme:** Deep ocean dark — `#050e1a` base, `#071525` sidebar/topbar, `#071e2e` cards. Accent cyan `#0096c7`, blue `#4361ee`, purple `#9b72cf`. Status: green `#22c55e`, amber `#f59e0b`, red `#ef4444`. System UI font, 13px base.

**Error states:** Unreachable device → red dot + "Device offline" banner + disabled controls. Failed command → inline error that auto-clears after 4 seconds. Missing endpoint (404) → hide that section, don't crash.

## Device API Reference

All devices expose: `GET /`, `GET /mode`, `POST /mode`, `GET /firmware`, `GET /wifi`, `GET /time`

Reef Lights additionally: `GET /lights`, `POST /manual`, `POST /timer`, `GET|POST /moonphase`, `GET|POST /acclimation`

See the spec for full payload shapes.
