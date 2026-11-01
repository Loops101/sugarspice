const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');
const db = require('./db');
const { fail, randomId } = require('./util');

// Signing secret: env var, else generated once and kept in the data folder
function getSecret() {
  if (config.JWT_SECRET) return config.JWT_SECRET;
  const file = path.join(config.DATA_DIR, 'secret.key');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const s = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(config.DATA_DIR, { recursive: true });
    fs.writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}
const SECRET = getSecret();

const COOKIE = 'ssc_token';
const MAX_AGE_MS = 14 * 24 * 3600 * 1000;

function issue(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.tokenVersion || 0 }, SECRET, { expiresIn: '14d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.IS_PROD,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

const clear = (res) => res.clearCookie(COOKIE, { path: '/' });

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Attaches req.user when a valid session cookie is present. Never blocks guests.
function attachUser(req, _res, next) {
  req.user = null;
  const token = readCookie(req);
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET);
      const user = db.data.users.find((u) => u.id === payload.sub);
      if (user && !user.disabled && (user.tokenVersion || 0) === payload.v) req.user = user;
    } catch { /* invalid or expired: treat as guest */ }
  }
  next();
}

const requireUser = (req, _res, next) => (req.user ? next() : next(Object.assign(new Error('Please sign in.'), { status: 401 })));
// Roles: 'admin' is the shop owner (everything), 'staff' is an employee (day-to-day work only), 'customer' has no back-office access.
const isOwner = (u) => !!u && u.role === 'admin';
const isStaff = (u) => !!u && (u.role === 'admin' || u.role === 'staff');
const deny = (req, msg) => (req.user ? Object.assign(new Error(msg), { status: 403 }) : Object.assign(new Error('Please sign in.'), { status: 401 }));
const requireStaff = (req, _res, next) => (isStaff(req.user) ? next() : next(deny(req, 'This area is for shop staff.')));
const requireOwner = (req, _res, next) => (isOwner(req.user) ? next() : next(deny(req, 'Only the shop owner can do this.')));
const requireAdmin = requireOwner;

// CSRF defence for cookie auth: state-changing requests must come from our own origin
function sameOrigin(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === req.headers.host; } catch { /* ignore */ }
    if (!ok) return next(Object.assign(new Error('Cross-origin request blocked.'), { status: 403 }));
  }
  next();
}

const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
const checkPassword = (pw, hash) => bcrypt.compareSync(pw, hash);

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) fail(400, 'Password must be at least 8 characters.', 'password');
  if (pw.length > 100) fail(400, 'Password is too long.', 'password');
}

// Create the first admin on first run
function ensureAdmin() {
  if (db.data.users.some((u) => u.role === 'admin')) return null;
  const password = config.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  db.data.users.push({
    id: 'u_' + randomId(6),
    role: 'admin',
    name: 'Store Admin',
    email: config.ADMIN_EMAIL,
    phone: '',
    passwordHash: hashPassword(password),
    tokenVersion: 0,
    createdAt: Date.now(),
    addresses: [],
  });
  db.save();
  return { email: config.ADMIN_EMAIL, password, generated: !config.ADMIN_PASSWORD };
}

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role, addresses: u.addresses || [],
});

module.exports = {
  issue, clear, attachUser, requireUser, requireAdmin, requireStaff, requireOwner, isOwner, isStaff, sameOrigin,
  hashPassword, checkPassword, validatePassword, ensureAdmin, publicUser,
};
