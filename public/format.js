// Shared by the page (classic script) and the Node tests (module.exports).

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ReefLED reports next_full_moon as a day count on a 28-day cycle
// (full moon on day 14), not as a calendar day. ISO dates are accepted
// so a date string cannot be concatenated into the label.
function daysUntil(value, now = new Date()) {
  if (value == null || value === '') return '?';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return '?';
    return Math.round(value);
  }
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return n < 0 ? '?' : Math.round(n);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return '?';
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((target - start) / 86400000);
  return diff >= 0 ? diff : '?';
}

// GET /lights stores percent × 100. Posts send the same tenth the slider shows.
function channelPercent(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

function channelValue(raw) {
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.min(100, Math.max(0, n));
  return Math.round(clamped * 10) / 10;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { esc, daysUntil, channelPercent, channelValue };
}
