const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');
const auth = require('./auth');
const orders = require('./orders');
const seed = require('./seed');

const app = express();
if (config.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers (no inline scripts anywhere, so script-src can stay strict)
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://wa.me",
    "frame-ancestors 'none'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
});

app.use('/api', express.json({ limit: '100kb' }), auth.attachUser, auth.sameOrigin);
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/account'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Uploaded product photos live in the data folder so they survive redeploys
app.use('/uploads', express.static(config.UPLOAD_DIR, { maxAge: '7d', immutable: true, index: false, dotfiles: 'deny' }));

const originOf = (req) => {
  if (config.PUBLIC_URL) return config.PUBLIC_URL;
  const host = req.get('host') || '';
  return /^[a-z0-9.:-]+$/i.test(host) ? `${req.protocol}://${host}` : 'http://localhost';
};

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /checkout\nDisallow: /order\nDisallow: /account\n\nSitemap: ${originOf(req)}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const o = originOf(req);
  const urls = ['/', '/shop.html', '/about.html', '/contact.html', '/track.html',
    ...db.data.products.filter((p) => p.active).map((p) => `/product.html?id=${encodeURIComponent(p.id)}`),
    ...db.data.settings.categories.map((c) => `/shop.html?category=${encodeURIComponent(c)}`)];
  const esc = (s) => s.replace(/&/g, '&amp;');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(o + u)}</loc></url>`).join('\n')}\n</urlset>`);
});

// HTML pages: fill in the absolute site address so canonical / social URLs are right on any domain
const PAGE_RE = /^\/([a-z0-9-]+)(?:\.html)?$/;
app.get(['/', PAGE_RE], (req, res, next) => {
  const name = req.path === '/' ? 'index' : req.path.match(PAGE_RE)[1];
  if (name === 'admin') return next();
  fs.readFile(path.join(config.PUBLIC_DIR, name + '.html'), 'utf8', (err, html) => {
    if (err) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html.replace(/%ORIGIN%/g, originOf(req)));
  });
});

app.use(express.static(config.PUBLIC_DIR, { maxAge: '5m', index: false, dotfiles: 'deny' }));
app.get('/admin', (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'admin', 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }));

app.use((req, res) => res.status(404).sendFile(path.join(config.PUBLIC_DIR, '404.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err.type === 'entity.too.large') { status = 413; message = 'That upload is too large (5 MB maximum).'; }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'That request could not be read.'; }
  else if (status >= 500) { console.error(err); message = 'Something went wrong on our side. Please try again.'; }
  if (req.path.startsWith('/api')) return res.status(status).json({ error: message, field: err.field });
  res.status(status).send(message);
});

const created = auth.ensureAdmin();
if (!db.data.meta.seeded) seed.addDemo();
orders.sweepExpired();
setInterval(orders.sweepExpired, 60 * 1000).unref();

app.listen(config.PORT, () => {
  console.log(`\n  Sugar & Spice Couture is running:  http://localhost:${config.PORT}`);
  console.log(`  Admin dashboard:                   http://localhost:${config.PORT}/admin`);
  if (created) {
    console.log('\n  First-run admin account created');
    console.log(`    Email:    ${created.email}`);
    console.log(`    Password: ${created.password}${created.generated ? '   (generated; change it after signing in)' : ''}`);
  }
  console.log(`  M-Pesa mode: ${require('./mpesa').mode().toUpperCase()}${require('./mpesa').mode() === 'demo' ? ' (payments are simulated; see .env.example for going live)' : ''}\n`);
});
