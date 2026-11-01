import { h, mount, kes, fmtDay, debounce } from '/js/ui.js';
import { api } from '/js/api.js';
import { waLink, prettyPhone } from './common.js';

export async function render(root, ctx) {
  const { customers, accounts } = await api('/admin/customers');
  let q = '';
  const list = h('div');
  const search = h('input', { class: 'input grow', type: 'search', placeholder: 'Search by name or phone', 'aria-label': 'Search customers', oninput: debounce(() => { q = search.value.trim().toLowerCase(); draw(); }, 150) });
  mount(root, h('div', { class: 'page-title' }, h('div', null, h('h1', { text: 'Customers' }), h('p', { text: `${customers.length} people have ordered, ${accounts} created an account. Guests are listed by phone number.` }))),
    h('div', { class: 'toolbar' }, search), list);
  function draw() {
    const rows = customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, '') || '@@'));
    if (!rows.length) { mount(list, h('div', { class: 'card-a empty-a', text: customers.length ? 'No one matches.' : 'Customers appear here after their first order.' })); return; }
    mount(list, h('div', { class: 'card-a' }, h('div', { class: 'table-wrap' }, h('table', { class: 'tbl stack' },
      h('thead', null, h('tr', null, ['Customer', 'Orders', ...(ctx.user.role === 'admin' ? ['Spent'] : []), 'Last order', ''].map((t) => h('th', { text: t })))),
      h('tbody', null, rows.map((c) => h('tr', null,
        h('td', { 'data-label': 'Customer' }, h('span', null, c.name, h('span', { class: 'sub', text: prettyPhone(c.phone) + (c.email ? ' · ' + c.email : '') }))),
        h('td', { class: 'num', 'data-label': 'Orders' }, c.orders), ctx.user.role === 'admin' ? h('td', { class: 'num', 'data-label': 'Spent' }, kes(c.spent)) : null,
        h('td', { 'data-label': 'Last order' }, fmtDay(c.last)),
        h('td', { class: 'nolabel', style: 'white-space:nowrap' }, h('span', { class: 'pill ' + (c.hasAccount ? '' : 'mute'), text: c.hasAccount ? 'Account' : 'Guest' }), ' ',
          h('a', { class: 'btn btn-glass', style: 'min-height:44px;padding:0 16px', href: waLink(c.phone), target: '_blank', rel: 'noopener', text: 'WhatsApp' })))))))));
  }
  draw();
}
