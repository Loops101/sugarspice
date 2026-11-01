import { h, mount, kes, toast, showFormError } from '/js/ui.js';
import { api } from '/js/api.js';
import { field, errorBox, showError, checkbox } from './common.js';

export async function render(root, ctx) {
  const { settings: s, mpesa } = await api('/admin/settings');
  const cats = [...s.categories];
  const zones = s.deliveryZones.map((z) => ({ ...z }));
  const err = errorBox();
  const chips = h('div', { class: 'chip-list' });
  const zoneBox = h('div');
  const catInput = h('input', { class: 'input', id: 'x-newcat', maxlength: 40, placeholder: 'New category', 'aria-label': 'New category', style: 'flex:1;min-height:44px' });

  const drawCats = () => mount(chips, cats.map((c, i) => h('span', { class: 'chip-x' }, c, h('button', { type: 'button', 'aria-label': `Remove ${c}`, text: '×', onclick: () => { cats.splice(i, 1); drawCats(); } }))));
  const addCat = () => { const v = catInput.value.trim(); if (v && !cats.includes(v)) { cats.push(v); drawCats(); } catInput.value = ''; catInput.focus(); };
  catInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });
  drawCats();

  const drawZones = () => mount(zoneBox, zones.map((z, i) => h('div', { class: 'zone-row' },
    h('input', { class: 'input', value: z.name, maxlength: 80, 'aria-label': 'Delivery option name', oninput: (e) => { z.name = e.target.value; } }),
    h('input', { class: 'input', value: z.fee, inputmode: 'numeric', 'aria-label': 'Fee in shillings', oninput: (e) => { z.fee = e.target.value; } }),
    h('div', { class: 'full' },
      h('label', { style: 'display:flex;gap:8px;align-items:center' }, h('input', { type: 'checkbox', checked: z.pickup, style: 'accent-color:var(--gold);width:18px;height:18px', onchange: (e) => { z.pickup = e.target.checked; } }), 'Pickup at the shop'),
      h('label', { style: 'display:flex;gap:8px;align-items:center' }, h('input', { type: 'checkbox', checked: z.active, style: 'accent-color:var(--gold);width:18px;height:18px', onchange: (e) => { z.active = e.target.checked; } }), 'Offered at checkout'),
      h('button', { class: 'btn btn-glass', type: 'button', style: 'min-height:44px;padding:0 14px;margin-left:auto', text: 'Remove', onclick: () => { zones.splice(i, 1); drawZones(); } })))));
  drawZones();

  const form = h('form', { novalidate: true },
    h('section', { class: 'card-a', style: 'margin-bottom:16px' }, h('h2', { text: 'Shop details' }),
      field('Shop name', 'storeName', { value: s.storeName, maxlength: 80 }), field('Tagline', 'tagline', { value: s.tagline || '', maxlength: 120 }),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px' },
        field('WhatsApp number', 'whatsapp', { value: s.whatsapp, inputmode: 'tel' }, 'Orders and chat buttons use this. Example 0711 766 189'),
        field('Phone numbers shown', 'phoneDisplay', { value: s.phoneDisplay || '' }), field('Email', 'email', { type: 'email', value: s.email || '' }), field('Instagram', 'instagram', { value: s.instagram || '' })),
      field('Address', 'address', { value: s.address || '' })),
    h('section', { class: 'card-a', style: 'margin-bottom:16px' }, h('h2', { text: 'Categories' }), chips,
      h('div', { style: 'display:flex;gap:8px' }, catInput, h('button', { class: 'btn btn-glass', type: 'button', text: 'Add', onclick: addCat }))),
    h('section', { class: 'card-a', style: 'margin-bottom:16px' }, h('h2', { text: 'Delivery' }),
      h('p', { style: 'margin:0 0 14px;font-size:.95rem', text: 'These fees are placeholders. Set what you really charge.' }), zoneBox,
      h('button', { class: 'btn btn-glass', type: 'button', text: 'Add delivery option', onclick: () => { zones.push({ id: '', name: '', fee: 0, pickup: false, active: true }); drawZones(); } }),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:18px' },
        field('Free delivery from (KSh)', 'freeShippingThreshold', { value: s.freeShippingThreshold || 0, inputmode: 'numeric' }, '0 turns this off'),
        field('Low stock warning at', 'lowStockThreshold', { value: s.lowStockThreshold, inputmode: 'numeric' }))),
    h('section', { class: 'card-a', style: 'margin-bottom:16px' }, h('h2', { text: 'Payments' }),
      h('div', { class: 'switch-row' }, checkbox('M-Pesa', 'mpesa', s.payments.mpesa, 'STK push to the customer\'s phone'), checkbox('Pay on delivery', 'cod', s.payments.cod, 'Cash or M-Pesa to the rider')),
      h('p', { style: 'margin:12px 0 0;font-size:.95rem', text: mpesa.mode === 'live' ? `M-Pesa is live (${mpesa.env}). Customers are charged for real.` : 'M-Pesa is in demo mode, payments are simulated. To go live, set the MPESA_ keys, PUBLIC_URL and MPESA_CALLBACK_SECRET on the server and restart. The README explains each one.' })),
    err, h('button', { class: 'btn btn-gold', type: 'submit', text: 'Save settings' }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    const f = form.elements;
    const body = { storeName: f.storeName.value, tagline: f.tagline.value, whatsapp: f.whatsapp.value, phoneDisplay: f.phoneDisplay.value, email: f.email.value, instagram: f.instagram.value, address: f.address.value,
      categories: cats, deliveryZones: zones, freeShippingThreshold: f.freeShippingThreshold.value, lowStockThreshold: f.lowStockThreshold.value, payments: { mpesa: f.mpesa.checked, cod: f.cod.checked } };
    try { await api('/admin/settings', { method: 'PUT', body }); toast('Settings saved'); } catch (ex) { if (!showFormError(form, ex)) showError(err, ex); }
  });

  mount(root, h('div', { class: 'page-title' }, h('div', null, h('h1', { text: 'Settings' }), h('p', { text: 'Shop details, delivery, categories and payments.' }))), form);
}
