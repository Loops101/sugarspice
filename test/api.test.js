// End-to-end API checks. Run the server first (see README), then: node test/api.test.js
const BASE = process.env.BASE || 'http://localhost:3111';
let pass = 0, failN = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { failN++; console.log('  FAIL ' + label + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
};

class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : (typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)),
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const guest = new Client();
  const admin = new Client();
  const user = new Client();

  console.log('Catalogue');
  let r = await guest.call('GET', '/api/products');
  ok(r.status === 200 && r.json.products.length >= 10, 'products list', r.status);
  const products = r.json.products;
  const sold = products.find((p) => p.stock === 0);
  const normal = products.find((p) => p.stock > 5 && p.price === 1500 && p.category === 'Necklaces') || products.find((p) => p.stock > 5);
  r = await guest.call('GET', '/api/products/nope');
  ok(r.status === 404, 'unknown product -> 404');

  console.log('Quote / validation');
  r = await guest.call('POST', '/api/quote', { items: [{ id: normal.id, qty: 2 }], zoneId: 'nairobi' });
  ok(r.json.subtotal === normal.price * 2 && r.json.delivery === 250 && r.json.total === normal.price * 2 + 250, 'quote totals computed server-side', r.json);
  r = await guest.call('POST', '/api/quote', { items: [{ id: normal.id, qty: 1, price: 1 }], zoneId: 'pickup' });
  ok(r.json.subtotal === normal.price, 'client-sent price is ignored');
  r = await guest.call('POST', '/api/quote', { items: [{ id: sold.id, qty: 1 }] });
  ok(r.status === 409, 'sold-out item rejected', r.json);
  r = await guest.call('POST', '/api/quote', { items: [{ id: normal.id, qty: -1 }] });
  ok(r.status === 400, 'negative qty rejected');
  r = await guest.call('POST', '/api/quote', { items: [{ id: normal.id, qty: 1.5 }] });
  ok(r.status === 400, 'fractional qty rejected');
  r = await guest.call('POST', '/api/quote', { items: [{ id: normal.id, qty: 1 }], zoneId: 'pickup', couponCode: 'welcome10' });
  ok(r.json.couponApplied === 'WELCOME10' && r.json.discount === Math.floor(normal.price * 0.1), 'coupon applies (case-insensitive)', r.json);
  r = await guest.call('POST', '/api/quote', { items: [{ id: normal.id, qty: 1 }], couponCode: 'BOGUS' });
  ok(r.json.couponError && r.json.discount === 0, 'bad coupon reported, no discount');

  console.log('Guest checkout (M-Pesa demo)');
  const before = (await guest.call('GET', '/api/products/' + normal.id)).json.product.stock;
  const bad = await guest.call('POST', '/api/orders', { items: [{ id: normal.id, qty: 1 }], zoneId: 'nairobi', paymentMethod: 'mpesa', name: 'A', phone: '123' });
  ok(bad.status === 400 && bad.json.field, 'bad name/phone rejected', bad.json);
  const noAddr = await guest.call('POST', '/api/orders', { items: [{ id: normal.id, qty: 1 }], zoneId: 'nairobi', paymentMethod: 'mpesa', name: 'Test Guest', phone: '0712345678' });
  ok(noAddr.status === 400 && noAddr.json.field === 'address', 'delivery needs an address');
  r = await guest.call('POST', '/api/orders', { items: [{ id: normal.id, qty: 2 }], zoneId: 'nairobi', address: 'Westlands, Nairobi', paymentMethod: 'mpesa', name: 'Test Guest', phone: '0712 345 678', couponCode: 'WELCOME10' });
  ok(r.status === 201 && r.json.order.status === 'awaiting_payment' && r.json.payment.sent, 'order created, STK sent', r.json);
  const o1 = r.json.order;
  const expectTotal = normal.price * 2 - Math.floor(normal.price * 2 * 0.1) + 250;
  ok(o1.total === expectTotal, 'order total correct incl. coupon + delivery', [o1.total, expectTotal]);
  const after = (await guest.call('GET', '/api/products/' + normal.id)).json.product.stock;
  ok(after === before - 2, 'stock reserved at order time', [before, after]);
  r = await guest.call('GET', `/api/orders/${o1.number}/status`);
  ok(r.status === 404, 'status without token -> 404 (no order enumeration)');
  r = await guest.call('GET', `/api/orders/${o1.number}/status?token=${o1.token}`);
  ok(r.json.order.status === 'awaiting_payment', 'status with token ok');
  await sleep(6500);
  r = await guest.call('GET', `/api/orders/${o1.number}/status?token=${o1.token}`);
  ok(r.json.order.status === 'new' && r.json.order.paymentStatus === 'paid' && r.json.order.receipt, 'demo payment confirms after delay', r.json.order);

  console.log('Lookup by number + phone');
  r = await guest.call('POST', '/api/orders/lookup', { number: o1.number, phone: '0712345678' });
  ok(r.status === 200 && r.json.order.number === o1.number, 'guest lookup works');
  r = await guest.call('POST', '/api/orders/lookup', { number: o1.number, phone: '0799999999' });
  ok(r.status === 404, 'wrong phone -> 404');

  console.log('Stock cannot be oversold');
  const scarce = products.find((p) => p.stock > 0 && p.stock <= 6 && p.id !== normal.id);
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => new Client().call('POST', '/api/orders', {
    items: [{ id: scarce.id, qty: 1 }], zoneId: 'pickup', paymentMethod: 'cod', name: 'Racer ' + i, phone: '07123456' + (10 + i),
  })));
  const accepted = results.filter((x) => x.status === 201).length;
  ok(accepted === scarce.stock, `exactly ${scarce.stock} of 8 simultaneous orders accepted`, accepted);
  const sc = (await guest.call('GET', '/api/products/' + scarce.id)).json.product;
  ok(sc.stock === 0, 'stock ends at zero, never negative', sc.stock);

  console.log('Cash on delivery + cancel restocks');
  const target = products.find((p) => p.stock > 3 && p.id !== normal.id && p.id !== scarce.id);
  r = await guest.call('POST', '/api/orders', { items: [{ id: target.id, qty: 2 }], zoneId: 'pickup', paymentMethod: 'cod', name: 'Cod Buyer', phone: '0722000111' });
  ok(r.status === 201 && r.json.order.status === 'new' && r.json.payment === null, 'COD order goes straight to new');
  const codNum = r.json.order.number;

  console.log('Auth');
  r = await admin.call('GET', '/api/admin/stats');
  ok(r.status === 401, 'admin API blocked for guests');
  r = await admin.call('POST', '/api/auth/login', { email: 'admin@sugarspice.local', password: 'wrong' });
  ok(r.status === 401, 'wrong password rejected');
  r = await admin.call('POST', '/api/auth/login', { email: 'admin@sugarspice.local', password: 'TestAdmin123' });
  ok(r.status === 200 && r.json.user.role === 'admin' && !r.json.user.passwordHash, 'admin login, no hash leaked');
  ok(/HttpOnly/i.test(r.headers.get('set-cookie')), 'session cookie is HttpOnly');
  r = await admin.call('POST', '/api/auth/login', { email: 'admin@sugarspice.local', password: 'TestAdmin123' }, { Origin: 'https://evil.example' });
  ok(r.status === 403, 'cross-origin POST blocked');

  r = await user.call('POST', '/api/auth/register', { name: 'Jane Doe', email: 'jane@example.com', phone: '0733000222', password: 'short' });
  ok(r.status === 400 && r.json.field === 'password', 'short password rejected');
  r = await user.call('POST', '/api/auth/register', { name: 'Jane Doe', email: 'jane@example.com', phone: '0733000222', password: 'longenough1' });
  ok(r.status === 201 && r.json.user.role === 'customer', 'customer registers');
  r = await new Client().call('POST', '/api/auth/register', { name: 'Jane Two', email: 'JANE@example.com', password: 'longenough1' });
  ok(r.status === 409, 'duplicate email (case-insensitive) rejected');
  r = await user.call('GET', '/api/admin/stats');
  ok(r.status === 403, 'customer cannot reach admin API');
  r = await user.call('POST', '/api/orders', { items: [{ id: target.id, qty: 1 }], zoneId: 'pickup', paymentMethod: 'cod', name: 'Jane Doe', phone: '0733000222' });
  ok(r.status === 201, 'signed-in customer can check out');
  r = await user.call('GET', '/api/account/orders');
  ok(r.json.orders.length === 1, 'order appears in account history');
  r = await user.call('POST', '/api/account/claim', { number: codNum, phone: '0722000111' });
  ok(r.status === 200, 'claiming a guest order with number+phone works');
  r = await user.call('POST', '/api/account/claim', { number: codNum, phone: '0700000000' });
  ok(r.status === 404, 'claiming with wrong phone fails');

  console.log('Admin: orders');
  r = await admin.call('GET', '/api/admin/orders?status=new');
  ok(r.json.orders.length >= 2, 'orders list + filter');
  const codOrder = (await admin.call('GET', '/api/admin/orders?q=' + codNum)).json.orders[0];
  ok(codOrder && codOrder.number === codNum, 'order search by number');
  r = await admin.call('PATCH', '/api/admin/orders/' + codOrder.id, { status: 'processing' });
  ok(r.json.order.status === 'processing', 'status -> processing');
  const stockBeforeCancel = (await guest.call('GET', '/api/products/' + target.id)).json.product.stock;
  r = await admin.call('PATCH', '/api/admin/orders/' + codOrder.id, { status: 'cancelled' });
  ok(r.json.order.status === 'cancelled', 'cancel works');
  const stockAfterCancel = (await guest.call('GET', '/api/products/' + target.id)).json.product.stock;
  ok(stockAfterCancel === stockBeforeCancel + 2, 'cancel restocks items', [stockBeforeCancel, stockAfterCancel]);
  r = await admin.call('PATCH', '/api/admin/orders/' + codOrder.id, { status: 'processing' });
  ok(r.status === 409, 'cancelled order cannot be reopened');
  r = await admin.call('PATCH', '/api/admin/orders/' + codOrder.id, { status: 'cancelled' });
  ok(r.status === 200, 'double-cancel is harmless');
  ok((await guest.call('GET', '/api/products/' + target.id)).json.product.stock === stockAfterCancel, 'double-cancel does not restock twice');

  console.log('Admin: paid order cancel -> refund due');
  const paidOrder = (await admin.call('GET', '/api/admin/orders?q=' + o1.number)).json.orders[0];
  r = await admin.call('PATCH', '/api/admin/orders/' + paidOrder.id, { status: 'cancelled' });
  ok(r.json.order.paymentStatus === 'refund_due', 'paid order cancelled -> refund_due');
  r = await admin.call('PATCH', '/api/admin/orders/' + paidOrder.id, { markRefunded: true });
  ok(r.json.order.paymentStatus === 'refunded', 'refund recorded');

  console.log('Admin: products');
  r = await admin.call('POST', '/api/admin/products', { name: 'Test Piece', category: 'Rings', price: '1200.5', stock: 3 });
  ok(r.status === 400 && r.json.field === 'price', 'decimal price rejected');
  r = await admin.call('POST', '/api/admin/products', { name: 'Test Piece', category: 'Rings', price: 1200, oldPrice: 1000, stock: 3 });
  ok(r.status === 400 && r.json.field === 'oldPrice', 'old price must exceed price');
  r = await admin.call('POST', '/api/admin/products', { name: 'Test Piece', category: 'Rings', price: 1200, stock: 3, images: ['javascript:alert(1)', 'https://example.com/a.jpg'] });
  ok(r.status === 201 && r.json.product.images.length === 1, 'unsafe image URL stripped', r.json);
  const newId = r.json.product.id;
  r = await admin.call('PATCH', '/api/admin/products/' + newId + '/stock', { stock: 9 });
  ok(r.json.product.stock === 9, 'quick stock update');
  r = await admin.call('DELETE', '/api/admin/products/' + newId);
  ok(r.json.ok && r.json.archived === false, 'unused product deleted');
  r = await admin.call('DELETE', '/api/admin/products/' + normal.id);
  ok(r.json.archived === true, 'product with order history is archived, not deleted');
  r = await guest.call('GET', '/api/products/' + normal.id);
  ok(r.status === 404, 'archived product hidden from shop');

  console.log('Admin: upload');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
  r = await admin.call('POST', '/api/admin/upload', png, { 'Content-Type': 'image/png' });
  ok(r.status === 201 && /^\/uploads\/[a-f0-9]+\.png$/.test(r.json.url), 'png upload accepted', r.json);
  const served = await fetch(BASE + r.json.url);
  ok(served.status === 200, 'uploaded file is served');
  r = await admin.call('POST', '/api/admin/upload', Buffer.from('<script>alert(1)</script>padding'), { 'Content-Type': 'image/png' });
  ok(r.status === 400, 'non-image disguised as png rejected');

  console.log('Admin: coupons');
  r = await admin.call('POST', '/api/admin/coupons', { code: 'save200', type: 'fixed', value: 200, maxUses: 1 });
  ok(r.status === 201 && r.json.coupon.code === 'SAVE200', 'coupon created');
  const other = products.find((p) => p.stock > 3 && p.id !== normal.id && p.id !== scarce.id && p.id !== target.id);
  const c1 = await guest.call('POST', '/api/orders', { items: [{ id: other.id, qty: 1 }], zoneId: 'pickup', paymentMethod: 'cod', name: 'Coupon One', phone: '0711000001', couponCode: 'SAVE200' });
  ok(c1.status === 201 && c1.json.order.discount === 200, 'fixed coupon applied');
  const c2 = await guest.call('POST', '/api/orders', { items: [{ id: other.id, qty: 1 }], zoneId: 'pickup', paymentMethod: 'cod', name: 'Coupon Two', phone: '0711000002', couponCode: 'SAVE200' });
  ok(c2.status === 400, 'single-use coupon cannot be reused', c2.json);

  console.log('Admin: stats');
  r = await admin.call('GET', '/api/admin/stats?days=30');
  const s = r.json;
  ok(r.status === 200 && s.series.length === 30, '30-day series');
  ok(s.series.every((d, i, a) => i === 0 || d.date > a[i - 1].date), 'series dates ascending, no duplicates');
  const seriesRevenue = s.series.reduce((a, d) => a + d.revenue, 0);
  ok(seriesRevenue === s.current.revenue, 'series total equals headline revenue', [seriesRevenue, s.current.revenue]);
  ok(s.topProducts.length > 0 && s.categories.length > 0, 'top products and categories present');
  ok(Object.values(s.statusCounts).reduce((a, b) => a + b, 0) > 50, 'status counts present');

  console.log('Admin: settings');
  r = await admin.call('GET', '/api/admin/settings');
  const settings = r.json.settings;
  r = await admin.call('PUT', '/api/admin/settings', { ...settings, whatsapp: 'abc' });
  ok(r.status === 400, 'invalid whatsapp rejected');
  r = await admin.call('PUT', '/api/admin/settings', { ...settings, categories: ['Necklaces'] });
  ok(r.status === 409, 'cannot drop a category still in use');
  r = await admin.call('PUT', '/api/admin/settings', { ...settings, deliveryZones: settings.deliveryZones.map((z) => ({ ...z, active: false })) });
  ok(r.status === 400, 'need at least one delivery option');
  r = await admin.call('PUT', '/api/admin/settings', { ...settings, tagline: 'New tagline' });
  ok(r.status === 200 && (await guest.call('GET', '/api/store')).json.tagline === 'New tagline', 'settings saved and visible on store');

  console.log('Roles: owner and employee');
  const staff = new Client();
  r = await admin.call('POST', '/api/admin/team', { name: 'Amina Staff', email: 'amina@shop.test', password: 'short' });
  ok(r.status === 400, 'weak employee password rejected');
  r = await admin.call('POST', '/api/admin/team', { name: 'Amina Staff', email: 'amina@shop.test', password: 'StaffPass123' });
  ok(r.status === 201 && r.json.member.role === 'staff', 'owner creates an employee');
  const staffId = r.json.member.id;
  r = await admin.call('POST', '/api/admin/team', { name: 'Dup', email: 'amina@shop.test', password: 'StaffPass123' });
  ok(r.status === 409, 'duplicate employee email rejected');
  r = await staff.call('POST', '/api/auth/login', { email: 'amina@shop.test', password: 'StaffPass123' });
  ok(r.status === 200 && r.json.user.role === 'staff', 'employee can sign in');
  r = await staff.call('GET', '/api/admin/stats?days=30');
  ok(r.status === 200 && r.json.limited && r.json.current === undefined && !JSON.stringify(r.json).includes('"revenue"') && !JSON.stringify(r.json).includes('"total"'), 'employee dashboard has no sales figures');
  for (const [m, p] of [['GET', '/api/admin/coupons'], ['GET', '/api/admin/team'], ['GET', '/api/admin/orders.csv'], ['PUT', '/api/admin/settings'], ['POST', '/api/admin/demo/clear']]) {
    r = await staff.call(m, p, m === 'GET' ? undefined : {});
    ok(r.status === 403, `employee blocked from ${m} ${p}`, r.status);
  }
  r = await staff.call('GET', '/api/admin/orders');
  ok(r.status === 200 && r.json.orders.length > 0, 'employee can view orders');
  r = await staff.call('GET', '/api/admin/customers');
  ok(r.status === 200 && r.json.customers.every((c) => c.spent === null), 'employee sees customers without spend');
  r = await staff.call('GET', '/api/admin/settings');
  ok(r.status === 200 && r.json.settings.categories && !r.json.settings.whatsapp, 'employee gets categories only from settings');
  const newOrder = (await admin.call('GET', '/api/admin/orders?status=new')).json.orders.find((o) => o.paymentStatus === 'paid');
  if (newOrder) {
    r = await staff.call('PATCH', '/api/admin/orders/' + newOrder.id, { status: 'cancelled' });
    ok(r.status === 403, 'employee cannot cancel a paid order');
    r = await staff.call('PATCH', '/api/admin/orders/' + newOrder.id, { status: 'processing', note: 'Packed by Amina' });
    ok(r.status === 200 && r.json.order.history.some((x) => x.by === 'Amina Staff'), 'employee updates status; action is attributed');
    r = await guest.call('POST', '/api/orders/lookup', { number: newOrder.number, phone: newOrder.customer.phone });
    ok(r.status === 200 && !JSON.stringify(r.json).includes('Packed by Amina') && !JSON.stringify(r.json).includes('Amina Staff'), 'internal notes and staff names are hidden from customers');
  }
  r = await staff.call('POST', '/api/admin/products', { name: 'Staff Added Hoop', category: 'Earrings', price: 900, stock: 4 });
  ok(r.status === 201, 'employee can add a product');
  r = await staff.call('DELETE', '/api/admin/products/' + r.json.product.id);
  ok(r.status === 403, 'employee cannot delete a product');
  r = await staff.call('POST', '/api/account/password', { current: 'StaffPass123', next: 'StaffPass456' });
  ok(r.status === 200, 'employee can change own password');
  r = await admin.call('PATCH', '/api/admin/team/' + staffId, { disabled: true });
  ok(r.status === 200, 'owner locks employee');
  r = await staff.call('GET', '/api/admin/orders');
  ok(r.status === 401, 'locked employee is signed out immediately', r.status);
  r = await admin.call('PATCH', '/api/admin/team/' + staffId, { disabled: false, password: 'StaffPass789' });
  r = await staff.call('POST', '/api/auth/login', { email: 'amina@shop.test', password: 'StaffPass789' });
  ok(r.status === 200, 'unlocked employee signs in with the reset password');
  r = await user.call('GET', '/api/admin/orders');
  ok(r.status === 401 || r.status === 403, 'customers cannot reach the back office');
  const me = (await admin.call('GET', '/api/auth/me')).json.user;
  r = await admin.call('PATCH', '/api/admin/team/' + me.id, { disabled: true });
  ok(r.status === 400, 'owner cannot lock themselves out');
  r = await admin.call('DELETE', '/api/admin/team/' + staffId);
  ok(r.status === 200, 'owner removes an employee');

  console.log('Misc');
  r = await admin.call('GET', '/api/admin/orders.csv');
  ok(r.status === 200 && r.headers.get('content-type').includes('text/csv') && r.text.includes('SSC-'), 'CSV export');
  r = await guest.call('GET', '/api/nothing');
  ok(r.status === 404 && r.json.error, 'unknown API route returns JSON 404');
  r = await guest.call('POST', '/api/orders', '{bad json');
  ok(r.status === 400, 'malformed JSON -> 400, not 500');
  r = await guest.call('POST', '/api/payments/mpesa/callback/wrong', {});
  ok(r.status === 404, 'callback without secret rejected');
  const h = (await guest.call('GET', '/api/store')).headers;
  ok(h.get('content-security-policy') && h.get('x-content-type-options') === 'nosniff', 'security headers present');

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
