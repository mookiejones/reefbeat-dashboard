const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const devices = require('./devices');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
  app.listen(PORT, () => console.log(`ReefBeat Dashboard running at http://localhost:${PORT}`));
}

module.exports = app;
