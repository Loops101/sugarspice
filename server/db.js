/**
 * Tiny JSON-file database.
 * - Whole dataset is held in memory and written atomically on every change.
 * - Node is single-threaded and every mutation here is synchronous, so
 *   stock decrements and order numbering cannot race.
 * - Perfect for a single-shop store. If traffic ever outgrows it, swap this
 *   module for Postgres/SQLite; the routes only use db.data and db.save().
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const FILE = path.join(config.DATA_DIR, 'db.json');

const defaultSettings = () => ({
  storeName: 'Sugar & Spice Couture',
  tagline: 'Elegant pieces. Effortless style.',
  whatsapp: '254142832932',
  phoneDisplay: '+254 142 832 932',
  email: '',
  instagram: 'sugarspice_couture_',
  address: "Superior Center, along Kimathi Street, Shop No L'11, 5th Floor, Nairobi",
  categories: ['Necklaces', 'Earrings', 'Bracelets', 'Rings', 'Sets', 'Stainless Steel'],
  // Placeholder fees: edit in Admin > Settings before launch.
  deliveryZones: [
    { id: 'pickup', name: "Pick up at our shop (Superior Center, Kimathi St)", fee: 0, pickup: true, active: true },
    { id: 'nairobi', name: 'Nairobi delivery', fee: 250, pickup: false, active: true },
    { id: 'countrywide', name: 'Outside Nairobi (courier)', fee: 450, pickup: false, active: true },
  ],
  freeShippingThreshold: 0, // 0 = disabled
  lowStockThreshold: 3,
  payments: { mpesa: true, cod: true },
});

const defaults = () => ({
  users: [],
  products: [],
  orders: [],
  coupons: [],
  settings: defaultSettings(),
  counters: { order: 1000, product: 0 },
  meta: { seeded: false },
});

let data = defaults();

function load() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const base = defaults();
    data = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
    data.counters = { ...base.counters, ...(parsed.counters || {}) };
    data.meta = { ...base.meta, ...(parsed.meta || {}) };
    // One-off: shops created before the contact number changed still hold the old default
    if (data.settings.whatsapp === '254711766189') { data.settings.whatsapp = base.settings.whatsapp; data.settings.phoneDisplay = base.settings.phoneDisplay; }
  } catch (err) {
    const backup = FILE + '.corrupt-' + Date.now();
    fs.copyFileSync(FILE, backup);
    console.error(`db.json could not be read. A copy was saved to ${backup}. Starting with an empty database.`);
    data = defaults();
  }
}

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}

load();

module.exports = {
  get data() { return data; },
  save,
  reload: load,
  FILE,
};
