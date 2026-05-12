const devices = require('../devices');

test('exports an object with lights, wave, and ato keys', () => {
  expect(devices).toHaveProperty('lights');
  expect(devices).toHaveProperty('wave');
  expect(devices).toHaveProperty('ato');
});

test('each device has ip, name, icon, and model fields', () => {
  for (const key of ['lights', 'wave', 'ato']) {
    expect(devices[key]).toHaveProperty('ip');
    expect(devices[key]).toHaveProperty('name');
    expect(devices[key]).toHaveProperty('icon');
    expect(devices[key]).toHaveProperty('model');
  }
});

test('device IPs match known values', () => {
  expect(devices.lights.ip).toBe('172.16.0.21');
  expect(devices.wave.ip).toBe('172.16.0.19');
  expect(devices.ato.ip).toBe('172.16.0.20');
});
