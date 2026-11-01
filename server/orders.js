/**
 * Order engine. All money maths happens here, on the server, from the product
 * database. The browser only ever sends product ids and quantities.
 * Every function is synchronous, so stock cannot be oversold by concurrent requests.
 */
const db = require('./db');
const mpesa = require('./mpesa');
const { fail, randomId, normalizePhone, EMAIL_RE, cleanStr, cleanText, toInt } = require('./util');

const PAYMENT_WINDOW_MS = 15 * 60 * 1000;
const DEMO_PAY_DELAY_MS = 6000;

const STATUS = {
  AWAITING: 'awaiting_payment',
  NEW: 'new',
  PROCESSING: 'processing',
  OUT: 'out_for_delivery',
  DONE: 'completed',
  CANCELLED: 'cancelled',
};
const ALL_STATUSES = Object.values(STATUS);

const findProduct = (id) => db.data.products.find((p) => p.id === id);
const findCoupon = (code) => db.data.coupons.find((c) => c.code === String(code || '').trim().toUpperCase());

function checkCoupon(coupon, subtotal) {
  if (!coupon || !coupon.active) return 'That code is not valid.';
  if (coupon.expiresAt && Date.now() > coupon.expiresAt) return 'That code has expired.';
  if (coupon.maxUses && coupon.used >= coupon.maxUses) return 'That code has been fully used.';
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) return `Spend KSh ${coupon.minSubtotal.toLocaleString('en-KE')} or more to use this code.`;
  return null;
}

/** Validates the cart and returns priced lines. Throws friendly errors. */
function priceItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) fail(400, 'Your cart is empty.');
  if (rawItems.length > 30) fail(400, 'Too many different items in one order.');
  const merged = new Map();
  for (const raw of rawItems) {
    const qty = toInt(raw && raw.qty, { min: 1, max: 20 });
    if (!raw || typeof raw.id !== 'string' || qty === null) fail(400, 'One of the items in your cart is invalid.');
    merged.set(raw.id, (merged.get(raw.id) || 0) + qty);
  }
  const lines = [];
  for (const [id, qty] of merged) {
    const p = findProduct(id);
    if (!p || !p.active) fail(409, 'An item in your cart is no longer available. Please review your cart.');
    if (p.stock < qty) {
      fail(409, p.stock <= 0 ? `Sorry, "${p.name}" just sold out.` : `Only ${p.stock} of "${p.name}" left in stock.`);
    }
    lines.push({ productId: p.id, name: p.name, price: p.price, qty, image: (p.images && p.images[0]) || '', art: p.art || '' });
  }
  return lines;
}

function resolveZone(zoneId) {
  const zone = db.data.settings.deliveryZones.find((z) => z.id === zoneId && z.active);
  if (!zone) fail(400, 'Please choose a delivery option.', 'zone');
  return zone;
}

/** Totals for a cart. Used by both the live quote and order creation. */
function quote({ items, zoneId, couponCode }) {
  const lines = priceItems(items);
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  let discount = 0;
  let coupon = null;
  let couponError = null;
  if (couponCode) {
    coupon = findCoupon(couponCode);
    couponError = checkCoupon(coupon, subtotal);
    if (couponError) coupon = null;
    else discount = Math.min(subtotal, coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value);
  }
  let delivery = 0;
  let zone = null;
  if (zoneId) {
    zone = resolveZone(zoneId);
    delivery = zone.fee;
    const threshold = db.data.settings.freeShippingThreshold;
    if (threshold > 0 && subtotal - discount >= threshold && !zone.pickup) delivery = 0;
  }
  return { lines, subtotal, discount, delivery, total: subtotal - discount + delivery, coupon, couponError, zone };
}

function logHistory(order, text) {
  order.history.push({ at: Date.now(), text });
}

function restock(order) {
  if (order.restocked) return;
  for (const l of order.items) {
    const p = findProduct(l.productId);
    if (p) p.stock += l.qty;
  }
  order.restocked = true;
}

function releaseCoupon(order) {
  if (!order.couponCode || order.couponReleased) return;
  const c = findCoupon(order.couponCode);
  if (c && c.used > 0) c.used -= 1;
  order.couponReleased = true;
}

function createOrder(body, user) {
  const method = body.paymentMethod;
  const s = db.data.settings;
  if (!['mpesa', 'cod'].includes(method) || !s.payments[method]) fail(400, 'Please choose a payment method.', 'paymentMethod');

  const name = cleanStr(body.name, 80);
  if (name.length < 2) fail(400, 'Please enter your name.', 'name');
  const phone = normalizePhone(body.phone);
  if (!phone) fail(400, 'Enter a valid Kenyan phone number, e.g. 0712 345 678.', 'phone');
  const email = cleanStr(body.email, 120).toLowerCase();
  if (email && !EMAIL_RE.test(email)) fail(400, 'That email address does not look right.', 'email');

  const q = quote({ items: body.items, zoneId: body.zoneId, couponCode: body.couponCode });
  if (!q.zone) fail(400, 'Please choose a delivery option.', 'zone');
  if (body.couponCode && q.couponError) fail(400, q.couponError, 'coupon');

  const address = cleanStr(body.address, 300);
  if (!q.zone.pickup && address.length < 5) fail(400, 'Please enter your delivery address or area.', 'address');

  let payPhone = phone;
  if (method === 'mpesa' && body.mpesaPhone) {
    payPhone = normalizePhone(body.mpesaPhone);
    if (!payPhone) fail(400, 'Enter a valid M-Pesa number.', 'mpesaPhone');
  }
  if (method === 'cod' && q.total > 50000) fail(400, 'Orders above KSh 50,000 must be paid with M-Pesa.', 'paymentMethod');

  // Everything validated: from here on we mutate state
  const now = Date.now();
  db.data.counters.order += 1;
  const order = {
    id: 'o_' + randomId(6),
    requestId: cleanStr(body.requestId, 40),
    number: 'SSC-' + db.data.counters.order,
    trackingToken: randomId(10),
    userId: user ? user.id : null,
    status: method === 'mpesa' ? STATUS.AWAITING : STATUS.NEW,
    paymentMethod: method,
    paymentStatus: 'unpaid',
    items: q.lines,
    subtotal: q.subtotal,
    discount: q.discount,
    deliveryFee: q.delivery,
    total: q.total,
    couponCode: q.coupon ? q.coupon.code : '',
    customer: { name, phone, email },
    shipping: { zoneId: q.zone.id, zoneName: q.zone.name, pickup: !!q.zone.pickup, address: q.zone.pickup ? '' : address },
    notes: cleanText(body.notes, 500),
    payment: method === 'mpesa' ? { phone: payPhone, checkoutRequestId: '', receipt: '', demo: false, initiatedAt: 0, failReason: '' } : null,
    restocked: false,
    couponReleased: false,
    createdAt: now,
    updatedAt: now,
    history: [],
  };
  logHistory(order, method === 'mpesa' ? 'Order placed. Waiting for M-Pesa payment.' : 'Order placed. Pay on delivery or pickup.');

  for (const l of order.items) findProduct(l.productId).stock -= l.qty;
  if (q.coupon) q.coupon.used += 1;
  db.data.orders.push(order);
  db.save();
  return order;
}

/** Fire the STK prompt for an order. Failure leaves the order awaiting so the customer can retry. */
async function startPayment(order, overridePhone) {
  const phone = overridePhone || order.payment.phone;
  try {
    const r = await mpesa.stkPush({ phone, amount: order.total, reference: order.number, description: 'Jewelry' });
    order.payment.phone = phone;
    order.payment.checkoutRequestId = r.checkoutRequestId;
    order.payment.demo = !!r.demo;
    order.payment.initiatedAt = Date.now();
    order.payment.failReason = '';
    logHistory(order, `M-Pesa prompt sent to ${phone.slice(0, 5)}***${phone.slice(-2)}.`);
    db.save();
    return { sent: true };
  } catch (err) {
    order.payment.failReason = err.message || 'Could not send the M-Pesa prompt.';
    logHistory(order, 'Could not send the M-Pesa prompt.');
    db.save();
    return { sent: false, error: order.payment.failReason };
  }
}

function markPaid(order, receipt) {
  if (order.paymentStatus === 'paid') return;
  order.paymentStatus = 'paid';
  order.payment.receipt = receipt || '';
  if (order.status === STATUS.AWAITING) order.status = STATUS.NEW;
  order.updatedAt = Date.now();
  logHistory(order, `Payment received${receipt ? ' (' + receipt + ')' : ''}.`);
  db.save();
}

function markPaymentFailed(order, reason) {
  if (order.paymentStatus === 'paid') return;
  order.payment.failReason = reason || 'Payment was not completed.';
  order.payment.checkoutRequestId = '';
  order.updatedAt = Date.now();
  logHistory(order, 'Payment not completed: ' + order.payment.failReason);
  db.save();
}

function cancelOrder(order, reason) {
  if (order.status === STATUS.CANCELLED) return;
  order.status = STATUS.CANCELLED;
  restock(order);
  releaseCoupon(order);
  if (order.paymentStatus === 'paid') order.paymentStatus = 'refund_due';
  order.updatedAt = Date.now();
  logHistory(order, reason || 'Order cancelled.');
  db.save();
}

function setStatus(order, status, actorNote) {
  if (!ALL_STATUSES.includes(status)) fail(400, 'Unknown status.');
  if (status === order.status) return;
  if (status === STATUS.CANCELLED) return cancelOrder(order, actorNote || 'Order cancelled by the shop.');
  if (order.status === STATUS.CANCELLED) fail(409, 'Cancelled orders cannot be reopened. Ask the customer to place a new order.');
  if (status !== STATUS.AWAITING && order.paymentMethod === 'mpesa' && order.paymentStatus !== 'paid') {
    fail(409, 'This M-Pesa order has not been paid yet.');
  }
  order.status = status;
  if (status === STATUS.DONE && order.paymentMethod === 'cod') order.paymentStatus = 'paid';
  order.updatedAt = Date.now();
  logHistory(order, actorNote || `Status changed to ${status.replace(/_/g, ' ')}.`);
  db.save();
}

/** Resolves demo payments lazily and expires unpaid M-Pesa orders. */
function refreshPayment(order) {
  if (order.status !== STATUS.AWAITING) return;
  const pay = order.payment;
  if (pay && pay.demo && pay.checkoutRequestId && Date.now() - pay.initiatedAt >= DEMO_PAY_DELAY_MS) {
    markPaid(order, 'DEMO' + order.number.replace(/\D/g, ''));
    return;
  }
  if (Date.now() - order.createdAt > PAYMENT_WINDOW_MS) cancelOrder(order, 'Cancelled: payment was not received in time.');
}

function sweepExpired() {
  for (const o of db.data.orders) if (o.status === STATUS.AWAITING) refreshPayment(o);
}

/** What a customer (guest or signed-in) may see about their own order. */
function publicOrder(o) {
  return {
    number: o.number,
    token: o.trackingToken,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    items: o.items.map((l) => ({ productId: l.productId, name: l.name, price: l.price, qty: l.qty, image: l.image, art: l.art })),
    subtotal: o.subtotal,
    discount: o.discount,
    deliveryFee: o.deliveryFee,
    total: o.total,
    customerName: o.customer.name,
    shipping: o.shipping,
    receipt: o.payment ? o.payment.receipt : '',
    payFailReason: o.payment ? o.payment.failReason : '',
    awaitingPrompt: !!(o.payment && o.status === STATUS.AWAITING && o.payment.checkoutRequestId),
    demoPayment: !!(o.payment && o.payment.demo),
    expiresAt: o.status === STATUS.AWAITING ? o.createdAt + PAYMENT_WINDOW_MS : null,
    history: o.history.filter((h) => !h.internal).map((h) => ({ at: h.at, text: h.text })),
    createdAt: o.createdAt,
  };
}

module.exports = {
  STATUS, ALL_STATUSES, PAYMENT_WINDOW_MS, findProduct, findCoupon, checkCoupon, quote, createOrder,
  startPayment, markPaid, markPaymentFailed, cancelOrder, setStatus, refreshPayment, sweepExpired, publicOrder,
};
