/**
 * M-Pesa Daraja STK Push.
 *
 * LIVE mode: set MPESA_* variables in .env (see .env.example).
 * DEMO mode: no credentials -> a simulated prompt that succeeds a few seconds
 * after it is "sent". Demo payments are clearly labelled in the admin panel so
 * they are never mistaken for real money.
 */
const config = require('./config');

const cfg = config.MPESA;
const BASE = cfg.env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

const isLive = () => !!(cfg.consumerKey && cfg.consumerSecret && cfg.shortcode && cfg.passkey && config.PUBLIC_URL && cfg.callbackSecret);
const mode = () => (isLive() ? 'live' : 'demo');

let tokenCache = { value: null, expires: 0 };

async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.expires) return tokenCache.value;
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('Could not authenticate with M-Pesa.');
  const json = await res.json();
  tokenCache = { value: json.access_token, expires: Date.now() + (parseInt(json.expires_in, 10) - 60) * 1000 };
  return tokenCache.value;
}

const timestamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
};

/** Sends the STK prompt. Returns { checkoutRequestId, merchantRequestId }. */
async function stkPush({ phone, amount, reference, description }) {
  if (!isLive()) {
    return { checkoutRequestId: 'DEMO-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), merchantRequestId: 'DEMO', demo: true };
  }
  const token = await getToken();
  const ts = timestamp();
  const password = Buffer.from(cfg.shortcode + cfg.passkey + ts).toString('base64');
  const res = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: cfg.shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: cfg.shortcode,
      PhoneNumber: phone,
      CallBackURL: `${config.PUBLIC_URL}/api/payments/mpesa/callback/${cfg.callbackSecret}`,
      AccountReference: String(reference).slice(0, 12),
      TransactionDesc: String(description || 'Order').slice(0, 13),
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ResponseCode !== '0') {
    throw new Error(json.errorMessage || json.ResponseDescription || 'M-Pesa did not accept the request.');
  }
  return { checkoutRequestId: json.CheckoutRequestID, merchantRequestId: json.MerchantRequestID, demo: false };
}

/** Parses the body Safaricom posts to the callback URL. */
function parseCallback(body) {
  const cb = body && body.Body && body.Body.stkCallback;
  if (!cb || !cb.CheckoutRequestID) return null;
  const items = (cb.CallbackMetadata && cb.CallbackMetadata.Item) || [];
  const get = (name) => (items.find((i) => i.Name === name) || {}).Value;
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    success: cb.ResultCode === 0,
    resultDesc: cb.ResultDesc || '',
    receipt: get('MpesaReceiptNumber') || '',
    amount: get('Amount'),
  };
}

module.exports = { isLive, mode, stkPush, parseCallback };
