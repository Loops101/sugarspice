// Usage: npm run reset-admin -- "NewPassword123"
const db = require('./db');
const auth = require('./auth');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run reset-admin -- "NewPassword"');
  process.exit(1);
}
try {
  auth.validatePassword(password);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const admin = db.data.users.find((u) => u.role === 'admin');
if (!admin) {
  console.error('No admin account exists yet. Start the server once to create it.');
  process.exit(1);
}
admin.passwordHash = auth.hashPassword(password);
admin.tokenVersion = (admin.tokenVersion || 0) + 1;
db.save();
console.log(`Password updated for ${admin.email}.`);
