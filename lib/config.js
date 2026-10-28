'use strict';

const crypto = require('crypto');

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function isLoopback(host) {
  const normalized = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  return LOOPBACK_HOSTS.has(normalized);
}

function bindConfig(env = process.env) {
  const host = env.HOST || '127.0.0.1';
  const rawPort = env.PORT === undefined || env.PORT === '' ? '3000' : String(env.PORT);
  const port = Number(rawPort);
  const secret = env.DASHBOARD_SECRET || '';
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer from 0 to 65535');
  }
  if (!isLoopback(host) && !secret) {
    throw new Error('DASHBOARD_SECRET is required when HOST is not a loopback address');
  }
  return { host, port, secret };
}

function secretsMatch(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided), 'utf8').digest();
  const b = crypto.createHash('sha256').update(String(expected), 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

function bearerToken(header) {
  if (!header || header.length > 1024) return '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : '';
}

function formatOrigin(host, port) {
  const display = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `http://${display}:${port}`;
}

function requireSecret(secret) {
  return function auth(req, res, next) {
    if (!secret) return next();
    const token = bearerToken(req.get('authorization') || '');
    if (!token || !secretsMatch(token, secret)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  };
}

module.exports = {
  isLoopback,
  bindConfig,
  secretsMatch,
  bearerToken,
  formatOrigin,
  requireSecret,
};
