const { bindConfig, secretsMatch, bearerToken, formatOrigin } = require('../lib/config');
const { buildDeviceUrl } = require('../lib/proxy');

test('bindConfig defaults to loopback and rejects a LAN bind without a secret', () => {
  expect(bindConfig({}).host).toBe('127.0.0.1');
  expect(bindConfig({ PORT: '0' }).port).toBe(0);
  expect(bindConfig({ HOST: '::1' }).secret).toBe('');
  expect(() => bindConfig({ HOST: '0.0.0.0' })).toThrow(/DASHBOARD_SECRET/);
  expect(bindConfig({ HOST: '0.0.0.0', DASHBOARD_SECRET: 'tank secret' })).toMatchObject({
    host: '0.0.0.0',
    secret: 'tank secret',
  });
  expect(() => bindConfig({ PORT: 'nope' })).toThrow(/PORT/);
});

test('bearer tokens are trimmed and oversized headers are ignored', () => {
  expect(bearerToken('Bearer tank-secret')).toBe('tank-secret');
  expect(bearerToken('bearer  tank secret  ')).toBe('tank secret');
  expect(bearerToken('Basic abc')).toBe('');
  expect(bearerToken(`Bearer ${'x'.repeat(2000)}`)).toBe('');
  expect(secretsMatch('tank-secret', 'tank-secret')).toBe(true);
  expect(secretsMatch('tank-secret', 'other')).toBe(false);
});

test('formatOrigin brackets IPv6 hosts', () => {
  expect(formatOrigin('127.0.0.1', 3000)).toBe('http://127.0.0.1:3000');
  expect(formatOrigin('::1', 3000)).toBe('http://[::1]:3000');
});

test('device URLs keep the device host', () => {
  const url = buildDeviceUrl('172.16.0.21', 'time', '?tz=UTC&offset=1');
  expect(url.href).toBe('http://172.16.0.21/time?tz=UTC&offset=1');
  const tricky = buildDeviceUrl('172.16.0.21', 'mode', ' http://evil.example');
  expect(tricky.hostname).toBe('172.16.0.21');
  expect(tricky.pathname).toBe('/mode');
  expect(tricky.search).not.toContain('@');
});
