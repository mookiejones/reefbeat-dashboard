const { catalog, isAllowed, publicCatalog } = require('../devices');

test('lists the three known devices', () => {
  expect(Object.keys(catalog)).toEqual(['lights', 'wave', 'ato']);
  expect(catalog.lights.ip).toBe('172.16.0.21');
  expect(catalog.wave.ip).toBe('172.16.0.19');
  expect(catalog.ato.ip).toBe('172.16.0.20');
});

test('allowlist is the only place paths are declared', () => {
  expect(isAllowed('lights', 'DELETE', 'moonphase')).toBe(true);
  expect(isAllowed('lights', 'DELETE', 'acclimation')).toBe(true);
  expect(isAllowed('lights', 'POST', 'manual')).toBe(true);
  expect(isAllowed('lights', 'DELETE', 'mode')).toBe(false);
  expect(isAllowed('wave', 'POST', 'manual')).toBe(false);
  expect(isAllowed('wave', 'DELETE', 'moonphase')).toBe(false);
  expect(isAllowed('ato', 'GET', 'mode')).toBe(true);
  expect(isAllowed('unknown', 'GET', 'mode')).toBe(false);
});

test('public catalog exposes reads and not the write methods', () => {
  const published = publicCatalog();
  expect(published.lights.reads).toEqual(catalog.lights.allow.GET);
  expect(published.lights.reads).toContain('lights');
  expect(published.wave.allow).toBeUndefined();
  expect(published.ato.ip).toBe(catalog.ato.ip);
});
