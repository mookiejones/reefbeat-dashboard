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

Open http://127.0.0.1:3000

## Configuration

| Variable | Default | Purpose |
| `HOST` | `127.0.0.1` | Bind address. `0.0.0.0` listens on every interface. |
| `PORT` | `3000` | TCP port. |
| `DASHBOARD_SECRET` | unset | Bearer token required on `/api`. Required whenever `HOST` is not loopback. |

```bash
HOST=0.0.0.0 DASHBOARD_SECRET='a long random string' node server.js
```

The page asks for the secret and keeps it in `sessionStorage` for that tab. Requests send `Authorization: Bearer`. Setting the secret also locks `/api` when the server stays on loopback.

Device names, addresses, and the paths each device may be called on live in `devices.js`. That file is the only copy: the proxy allowlist and the `GET /api/devices` payload both come from it.

## Security

This process can change lights, a wavemaker, and an auto top-off. The proxy is the trust boundary.

- **Loopback by default.** Nothing else on the network can open the port unless `HOST` says so. A non-loopback address will not start without `DASHBOARD_SECRET`.
- **Allowlist.** Only the methods and paths recorded on each device in `devices.js` are forwarded. A request such as `POST /api/lights/firmware/update` is rejected before a socket is opened.
- **Redirects are not followed.** A device response in the 300 range becomes `502` and is not fetched again.
- **Query strings are forwarded** through the URL parser, so they cannot move the request onto another host. The dashboard secret is not copied onto the device request.
- **The HTML and JavaScript are not authenticated.** The secret is not in the page. Commands are authorized by the bearer token.
- **The devices themselves have no login.** Anything that can reach their addresses can still talk to them directly. This app does not change that.

## What You Can Control

- **Reef Lights** — switch AUTO / MANUAL / TIMER mode, adjust white/blue/moon channels, set timed overrides, toggle moonphase simulation and acclimation
- **Reef Wave** — switch AUTO / MANUAL mode
- **Reef ATO+** — switch AUTO / MANUAL mode

## Running Tests

```bash
npm test
```

Jest covers the proxy allowlist, redirects, query strings, the shared secret, the device catalog, and the main UI states (channel tenths, escaping, the TIMER badge, 404 sections, and acclimation disable).

## Architecture

```
Browser
   │
   ▼
server.js
├── lib/config.js     bind address and shared secret
├── lib/proxy.js      allowlisted request, query kept, redirects refused
├── GET /api/devices  public view of devices.js
└── GET /             public/index.html, format.js, app.js

devices.js is the only device map: name, address, and allowed paths.
```
