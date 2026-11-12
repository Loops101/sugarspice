# Deploying on shared hosting with cPanel (Node.js App)

This works on cPanel hosts that offer **Setup Node.js App** (for example Truehost's "WebHosting Starter", which lists Node.js support). The shop saves to the hosting disk, so it needs no extra database and no Redis.

The host may start several copies of the app and restart them whenever it likes. The shop handles that: every request takes a lock, reads the latest data, saves before replying, and never overwrites another copy's changes (tested with two copies receiving 24 orders at once). Node 14 and newer are supported (tested on 14, 16 and 22); newer is better because older versions no longer get security fixes.

## Before you pay: confirm with the host
1. Setup Node.js App is available, with Node 14 or newer (newer is better).
2. The app can run continuously (not stopped after a few minutes idle).
3. You get at least 512 MB memory for it, and the app can make outgoing HTTPS calls (M-Pesa).
4. Free SSL is on and the domain can point to the Node app.

If any answer is no, use the VPS route in `DEPLOY-VPS.md` instead.

## Steps
1. **Upload the project.** In cPanel File Manager, create a folder in your home directory (not inside `public_html`), for example `shop`, and upload and extract the zip there so `shop/package.json` exists. Delete `node_modules` if you have one.
2. **Create a data folder** next to it, for example `shop-data`. Orders, products, users and photos live here, outside the website files.
3. **Setup Node.js App > Create Application**
   - Node.js version: the newest offered (14 is the minimum)
   - Application mode: **Production**
   - Application root: `shop`
   - Application URL: your domain
   - Application startup file: `server/index.js`
4. **Environment variables** (add each in the same screen):

   | Name | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `STORAGE` | `files` |
   | `DATA_DIR` | `/home/YOURCPANELUSER/shop-data` |
   | `PUBLIC_URL` | `https://yourdomain.co.ke` |
   | `TRUST_PROXY` | `1` |
   | `JWT_SECRET` | a long random string (40+ characters) |
   | `ADMIN_EMAIL` | your sign-in email |
   | `ADMIN_PASSWORD` | a password of 8+ characters |

   (Do not add the Redis `KV_` variables.)
5. Click **Run NPM Install**, then **Start / Restart** the app.
6. Open `https://yourdomain.co.ke/admin` and sign in. The first visit creates the owner account and loads the product catalogue. Change the password under **My account**.

## Backups
The host's daily backup should include your home folder, so `shop-data` is covered. Also keep your own copy: in File Manager, compress `shop-data` and download it weekly. To restore, extract it back to the same place and restart the app. Ask the host how to restore from their backup and test it once.

## Going live with M-Pesa
Add the `MPESA_*` variables from the README (and `MPESA_CALLBACK_SECRET`), keep `PUBLIC_URL` as your https address, and restart the app. Test in the Safaricom sandbox first.

## Troubleshooting
- **Blank page or 503:** open the app's log in cPanel (or `stderr.log` in the app folder). The first line usually says what is missing.
- **Cannot sign in:** set `RESET_ADMIN` = `1` with a new `ADMIN_PASSWORD`, restart, sign in, then remove `RESET_ADMIN`.
- **App stops after being idle:** the host is stopping it. Ask them to keep it running, or use the VPS route.
- **"The shop is busy":** two requests collided for more than 15 seconds; reload. If it keeps happening, the host's disk is very slow.
- **Photos missing after moving hosts:** copy the whole `shop-data` folder, including `uploads`.

## Limits
The data is a few files, fine for a small shop (hundreds of orders a month). Disk is fast enough that each page waits a few milliseconds for the lock. If you grow past that, ask for the MySQL/PostgreSQL version.
