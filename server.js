const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const devices = require('./devices');

const DEVICE_TIMEOUT_MS = 5000;

async function proxyFetch(url, options = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DEVICE_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, { ...options, signal: ac.signal });
    const text = await upstream.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    return { status: upstream.status, body };
  } finally {
    clearTimeout(timer);
  }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/:device/:endpoint(*)', async (req, res) => {
  const device = devices[req.params.device];
  if (!device) return res.status(404).json({ error: `Unknown device: ${req.params.device}` });
  try {
    const { status, body } = await proxyFetch(`http://${device.ip}/${req.params.endpoint}`);
    res.status(status).json(body);
  } catch (err) {
    res.status(502).json({ error: `Device unreachable: ${err.message}` });
  }
});

app.post('/api/:device/:endpoint(*)', async (req, res) => {
  const device = devices[req.params.device];
  if (!device) return res.status(404).json({ error: `Unknown device: ${req.params.device}` });
  try {
    const { status, body } = await proxyFetch(`http://${device.ip}/${req.params.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.status(status).json(body);
  } catch (err) {
    res.status(502).json({ error: `Device unreachable: ${err.message}` });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`ReefBeat Dashboard running at http://localhost:${PORT}`));
}

module.exports = app;
