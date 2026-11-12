const config = require('./config');
const db = require('./db');
const orders = require('./orders');
const { app, bootstrap } = require('./app');

const created = db.persistent ? null : bootstrap(); // in shared/serverless mode this happens inside the first request
if (!db.persistent) setInterval(orders.sweepExpired, 60 * 1000).unref();

app.listen(config.PORT, process.env.HOST || undefined, () => {
  console.log(`\n  Sugar & Spice Couture is running:  http://localhost:${config.PORT}`);
  console.log(`  Admin dashboard:                   http://localhost:${config.PORT}/admin`);
  if (created) {
    console.log('\n  First-run admin account created');
    console.log(`    Email:    ${created.email}`);
    console.log(`    Password: ${created.password}${created.generated ? '   (generated; change it after signing in)' : ''}`);
  }
  console.log(`  M-Pesa mode: ${require('./mpesa').mode().toUpperCase()}${require('./mpesa').mode() === 'demo' ? ' (payments are simulated; see .env.example for going live)' : ''}\n`);
});
