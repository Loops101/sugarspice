const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const auth = require('../auth');
const orders = require('../orders');
const { ah, fail, randomId, normalizePhone, EMAIL_RE, cleanStr, safeEqual } = require('../util');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

// Pre-computed so unknown emails take the same time as wrong passwords
const DUMMY_HASH = auth.hashPassword('not-a-real-password');

router.post('/auth/register', authLimiter, ah((req, res) => {
  const b = req.body || {};
  const name = cleanStr(b.name, 80);
  const email = cleanStr(b.email, 120).toLowerCase();
  const phone = b.phone ? normalizePhone(b.phone) : '';
  if (name.length < 2) fail(400, 'Please enter your name.', 'name');
  if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address.', 'email');
  if (b.phone && !phone) fail(400, 'Enter a valid Kenyan phone number.', 'phone');
  auth.validatePassword(b.password);
  if (db.data.users.some((u) => u.email === email)) fail(409, 'An account with that email already exists. Try signing in.', 'email');

  const user = {
    id: 'u_' + randomId(6), role: 'customer', name, email, phone: phone || '',
    passwordHash: auth.hashPassword(b.password), tokenVersion: 0, createdAt: Date.now(), addresses: [],
  };
  db.data.users.push(user);
  db.save();
  auth.issue(res, user);
  res.status(201).json({ user: auth.publicUser(user) });
}));

router.post('/auth/login', authLimiter, ah((req, res) => {
  const email = cleanStr((req.body || {}).email, 120).toLowerCase();
  const password = String((req.body || {}).password || '');
  const user = db.data.users.find((u) => u.email === email);
  const ok = auth.checkPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok || user.disabled) fail(401, 'Email or password is incorrect.');
  user.lastLogin = Date.now();
  db.save();
  auth.issue(res, user);
  res.json({ user: auth.publicUser(user) });
}));

router.post('/auth/logout', (req, res) => {
  auth.clear(res);
  res.json({ ok: true });
});

router.get('/auth/me', (req, res) => {
  res.json({ user: req.user ? auth.publicUser(req.user) : null });
});

router.patch('/account', auth.requireUser, ah((req, res) => {
  const b = req.body || {};
  const u = req.user;
  if (b.name !== undefined) {
    const name = cleanStr(b.name, 80);
    if (name.length < 2) fail(400, 'Please enter your name.', 'name');
    u.name = name;
  }
  if (b.phone !== undefined) {
    if (b.phone === '') u.phone = '';
    else {
      const phone = normalizePhone(b.phone);
      if (!phone) fail(400, 'Enter a valid Kenyan phone number.', 'phone');
      u.phone = phone;
    }
  }
  if (Array.isArray(b.addresses)) {
    u.addresses = b.addresses.slice(0, 5).map((a) => ({ label: cleanStr(a.label, 30), address: cleanStr(a.address, 300) })).filter((a) => a.address);
  }
  db.save();
  res.json({ user: auth.publicUser(u) });
}));

router.post('/account/password', authLimiter, auth.requireUser, ah((req, res) => {
  const b = req.body || {};
  if (!auth.checkPassword(String(b.current || ''), req.user.passwordHash)) fail(400, 'Your current password is incorrect.', 'current');
  auth.validatePassword(b.next);
  req.user.passwordHash = auth.hashPassword(b.next);
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1; // signs out other devices
  db.save();
  auth.issue(res, req.user);
  res.json({ ok: true });
}));

router.get('/account/orders', auth.requireUser, (req, res) => {
  const mine = db.data.orders.filter((o) => o.userId === req.user.id).sort((a, b) => b.createdAt - a.createdAt);
  mine.forEach(orders.refreshPayment);
  res.json({ orders: mine.map(orders.publicOrder) });
});

// Attach an earlier guest order to this account (needs the order number + phone used)
router.post('/account/claim', authLimiter, auth.requireUser, ah((req, res) => {
  const b = req.body || {};
  const number = cleanStr(b.number, 20).toUpperCase().replace(/^#/, '');
  const phone = normalizePhone(b.phone);
  const token = typeof b.token === 'string' ? b.token : '';
  const order = db.data.orders.find((o) => o.number === number && ((phone && o.customer.phone === phone) || (token && safeEqual(o.trackingToken, token))));
  if (!order) fail(404, 'We could not find an order with those details.');
  if (order.userId && order.userId !== req.user.id) fail(409, 'That order already belongs to another account.');
  order.userId = req.user.id;
  db.save();
  res.json({ order: orders.publicOrder(order) });
}));

module.exports = router;
