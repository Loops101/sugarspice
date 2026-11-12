// Disk-backed key/value store with the same tiny interface as the Redis client.
// Used on shared hosting (cPanel / Passenger), where the host may start several copies of the app at once
// and restart them at any time. Data lives in DATA_DIR/kv, one file per key, written atomically.
const fs = require('fs');
const path = require('path');
const config = require('./config');

const env = process.env;
const enabled = env.STORAGE === 'files' || !!(env.PASSENGER_APP_ENV || env.IN_PASSENGER || env.PASSENGER_INSTANCE_REGISTRY_DIR);
const DIR = path.join(config.DATA_DIR, 'kv');
const LOCK = path.join(DIR, '.lock');

if (enabled) { fs.mkdirSync(DIR, { recursive: true }); fs.mkdirSync(config.UPLOAD_DIR, { recursive: true }); }

const file = (key) => path.join(DIR, key.replace(/[^A-Za-z0-9._-]/g, '_'));

function run(cmd) {
  const [op, key, val] = cmd;
  if (op === 'GET') { try { return fs.readFileSync(file(key), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
  if (op === 'SET') { const f = file(key); const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, val); fs.renameSync(tmp, f); return 'OK'; }
  if (op === 'DEL') { try { fs.unlinkSync(file(key)); return 1; } catch (e) { if (e.code === 'ENOENT') return 0; throw e; } }
  throw new Error('Unsupported command ' + op);
}

/** Cross-process mutex: mkdir is atomic. A lock older than 20 s is treated as left behind by a crashed process. */
async function acquire() {
  const start = Date.now();
  for (;;) {
    try { fs.mkdirSync(LOCK); return () => { try { fs.rmdirSync(LOCK); } catch { /* already gone */ } }; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 20000) fs.rmdirSync(LOCK); } catch { /* raced with the owner */ }
      if (Date.now() - start > 15000) throw new Error('The shop is busy. Please try again.');
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 25));
    }
  }
}

module.exports = {
  enabled,
  token: '',
  acquire,
  async cmd(...args) { return run(args); },
  async pipeline(cmds) { return cmds.map(run); },
};
