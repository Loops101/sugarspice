# Deploying on Vercel

Vercel runs the site as a serverless function, which has **no permanent disk**. That is why the admin could not work before: the owner account and every order lived in a file that Vercel throws away. This version keeps everything in a free Upstash Redis database instead.

## One-time setup (about 5 minutes)

1. **Upload the project** to GitHub and import it in Vercel (New Project). Framework preset: *Other*. Leave build and output settings empty.
2. **Add the database.** In your Vercel project open *Storage* > *Create Database* > **Upstash Redis** (free plan) and connect it to the project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. **Set your owner login.** In *Settings > Environment Variables* add:
   - `ADMIN_EMAIL` = the email you will sign in with
   - `ADMIN_PASSWORD` = a password of 8+ characters
   - `PUBLIC_URL` = your site address, for example `https://yourshop.vercel.app` (needed later for M-Pesa)
4. **Redeploy** (Deployments > the latest > Redeploy). Open `https://your-site/admin` and sign in.

The first visit creates the owner account and loads the starting catalogue. Photos you upload in the admin are stored in the same database, so they survive redeploys.

## Forgot the password / locked out

Set `RESET_ADMIN` = `1` and `ADMIN_PASSWORD` = a new password, redeploy, sign in, then delete `RESET_ADMIN`.

## Good to know

- The free Upstash plan is plenty for a small shop (a few thousand visits a month). The shop keeps working if you outgrow it; upgrade the Upstash plan.
- Photos are shrunk to about 1200 px in the admin before upload.
- Orders are saved before the customer sees the confirmation. If the database is unreachable the customer sees a "please try again" message instead of a false confirmation.
- Live M-Pesa: add the `MPESA_*` variables from the README and set `PUBLIC_URL`.
