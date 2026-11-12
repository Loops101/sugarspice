const fetch = require('./fetch');
// Minimal Upstash / Vercel KV (Redis over HTTPS) client. No dependency: uses fetch.
// Used only when KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_* pair) are set.
const env = process.env;
const URL_ = (env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const TOKEN = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '';

async function post(path, body) {
  let res;
  try {
    res = await fetch(URL_ + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) { throw new Error('Storage is unreachable: ' + e.message); }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Storage error: ' + ((json && json.error) || res.status));
  return json;
}

const enabled = !!(URL_ && TOKEN);

module.exports = {
  enabled,
  token: TOKEN,
  async cmd(...args) {
    const j = await post('/', args);
    if (j.error) throw new Error('Storage error: ' + j.error);
    return j.result;
  },
  /** Several commands in one round trip. Returns the results in order. */
  async pipeline(cmds) {
    if (!cmds.length) return [];
    const out = await post('/pipeline', cmds);
    return out.map((o) => { if (o.error) throw new Error('Storage error: ' + o.error); return o.result; });
  },
};
