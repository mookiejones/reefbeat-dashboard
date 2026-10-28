'use strict';

const { catalog, isAllowed } = require('../devices');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function queryFrom(url) {
  const text = String(url || '');
  const index = text.indexOf('?');
  return index === -1 ? '' : text.slice(index);
}

function buildDeviceUrl(ip, endpoint, search) {
  const url = new URL(`http://${ip}/`);
  url.pathname = endpoint ? `/${endpoint}` : '/';
  if (search) url.search = search;
  if (url.hostname !== ip || url.protocol !== 'http:') {
    throw new HttpError(400, 'Invalid query');
  }
  return url;
}

function isDeviceFailure(err) {
  if (!err) return false;
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
  const code = err.code || err.cause?.code;
  if (typeof code === 'string' && /^(ECONN|EHOST|ENET|EAI_|UND_ERR_)/.test(code)) return true;
  return typeof err.message === 'string' && /ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|fetch failed/i.test(err.message);
}

function parseBody(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function cancelBody(upstream) {
  if (upstream.body && typeof upstream.body.cancel === 'function') {
    await upstream.body.cancel();
  }
}

async function proxyRequest({ deviceKey, endpoint, method, search, body, fetchImpl, timeoutMs }) {
  const device = catalog[deviceKey];
  if (!device) throw new HttpError(404, `Unknown device: ${deviceKey}`);
  if (!isAllowed(deviceKey, method, endpoint)) throw new HttpError(404, 'Unknown endpoint');

  const url = buildDeviceUrl(device.ip, endpoint, search);
  const init = {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body ?? {});
  }

  let upstream;
  try {
    upstream = await fetchImpl(url, init);
  } catch (err) {
    if (isDeviceFailure(err)) throw new HttpError(502, 'Device unreachable');
    throw err;
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    await cancelBody(upstream);
    throw new HttpError(502, 'Upstream redirect refused');
  }

  const text = await upstream.text();
  return { status: upstream.status, body: parseBody(text) };
}

module.exports = {
  HttpError,
  queryFrom,
  buildDeviceUrl,
  isDeviceFailure,
  proxyRequest,
};
