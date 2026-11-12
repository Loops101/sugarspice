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
const SERVERLESS = !!(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = env.DATA_DIR ? path.resolve(env.DATA_DIR) : SERVERLESS ? '/tmp/ssc-data' : path.join(ROOT, 'data');

module.exports = {
  ROOT,
  PORT: parseInt(env.PORT || '3000', 10),
  IS_PROD: env.NODE_ENV === 'production',
  SERVERLESS,
  TRUST_PROXY: env.TRUST_PROXY || SERVERLESS ? 1 : 0,
  DATA_DIR,
  UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
  PUBLIC_DIR: path.join(ROOT, 'public'),
  VIEWS_DIR: path.join(ROOT, 'views'),
  ADMIN_EMAIL: (env.ADMIN_EMAIL || 'admin@sugarspice.local').toLowerCase(),
  ADMIN_PASSWORD: env.ADMIN_PASSWORD || '',
  JWT_SECRET: env.JWT_SECRET || '',
  PUBLIC_URL: (env.PUBLIC_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL : '')).replace(/\/+$/, ''),
  MPESA: {
    env: env.MPESA_ENV === 'production' ? 'production' : 'sandbox',
    consumerKey: env.MPESA_CONSUMER_KEY || '',
    consumerSecret: env.MPESA_CONSUMER_SECRET || '',
    shortcode: env.MPESA_SHORTCODE || '',
    passkey: env.MPESA_PASSKEY || '',
    callbackSecret: env.MPESA_CALLBACK_SECRET || '',
  },
};
