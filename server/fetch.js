// fetch() exists from Node 18. Some shared hosts still offer Node 14/16, so fall back to https there.
const https = require('https');
const http = require('http');

function fallback(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(u, { method: opts.method || 'GET', headers: opts.headers || {}, timeout: 20000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: async () => text, json: async () => JSON.parse(text) });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

module.exports = typeof fetch === 'function' ? fetch : fallback;
