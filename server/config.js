const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Minimal .env loader (no dependency needed)
(function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
})();

const env = process.env;
const DATA_DIR = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(ROOT, 'data');

module.exports = {
  ROOT,
  PORT: parseInt(env.PORT || '3000', 10),
  IS_PROD: env.NODE_ENV === 'production',
  TRUST_PROXY: env.TRUST_PROXY ? 1 : 0,
  DATA_DIR,
  UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
  PUBLIC_DIR: path.join(ROOT, 'public'),
  ADMIN_EMAIL: (env.ADMIN_EMAIL || 'admin@sugarspice.local').toLowerCase(),
  ADMIN_PASSWORD: env.ADMIN_PASSWORD || '',
  JWT_SECRET: env.JWT_SECRET || '',
  PUBLIC_URL: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
  MPESA: {
    env: env.MPESA_ENV === 'production' ? 'production' : 'sandbox',
    consumerKey: env.MPESA_CONSUMER_KEY || '',
    consumerSecret: env.MPESA_CONSUMER_SECRET || '',
    shortcode: env.MPESA_SHORTCODE || '',
    passkey: env.MPESA_PASSKEY || '',
    callbackSecret: env.MPESA_CALLBACK_SECRET || '',
  },
};
