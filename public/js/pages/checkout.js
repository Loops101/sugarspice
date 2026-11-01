import { h, $, mount, kes, icon, toast, trapFocus, showFormError } from '../ui.js';
import { initLayout } from '../layout.js';
import { api, ApiError } from '../api.js';
import { cartLines, clearCart, onCartChange } from '../store.js';
import { media } from '../card.js';
import { emptyGlyph } from '../art.js';

const { store, me } = await initLayout();
const root = $('#co-root');

const showEmpty = () => mount(root, h('div', { class: 'empty' }, emptyGlyph(), h('h2', { text: 'Your bag is empty' }), h('p', { text: 'Add a piece you love, then come back here to check out.' }), h('a', { class: 'btn btn-gold', href: '/shop.html', text: 'Explore the collection' })));

let lines = [];
try { lines = await cartLines(); } catch { /* offline */ }
if (!lines.length) showEmpty();
else start();

function start() {
  const zones = store.deliveryZones;
  const methods = ['mpesa', 'cod'].filter((m) => store.payments[m]);
  const state = {
    zoneId: (zones.find((z) => !z.pickup) || zones[0]).id,
    method: methods[0],
    coupon: '',
    quote: null,
    busy: false,
    requestId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)).slice(0, 40),
  };
  const zone = () => zones.find((z) => z.id === state.zoneId);

  /* ------------------------------ Form ----------------------------- */
  const field = (label, name, attrs = {}, optional = false, hint) => h('div', { class: 'field' },
    h('label', { for: 'f-' + name }, label, optional ? h('span', { class: 'opt', text: ' (optional)' }) : null),
    h('input', { class: 'input', id: 'f-' + name, name, ...attrs }),
    hint ? h('span', { style: 'color:var(--faint);font-size:.86rem', text: hint }) : null);

  const formError = h('div', { class: 'form-error', role: 'alert', hidden: true });
  const addressInput = h('textarea', { class: 'input', id: 'f-address', name: 'address', rows: '2', autocomplete: 'street-address', placeholder: 'Building, street, area (e.g. Kilimani, Argwings Kodhek Rd)', maxlength: '300' });
  const addressField = h('div', { class: 'field' }, h('label', { for: 'f-address', text: 'Delivery address' }), addressInput);
  const pickupNote = h('div', { class: 'hint', style: 'margin:0 0 16px' });
  const savedAddr = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin:-6px 0 16px' });
  (me && me.addresses || []).forEach((a) => savedAddr.append(h('button', { class: 'chip', type: 'button', onclick: () => { addressInput.value = a.address; }, text: a.label || a.address.slice(0, 24) })));

  const mpesaPhone = field('M-Pesa number', 'mpesaPhone', { type: 'tel', inputmode: 'tel', autocomplete: 'off', placeholder: '0712 345 678' }, false);
  const mpesaBox = h('div', { hidden: true });
  const mpesaToggle = h('button', { class: 'link-btn', type: 'button', style: 'text-decoration:underline;color:var(--gold-light)', text: 'Pay with a different M-Pesa number' });
  mpesaToggle.addEventListener('click', () => { mpesaBox.hidden = !mpesaBox.hidden; mpesaToggle.textContent = mpesaBox.hidden ? 'Pay with a different M-Pesa number' : 'Use the number above'; if (mpesaBox.hidden) $('#f-mpesaPhone').value = ''; else $('#f-mpesaPhone').focus(); });
  mount(mpesaBox, mpesaPhone);

  const zoneChoices = zones.map((z) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name: 'zoneId', value: z.id, checked: z.id === state.zoneId }),
    h('span', { class: 'grow' }, h('strong', { text: z.name }), h('small', { text: z.pickup ? 'Collect when it is ready. No delivery charge.' : 'Delivered to your address.' })),
    h('span', { class: 'price', text: z.fee ? kes(z.fee) : 'Free' })));

  const methodCopy = {
    mpesa: ['Pay with M-Pesa', 'We send a prompt to your phone. Enter your M-Pesa PIN to finish.'],
    cod: ['Pay on delivery or pickup', 'Pay when your order arrives or when you collect it.'],
  };
  const methodChoices = methods.map((m) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name: 'paymentMethod', value: m, checked: m === state.method }),
    h('span', { class: 'grow' }, h('strong', { text: methodCopy[m][0] }), h('small', { text: methodCopy[m][1] }),
      m === 'mpesa' && store.mpesaMode === 'demo' ? h('small', { style: 'display:block;color:var(--warn);margin-top:6px', text: 'Demo mode: this store is not charging real money yet.' }) : null)));

  const nudge = me ? h('div', { class: 'signin-nudge glass' }, h('span', { text: `Signed in as ${me.name}. Your order will be saved to your account.` }))
    : h('div', { class: 'signin-nudge glass' }, h('span', { text: 'Checking out as a guest. No account needed.' }), h('a', { class: 'btn btn-ghost', href: '/account.html?next=/checkout.html', text: 'Sign in for faster checkout' }));

  const form = h('form', { id: 'co-form', novalidate: true, autocomplete: 'on' },
    nudge, formError,
    h('section', { class: 'glass co-block', 'aria-labelledby': 'h-contact' },
      h('h2', { id: 'h-contact' }, h('span', { class: 'step-n', text: '1' }), 'Your details'),
      h('div', { class: 'row2' },
        field('Full name', 'name', { type: 'text', autocomplete: 'name', required: true, maxlength: '80', value: me ? me.name : '' }),
        field('Phone number', 'phone', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', required: true, placeholder: '0712 345 678', value: me && me.phone ? me.phone : '' })),
      field('Email', 'email', { type: 'email', autocomplete: 'email', placeholder: 'you@example.com', value: me ? me.email : '' }, true, 'Only used if we need to reach you about your order.')),
    h('section', { class: 'glass co-block', 'aria-labelledby': 'h-ship' },
      h('h2', { id: 'h-ship' }, h('span', { class: 'step-n', text: '2' }), 'Delivery'),
      h('div', { role: 'radiogroup', 'aria-label': 'Delivery option' }, zoneChoices),
      pickupNote, addressField, savedAddr.children.length ? savedAddr : null,
      h('div', { class: 'field', style: 'margin:0' }, h('label', { for: 'f-notes' }, 'Order notes', h('span', { class: 'opt', text: ' (optional)' })), h('textarea', { class: 'input', id: 'f-notes', name: 'notes', rows: '2', maxlength: '500', placeholder: 'Gift wrapping, landmarks, best time to call...' }))),
    h('section', { class: 'glass co-block', 'aria-labelledby': 'h-pay' },
      h('h2', { id: 'h-pay' }, h('span', { class: 'step-n', text: '3' }), 'Payment'),
      h('div', { role: 'radiogroup', 'aria-label': 'Payment method' }, methodChoices),
      h('div', { id: 'mpesa-extra' }, mpesaToggle, mpesaBox)),
  );

  /* ----------------------------- Summary --------------------------- */
  const couponInput = h('input', { class: 'input', id: 'coupon', type: 'text', placeholder: 'Discount code', autocomplete: 'off', maxlength: '20', 'aria-label': 'Discount code' });
  const couponMsg = h('div', { style: 'font-size:.9rem;min-height:1.3em;margin-bottom:8px', 'aria-live': 'polite' });
  const applyBtn = h('button', { class: 'btn btn-glass btn-sm', type: 'button', text: 'Apply' });
  const sumLines = h('div'), sumTotals = h('div');
  const placeBtn = h('button', { class: 'btn btn-gold btn-block', type: 'submit', form: 'co-form', style: 'margin-top:18px' });
  const stickyTotal = h('div', { class: 't' });
  const stickyBtn = h('button', { class: 'btn btn-gold', type: 'submit', form: 'co-form' });

  const subtotalEst = () => lines.reduce((s, l) => s + l.product.price * l.qty, 0);

  function renderSummary() {
    const q = state.quote;
    const sub = q ? q.subtotal : subtotalEst();
    const delivery = q ? q.delivery : zone().fee;
    const discount = q ? q.discount : 0;
    const total = q ? q.total : sub + delivery;
    mount(sumLines, lines.map(({ product: p, qty }) => h('div', { class: 'sum-line' },
      h('div', { class: 'thumb' }, media(p, { width: 104 }), h('span', { class: 'q', text: String(qty) })),
      h('span', { class: 'nm', text: p.name }), h('span', { text: kes(p.price * qty) }))));
    mount(sumTotals,
      h('div', { class: 'sum-row' }, h('span', { text: 'Subtotal' }), h('span', { text: kes(sub) })),
      discount ? h('div', { class: 'sum-row' }, h('span', { text: `Discount (${state.coupon})` }), h('span', { class: 'off', text: '− ' + kes(discount) })) : null,
      h('div', { class: 'sum-row' }, h('span', { text: zone().pickup ? 'Pickup' : 'Delivery' }), h('span', { text: delivery ? kes(delivery) : 'Free' })),
      h('div', { class: 'sum-row total' }, h('span', { text: 'Total' }), h('span', { text: kes(total) })));
    placeBtn.textContent = state.method === 'mpesa' ? 'Place order and pay with M-Pesa' : 'Place order';
    stickyBtn.textContent = state.method === 'mpesa' ? 'Pay with M-Pesa' : 'Place order';
    mount(stickyTotal, h('small', { text: 'Total' }), kes(total));
  }

  let quoteSeq = 0;
  async function refreshQuote(couponCode = state.coupon) {
    const seq = ++quoteSeq;
    try {
      const q = await api('/quote', { method: 'POST', body: { items: lines.map((l) => ({ id: l.product.id, qty: l.qty })), zoneId: state.zoneId, couponCode } });
      if (seq !== quoteSeq) return null; // a newer request superseded this one
      if (couponCode && q.couponError) { couponMsg.style.color = 'var(--bad)'; couponMsg.textContent = q.couponError; state.coupon = ''; const again = await api('/quote', { method: 'POST', body: { items: lines.map((l) => ({ id: l.product.id, qty: l.qty })), zoneId: state.zoneId } }); state.quote = again; }
      else { state.quote = q; if (q.couponApplied) { state.coupon = q.couponApplied; couponMsg.style.color = 'var(--ok)'; couponMsg.textContent = `Code ${q.couponApplied} applied.`; } }
      renderSummary();
      return q;
    } catch (err) {
      if (err.status === 409) {
        toast(err.message, 'err');
        lines = await cartLines();
        if (!lines.length) { showEmpty(); return null; }
        return refreshQuote(couponCode);
      }
      renderSummary();
      return null;
    }
  }

  applyBtn.addEventListener('click', async () => {
    const code = couponInput.value.trim();
    if (!code) { couponMsg.style.color = 'var(--bad)'; couponMsg.textContent = 'Enter a code first.'; return; }
    applyBtn.disabled = true;
    state.coupon = '';
    await refreshQuote(code);
    applyBtn.disabled = false;
    if (state.coupon) couponInput.value = '';
  });
  couponInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyBtn.click(); } });

  const summary = h('aside', { class: 'glass co-block co-summary', 'aria-label': 'Order summary' },
    h('h2', { style: 'font-size:1.5rem' }, 'Order summary'),
    sumLines,
    h('div', { class: 'coupon', style: 'margin-top:16px' }, couponInput, applyBtn), couponMsg,
    sumTotals, placeBtn,
    h('div', { class: 'secure-note' }, icon('lock'), h('span', { text: store.mpesaMode === 'live' ? 'Payments are handled by M-Pesa. We never see your PIN.' : 'We only ask for what we need to deliver your order.' })));

  mount(root, h('div', { class: 'co-grid' }, form, summary), h('div', { class: 'sticky-pay' }, stickyTotal, stickyBtn));

  /* ----------------------------- Behaviour ------------------------- */
  function syncUi() {
    const z = zone();
    addressField.hidden = z.pickup;
    savedAddr.hidden = z.pickup;
    pickupNote.hidden = !z.pickup;
    pickupNote.textContent = z.pickup ? `Collect from ${store.address}. We will let you know when it is ready.` : '';
    $('#mpesa-extra').hidden = state.method !== 'mpesa';
  }
  form.addEventListener('change', (e) => {
    if (e.target.name === 'zoneId') { state.zoneId = e.target.value; syncUi(); renderSummary(); refreshQuote(); }
    if (e.target.name === 'paymentMethod') { state.method = e.target.value; syncUi(); renderSummary(); }
  });
  onCartChange(async () => {
    lines = await cartLines();
    if (!lines.length) { if (!state.busy) showEmpty(); return; } // an order just emptied the bag: nothing to re-price
    renderSummary(); refreshQuote();
  });
  syncUi(); renderSummary(); refreshQuote();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.busy) return;
    formError.hidden = true;
    for (const el of form.querySelectorAll('.field-error')) el.remove();
    state.busy = true;
    const btns = [placeBtn, stickyBtn];
    const labels = btns.map((b) => b.textContent);
    btns.forEach((b) => { b.disabled = true; mount(b, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Placing your order'); });
    const v = (n) => (form.elements[n] ? form.elements[n].value : '');
    try {
      const res = await api('/orders', {
        method: 'POST',
        body: {
          requestId: state.requestId, items: lines.map((l) => ({ id: l.product.id, qty: l.qty })), zoneId: state.zoneId, couponCode: state.coupon,
          paymentMethod: state.method, name: v('name'), phone: v('phone'), email: v('email'), address: v('address'), notes: v('notes'),
          mpesaPhone: state.method === 'mpesa' && !mpesaBox.hidden ? v('mpesaPhone') : '',
        },
      });
      clearCart();
      const url = `/order.html?n=${encodeURIComponent(res.order.number)}&t=${encodeURIComponent(res.order.token)}`;
      if (res.order.paymentMethod === 'mpesa' && res.order.status === 'awaiting_payment') {
        const payNumber = (!mpesaBox.hidden && v('mpesaPhone')) || v('phone');
        showPayment(res, url, payNumber);
      } else location.href = url;
    } catch (err) {
      state.busy = false;
      btns.forEach((b, i) => { b.disabled = false; b.textContent = labels[i]; });
      if (err.status === 409) { toast(err.message, 'err'); lines = await cartLines(); if (!lines.length) return showEmpty(); renderSummary(); refreshQuote(); return; }
      if (!showFormError(form, err)) { formError.textContent = err.message; formError.hidden = false; formError.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  });
}

/* --------------------- M-Pesa payment waiting dialog ------------------ */
function showPayment(first, orderUrl, payNumber) {
  const { number, token } = first.order;
  const pretty = (s) => { const d = String(s).replace(/\D/g, '').replace(/^254/, '0'); return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d; };
  const box = h('div', { class: 'box glass', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pay-title' });
  const modal = h('div', { class: 'modal' }, box);
  document.body.append(modal);
  document.body.style.overflow = 'hidden';
  const release = trapFocus(modal);
  let order = first.order, sent = first.payment ? first.payment.sent : false, sendError = first.payment && first.payment.error;
  let poll, tick, timerEl, canResend = false, resendTimer;

  const stop = () => { clearInterval(poll); clearInterval(tick); clearTimeout(resendTimer); };
  const done = () => { stop(); release(); document.body.style.overflow = ''; };

  async function retry(otherNumber) {
    sendError = null; sent = false; render('Sending a new prompt...');
    try {
      const r = await api(`/orders/${encodeURIComponent(number)}/retry-payment`, { method: 'POST', body: { token, mpesaPhone: otherNumber || undefined } });
      order = r.order; sent = r.payment.sent; sendError = r.payment.error;
      if (otherNumber) payNumber = otherNumber;
    } catch (err) { sendError = err.message; if (err.status === 409) { order = { ...order, status: 'cancelled' }; } }
    startResendTimer(); render();
  }
  function startResendTimer() { canResend = false; clearTimeout(resendTimer); resendTimer = setTimeout(() => { canResend = true; render(); }, 20000); }

  function render(busyText) {
    const paid = order.paymentStatus === 'paid';
    const dead = order.status === 'cancelled';
    if (paid) {
      stop();
      mount(box, h('div', { class: 'pulse-ring' }, icon('check')), h('h2', { id: 'pay-title', text: 'Payment received' }), h('p', { text: 'Thank you. Taking you to your order.' }));
      setTimeout(() => { done(); location.href = orderUrl; }, 1100);
      return;
    }
    if (dead) {
      stop();
      mount(box, h('h2', { id: 'pay-title', text: 'This order has expired' }), h('p', { text: 'The payment was not completed in time, so we released the items. Nothing was charged. You can order again whenever you are ready.' }),
        h('a', { class: 'btn btn-gold', href: '/shop.html', text: 'Back to the shop' }));
      return;
    }
    const msLeft = order.expiresAt ? Math.max(0, order.expiresAt - Date.now()) : 0;
    const mm = String(Math.floor(msLeft / 60000)).padStart(2, '0'), ss = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, '0');
    const failed = !busyText && (sendError || (!sent && !order.awaitingPrompt) || order.payFailReason);
    const otherInput = h('input', { class: 'input', type: 'tel', inputmode: 'tel', id: 'other-num', placeholder: 'Another M-Pesa number', 'aria-label': 'Another M-Pesa number', style: 'margin-bottom:12px;text-align:center' });
    mount(box,
      h('div', { class: 'pulse-ring' }, icon('phone')),
      h('h2', { id: 'pay-title', text: busyText ? 'One moment' : failed ? 'Payment not completed' : 'Check your phone' }),
      busyText ? h('p', { text: busyText }) :
        failed ? h('p', { text: sendError || order.payFailReason || 'We could not send the M-Pesa prompt. You can try again.' }) :
          h('p', null, 'We sent an M-Pesa prompt to ', h('strong', { style: 'color:var(--ivory)', text: pretty(payNumber) }), `. Enter your PIN to pay ${kes(order.total)}.`),
      order.demoPayment && !failed ? h('p', { style: 'color:var(--warn);font-size:.92rem', text: 'Demo mode: this will confirm by itself in a few seconds. No money moves.' }) : null,
      !busyText ? h('div', { style: 'margin:14px 0 20px' }, (timerEl = h('div', { class: 'timer', 'aria-label': 'Time left to pay', text: `${mm}:${ss}` })), h('small', { style: 'color:var(--faint)', text: 'Your items are held for you until then.' })) : null,
      !busyText ? h('div', { style: 'display:grid;gap:10px' },
        failed || canResend ? h('button', { class: 'btn btn-gold', type: 'button', onclick: () => retry(), text: failed ? 'Send the prompt again' : 'Did not get it? Resend' }) : null,
        h('details', { style: 'text-align:left' }, h('summary', { style: 'cursor:pointer;text-align:center;color:var(--gold-light);padding:8px', text: 'Use a different M-Pesa number' }),
          h('div', { style: 'margin-top:10px' }, otherInput, h('button', { class: 'btn btn-glass btn-block', type: 'button', onclick: () => retry(otherInput.value), text: 'Send prompt to this number' }))),
        h('a', { class: 'btn btn-ghost', href: orderUrl, text: 'Close and track this order' })) : null);
  }

  render();
  if (!sent || sendError) { /* failed state is shown by render() */ } else startResendTimer();
  tick = setInterval(() => {
    if (!order.expiresAt || !timerEl) return;
    const left = Math.max(0, order.expiresAt - Date.now());
    timerEl.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
  }, 1000);
  poll = setInterval(async () => {
    try {
      const r = await api(`/orders/${encodeURIComponent(number)}/status?token=${encodeURIComponent(token)}`);
      const changed = r.order.status !== order.status || r.order.paymentStatus !== order.paymentStatus;
      order = r.order; if (changed) render();
    } catch { /* offline: keep waiting */ }
  }, 3000);
}
