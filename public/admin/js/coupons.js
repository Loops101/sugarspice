import { h, mount, kes, fmtDay, toast, showFormError } from '/js/ui.js';
import { api } from '/js/api.js';
import { field, errorBox, showError, confirmDialog } from './common.js';

export async function render(root) {
  const list = h('div');
  const err = errorBox();
  const type = h('select', { class: 'input', id: 'x-type', name: 'type' }, h('option', { value: 'percent', text: 'Percent off' }), h('option', { value: 'fixed', text: 'Fixed amount (KSh)' }));
  const form = h('form', { novalidate: true, class: 'card-a', style: 'margin-bottom:16px' }, h('h2', { text: 'New coupon' }), err,
    h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px' },
      field('Code', 'code', { maxlength: 20, placeholder: 'EID10', style: 'text-transform:uppercase' }),
      h('div', { class: 'field' }, h('label', { for: 'x-type', text: 'Type' }), type),
      field('Value', 'value', { inputmode: 'numeric' }), field('Minimum order (KSh)', 'minSubtotal', { inputmode: 'numeric', placeholder: '0' }),
      field('Max uses', 'maxUses', { inputmode: 'numeric', placeholder: 'Unlimited' }), field('Expires', 'expiresAt', { type: 'date' })),
    h('button', { class: 'btn btn-gold', type: 'submit', text: 'Create coupon' }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    const f = form.elements;
    try {
      await api('/admin/coupons', { method: 'POST', body: { code: f.code.value, type: f.type.value, value: f.value.value, minSubtotal: f.minSubtotal.value, maxUses: f.maxUses.value, expiresAt: f.expiresAt.value } });
      toast('Coupon created'); form.reset(); load();
    } catch (ex) { if (!showFormError(form, ex)) showError(err, ex); }
  });
  mount(root, h('div', { class: 'page-title' }, h('div', null, h('h1', { text: 'Coupons' }), h('p', { text: 'Discount codes customers type at checkout.' }))), form, list);

  async function load() {
    const { coupons } = await api('/admin/coupons');
    if (!coupons.length) { mount(list, h('div', { class: 'card-a empty-a', text: 'No coupons yet.' })); return; }
    mount(list, h('div', { class: 'card-a' }, h('div', { class: 'table-wrap' }, h('table', { class: 'tbl stack' },
      h('thead', null, h('tr', null, ['Code', 'Discount', 'Used', 'Expires', 'Status', ''].map((t) => h('th', { text: t })))),
      h('tbody', null, coupons.map((c) => h('tr', null,
        h('td', { 'data-label': 'Code' }, h('b', { text: c.code }), c.minSubtotal ? h('span', { class: 'sub', text: `Min order ${kes(c.minSubtotal)}` }) : null),
        h('td', { class: 'num', 'data-label': 'Discount' }, c.type === 'percent' ? c.value + '% off' : kes(c.value) + ' off'),
        h('td', { class: 'num', 'data-label': 'Used' }, c.maxUses ? `${c.used} / ${c.maxUses}` : c.used),
        h('td', { 'data-label': 'Expires' }, c.expiresAt ? fmtDay(c.expiresAt) : 'Never'),
        h('td', { 'data-label': 'Status' }, h('span', { class: 'pill ' + (c.active ? 'ok' : 'mute'), text: c.active ? 'Active' : 'Paused' })),
        h('td', { class: 'nolabel', style: 'white-space:nowrap;text-align:right' },
          h('button', { class: 'btn btn-glass', type: 'button', style: 'min-height:44px;padding:0 16px', text: c.active ? 'Pause' : 'Resume', onclick: async () => { try { await api('/admin/coupons/' + encodeURIComponent(c.code), { method: 'PATCH', body: { active: !c.active } }); load(); } catch (ex) { toast(ex.message, 'err'); } } }), ' ',
          h('button', { class: 'btn btn-glass', type: 'button', style: 'min-height:44px;padding:0 16px', text: 'Delete', onclick: async () => {
            if (!(await confirmDialog({ title: `Delete ${c.code}?`, message: 'Customers will no longer be able to use this code.', confirmText: 'Delete', danger: true }))) return;
            try { await api('/admin/coupons/' + encodeURIComponent(c.code), { method: 'DELETE' }); toast('Deleted'); load(); } catch (ex) { toast(ex.message, 'err'); }
          } })))))))));
  }
  await load();
}
