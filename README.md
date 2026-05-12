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

## What You Can Control

- **Reef Lights** — switch AUTO / MANUAL / TIMER mode, adjust white/blue/moon channels, set timed overrides, toggle moonphase simulation and acclimation
- **Reef Wave** — switch AUTO / MANUAL mode
- **Reef ATO+** — switch AUTO / MANUAL mode

## Running Tests

```bash
npm test
```

8 tests covering the Express proxy routes and device configuration.

## Architecture

```
Browser (localhost:3000)
        │
        ▼
  Express Server (server.js)
  ├── GET/POST /api/:device/:endpoint  → proxy to device IP
  └── GET /                            → serve public/index.html

public/app.js — all UI logic, state, polling
public/style.css — deep ocean dark theme
devices.js — device name → IP mapping
```
