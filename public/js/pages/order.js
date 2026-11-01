import { h, $, mount, kes, icon, waIcon, toast, fmtDateTime, svgNode, showFormError } from '../ui.js';
import { initLayout, waLink } from '../layout.js';
import { api } from '../api.js';
import { media } from '../card.js';
import { setMe } from '../store.js';

const { store, me } = await initLayout();
const root = $('#order-root');
const params = new URLSearchParams(location.search);
const number = (params.get('n') || '').trim();
const token = params.get('t') || '';

if (!number) location.replace('/track.html');

const url = (p) => `/orders/${encodeURIComponent(number)}/${p}${token ? '?token=' + encodeURIComponent(token) : ''}`;
let order = null;

const SEAL = '<svg xmlns="http://www.w3.org/2000/svg" class="seal" viewBox="0 0 92 92" aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3cf"/><stop offset=".5" stop-color="#d4ae60"/><stop offset="1" stop-color="#8a6a2c"/></linearGradient></defs><circle cx="46" cy="46" r="43" fill="none" stroke="url(#sg)" stroke-width="1.5"/><circle cx="46" cy="46" r="36" fill="rgba(201,164,92,.08)" stroke="url(#sg)" stroke-opacity=".4"/><path d="m29 47 12 12 23-26" fill="none" stroke="url(#sg)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CLOCK = '<svg xmlns="http://www.w3.org/2000/svg" class="seal" viewBox="0 0 92 92" aria-hidden="true"><defs><linearGradient id="sg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3cf"/><stop offset=".5" stop-color="#d4ae60"/><stop offset="1" stop-color="#8a6a2c"/></linearGradient></defs><circle cx="46" cy="46" r="43" fill="none" stroke="url(#sg2)" stroke-width="1.5"/><path d="M46 24v24l15 9" fill="none" stroke="url(#sg2)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const STEP_INDEX = { awaiting_payment: -1, new: 0, processing: 1, out_for_delivery: 2, completed: 3 };
const PAY_LABEL = { paid: 'Paid', unpaid: 'Not paid yet', refund_due: 'Refund due', refunded: 'Refunded' };

async function load() {
  try { order = (await api(`/orders/${encodeURIComponent(number)}/status${token ? '?token=' + encodeURIComponent(token) : ''}`)).order; }
  catch (err) {
    document.title = 'Order not found | Sugar & Spice Couture';
    mount(root, h('div', { class: 'empty', style: 'padding-top:80px' }, h('h1', { style: 'font-size:2.2rem', text: err.status === 404 ? 'We could not find that order' : 'We could not load your order' }),
      h('p', { text: err.status === 404 ? 'The link may be incomplete. You can look your order up with the order number and the phone number you used.' : err.message }),
      h('a', { class: 'btn btn-gold', href: '/track.html', text: 'Find my order' })));
    return false;
  }
  return true;
}

function render() {
  const o = order;
  const first = (o.customerName || '').split(' ')[0];
  document.title = `Order ${o.number} | Sugar & Spice Couture`;
  const awaiting = o.status === 'awaiting_payment';
  const cancelled = o.status === 'cancelled';
  const pickup = o.shipping.pickup;

  const heading = cancelled ? ['This order was cancelled', 'If you did not expect this, message us and we will help.']
    : awaiting ? ['Waiting for your payment', o.awaitingPrompt ? 'Enter your M-Pesa PIN on your phone to finish. This page updates by itself.' : 'We have not received your payment yet.']
      : o.status === 'completed' ? [pickup ? 'Collected. Enjoy!' : 'Delivered. Enjoy!', 'Thank you for shopping with us.']
        : [`Thank you${first ? ', ' + first : ''}!`, 'We have your order and will confirm the details with you shortly.'];

  const idx = STEP_INDEX[o.status];
  const labels = ['Order received', 'Being prepared', pickup ? 'Ready for pickup' : 'On its way', pickup ? 'Collected' : 'Delivered'];

  const payStatus = h('span', { class: 'status-pill' + (o.paymentStatus === 'paid' ? ' ok' : ''), text: PAY_LABEL[o.paymentStatus] || o.paymentStatus });
  const actions = [];
  if (awaiting) {
    const r = h('button', { class: 'btn btn-gold', type: 'button', text: 'Send the M-Pesa prompt again' });
    r.addEventListener('click', async () => {
      r.disabled = true;
      try { const res = await api(`/orders/${encodeURIComponent(number)}/retry-payment`, { method: 'POST', body: { token } }); order = res.order; toast(res.payment.sent ? 'Prompt sent. Check your phone.' : (res.payment.error || 'Could not send the prompt.'), res.payment.sent ? 'ok' : 'err'); render(); }
      catch (err) { toast(err.message, 'err'); r.disabled = false; }
    });
    actions.push(r);
  }
  actions.push(h('a', { class: 'btn btn-glass', href: waLink(store, `Hello ${store.name}, about my order ${o.number}.`), target: '_blank', rel: 'noopener' }, waIcon(), 'Message us about this order'));

  const guestSave = me ? null : saveCard(o);

  mount(root,
    h('div', { class: 'order-head' }, svgNode(awaiting ? CLOCK : SEAL), h('h1', { style: 'font-size:clamp(2rem,5vw,3.2rem);margin-bottom:.2em', text: heading[0] }), h('p', { style: 'margin-inline:auto', text: heading[1] }), h('span', { class: 'order-no', text: o.number })),
    cancelled ? null : h('div', { class: 'glass co-block' },
      h('ol', { class: 'timeline', 'aria-label': 'Order progress' }, labels.map((l, i) => h('li', { class: (i <= idx ? 'done ' : '') + (i === idx && idx < 3 ? 'now' : ''), 'aria-current': i === idx ? 'step' : false, text: l })))),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:24px' }, actions),
    h('div', { class: 'glass co-block' },
      h('h2', { style: 'font-size:1.5rem', text: 'Your items' }),
      o.items.map((l) => h('div', { class: 'sum-line' }, h('div', { class: 'thumb' }, media({ name: l.name, images: l.image ? [l.image] : [], art: l.art }, { width: 104 }), h('span', { class: 'q', text: String(l.qty) })), h('span', { class: 'nm', text: l.name }), h('span', { text: kes(l.price * l.qty) }))),
      h('div', { style: 'margin-top:14px' },
        h('div', { class: 'sum-row' }, h('span', { text: 'Subtotal' }), h('span', { text: kes(o.subtotal) })),
        o.discount ? h('div', { class: 'sum-row' }, h('span', { text: 'Discount' }), h('span', { class: 'off', text: '− ' + kes(o.discount) })) : null,
        h('div', { class: 'sum-row' }, h('span', { text: pickup ? 'Pickup' : 'Delivery' }), h('span', { text: o.deliveryFee ? kes(o.deliveryFee) : 'Free' })),
        h('div', { class: 'sum-row total' }, h('span', { text: 'Total' }), h('span', { text: kes(o.total) })))),
    h('div', { class: 'cards3', style: 'margin-bottom:18px' },
      h('div', { class: 'panel', style: 'padding:22px' }, h('span', { class: 'kicker', style: 'margin-bottom:8px', text: 'Payment' }),
        h('p', { style: 'margin:0 0 10px', text: o.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Pay on delivery or pickup' }), payStatus,
        o.receipt ? h('p', { style: 'margin:10px 0 0;font-size:.92rem', text: 'Receipt: ' + o.receipt }) : null),
      h('div', { class: 'panel', style: 'padding:22px' }, h('span', { class: 'kicker', style: 'margin-bottom:8px', text: pickup ? 'Pickup' : 'Delivery' }),
        h('p', { style: 'margin:0', text: o.shipping.zoneName }), !pickup ? h('p', { style: 'margin:8px 0 0;font-size:.95rem', text: o.shipping.address }) : h('p', { style: 'margin:8px 0 0;font-size:.95rem', text: store.address })),
      h('div', { class: 'panel', style: 'padding:22px' }, h('span', { class: 'kicker', style: 'margin-bottom:8px', text: 'Placed' }), h('p', { style: 'margin:0', text: fmtDateTime(o.createdAt) }))),
    guestSave,
    h('div', { class: 'glass co-block', style: 'margin-top:18px' }, h('h2', { style: 'font-size:1.5rem', text: 'Order updates' }),
      h('ul', { class: 'hist' }, [...o.history].reverse().map((e) => h('li', null, h('time', { text: fmtDateTime(e.at) }), h('span', { text: e.text }))))),
    h('p', { style: 'text-align:center;color:var(--faint);font-size:.88rem;margin:28px auto 0', text: 'Keep this page\'s link to check on your order any time. Anyone with the link can see it.' }));
}

function saveCard(o) {
  const form = h('form', { novalidate: true },
    h('div', { class: 'form-error', role: 'alert', hidden: true }),
    h('div', { class: 'row2' },
      h('div', { class: 'field' }, h('label', { for: 's-email', text: 'Email' }), h('input', { class: 'input', id: 's-email', name: 'email', type: 'email', autocomplete: 'email', required: true })),
      h('div', { class: 'field' }, h('label', { for: 's-pw', text: 'Choose a password' }), h('input', { class: 'input', id: 's-pw', name: 'password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true, placeholder: '8+ characters' }))),
    h('button', { class: 'btn btn-gold', type: 'submit', text: 'Create my account' }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button'); btn.disabled = true;
    const banner = form.querySelector('.form-error'); banner.hidden = true;
    try {
      const r = await api('/auth/register', { method: 'POST', body: { name: o.customerName, email: form.elements.email.value, password: form.elements.password.value } });
      setMe(r.user);
      await api('/account/claim', { method: 'POST', body: { number: o.number, token } });
      toast('Account created. This order is saved to it.');
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      btn.disabled = false;
      if (!showFormError(form, err)) { banner.textContent = err.message; banner.hidden = false; }
    }
  });
  return h('div', { class: 'glass save-card' }, h('span', { class: 'kicker', text: 'Optional' }), h('h2', { style: 'font-size:1.6rem', text: 'Save this order to an account' }),
    h('p', { text: 'Next time, check out faster and see all your orders in one place. You never have to.' }), form);
}

if (await load()) {
  render();
  // Keep the page fresh while an order is still moving
  setInterval(async () => {
    if (!order || ['completed', 'cancelled'].includes(order.status) || document.hidden) return;
    const before = order.status + order.paymentStatus + order.history.length;
    try { order = (await api(`/orders/${encodeURIComponent(number)}/status${token ? '?token=' + encodeURIComponent(token) : ''}`)).order; } catch { return; }
    if (before !== order.status + order.paymentStatus + order.history.length) { if (document.activeElement && document.activeElement.closest('form')) return; render(); }
  }, order && order.status === 'awaiting_payment' ? 4000 : 15000);
}
