import { h, mount, kes, icon, fmtDateTime, toast } from '/js/ui.js';
import { api } from '/js/api.js';
import { lineChart, barList, splitBar, compact, dayShort } from './charts.js';
import { statusPill, payPill, STATUS_LABEL, confirmDialog } from './common.js';
import { openOrder } from './orders.js';

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
let days = 30;

function delta(cur, prev, fmt = (n) => n) {
  if (!prev && !cur) return h('span', { class: 'delta' }, 'No change');
  if (!prev) return h('span', { class: 'delta' }, 'New this period');
  const pct = Math.round(((cur - prev) / prev) * 100);
  const cls = pct > 0 ? 'good' : pct < 0 ? 'bad' : '';
  return h('span', { class: 'delta ' + cls }, pct ? icon(pct > 0 ? 'up' : 'down') : null,
    h('span', { text: pct === 0 ? 'Same as before' : `${Math.abs(pct)}% ${pct > 0 ? 'up' : 'down'}` }), h('small', { text: `from ${fmt(prev)}` }));
}

export async function render(root, ctx) {
  const frame = h('div', { class: 'loading-frame' });
  const head = h('div', { class: 'page-title' }, h('div', null, h('h1', { text: 'Dashboard' }), h('p', { text: ctx.user.role === 'admin' ? 'How the shop is doing, in Nairobi time.' : `Hello ${ctx.user.name.split(' ')[0]}, here is what needs doing today.` })));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Date range' }, RANGES.map(([d, label]) =>
    h('button', { type: 'button', 'aria-pressed': String(d === days), text: label, onclick: () => { days = d; seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(RANGES[i][0] === d))); load(); } })));
  if (ctx.user.role === 'admin') head.append(seg);
  mount(root, head, frame);

  async function load() {
    frame.classList.add('is-loading');
    try {
      const s = await api('/admin/stats?days=' + days);
      mount(frame, view(s, load));
      ctx.setBadge(s.toFulfil);
    } catch (e) { mount(frame, h('div', { class: 'empty-a', text: e.message })); if (e.status === 401 || e.status === 403) throw e; }
    finally { frame.classList.remove('is-loading'); }
  }
  await load();
}

function staffView(s, reload) {
  const out = h('div');
  out.append(h('div', { class: 'kpis' },
    h('div', { class: 'card-a tile' }, h('span', { class: 'lbl', text: 'To fulfil' }), h('a', { class: 'num', href: '#/orders?status=new', text: String(s.toFulfil) }), h('small', { class: 'sub', text: 'New and being prepared' })),
    h('div', { class: 'card-a tile' }, h('span', { class: 'lbl', text: 'Out for delivery' }), h('a', { class: 'num', href: '#/orders?status=out_for_delivery', text: String(s.statusCounts.out_for_delivery || 0) })),
    h('div', { class: 'card-a tile' }, h('span', { class: 'lbl', text: 'Awaiting payment' }), h('a', { class: 'num', href: '#/orders?status=awaiting_payment', text: String(s.statusCounts.awaiting_payment || 0) })),
    h('div', { class: 'card-a tile' }, h('span', { class: 'lbl', text: 'Products live' }), h('a', { class: 'num', href: '#/products', text: String(s.totals.products) }))));
  out.append(h('div', { class: 'grid-a g2' },
    h('section', { class: 'card-a' }, h('div', { class: 'card-head' }, h('h2', { text: 'Low stock' }), h('a', { href: '#/products', text: 'All products' })),
      s.lowStock.length ? h('div', { class: 'pipe' }, s.lowStock.map((p) => h('a', { href: '#/products?q=' + encodeURIComponent(p.name) }, h('span', { text: p.name }), h('b', { text: p.stock === 0 ? 'Sold out' : `${p.stock} left` }))))
        : h('p', { style: 'margin:0;color:var(--faint)', text: 'Everything is well stocked.' })),
    h('section', { class: 'card-a' }, h('div', { class: 'card-head' }, h('h2', { text: 'Latest orders' }), h('a', { href: '#/orders', text: 'All orders' })),
      s.recent.length ? h('div', { class: 'pipe' }, s.recent.map((o) => h('a', { href: '#/orders', onclick: (e) => { e.preventDefault(); openOrder(o, reload, window.__adminUser); } },
        h('span', null, h('b', { text: o.number }), ' ', h('span', { style: 'color:var(--faint)', text: o.customer.name })), statusPill(o.status))))
        : h('p', { style: 'margin:0;color:var(--faint)', text: 'No orders yet.' }))));
  return out;
}

function view(s, reload) {
  if (s.limited) return staffView(s, reload);
  const out = h('div');
  if (s.hasDemoData) {
    out.append(h('div', { class: 'notice' }, h('p', { text: 'You are looking at sample products and orders so the dashboard has something to show. Remove them when you are ready to add your own.' }),
      h('button', { class: 'btn btn-glass', type: 'button', text: 'Remove sample data', onclick: async () => {
        if (!(await confirmDialog({ title: 'Remove sample data?', message: 'This deletes the sample products, orders and coupon. Real orders and products stay.', confirmText: 'Remove', danger: true }))) return;
        try { await api('/admin/demo/clear', { method: 'POST', body: {} }); toast('Sample data removed'); reload(); } catch (e) { toast(e.message, 'err'); }
      } })));
  }
  if (s.mpesaMode !== 'live') {
    out.append(h('div', { class: 'notice info' }, h('p', { text: 'M-Pesa is in demo mode: payments are simulated and no real money moves. Add your Daraja keys in the server settings to take real payments.' }),
      h('a', { class: 'btn btn-glass', href: '#/settings', text: 'See setup' })));
  }

  const cur = s.current, prev = s.previous;
  out.append(h('section', { class: 'card-a hero-fig', 'aria-label': 'Revenue' },
    h('div', null, h('div', { class: 'lbl', text: `Revenue, last ${s.days} days` }), h('div', { class: 'num', text: kes(cur.revenue) })),
    delta(cur.revenue, prev.revenue, kes)));

  const tile = (label, num, extra, sub, href) => h('div', { class: 'card-a tile' }, h('span', { class: 'lbl', text: label }),
    href ? h('a', { class: 'num', href, text: num }) : h('span', { class: 'num', text: num }), extra, sub ? h('small', { class: 'sub', text: sub }) : null);
  out.append(h('div', { class: 'kpis' },
    tile('Paid orders', String(cur.orders), delta(cur.orders, prev.orders)),
    tile('Average order', kes(cur.aov), delta(cur.aov, prev.aov, kes)),
    tile('To fulfil', String(s.toFulfil), null, 'New and being prepared', '#/orders?status=new'),
    tile('Cash on delivery owed', kes(s.codOutstanding), null, 'Collect when delivered')));

  // Revenue chart with previous period for context
  const dates = s.series.map((r) => r.date);
  const chartCard = h('section', { class: 'card-a', style: 'margin-bottom:16px' });
  const chartBox = h('div');
  let table = false;
  const toggle = h('button', { class: 'btn btn-glass', type: 'button', style: 'min-height:44px;padding:0 16px', 'aria-pressed': 'false', text: 'View as table', onclick: () => { table = !table; toggle.textContent = table ? 'View as chart' : 'View as table'; toggle.setAttribute('aria-pressed', String(table)); draw(); } });
  function draw() {
    if (!table) {
      mount(chartBox, lineChart({ dates, fmt: kes, label: `Daily revenue for the last ${s.days} days. Use the arrow keys to read each day.`, series: [
        { name: 'Previous period', color: 'var(--viz-prev)', values: s.previousSeries, width: 1.5 },
        { name: 'Revenue', color: 'var(--viz-1)', values: s.series.map((r) => r.revenue), area: true, endLabel: true },
      ] }));
    } else {
      mount(chartBox, h('div', { class: 'table-wrap', style: 'max-height:340px;overflow-y:auto' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', { text: 'Day' }), h('th', { class: 'r', text: 'Orders' }), h('th', { class: 'r', text: 'Revenue' }), h('th', { class: 'r', text: 'Previous' }))),
        h('tbody', null, s.series.slice().reverse().map((r, k) => h('tr', null, h('td', { text: dayShort(r.date) }), h('td', { class: 'r num', text: r.orders }), h('td', { class: 'r num', text: kes(r.revenue) }), h('td', { class: 'r num', text: kes(s.previousSeries[s.series.length - 1 - k]) })))))));
    }
  }
  chartCard.append(h('div', { class: 'card-head' }, h('h2', { text: 'Revenue per day' }),
    h('div', { style: 'display:flex;gap:16px;align-items:center;flex-wrap:wrap' },
      h('div', { class: 'legend' }, h('span', null, h('i', { style: 'border-color:var(--viz-1)' }), 'Revenue'), h('span', null, h('i', { style: 'border-color:var(--viz-prev)' }), 'Previous period')), toggle)), chartBox);
  out.append(chartCard);
  draw();

  out.append(h('div', { class: 'grid-a g2' },
    h('section', { class: 'card-a' }, h('h2', { text: 'Best sellers' }),
      barList(s.topProducts.map((p) => ({ name: p.name, value: p.revenue, units: p.units })), { fmt: kes, detail: (i) => `${i.units} sold`, empty: 'No paid sales in this period yet.' })),
    h('section', { class: 'card-a' }, h('h2', { text: 'Sales by category' }),
      barList(s.categories.map((c) => ({ name: c.name, value: c.revenue })), { fmt: kes, empty: 'No paid sales in this period yet.' }))));

  out.append(h('div', { class: 'grid-a g3' },
    h('section', { class: 'card-a' }, h('h2', { text: 'How people pay' }),
      splitBar([{ name: 'M-Pesa', value: s.methods.mpesa, color: 'var(--viz-1)' }, { name: 'Pay on delivery', value: s.methods.cod, color: 'var(--viz-2)' }])),
    h('section', { class: 'card-a' }, h('h2', { text: 'Guest or account' }),
      splitBar([{ name: 'Guest checkout', value: s.channel.guest, color: 'var(--viz-1)' }, { name: 'Signed in', value: s.channel.account, color: 'var(--viz-2)' }]),
      h('p', { style: 'margin:14px 0 0;font-size:.92rem', text: `${s.newCustomers} new and ${s.returningCustomers} returning customers in this period.` })),
    h('section', { class: 'card-a' }, h('h2', { text: 'Order pipeline' }),
      h('div', { class: 'pipe' }, ['awaiting_payment', 'new', 'processing', 'out_for_delivery', 'completed', 'cancelled'].map((k) =>
        h('a', { href: '#/orders?status=' + k }, h('span', { text: STATUS_LABEL[k] }), h('b', { text: s.statusCounts[k] || 0 })))))));

  out.append(h('div', { class: 'grid-a g2' },
    h('section', { class: 'card-a' }, h('div', { class: 'card-head' }, h('h2', { text: 'Low stock' }), h('a', { href: '#/products', text: 'All products' })),
      s.lowStock.length ? h('div', { class: 'pipe' }, s.lowStock.map((p) => h('a', { href: '#/products?q=' + encodeURIComponent(p.name) }, h('span', { text: p.name }), h('b', { text: p.stock === 0 ? 'Sold out' : `${p.stock} left` }))))
        : h('p', { style: 'margin:0;color:var(--faint)', text: 'Everything is well stocked.' })),
    h('section', { class: 'card-a' }, h('div', { class: 'card-head' }, h('h2', { text: 'Latest orders' }), h('a', { href: '#/orders', text: 'All orders' })),
      s.recent.length ? h('div', { class: 'pipe' }, s.recent.map((o) => h('a', { href: '#/orders', onclick: (e) => { e.preventDefault(); openOrder(o, reload, window.__adminUser); } },
        h('span', null, h('b', { text: o.number }), ' ', h('span', { style: 'color:var(--faint)', text: o.customer.name })), h('span', { style: 'display:flex;gap:10px;align-items:center' }, statusPill(o.status), h('b', { text: kes(o.total) })))))
        : h('p', { style: 'margin:0;color:var(--faint)', text: 'No orders yet. Share your link on Instagram to get the first one.' }))));
  return out;
}
