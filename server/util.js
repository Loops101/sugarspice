const crypto = require('crypto');

const randomId = (bytes = 8) => crypto.randomBytes(bytes).toString('hex');

class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}
const fail = (status, message, field) => {
  throw new HttpError(status, message, field);
};

// Wrap async route handlers so rejected promises reach the error handler
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Kenyan mobile numbers -> 2547XXXXXXXX / 2541XXXXXXXX, or null when invalid
function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (/^254[71]\d{8}$/.test(digits)) return digits;
  if (/^0[71]\d{8}$/.test(digits)) return '254' + digits.slice(1);
  if (/^[71]\d{8}$/.test(digits)) return '254' + digits;
  return null;
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

// Single-line text: strips control characters, trims, caps length
const cleanStr = (v, max = 200) =>
  String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// Multi-line text: keeps newlines
const cleanText = (v, max = 2000) =>
  String(v == null ? '' : v)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);

// Strict integer parse. Returns null if not an integer in range.
function toInt(v, { min = 0, max = 1e9 } = {}) {
  if (v === '' || v === null || v === undefined || typeof v === 'boolean') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Only allow images we host or https URLs (blocks javascript:, data: etc.)
const isSafeImageUrl = (u) =>
  typeof u === 'string' && u.length < 600 && (/^\/uploads\/[A-Za-z0-9._-]+$/.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u));

const EAT_OFFSET_MS = 3 * 3600 * 1000; // Kenya is UTC+3 all year
const dayKeyEAT = (ms) => new Date(ms + EAT_OFFSET_MS).toISOString().slice(0, 10);

module.exports = {
  randomId, HttpError, fail, ah, normalizePhone, EMAIL_RE, cleanStr, cleanText,
  toInt, safeEqual, isSafeImageUrl, EAT_OFFSET_MS, dayKeyEAT,
};
