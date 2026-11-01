import { h, mount, kes, icon, fmtDateTime, toast, debounce } from '/js/ui.js';
import { api } from '/js/api.js';
import { statusPill, payPill, methodLabel, STATUS_LABEL, openSheet, confirmDialog, waLink, prettyPhone, field, errorBox, showError } from './common.js';

const FILTERS = [['', 'All'], ['awaiting_payment', 'Awaiting payment'], ['new', 'New'], ['processing', 'Preparing'], ['out_for_delivery', 'Out for delivery'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
const NEXT = { new: ['processing', 'Start preparing'], processing: ['out_for_delivery', 'Out for delivery'], out_for_delivery: ['completed', 'Mark delivered'], awaiting_payment: null };

export function openOrder(order, onChange, user) {
  user = user || window.__adminUser || {};
  const owner = user.role === 'admin';
  let o = order;
  openSheet({
    title: o.number,
    render(sheet) {
      const draw = () => {
        const err = errorBox();
        const act = async (body, ok) => {
          err.hidden = true;
          try { const r = await api('/admin/orders/' + o.id, { method: 'PATCH', body }); o = r.order; toast(ok); draw(); onChange && onChange(); } catch (e) { showError(err, e); }
        };
        const kv = (k, v) => h('div', { class: 'kv' }, h('span', { class: 'k', text: k }), h('div', { class: 'v' }, v));
        const wa = waLink(o.customer.phone, `Hello ${o.customer.name.split(' ')[0]}, this is Sugar & Spice Couture about your order ${o.number}.`);
        mount(sheet.body,
          h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px' }, statusPill(o.status), payPill(o.paymentStatus), h('span', { class: 'pill mute', text: methodLabel(o.paymentMethod) }),
            o.guest ? h('span', { class: 'pill mute', text: 'Guest' }) : null, o.demoPayment ? h('span', { class: 'pill warn', text: 'Sample' }) : null),
          err,
          kv('Customer', h('div', null, o.customer.name, h('br'), h('a', { href: 'tel:+' + o.customer.phone, text: prettyPhone(o.customer.phone) }), o.customer.email ? [h('br'), o.customer.email] : null)),
          kv('Delivery', h('div', null, o.shipping.zoneName, o.shipping.address ? [h('br'), o.shipping.address] : null, o.shipping.notes ? [h('br'), h('em', { text: o.shipping.notes })] : null)),
          o.notes ? kv('Customer note', o.notes) : null,
          h('div', { class: 'kv' }, h('span', { class: 'k', text: 'Items' }),
            h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('tbody', null,
              o.items.map((l) => h('tr', null, h('td', { text: `${l.qty} × ${l.name}` }), h('td', { class: 'r num', text: kes(l.qty * l.price) }))),
              h('tr', null, h('td', { class: 'sub', text: 'Subtotal' }), h('td', { class: 'r num', text: kes(o.subtotal) })),
              o.discount ? h('tr', null, h('td', { class: 'sub', text: 'Discount' + (o.couponCode ? ` (${o.couponCode})` : '') }), h('td', { class: 'r num', text: '− ' + kes(o.discount) })) : null,
              h('tr', null, h('td', { class: 'sub', text: 'Delivery' }), h('td', { class: 'r num', text: kes(o.deliveryFee) })),
              h('tr', null, h('td', null, h('b', { text: 'Total' })), h('td', { class: 'r num' }, h('b', { text: kes(o.total) }))))))),
          o.receipt ? kv('M-Pesa receipt', h('span', { class: 'code', text: o.receipt })) : null,
          h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px' },
            h('a', { class: 'btn btn-glass', href: wa, target: '_blank', rel: 'noopener', text: 'WhatsApp customer' })),
          h('div', { class: 'kv' }, h('span', { class: 'k', text: 'Add a note' }),
            h('form', { style: 'display:flex;gap:8px', onsubmit: (e) => { e.preventDefault(); const t = e.target.note.value.trim(); if (t) act({ note: t }, 'Note added'); } },
              h('input', { class: 'input', name: 'note', maxlength: 300, 'aria-label': 'Note', placeholder: 'Visible in the history only' }), h('button', { class: 'btn btn-glass', type: 'submit', text: 'Add' }))),
          h('div', { class: 'kv' }, h('span', { class: 'k', text: 'History' }),
            h('div', null, [...o.history].reverse().map((x) => h('div', { style: 'padding:8px 0;border-bottom:1px solid var(--line)' }, h('div', { text: x.text }), h('small', { style: 'color:var(--faint)', text: fmtDateTime(x.at) + (x.by ? ' · ' + x.by : '') }))))));

        const foot = [];
        const cancelled = o.status === 'cancelled';
        if (!cancelled) {
          if (owner || o.paymentStatus !== 'paid') foot.push(h('button', { class: 'btn btn-glass', type: 'button', style: 'border-color:var(--bad);color:var(--bad)', text: 'Cancel order', onclick: async () => {
            if (await confirmDialog({ title: 'Cancel this order?', message: 'Stock goes back on the shelf. If the customer already paid you will need to refund them.', confirmText: 'Cancel order', danger: true })) act({ status: 'cancelled' }, 'Order cancelled');
          } }));
          if (o.paymentStatus !== 'paid') foot.push(h('button', { class: 'btn btn-glass', type: 'button', text: o.paymentMethod === 'mpesa' ? 'Mark paid' : 'Mark cash received', onclick: async () => {
            let receipt = '';
            if (o.paymentMethod === 'mpesa') { receipt = (prompt('M-Pesa receipt code (optional)') || '').trim(); }
            act({ markPaid: true, receipt }, 'Marked as paid');
          } }));
          const n = NEXT[o.status];
          if (n) foot.push(h('button', { class: 'btn btn-gold', type: 'button', text: n[1], onclick: () => act({ status: n[0] }, STATUS_LABEL[n[0]]) }));
        }
        if (owner && o.paymentStatus === 'refund_due') foot.push(h('button', { class: 'btn btn-gold', type: 'button', text: 'Refund sent', onclick: () => act({ markRefunded: true }, 'Refund recorded') }));
        sheet.setFooter(...foot);
      };
      draw();
    },
  });
}

export async function render(root, ctx) {
  let status = ctx.params.get('status') || '';
  let q = '';
  let page = 1;
  const list = h('div');
  const chips = h('div', { class: 'seg', style: 'flex-wrap:wrap;border-radius:20px', role: 'group', 'aria-label': 'Filter by status' });
  const search = h('input', { class: 'input grow', type: 'search', placeholder: 'Search by order number, name or phone', 'aria-label': 'Search orders', oninput: debounce(() => { q = search.value.trim(); page = 1; load(); }, 250) });
  mount(root,
    h('div', { class: 'page-title' }, h('div', null, h('h1', { text: 'Orders' }), h('p', { text: 'Tap an order to update it, mark it paid or message the customer.' })),
      ctx.user.role === 'admin' ? h('a', { class: 'btn btn-glass', href: '/api/admin/orders.csv', download: 'orders.csv' }, icon('download'), ' Export CSV') : null),
    h('div', { class: 'toolbar' }, search), h('div', { class: 'toolbar' }, chips), list);

  const drawChips = () => mount(chips, FILTERS.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(v === status), text: l, onclick: () => { status = v; page = 1; drawChips(); load(); } })));
  drawChips();

  async function load() {
    const r = await api(`/admin/orders?status=${status}&q=${encodeURIComponent(q)}&page=${page}`);
    if (!r.orders.length) { mount(list, h('div', { class: 'card-a empty-a', text: q || status ? 'No orders match.' : 'No orders yet.' })); return; }
    const rows = r.orders.map((o) => h('tr', { class: 'click', tabindex: '0', onclick: () => openOrder(o, load, ctx.user), onkeydown: (e) => { if (e.key === 'Enter') openOrder(o, load, ctx.user); } },
      h('td', { 'data-label': 'Order' }, h('b', { text: o.number }), h('span', { class: 'sub', text: fmtDateTime(o.createdAt) })),
      h('td', { 'data-label': 'Customer' }, h('span', null, o.customer.name, h('span', { class: 'sub', text: prettyPhone(o.customer.phone) }))),
      h('td', { class: 'num', 'data-label': 'Total' }, kes(o.total)),
      h('td', { 'data-label': 'Payment' }, h('span', { style: 'display:grid;gap:4px;justify-items:end' }, payPill(o.paymentStatus), h('span', { class: 'sub', text: methodLabel(o.paymentMethod) }))),
      h('td', { 'data-label': 'Status' }, statusPill(o.status))));
    const pages = Math.ceil(r.total / r.per);
    mount(list, h('div', { class: 'card-a' }, h('div', { class: 'table-wrap' }, h('table', { class: 'tbl stack' },
      h('thead', null, h('tr', null, ['Order', 'Customer', 'Total', 'Payment', 'Status'].map((t) => h('th', { text: t })))), h('tbody', null, rows))),
      h('div', { class: 'pager' }, h('span', { text: `${r.total} order${r.total === 1 ? '' : 's'}` }),
        pages > 1 ? h('span', { style: 'display:flex;gap:8px;align-items:center' },
          h('button', { class: 'btn btn-glass', type: 'button', disabled: page <= 1, text: 'Previous', onclick: () => { page--; load(); } }), `Page ${page} of ${pages}`,
          h('button', { class: 'btn btn-glass', type: 'button', disabled: page >= pages, text: 'Next', onclick: () => { page++; load(); } })) : null)));
  }
  await load();
}
