const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const orders = require('../orders');
const mpesa = require('../mpesa');
const config = require('../config');
const { ah, fail, safeEqual, normalizePhone, cleanStr } = require('../util');

const router = express.Router();

const checkoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });
const lookupLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });

const publicProduct = (p) => ({
  id: p.id, name: p.name, category: p.category, price: p.price, oldPrice: p.oldPrice || null,
  description: p.description, images: p.images || [], art: p.art || '', featured: !!p.featured,
  bestseller: !!p.bestseller, stock: p.stock, createdAt: p.createdAt,
});

router.get('/store', (req, res) => {
  const s = db.data.settings;
  res.json({
    name: s.storeName, tagline: s.tagline, whatsapp: s.whatsapp, phone: s.phoneDisplay, email: s.email,
    instagram: s.instagram, address: s.address, categories: s.categories,
    deliveryZones: s.deliveryZones.filter((z) => z.active).map((z) => ({ id: z.id, name: z.name, fee: z.fee, pickup: !!z.pickup })),
    freeShippingThreshold: s.freeShippingThreshold,
    lowStockThreshold: s.lowStockThreshold,
    payments: { mpesa: !!s.payments.mpesa, cod: !!s.payments.cod },
    mpesaMode: mpesa.mode(),
  });
});

router.get('/products', (req, res) => {
  res.json({ products: db.data.products.filter((p) => p.active).map(publicProduct) });
});

router.get('/products/:id', (req, res) => {
  const p = db.data.products.find((x) => x.id === req.params.id && x.active);
  if (!p) fail(404, 'We could not find that piece.');
  res.json({ product: publicProduct(p) });
});

// Live totals for the cart / checkout summary
router.post('/quote', ah((req, res) => {
  const b = req.body || {};
  const q = orders.quote({ items: b.items, zoneId: b.zoneId, couponCode: b.couponCode });
  res.json({
    lines: q.lines, subtotal: q.subtotal, discount: q.discount, delivery: q.delivery, total: q.total,
    couponApplied: q.coupon ? q.coupon.code : '', couponError: b.couponCode ? q.couponError : null,
  });
}));

// Guest-first checkout: works with or without a signed-in user
router.post('/orders', checkoutLimiter, ah(async (req, res) => {
  // A retry of the same checkout (flaky connection, double tap) returns the order already made
  const rid = cleanStr((req.body || {}).requestId, 40);
  if (rid) {
    const existing = db.data.orders.find((o) => o.requestId === rid && Date.now() - o.createdAt < 30 * 60 * 1000);
    if (existing) return res.status(200).json({ order: orders.publicOrder(existing), payment: existing.payment ? { sent: !!existing.payment.checkoutRequestId } : null });
  }
  const order = orders.createOrder(req.body || {}, req.user);
  let payment = null;
  if (order.paymentMethod === 'mpesa') payment = await orders.startPayment(order);
  res.status(201).json({ order: orders.publicOrder(order), payment });
}));

// Customer polls this while waiting for the M-Pesa PIN prompt
router.get('/orders/:number/status', ah((req, res) => {
  const order = findOwnOrder(req, req.params.number, req.query.token);
  orders.refreshPayment(order);
  res.json({ order: orders.publicOrder(order) });
}));

router.post('/orders/:number/retry-payment', checkoutLimiter, ah(async (req, res) => {
  const order = findOwnOrder(req, req.params.number, (req.body || {}).token);
  if (order.paymentMethod !== 'mpesa' || order.status !== orders.STATUS.AWAITING) fail(409, 'This order is not waiting for payment.');
  orders.refreshPayment(order);
  if (order.status !== orders.STATUS.AWAITING) fail(409, 'This order has expired. Please place a new order.');
  let phone = null;
  if (req.body && req.body.mpesaPhone) {
    phone = normalizePhone(req.body.mpesaPhone);
    if (!phone) fail(400, 'Enter a valid M-Pesa number.', 'mpesaPhone');
  }
  const payment = await orders.startPayment(order, phone);
  res.json({ order: orders.publicOrder(order), payment });
}));

// Guests can find an order with number + phone; no account needed
router.post('/orders/lookup', lookupLimiter, ah((req, res) => {
  const number = cleanStr((req.body || {}).number, 20).toUpperCase().replace(/^#/, '');
  const phone = normalizePhone((req.body || {}).phone);
  const order = db.data.orders.find((o) => o.number === number && phone && o.customer.phone === phone);
  if (!order) fail(404, 'We could not find an order with those details. Check the order number and the phone number you used.');
  orders.refreshPayment(order);
  res.json({ order: orders.publicOrder(order) });
}));

function findOwnOrder(req, number, token) {
  const order = db.data.orders.find((o) => o.number === String(number).toUpperCase());
  const byToken = order && token && safeEqual(order.trackingToken, token);
  const byUser = order && req.user && order.userId === req.user.id;
  if (!order || !(byToken || byUser)) fail(404, 'Order not found.');
  return order;
}

// Safaricom posts payment results here. The secret in the path keeps strangers out.
router.post('/payments/mpesa/callback/:secret', (req, res) => {
  const secret = config.MPESA.callbackSecret;
  if (!secret || !safeEqual(req.params.secret, secret)) return res.status(404).end();
  const result = mpesa.parseCallback(req.body);
  if (result) {
    const order = db.data.orders.find((o) => o.payment && o.payment.checkoutRequestId === result.checkoutRequestId);
    if (order && order.status === orders.STATUS.AWAITING) {
      if (result.success && result.amount !== undefined && Number(result.amount) < order.total) {
        orders.markPaymentFailed(order, 'Amount paid did not match the order total.');
      } else if (result.success) {
        orders.markPaid(order, result.receipt);
      } else {
        orders.markPaymentFailed(order, result.resultDesc);
      }
    }
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = router;
