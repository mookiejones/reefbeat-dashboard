'use strict';

const path = require('path');
const express = require('express');
const { publicCatalog } = require('./devices');
const { bindConfig, formatOrigin, requireSecret } = require('./lib/config');
const { HttpError, queryFrom, proxyRequest } = require('./lib/proxy');

const DEVICE_TIMEOUT_MS = 5000;

function createApp(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEVICE_TIMEOUT_MS;
  const secret = options.secret !== undefined ? options.secret : (process.env.DASHBOARD_SECRET || '');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api', requireSecret(secret));

  app.get('/api/devices', (req, res) => {
    res.json(publicCatalog());
  });

  async function proxy(req, res, next) {
    try {
      const result = await proxyRequest({
        deviceKey: req.params.device,
        endpoint: req.params.endpoint || '',
        method: req.method.toUpperCase(),
        search: queryFrom(req.originalUrl || req.url),
        body: req.body,
        fetchImpl,
        timeoutMs,
      });
      res.status(result.status).json(result.body);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    }
  }

  app.all('/api/:device/:endpoint', proxy);
  app.all('/api/:device', proxy);
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Unknown endpoint' });
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
    console.error(err);
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}

function listen(app, env = process.env) {
  const cfg = bindConfig(env);
  return new Promise((resolve, reject) => {
    const server = app.listen(cfg.port, cfg.host, () => resolve({ server, cfg }));
    server.on('error', reject);
  });
}

function main() {
  let cfg;
  try {
    cfg = bindConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const app = createApp();
  app.listen(cfg.port, cfg.host, () => {
    const auth = cfg.secret ? ' (shared secret required)' : '';
    console.log(`ReefBeat Dashboard running at ${formatOrigin(cfg.host, cfg.port)}${auth}`);
  });
}

if (require.main === module) main();

module.exports = createApp();
module.exports.createApp = createApp;
module.exports.listen = listen;
