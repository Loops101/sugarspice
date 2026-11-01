# Sugar & Spice Couture: online store

A complete jewelry store for Nairobi: browse, add to bag and **check out on the site** (guest first, sign-in optional), with M-Pesa or pay-on-delivery, plus a private **admin dashboard** with sales analytics, orders, products, customers, coupons and settings. Black and gold glass design.

Only four dependencies. Needs Node 18 or newer (22 recommended).

## Run it

    npm install
    cp .env.example .env      (Windows: copy .env.example .env)
    npm start

Open http://localhost:3000. The shop is at `/`, the admin at `/admin`.

On the first start the server creates the admin account and prints the login in the console. To choose your own, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before the first start. Forgot it later: `npm run reset-admin -- "NewPassword123"`.

The first start also loads **sample products, orders and a WELCOME10 coupon** so the dashboard has something to show. Remove them with the button on the dashboard, or `npm run demo:clear`. Bring them back with `npm run demo:add`.

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

With the server running: `BASE=http://localhost:3000 node test/api.test.js`.
