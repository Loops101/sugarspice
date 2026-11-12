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

const kvfile = require('./kvfile');
const redis = require('./redis').enabled ? require('./redis') : kvfile;
const FILE = path.join(config.DATA_DIR, 'db.json');

const defaultSettings = () => ({
  storeName: 'Sugar & Spice Couture',
  tagline: 'Elegant pieces. Effortless style.',
  whatsapp: '254142832932',
  phoneDisplay: '+254 142 832 932',
  email: '',
  instagram: 'sugarspice_couture_',
  address: "Superior Center, along Kimathi Street, Shop No L'11, 5th Floor, Nairobi",
  categories: ['Necklaces', 'Earrings', 'Bracelets', 'Rings', 'Sets', 'Stainless Steel', 'Brooches', 'Hats'],
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

/* --------------------------------------------------------------------------
 * Two storage modes
 *  - File (default): db.json in DATA_DIR, loaded once, written on every change.
 *  - Redis (Vercel / any serverless host): every request first checks a small
 *    "manifest" and reloads only if another instance changed the data; changes are
 *    written before the response is sent. Orders are split into chunks of 100 so
 *    each write stays small.
 * ------------------------------------------------------------------------ */

const CHUNK = 100;
const K = { manifest: 'ssc:manifest', core: 'ssc:core', orders: (n) => 'ssc:orders:' + n };
const persistent = redis.enabled;
const crossProcess = !require('./redis').enabled && kvfile.enabled; // shared hosting: several app processes share one disk
let localVer = null;
let dirty = false;
let snap = new Map(); // key -> last stored string, so only changed pieces are rewritten
let chunkCount = 0;

function normalise(parsed) {
  const base = defaults();
  const out = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
  out.counters = { ...base.counters, ...(parsed.counters || {}) };
  out.meta = { ...base.meta, ...(parsed.meta || {}) };
  // One-off: shops created before the contact number changed still hold the old default
  if (out.settings.whatsapp === '254711766189') { out.settings.whatsapp = base.settings.whatsapp; out.settings.phoneDisplay = base.settings.phoneDisplay; }
  return out;
}

function loadFile() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return;
  try {
    data = normalise(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (err) {
    const backup = FILE + '.corrupt-' + Date.now();
    fs.copyFileSync(FILE, backup);
    console.error(`db.json could not be read. A copy was saved to ${backup}. Starting with an empty database.`);
    data = defaults();
  }
}

function save() {
  if (persistent) { dirty = true; return; }
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}

/** Redis mode: pull in changes made by other instances (cheap when nothing changed). */
async function refresh() {
  if (!persistent) return;
  const raw = await redis.cmd('GET', K.manifest);
  if (!raw) { // brand new store
    if (localVer !== null || snap.size) { data = defaults(); snap = new Map(); chunkCount = 0; }
    localVer = null;
    return;
  }
  const m = JSON.parse(raw);
  if (m.ver === localVer) return;
  const keys = [K.core, ...Array.from({ length: m.chunks }, (_, n) => K.orders(n))];
  const vals = await redis.pipeline(keys.map((k) => ['GET', k]));
  const core = JSON.parse(vals[0] || '{}');
  const orders = [];
  const next = new Map([[K.core, vals[0]]]);
  for (let n = 0; n < m.chunks; n++) { orders.push(...JSON.parse(vals[n + 1] || '[]')); next.set(K.orders(n), vals[n + 1]); }
  data = normalise({ ...core, orders });
  snap = next; chunkCount = m.chunks; localVer = m.ver;
  dirty = false;
}

/** Redis mode: write whatever changed. Called before a response is sent. */
async function flush() {
  if (!persistent || !dirty) return;
  const { orders, ...core } = data;
  const pieces = new Map([[K.core, JSON.stringify(core)]]);
  const chunks = Math.ceil(orders.length / CHUNK);
  for (let n = 0; n < chunks; n++) pieces.set(K.orders(n), JSON.stringify(orders.slice(n * CHUNK, (n + 1) * CHUNK)));
  const writes = [];
  for (const [k, v] of pieces) if (snap.get(k) !== v) writes.push(['SET', k, v]);
  const stale = [];
  for (let n = chunks; n < chunkCount; n++) stale.push(['DEL', K.orders(n)]);
  if (!writes.length && !stale.length && localVer !== null) { dirty = false; return; }
  // Keep each request comfortably under the 1 MB limit
  let batch = []; let size = 0;
  for (const w of writes) {
    if (batch.length && size + w[2].length > 700000) { await redis.pipeline(batch); batch = []; size = 0; }
    batch.push(w); size += w[2].length;
  }
  if (batch.length || stale.length) await redis.pipeline([...batch, ...stale]);
  const ver = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await redis.cmd('SET', K.manifest, JSON.stringify({ ver, chunks }));
  snap = pieces; chunkCount = chunks; localVer = ver; dirty = false;
}

// One request at a time per instance, so a load-modify-save cycle can never interleave with another
let tail = Promise.resolve();
function lock() {
  let release;
  const next = new Promise((r) => { release = r; });
  const prev = tail;
  tail = prev.then(() => next);
  return prev.then(async () => {
    let unlockFile = null;
    if (crossProcess) {
      try { unlockFile = await kvfile.acquire(); } catch (e) { release(); throw e; }
    }
    let done = false;
    return () => { if (!done) { done = true; if (unlockFile) unlockFile(); release(); } };
  });
}

if (!persistent) loadFile();
else if (crossProcess) fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

module.exports = {
  get data() { return data; },
  set data(v) { data = v; },
  save,
  persistent,
  refresh,
  flush,
  lock,
  isNew: () => localVer === null,
  reload: loadFile,
  FILE,
};
