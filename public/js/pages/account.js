import { h, $, mount, kes, toast, fmtDay, showFormError, icon } from '../ui.js';
import { initLayout } from '../layout.js';
import { api } from '../api.js';
import { setMe } from '../store.js';

const { me } = await initLayout();
const root = $('#acct-root');

// Only allow redirects to pages on this site
const rawNext = new URLSearchParams(location.search).get('next') || '';
const next = /^\/[a-zA-Z0-9\-_./?=&]*$/.test(rawNext) && !rawNext.startsWith('//') ? rawNext : '/account.html';

const STATUS = { awaiting_payment: 'Awaiting payment', new: 'Received', processing: 'Preparing', out_for_delivery: 'On its way', completed: 'Completed', cancelled: 'Cancelled' };

const field = (label, name, attrs = {}) => h('div', { class: 'field' }, h('label', { for: 'a-' + name, text: label }), h('input', { class: 'input', id: 'a-' + name, name, ...attrs }));
const banner = () => h('div', { class: 'form-error', role: 'alert', hidden: true });

function submitter(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('.form-error'); if (b) b.hidden = true;
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try { await fn(); } catch (err) { if (!showFormError(form, err) && b) { b.textContent = err.message; b.hidden = false; } }
    btn.disabled = false;
  });
}

if (!me) guestView(); else memberView();

function guestView() {
  document.title = 'Sign in | Sugar & Spice Couture';
  let mode = 'in';
  const box = h('div', { class: 'glass auth-box' });
  const draw = () => {
    const signIn = mode === 'in';
    const form = h('form', { novalidate: true }, banner(),
      signIn ? null : field('Full name', 'name', { type: 'text', autocomplete: 'name', required: true }),
      field('Email', 'email', { type: 'email', autocomplete: 'email', required: true }),
      signIn ? null : field('Phone (optional)', 'phone', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '0712 345 678' }),
      field('Password', 'password', { type: 'password', autocomplete: signIn ? 'current-password' : 'new-password', required: true, minlength: signIn ? null : '8', placeholder: signIn ? null : '8+ characters' }),
      h('button', { class: 'btn btn-gold btn-block', type: 'submit', text: signIn ? 'Sign in' : 'Create account' }));
    submitter(form, async () => {
      const f = form.elements;
      const body = signIn ? { email: f.email.value, password: f.password.value } : { name: f.name.value, email: f.email.value, phone: f.phone.value, password: f.password.value };
      const r = await api(signIn ? '/auth/login' : '/auth/register', { method: 'POST', body });
      setMe(r.user);
      location.href = r.user.role === 'admin' && next === '/account.html' ? '/admin' : next;
    });
    mount(box,
      h('div', { class: 'tabs', role: 'tablist' },
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(signIn), onclick: () => { mode = 'in'; draw(); }, text: 'Sign in' }),
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(!signIn), onclick: () => { mode = 'up'; draw(); }, text: 'Create account' })),
      form,
      h('p', { style: 'text-align:center;margin:18px auto 0;font-size:.95rem' }, 'Not ready? ', h('a', { href: '/checkout.html', style: 'color:var(--gold-light);text-decoration:underline', text: 'Continue as a guest' }), ' or ', h('a', { href: '/track.html', style: 'color:var(--gold-light);text-decoration:underline', text: 'track an order' }), '.'));
  };
  draw();
  mount(root, h('h1', { style: 'text-align:center;font-size:clamp(2.2rem,5vw,3.4rem)', text: 'Welcome back' }), h('p', { style: 'text-align:center;margin:0 auto 28px', text: 'An account is optional. It simply saves your details and order history.' }), box);
}

async function memberView() {
  document.title = 'Your account | Sugar & Spice Couture';
  const ordersBox = h('div', null, h('div', { class: 'skel', style: 'aspect-ratio:16/5', 'aria-hidden': 'true' }));
  const logout = h('button', { class: 'btn btn-glass btn-sm', type: 'button', text: 'Sign out' });
  logout.addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setMe(null); location.href = '/'; });

  // Profile
  const profile = h('form', { novalidate: true, class: 'glass co-block' }, h('h2', { style: 'font-size:1.5rem', text: 'Your details' }), banner(),
    field('Full name', 'name', { type: 'text', value: me.name, required: true, autocomplete: 'name' }),
    field('Phone', 'phone', { type: 'tel', inputmode: 'tel', value: me.phone || '', placeholder: '0712 345 678', autocomplete: 'tel' }),
    h('div', { class: 'field' }, h('label', { text: 'Email' }), h('input', { class: 'input', value: me.email, disabled: true })),
    h('button', { class: 'btn btn-gold btn-sm', type: 'submit', text: 'Save details' }));
  submitter(profile, async () => { const r = await api('/account', { method: 'PATCH', body: { name: profile.elements.name.value, phone: profile.elements.phone.value } }); setMe(r.user); toast('Details saved'); });

  // Addresses
  let addrs = (me.addresses || []).map((a) => ({ ...a }));
  const addrList = h('div'), addrForm = h('form', { novalidate: true, class: 'glass co-block' }, h('h2', { style: 'font-size:1.5rem', text: 'Saved addresses' }), banner(), addrList);
  const drawAddrs = () => {
    mount(addrList, addrs.map((a, i) => h('div', { style: 'display:grid;gap:8px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--line)' },
      h('input', { class: 'input', 'aria-label': 'Label', placeholder: 'Label (Home, Office)', maxlength: '30', value: a.label, oninput: (e) => { a.label = e.target.value; } }),
      h('textarea', { class: 'input', 'aria-label': 'Address', rows: '2', maxlength: '300', placeholder: 'Building, street, area', oninput: (e) => { a.address = e.target.value; } }, a.address),
      h('button', { class: 'link-btn', type: 'button', style: 'justify-self:start', onclick: () => { addrs.splice(i, 1); drawAddrs(); }, text: 'Remove' }))),
      addrs.length < 5 ? h('button', { class: 'btn btn-glass btn-sm', type: 'button', onclick: () => { addrs.push({ label: '', address: '' }); drawAddrs(); }, text: 'Add an address' }) : null,
      h('button', { class: 'btn btn-gold btn-sm', type: 'submit', style: 'margin-left:8px', text: 'Save addresses' }));
  };
  drawAddrs();
  submitter(addrForm, async () => { const r = await api('/account', { method: 'PATCH', body: { addresses: addrs } }); setMe(r.user); addrs = r.user.addresses.map((a) => ({ ...a })); drawAddrs(); toast('Addresses saved'); });

  // Password
  const pw = h('form', { novalidate: true, class: 'glass co-block' }, h('h2', { style: 'font-size:1.5rem', text: 'Change password' }), banner(),
    field('Current password', 'current', { type: 'password', autocomplete: 'current-password', required: true }),
    field('New password', 'next', { type: 'password', autocomplete: 'new-password', minlength: '8', placeholder: '8+ characters', required: true }),
    h('button', { class: 'btn btn-glass btn-sm', type: 'submit', text: 'Update password' }));
  submitter(pw, async () => { await api('/account/password', { method: 'POST', body: { current: pw.elements.current.value, next: pw.elements.next.value } }); pw.reset(); toast('Password updated. Other devices were signed out.'); });

  // Claim a guest order
  const claim = h('form', { novalidate: true, class: 'panel', style: 'padding:20px;margin-top:8px' }, h('h3', { style: 'font-size:1.2rem', text: 'Placed an order as a guest?' }), banner(),
    h('p', { style: 'font-size:.95rem', text: 'Add it to this account with the order number and the phone number you used.' }),
    h('div', { class: 'row2' }, field('Order number', 'number', { placeholder: 'SSC-1042', autocapitalize: 'characters', required: true }), field('Phone', 'cphone', { type: 'tel', inputmode: 'tel', required: true })),
    h('button', { class: 'btn btn-glass btn-sm', type: 'submit', text: 'Add this order' }));
  submitter(claim, async () => { await api('/account/claim', { method: 'POST', body: { number: claim.elements.number.value, phone: claim.elements.cphone.value } }); toast('Order added to your account'); loadOrders(); claim.reset(); });

  mount(root,
    h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:28px' },
      h('div', null, h('span', { class: 'kicker', text: 'Your account' }), h('h1', { style: 'font-size:clamp(2rem,5vw,3.2rem);margin:0', text: `Hello, ${me.name.split(' ')[0]}` })),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, me.role === 'admin' ? h('a', { class: 'btn btn-gold btn-sm', href: '/admin', text: 'Open admin dashboard' }) : null, logout)),
    h('div', { class: 'acct-grid' },
      h('div', null, h('h2', { style: 'font-size:1.6rem', text: 'Your orders' }), ordersBox, claim),
      h('div', null, profile, addrForm, pw)));

  async function loadOrders() {
    try {
      const { orders } = await api('/account/orders');
      mount(ordersBox, orders.length ? orders.map((o) => h('a', { class: 'panel o-row', href: `/order.html?n=${encodeURIComponent(o.number)}&t=${encodeURIComponent(o.token)}`, style: 'display:grid' },
        h('span', { class: 'num', text: o.number }), h('span', { class: 'price', text: kes(o.total) }),
        h('small', { text: `${fmtDay(o.createdAt)} · ${o.items.reduce((s, l) => s + l.qty, 0)} item${o.items.reduce((s, l) => s + l.qty, 0) === 1 ? '' : 's'}` }), h('span', { class: 'status-pill' + (o.status === 'completed' ? ' ok' : o.status === 'cancelled' ? ' bad' : ''), text: STATUS[o.status] || o.status })))
        : h('div', { class: 'panel', style: 'padding:28px;text-align:center' }, h('p', { style: 'margin:0 auto 14px', text: 'No orders yet. When you order while signed in, it appears here.' }), h('a', { class: 'btn btn-gold btn-sm', href: '/shop.html', text: 'Start shopping' })));
    } catch (err) { mount(ordersBox, h('p', { text: err.message })); }
  }
  loadOrders();
}
