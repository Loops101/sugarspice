# Sugar & Spice Couture: online store

A complete jewelry store for Nairobi: browse, add to bag and **check out on the site** (guest first, sign-in optional), with M-Pesa or pay-on-delivery, plus a private **admin dashboard** with sales analytics, orders, products, customers, coupons and settings. Black and gold glass design.

Only four dependencies. Needs Node 18 or newer (22 recommended).

## Hosting

- **Shared hosting with cPanel "Setup Node.js App":** follow `DEPLOY-CPANEL.md`. No extra database needed.
- **Linux VPS:** follow `DEPLOY-VPS.md`. A script sets up the app, HTTPS, firewall and daily backups.
- **Vercel:** follow `DEPLOY-VERCEL.md` (needs the free Upstash Redis database).
- **Any Node host with a disk** (Render with a disk, Railway volume, Fly volume, a VPS): see "Deploying" below.

## Run it

    npm install
    cp .env.example .env      (Windows: copy .env.example .env)
    npm start

Open http://localhost:3000. The shop is at `/`, the admin at `/admin`.

On the first start the server creates the admin account and prints the login in the console. To choose your own, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before the first start. Forgot it later: `npm run reset-admin -- "NewPassword123"`.

The first start loads the shop's **starting catalogue** (the photos in `public/products`). Necklaces and the chain set are created hidden because their prices were not confirmed: open Products, set the price and tick *Show in shop*. Stock is a placeholder of 5 per item, so set the real counts.

Want sample orders so the dashboard has charts to look at? Start once with `SEED=demo npm start`, or run `npm run demo:add`; remove them with the dashboard button or `npm run demo:clear`.

## Owner and employee access

Two back-office roles share the same sign-in page at `/admin`:

| | Owner | Employee |
|---|---|---|
| Dashboard | Sales analytics | Work to do (orders, low stock), no sales figures |
| Orders | Everything, refunds, CSV export | View, update status, mark paid, add notes. Cannot cancel paid orders or record refunds |
| Products | Add, edit, stock, delete | Add, edit, stock. Cannot delete |
| Customers | With spend totals | Contact details only |
| Coupons, Settings, Team | Yes | No |

The owner adds employees under **Team** (name, email, starting password), and can lock, reset the password of, or remove them. Every order change is stamped with who made it. Internal notes are never shown to customers.

## How ordering works

- Guests need only a name and phone number (email optional). They get an order number and a tracking link, and can look an order up on `/track` with number + phone.
- An account is optional. After ordering, a guest can save the order to a new account. Signed-in customers get order history and saved details.
- Prices, discounts and delivery fees are always calculated on the server. Stock is reserved when an order is placed and returned if it is cancelled or an M-Pesa order is not paid within 15 minutes.
- Pay-on-delivery is blocked above KSh 50,000.

## Going live with M-Pesa

Out of the box M-Pesa is in **demo mode**: payments are simulated and no money moves. For real payments:

1. Create a Safaricom Daraja app (developer.safaricom.co.ke) and get a Paybill/Till shortcode and passkey.
2. Deploy the site on https (see below) and set in `.env`: `PUBLIC_URL`, `MPESA_ENV` (`sandbox` or `production`), `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, and a long random `MPESA_CALLBACK_SECRET`.
3. Restart. The dashboard and Settings page show "live" when everything is set. The callback address is `PUBLIC_URL/api/payments/mpesa/callback/<MPESA_CALLBACK_SECRET>`, which the server sends to Daraja itself.
4. Test with the sandbox first.

## Deploying

Any host that runs Node works (Render, Railway, Fly.io, a VPS). Important:

- Set `NODE_ENV=production`, `TRUST_PROXY=1` (behind a proxy), `PUBLIC_URL`, and a long random `JWT_SECRET`.
- Point `DATA_DIR` at a **persistent disk**. The database (`db.json`) and uploaded photos live there. Without a persistent disk they vanish on each deploy.
- Back up `DATA_DIR` regularly (copy the folder).
- Serve over https only.

## Things to replace before launch

- Delivery fees (Nairobi 250, countrywide 450) are placeholders. Settings > Delivery.
- Product photos: upload real ones under Products. Until then drawn illustrations show.
- WhatsApp and phone number are set to +254 142 832 932 (Settings > Shop details).
- Product photos: the sample products show drawn illustrations. Upload your own photos of the real pieces under Products (up to 6 per product).
- Remove the sample data.

## Security notes

HttpOnly cookie sessions, bcrypt password hashes, rate limits on sign-in and ordering, same-origin checks on all changes, strict Content-Security-Policy, uploads verified by file signature, CSV export protected against formula injection. Data is a JSON file, which is fine for a small shop; move to a database if you grow to thousands of daily orders.

## Tests

Start a fresh server with sample data, then run the checks:

    SEED=demo ADMIN_EMAIL=admin@sugarspice.local ADMIN_PASSWORD=TestAdmin123 DATA_DIR=/tmp/ssc-test PORT=3111 npm start
    node test/api.test.js
