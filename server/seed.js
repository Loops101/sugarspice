/**
 * Sample data. Everything created here is flagged `demo: true` so it can be
 * removed in one go (Admin > Dashboard banner, or `npm run demo:clear`).
 * Product names/prices are placeholders; photos are drawn by the storefront
 * until real images are uploaded in Admin > Products.
 */
const db = require('./db');

const PRODUCTS = [
  ['Layered Chain Necklace', 'Necklaces', 1500, 1800, 'necklace', 'A two-layer chain necklace in a warm gold tone. Wear it alone or stacked with your favourites.', 14, 1, 1],
  ['Emerald Drop Earrings', 'Earrings', 1200, 1500, 'earrings', 'Drop earrings with a green stone that catches the light. Made for evenings out.', 9, 1, 0],
  ['Sapphire Statement Ring', 'Rings', 1800, 0, 'ring', 'A statement ring with a deep blue centre stone in a polished gold-tone band.', 6, 1, 1],
  ['Sapphire Set: Necklace & Earrings', 'Sets', 1500, 0, 'set', 'A matching necklace and earring set with blue stones. Gift it or wear the full look.', 11, 1, 1],
  ['Classic Stainless Chain', 'Stainless Steel', 1000, 0, 'chain', 'An everyday chain in stainless steel with a gold-tone finish.', 22, 0, 1],
  ['Pearl Cluster Bracelet', 'Bracelets', 900, 0, 'bracelet', 'A soft bracelet with a cluster of pearl-look beads on a fine chain.', 12, 0, 0],
  ['Huggie Hoop Earrings', 'Earrings', 800, 0, 'earrings', 'Small close-fitting hoops in polished gold tone for everyday wear.', 30, 0, 1],
  ['Beaded Waist Chain', 'Necklaces', 1300, 1600, 'chain', 'A beaded body chain that layers over a simple outfit for a night out.', 7, 0, 0],
  ['Stainless Cuban Link Bracelet', 'Stainless Steel', 1100, 0, 'bracelet', 'A bold Cuban link bracelet in gold-tone stainless steel.', 15, 0, 0],
  ['Delicate Solitaire Ring', 'Rings', 700, 0, 'ring', 'A minimal band with a single clear stone. Easy to stack.', 18, 0, 0],
  ['Rose Quartz Drop Necklace', 'Necklaces', 1400, 0, 'necklace', 'A single pink drop pendant on a fine gold-tone chain.', 5, 0, 0],
  ['Everyday Set: Chain & Studs', 'Sets', 1600, 1900, 'set', 'A fine chain necklace with matching stud earrings, ready to wear.', 10, 0, 1],
  ['Twist Hoop Earrings', 'Earrings', 850, 0, 'earrings', 'Medium hoops with a twisted texture, light enough for all-day wear.', 0, 0, 0],
  ['Stainless Signet Ring', 'Stainless Steel', 950, 0, 'ring', 'A clean signet-style ring in stainless steel with a gold-tone finish.', 13, 0, 0],
  ['Chain Link Bracelet', 'Bracelets', 1000, 0, 'bracelet', 'A sturdy chain-link bracelet with a secure clasp.', 2, 0, 0],
  ['Bridal Set: Necklace, Earrings & Bracelet', 'Sets', 2600, 3000, 'set', 'A three-piece set with clear stones for weddings and special occasions.', 4, 1, 0],
];

const CUSTOMERS = [
  ['Amina Wanjiru', '254700000101'], ['Grace Achieng', '254700000102'], ['Faith Muthoni', '254700000103'],
  ['Mercy Njeri', '254700000104'], ['Lucy Atieno', '254700000105'], ['Joy Kamau', '254700000106'],
  ['Naomi Chebet', '254700000107'], ['Esther Wambui', '254700000108'], ['Brenda Akinyi', '254700000109'],
  ['Cynthia Mwende', '254700000110'], ['Diana Otieno', '254700000111'], ['Sharon Nyambura', '254700000112'],
];

// Small deterministic PRNG so the sample dashboard looks the same every time
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function addDemo() {
  const d = db.data;
  const now = Date.now();
  const rand = rng(42);
  const cats = new Set(d.settings.categories);

  for (const [name, category, price, oldPrice, art, description, stock, featured, bestseller] of PRODUCTS) {
    if (!cats.has(category)) continue;
    d.counters.product += 1;
    d.products.push({
      id: 'spc-' + String(d.counters.product).padStart(3, '0'),
      name, category, price, oldPrice: oldPrice || null, art, description, stock,
      images: [], featured: !!featured, bestseller: !!bestseller, active: true,
      createdAt: now - (PRODUCTS.length - d.counters.product) * 3 * 24 * 3600 * 1000, demo: true,
    });
  }

  d.coupons.push({ code: 'WELCOME10', type: 'percent', value: 10, minSubtotal: 0, maxUses: 0, used: 0, expiresAt: null, active: true, createdAt: now, demo: true });

  const sellable = d.products.filter((p) => p.demo);
  const zones = d.settings.deliveryZones;
  for (let day = 59; day >= 0; day--) {
    const base = 1.5 + (60 - day) * 0.05; // gentle upward trend
    const count = Math.max(0, Math.round(base + rand() * 3 - 0.5));
    for (let n = 0; n < count; n++) {
      const lineCount = 1 + Math.floor(rand() * 3);
      const items = [];
      for (let k = 0; k < lineCount; k++) {
        const p = sellable[Math.floor(rand() ** 1.4 * sellable.length)];
        if (items.some((i) => i.productId === p.id)) continue;
        items.push({ productId: p.id, name: p.name, price: p.price, qty: rand() < 0.2 ? 2 : 1, image: '', art: p.art });
      }
      const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);
      const zone = zones[Math.floor(rand() * zones.length)];
      const cust = CUSTOMERS[Math.floor(rand() ** 1.6 * CUSTOMERS.length)];
      const at = now - day * 24 * 3600 * 1000 - Math.floor(rand() * 14 * 3600 * 1000);
      const cod = rand() < 0.35;
      const roll = rand();
      let status = 'completed';
      if (day < 2) status = roll < 0.4 ? 'new' : roll < 0.7 ? 'processing' : roll < 0.85 ? 'out_for_delivery' : 'completed';
      else if (roll < 0.06) status = 'cancelled';
      d.counters.order += 1;
      const paid = status === 'completed' || (!cod && status !== 'cancelled' && status !== 'awaiting_payment');
      d.orders.push({
        id: 'o_demo' + d.counters.order, number: 'SSC-' + d.counters.order, trackingToken: 'demo' + d.counters.order,
        userId: rand() < 0.3 ? 'u_demo' : null, status, paymentMethod: cod ? 'cod' : 'mpesa',
        paymentStatus: status === 'cancelled' ? 'unpaid' : paid ? 'paid' : 'unpaid',
        items, subtotal, discount: 0, deliveryFee: zone.fee, total: subtotal + zone.fee, couponCode: '',
        customer: { name: cust[0], phone: cust[1], email: '' },
        shipping: { zoneId: zone.id, zoneName: zone.name, pickup: !!zone.pickup, address: zone.pickup ? '' : 'Sample address, Nairobi' },
        notes: '', payment: cod ? null : { phone: cust[1], checkoutRequestId: '', receipt: 'DEMO' + d.counters.order, demo: true, initiatedAt: at, failReason: '' },
        restocked: true, couponReleased: false, createdAt: at, updatedAt: at, demo: true,
        history: [{ at, text: 'Sample order.' }],
      });
    }
  }
  d.meta.seeded = true;
  db.save();
}

function clearDemo() {
  const d = db.data;
  d.orders = d.orders.filter((o) => !o.demo);
  d.products = d.products.filter((p) => !p.demo);
  d.coupons = d.coupons.filter((c) => !c.demo);
  db.save();
}

module.exports = { addDemo, clearDemo };

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'demo') { addDemo(); console.log('Sample data added.'); }
  else if (cmd === 'clear-demo') { clearDemo(); console.log('Sample data removed.'); }
  else console.log('Usage: node server/seed.js demo | clear-demo');
}
