const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const auth = require('../auth');
const orders = require('../orders');
const config = require('../config');
const mpesa = require('../mpesa');
const {
  ah, fail, randomId, cleanStr, cleanText, toInt, normalizePhone, isSafeImageUrl, dayKeyEAT, EAT_OFFSET_MS,
} = require('../util');

const router = express.Router();
router.use(auth.requireStaff);
const owner = auth.requireOwner;

const DAY = 24 * 3600 * 1000;

/* ------------------------------ Analytics ------------------------------ */

const isRevenue = (o) => o.paymentStatus === 'paid' && o.status !== orders.STATUS.CANCELLED;

function startOfDayEAT(ms) {
  return Math.floor((ms + EAT_OFFSET_MS) / DAY) * DAY - EAT_OFFSET_MS;
}

function summarize(list) {
  const paid = list.filter(isRevenue);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  return { revenue, orders: paid.length, aov: paid.length ? Math.round(revenue / paid.length) : 0 };
}

router.get('/stats', (req, res) => {
  orders.sweepExpired();
  const full = auth.isOwner(req.user);
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const todayStart = startOfDayEAT(Date.now());
  const from = todayStart - (days - 1) * DAY;
  const prevFrom = from - days * DAY;
  const all = db.data.orders;
  const inRange = all.filter((o) => o.createdAt >= from);
  const prevRange = all.filter((o) => o.createdAt >= prevFrom && o.createdAt < from);

  const cur = summarize(inRange);
  const prev = summarize(prevRange);

  // Daily series (zero-filled)
  const series = [];
  const byDay = new Map();
  for (let i = 0; i < days; i++) {
    const key = dayKeyEAT(from + i * DAY + 12 * 3600 * 1000);
    const row = { date: key, revenue: 0, orders: 0 };
    series.push(row);
    byDay.set(key, row);
  }
  for (const o of inRange) {
    if (!isRevenue(o)) continue;
    const row = byDay.get(dayKeyEAT(o.createdAt));
    if (row) { row.revenue += o.total; row.orders += 1; }
  }
  // Same-length series for the previous period, so the chart can overlay it day by day
  const previousSeries = new Array(days).fill(0);
  for (const o of prevRange) {
    if (!isRevenue(o)) continue;
    const i = Math.floor((startOfDayEAT(o.createdAt) - prevFrom) / DAY);
    if (i >= 0 && i < days) previousSeries[i] += o.total;
  }

  // Top products + categories (paid orders only)
  const prodMap = new Map();
  const catMap = new Map();
  for (const o of inRange.filter(isRevenue)) {
    for (const l of o.items) {
      const p = prodMap.get(l.productId) || { id: l.productId, name: l.name, units: 0, revenue: 0 };
      p.units += l.qty; p.revenue += l.qty * l.price;
      prodMap.set(l.productId, p);
      const prod = orders.findProduct(l.productId);
      const cat = prod ? prod.category : 'Other';
      catMap.set(cat, (catMap.get(cat) || 0) + l.qty * l.price);
    }
  }
  const topProducts = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const categories = [...catMap.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);

  // Payment methods & guest vs account (all non-cancelled orders in range)
  const live = inRange.filter((o) => o.status !== orders.STATUS.CANCELLED);
  const methods = { mpesa: live.filter((o) => o.paymentMethod === 'mpesa').length, cod: live.filter((o) => o.paymentMethod === 'cod').length };
  const channel = { guest: live.filter((o) => !o.userId).length, account: live.filter((o) => o.userId).length };

  const statusCounts = {};
  for (const s of orders.ALL_STATUSES) statusCounts[s] = all.filter((o) => o.status === s).length;

  const threshold = db.data.settings.lowStockThreshold;
  const lowStock = db.data.products
    .filter((p) => p.active && p.stock <= threshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock }));

  const customerKeys = new Set(all.filter((o) => o.createdAt >= from).map((o) => o.customer.phone));
  const earlierKeys = new Set(all.filter((o) => o.createdAt < from).map((o) => o.customer.phone));
  const newCustomers = [...customerKeys].filter((k) => !earlierKeys.has(k)).length;

  const unpaidCodValue = all
    .filter((o) => o.paymentMethod === 'cod' && o.paymentStatus !== 'paid' && o.status !== orders.STATUS.CANCELLED)
    .reduce((s, o) => s + o.total, 0);

  const base = {
    days,
    current: cur,
    previous: prev,
    series,
    previousSeries,
    topProducts,
    categories,
    methods,
    channel,
    statusCounts,
    lowStock,
    newCustomers,
    returningCustomers: customerKeys.size - newCustomers,
    toFulfil: statusCounts[orders.STATUS.NEW] + statusCounts[orders.STATUS.PROCESSING],
    codOutstanding: unpaidCodValue,
    recent: [...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6).map(adminOrder),
    totals: { products: db.data.products.filter((p) => p.active).length, customers: new Set(all.map((o) => o.customer.phone)).size },
    hasDemoData: all.some((o) => o.demo) || db.data.products.some((p) => p.demo),
    mpesaMode: mpesa.mode(),
  };
  if (full) return res.json(base);
  // Staff see the work to do, never sales figures
  res.json({
    limited: true, days, statusCounts: base.statusCounts, toFulfil: base.toFulfil, lowStock: base.lowStock,
    recent: base.recent.map(({ total, ...o }) => o), totals: base.totals,
  });
});

router.post('/demo/clear', owner, (req, res) => {
  require('../seed').clearDemo();
  res.json({ ok: true });
});

/* ------------------------------- Orders -------------------------------- */

const adminOrder = (o) => ({
  id: o.id, number: o.number, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
  items: o.items, subtotal: o.subtotal, discount: o.discount, deliveryFee: o.deliveryFee, total: o.total,
  couponCode: o.couponCode, customer: o.customer, shipping: o.shipping, notes: o.notes,
  receipt: o.payment ? o.payment.receipt : '', demoPayment: !!(o.payment && o.payment.demo) || !!o.demo,
  guest: !o.userId, history: o.history, createdAt: o.createdAt, updatedAt: o.updatedAt,
});

router.get('/orders', (req, res) => {
  orders.sweepExpired();
  const q = cleanStr(req.query.q, 60).toLowerCase();
  const status = req.query.status;
  let list = [...db.data.orders].sort((a, b) => b.createdAt - a.createdAt);
  if (status && orders.ALL_STATUSES.includes(status)) list = list.filter((o) => o.status === status);
  if (q) list = list.filter((o) => o.number.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q.replace(/\D/g, '') || '@@'));
  const page = toInt(req.query.page, { min: 1, max: 10000 }) || 1;
  const per = 25;
  res.json({ total: list.length, page, per, orders: list.slice((page - 1) * per, page * per).map(adminOrder) });
});

router.get('/orders.csv', owner, (req, res) => {
  const esc = (v) => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [['Order', 'Date (EAT)', 'Customer', 'Phone', 'Email', 'Items', 'Subtotal', 'Discount', 'Delivery', 'Total', 'Payment', 'Payment status', 'Status', 'Delivery option', 'Address']];
  for (const o of [...db.data.orders].sort((a, b) => b.createdAt - a.createdAt)) {
    rows.push([
      o.number, new Date(o.createdAt + EAT_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 16), o.customer.name, o.customer.phone, o.customer.email,
      o.items.map((l) => `${l.qty} x ${l.name}`).join('; '), o.subtotal, o.discount, o.deliveryFee, o.total, o.paymentMethod, o.paymentStatus, o.status, o.shipping.zoneName, o.shipping.address,
    ]);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
  res.send('﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'));
});

const getOrder = (id) => {
  const o = db.data.orders.find((x) => x.id === id);
  if (!o) fail(404, 'Order not found.');
  return o;
};

router.patch('/orders/:id', ah((req, res) => {
  const o = getOrder(req.params.id);
  const b = req.body || {};
  const isOwnerUser = auth.isOwner(req.user);
  if (!isOwnerUser) {
    if (b.status === orders.STATUS.CANCELLED && o.paymentStatus === 'paid') fail(403, 'Only the owner can cancel an order that has been paid, because it needs a refund.');
    if (b.markRefunded) fail(403, 'Only the owner can record refunds.');
  }
  const before = o.history.length;
  if (b.status) orders.setStatus(o, b.status);
  if (b.markPaid) {
    if (o.paymentStatus === 'paid') fail(409, 'This order is already marked as paid.');
    if (o.status === orders.STATUS.CANCELLED) fail(409, 'This order is cancelled.');
    if (o.paymentMethod === 'mpesa') {
      orders.markPaid(o, cleanStr(b.receipt, 30).toUpperCase());
    } else {
      o.paymentStatus = 'paid'; o.updatedAt = Date.now();
      o.history.push({ at: Date.now(), text: 'Marked as paid by the shop.' });
      db.save();
    }
  }
  if (b.markRefunded && o.paymentStatus === 'refund_due') {
    o.paymentStatus = 'refunded'; o.updatedAt = Date.now();
    o.history.push({ at: Date.now(), text: 'Refund recorded.' });
    db.save();
  }
  if (typeof b.note === 'string' && b.note.trim()) {
    o.history.push({ at: Date.now(), text: 'Note: ' + cleanText(b.note, 300), internal: true });
    o.updatedAt = Date.now();
    db.save();
  }
  o.history.slice(before).forEach((x) => { x.by = req.user.name; });
  db.save();
  res.json({ order: adminOrder(o) });
}));

/* ------------------------------- Products ------------------------------ */

const adminProduct = (p) => ({ ...p });

function readProduct(b, existing) {
  const name = cleanStr(b.name, 100);
  if (name.length < 2) fail(400, 'Give the product a name.', 'name');
  const category = cleanStr(b.category, 40);
  if (!db.data.settings.categories.includes(category)) fail(400, 'Choose a category from the list.', 'category');
  const price = toInt(b.price, { min: 1, max: 1000000 });
  if (price === null) fail(400, 'Enter the price as a whole number of shillings.', 'price');
  let oldPrice = null;
  if (b.oldPrice !== null && b.oldPrice !== '' && b.oldPrice !== undefined) {
    oldPrice = toInt(b.oldPrice, { min: 1, max: 1000000 });
    if (oldPrice === null || oldPrice <= price) fail(400, 'The old price must be higher than the current price.', 'oldPrice');
  }
  const stock = toInt(b.stock, { min: 0, max: 100000 });
  if (stock === null) fail(400, 'Enter the stock as a whole number.', 'stock');
  const images = (Array.isArray(b.images) ? b.images : []).slice(0, 6).filter(isSafeImageUrl);
  return {
    name, category, price, oldPrice, stock, images,
    description: cleanText(b.description, 1500),
    featured: !!b.featured, bestseller: !!b.bestseller, active: b.active !== false,
    art: existing ? existing.art : (['necklace', 'earrings', 'bracelet', 'ring', 'set', 'chain'].includes(b.art) ? b.art : ''),
  };
}

router.get('/products', (req, res) => res.json({ products: db.data.products.map(adminProduct) }));

router.post('/products', ah((req, res) => {
  const fields = readProduct(req.body || {}, null);
  db.data.counters.product += 1;
  const product = { id: 'spc-' + String(db.data.counters.product).padStart(3, '0') + '-' + randomId(2), createdAt: Date.now(), ...fields };
  db.data.products.push(product);
  db.save();
  res.status(201).json({ product: adminProduct(product) });
}));

router.put('/products/:id', ah((req, res) => {
  const p = db.data.products.find((x) => x.id === req.params.id);
  if (!p) fail(404, 'Product not found.');
  Object.assign(p, readProduct(req.body || {}, p));
  db.save();
  res.json({ product: adminProduct(p) });
}));

router.patch('/products/:id/stock', ah((req, res) => {
  const p = db.data.products.find((x) => x.id === req.params.id);
  if (!p) fail(404, 'Product not found.');
  const stock = toInt((req.body || {}).stock, { min: 0, max: 100000 });
  if (stock === null) fail(400, 'Enter the stock as a whole number.', 'stock');
  p.stock = stock;
  db.save();
  res.json({ product: adminProduct(p) });
}));

router.delete('/products/:id', owner, ah((req, res) => {
  const i = db.data.products.findIndex((x) => x.id === req.params.id);
  if (i < 0) fail(404, 'Product not found.');
  const used = db.data.orders.some((o) => o.items.some((l) => l.productId === req.params.id));
  if (used) {
    db.data.products[i].active = false;
    db.save();
    return res.json({ ok: true, archived: true });
  }
  db.data.products.splice(i, 1);
  db.save();
  res.json({ ok: true, archived: false });
}));

// Image upload: raw bytes in the request body, type verified from the file itself
const MAX_UPLOAD = 5 * 1024 * 1024;
router.post('/upload', express.raw({ type: () => true, limit: MAX_UPLOAD }), ah((req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 12) fail(400, 'No image received.');
  let ext = null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = 'jpg';
  else if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ext = 'png';
  else if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') ext = 'webp';
  if (!ext) fail(400, 'Please upload a JPG, PNG or WebP image.');
  const name = randomId(10) + '.' + ext;
  fs.writeFileSync(path.join(config.UPLOAD_DIR, name), buf);
  res.status(201).json({ url: '/uploads/' + name });
}));

/* ------------------------------- Customers ----------------------------- */

router.get('/customers', (req, res) => {
  const full = auth.isOwner(req.user);
  const map = new Map();
  for (const o of db.data.orders) {
    const key = o.customer.phone;
    const c = map.get(key) || { phone: key, name: o.customer.name, email: o.customer.email, orders: 0, spent: 0, last: 0, hasAccount: false };
    c.orders += 1;
    if (isRevenue(o) && full) c.spent += o.total;
    if (o.createdAt >= c.last) { c.last = o.createdAt; c.name = o.customer.name; if (o.customer.email) c.email = o.customer.email; }
    if (o.userId) c.hasAccount = true;
    map.set(key, c);
  }
  res.json({
    customers: [...map.values()].sort((a, b) => b.last - a.last).map((c) => (full ? c : { ...c, spent: null })),
    accounts: db.data.users.filter((u) => u.role === 'customer').length,
  });
});

/* -------------------------------- Coupons ------------------------------ */

router.get('/coupons', owner, (req, res) => res.json({ coupons: db.data.coupons }));

router.post('/coupons', owner, ah((req, res) => {
  const b = req.body || {};
  const code = cleanStr(b.code, 20).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (code.length < 3) fail(400, 'Use 3 or more letters or numbers for the code.', 'code');
  if (db.data.coupons.some((c) => c.code === code)) fail(409, 'That code already exists.', 'code');
  const type = b.type === 'fixed' ? 'fixed' : 'percent';
  const value = toInt(b.value, { min: 1, max: type === 'percent' ? 90 : 1000000 });
  if (value === null) fail(400, type === 'percent' ? 'Percent must be between 1 and 90.' : 'Enter the amount in shillings.', 'value');
  const minSubtotal = b.minSubtotal ? toInt(b.minSubtotal, { min: 0, max: 1000000 }) : 0;
  const maxUses = b.maxUses ? toInt(b.maxUses, { min: 1, max: 1000000 }) : 0;
  let expiresAt = null;
  if (b.expiresAt) {
    const t = Date.parse(b.expiresAt + 'T23:59:59+03:00');
    if (Number.isNaN(t)) fail(400, 'That expiry date is not valid.', 'expiresAt');
    expiresAt = t;
  }
  const coupon = { code, type, value, minSubtotal: minSubtotal || 0, maxUses: maxUses || 0, used: 0, expiresAt, active: true, createdAt: Date.now() };
  db.data.coupons.push(coupon);
  db.save();
  res.status(201).json({ coupon });
}));

router.patch('/coupons/:code', owner, ah((req, res) => {
  const c = db.data.coupons.find((x) => x.code === req.params.code);
  if (!c) fail(404, 'Coupon not found.');
  c.active = !!(req.body || {}).active;
  db.save();
  res.json({ coupon: c });
}));

router.delete('/coupons/:code', owner, ah((req, res) => {
  const i = db.data.coupons.findIndex((x) => x.code === req.params.code);
  if (i < 0) fail(404, 'Coupon not found.');
  db.data.coupons.splice(i, 1);
  db.save();
  res.json({ ok: true });
}));

/* -------------------------------- Settings ----------------------------- */

router.get('/settings', (req, res) => {
  if (!auth.isOwner(req.user)) return res.json({ settings: { categories: db.data.settings.categories, lowStockThreshold: db.data.settings.lowStockThreshold } });
  res.json({
    settings: db.data.settings,
    mpesa: { mode: mpesa.mode(), env: config.MPESA.env, hasPublicUrl: !!config.PUBLIC_URL },
  });
});

router.put('/settings', owner, ah((req, res) => {
  const b = req.body || {};
  const s = db.data.settings;
  const next = { ...s };
  next.storeName = cleanStr(b.storeName, 80) || s.storeName;
  next.tagline = cleanStr(b.tagline, 120);
  const wa = normalizePhone(b.whatsapp);
  if (!wa) fail(400, 'Enter a valid WhatsApp number.', 'whatsapp');
  next.whatsapp = wa;
  next.phoneDisplay = cleanStr(b.phoneDisplay, 60);
  next.email = cleanStr(b.email, 120);
  next.instagram = cleanStr(b.instagram, 60).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '');
  next.address = cleanStr(b.address, 300);

  const cats = (Array.isArray(b.categories) ? b.categories : []).map((c) => cleanStr(c, 40)).filter(Boolean);
  const uniqueCats = [...new Set(cats)].slice(0, 20);
  if (!uniqueCats.length) fail(400, 'Keep at least one category.', 'categories');
  const stillUsed = db.data.products.filter((p) => !uniqueCats.includes(p.category)).map((p) => p.category);
  if (stillUsed.length) fail(409, `You can't remove "${stillUsed[0]}" while products still use it. Move those products first.`, 'categories');
  next.categories = uniqueCats;

  const zones = (Array.isArray(b.deliveryZones) ? b.deliveryZones : []).slice(0, 15).map((z) => {
    const fee = toInt(z.fee, { min: 0, max: 100000 });
    if (fee === null) fail(400, 'Delivery fees must be whole numbers.', 'deliveryZones');
    const name = cleanStr(z.name, 80);
    if (!name) fail(400, 'Every delivery option needs a name.', 'deliveryZones');
    const id = /^[a-z0-9_-]{2,30}$/.test(z.id || '') ? z.id : 'z-' + randomId(3);
    return { id, name, fee, pickup: !!z.pickup, active: z.active !== false };
  });
  if (!zones.some((z) => z.active)) fail(400, 'Keep at least one active delivery option.', 'deliveryZones');
  next.deliveryZones = zones;

  const fst = toInt(b.freeShippingThreshold || 0, { min: 0, max: 1000000 });
  const lst = toInt(b.lowStockThreshold === undefined ? 3 : b.lowStockThreshold, { min: 0, max: 1000 });
  if (fst === null || lst === null) fail(400, 'Thresholds must be whole numbers.');
  next.freeShippingThreshold = fst;
  next.lowStockThreshold = lst;

  next.payments = { mpesa: !!(b.payments && b.payments.mpesa), cod: !!(b.payments && b.payments.cod) };
  if (!next.payments.mpesa && !next.payments.cod) fail(400, 'Keep at least one payment method on.', 'payments');

  db.data.settings = next;
  db.save();
  res.json({ settings: next });
}));

/* --------------------------------- Team -------------------------------- */
// Owner-only: create and manage employee accounts (role 'staff').

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const teamUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role, disabled: !!u.disabled, createdAt: u.createdAt, lastLogin: u.lastLogin || null });
const getMember = (id) => {
  const u = db.data.users.find((x) => x.id === id && (x.role === 'staff' || x.role === 'admin'));
  if (!u) fail(404, 'Team member not found.');
  return u;
};

router.get('/team', owner, (req, res) => {
  res.json({ team: db.data.users.filter((u) => u.role === 'staff' || u.role === 'admin').map(teamUser) });
});

router.post('/team', owner, ah((req, res) => {
  const b = req.body || {};
  const name = cleanStr(b.name, 80);
  const email = cleanStr(b.email, 120).toLowerCase();
  const phone = b.phone ? normalizePhone(b.phone) : '';
  if (name.length < 2) fail(400, 'Enter the employee\'s name.', 'name');
  if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address.', 'email');
  if (b.phone && !phone) fail(400, 'Enter a valid Kenyan phone number.', 'phone');
  auth.validatePassword(b.password);
  if (db.data.users.some((u) => u.email === email)) fail(409, 'Someone already uses that email.', 'email');
  const user = { id: 'u_' + randomId(6), role: 'staff', name, email, phone, passwordHash: auth.hashPassword(b.password), tokenVersion: 0, createdAt: Date.now(), addresses: [] };
  db.data.users.push(user);
  db.save();
  res.status(201).json({ member: teamUser(user) });
}));

router.patch('/team/:id', owner, ah((req, res) => {
  const u = getMember(req.params.id);
  const b = req.body || {};
  if (u.id === req.user.id && (b.disabled || b.role)) fail(400, 'You cannot lock yourself out.');
  if (u.role === 'admin' && u.id !== req.user.id) fail(403, 'Owner accounts cannot be changed here.');
  if (typeof b.name === 'string') {
    const name = cleanStr(b.name, 80);
    if (name.length < 2) fail(400, 'Enter a name.', 'name');
    u.name = name;
  }
  if (typeof b.disabled === 'boolean') { u.disabled = b.disabled; u.tokenVersion = (u.tokenVersion || 0) + 1; }
  if (b.password) { auth.validatePassword(b.password); u.passwordHash = auth.hashPassword(b.password); u.tokenVersion = (u.tokenVersion || 0) + 1; }
  db.save();
  res.json({ member: teamUser(u) });
}));

router.delete('/team/:id', owner, ah((req, res) => {
  const u = getMember(req.params.id);
  if (u.role !== 'staff') fail(400, 'Only employee accounts can be removed.');
  db.data.users.splice(db.data.users.indexOf(u), 1);
  db.save();
  res.json({ ok: true });
}));

module.exports = router;
