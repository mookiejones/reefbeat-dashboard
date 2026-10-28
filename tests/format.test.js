const { esc, daysUntil, channelPercent, channelValue } = require('../public/format');

test('escapes the characters that break HTML', () => {
  expect(esc(`<img src=x onerror="alert('x')">`)).toBe(
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;'
  );
  expect(esc(0)).toBe('0');
  expect(esc(null)).toBe('');
});

test('daysUntil keeps a device day-count and parses calendar dates', () => {
  expect(daysUntil(0)).toBe(0);
  expect(daysUntil(14)).toBe(14);
  expect(daysUntil('14')).toBe(14);
  expect(daysUntil(-3)).toBe('?');
  expect(daysUntil('<script>')).toBe('?');
  expect(daysUntil('2026-11-02', new Date(2026, 9, 28))).toBe(5);
  expect(daysUntil('2026-10-01', new Date(2026, 9, 28))).toBe('?');
});

test('channel values round-trip at one decimal', () => {
  expect(channelPercent(8850)).toBe(88.5);
  expect(channelPercent('nope')).toBe(0);
  expect(channelValue(88.5)).toBe(88.5);
  expect(channelValue('88.54')).toBe(88.5);
  expect(channelValue(150)).toBe(100);
  expect(channelValue(-4)).toBe(0);
});
