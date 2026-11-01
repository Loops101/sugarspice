// Small dependency-free charts for the dashboard: line chart, ranked bars, thin segmented bar.
// All text from data goes through textContent (h() does this), never innerHTML.
import { h } from '/js/ui.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  kids.flat().forEach((k) => k && el.append(k));
  return el;
};

const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const shortDay = new Intl.DateTimeFormat('en-KE', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const longDay = new Intl.DateTimeFormat('en-KE', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
export const dayShort = (s) => shortDay.format(parseDay(s));
export const dayLong = (s) => longDay.format(parseDay(s));

export function compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return Math.round(n).toLocaleString('en-KE');
}

// Round the axis to clean numbers (0 / 1,000 / 2,000...)
function niceMax(max, intervals = 4) {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / intervals;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  return { top: step * intervals, step };
}

/* ---------------------------- Floating tooltip --------------------------- */
let floating;
export function attachTip(el, build) {
  const show = (x, y) => {
    if (!floating) { floating = h('div', { class: 'tip', style: 'position:fixed;transform:none', role: 'tooltip' }); document.body.append(floating); }
    floating.replaceChildren(build());
    floating.hidden = false;
    const w = floating.offsetWidth, hgt = floating.offsetHeight;
    floating.style.left = Math.max(8, Math.min(x + 14, innerWidth - w - 8)) + 'px';
    floating.style.top = Math.max(8, Math.min(y + 14, innerHeight - hgt - 8)) + 'px';
  };
  const hide = () => { if (floating) floating.hidden = true; };
  el.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
  el.addEventListener('pointerleave', hide);
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); show(r.left + r.width / 2, r.top); });
  el.addEventListener('blur', hide);
}

/* -------------------------------- Line chart ----------------------------- */
/**
 * series: [{ name, color, values[], area?, width?, endLabel? }] drawn in order, so put context lines first.
 * fmt(value) formats numbers in the tooltip and end label.
 */
export function lineChart({ dates, series, fmt, height = 290, label }) {
  const host = h('div', { class: 'chart', tabindex: '0', role: 'group', 'aria-label': label || 'Line chart. Use the left and right arrow keys to read each day.' });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  host.append(live);
  const tip = h('div', { class: 'tip', hidden: true });
  host.append(tip);
  let active = -1;
  let drawn = null;

  function draw() {
    const W = Math.max(280, host.clientWidth || 600);
    const m = { l: 54, r: 70, t: 14, b: 30 };
    const pw = W - m.l - m.r, ph = height - m.t - m.b;
    const n = dates.length;
    const max = Math.max(0, ...series.flatMap((s) => s.values));
    const { top, step } = niceMax(max);
    const x = (i) => m.l + (n === 1 ? pw / 2 : (i * pw) / (n - 1));
    const y = (v) => m.t + ph - (v / top) * ph;
    const useK = top >= 10000;
    const tickLabel = (v) => (useK ? compact(v) : Math.round(v).toLocaleString('en-KE'));

    const el = svg('svg', { width: W, height, viewBox: `0 0 ${W} ${height}`, 'aria-hidden': 'true' });
    const grid = svg('g', { class: 'grid' });
    for (let v = 0; v <= top + 1e-9; v += step) {
      grid.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      el.append(svg('text', { x: m.l - 10, y: y(v) + 4, 'text-anchor': 'end' }, document.createTextNode(tickLabel(v))));
    }
    el.prepend(grid);

    const xt = Math.max(2, Math.min(7, Math.floor(pw / 96)));
    for (let k = 0; k < xt; k++) {
      const i = Math.round((k * (n - 1)) / (xt - 1 || 1));
      const anchor = k === 0 ? 'start' : k === xt - 1 ? 'end' : 'middle';
      el.append(svg('text', { x: x(i), y: height - 8, 'text-anchor': anchor }, document.createTextNode(dayShort(dates[i]))));
    }
    el.append(svg('g', { class: 'axis' }, svg('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) })));

    series.forEach((s) => {
      const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      if (s.area) el.append(svg('path', { d: `M${x(0)},${y(0)} L${pts.join(' L')} L${x(n - 1)},${y(0)} Z`, fill: s.color, 'fill-opacity': '0.1' }));
      el.append(svg('path', { d: 'M' + pts.join(' L'), fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      if (s.endLabel) {
        const lx = x(n - 1), ly = y(s.values[n - 1]);
        el.append(svg('circle', { cx: lx, cy: ly, r: 4, fill: s.color, stroke: '#14110e', 'stroke-width': 2 }));
        el.append(svg('text', { x: lx + 10, y: ly + 4, class: 'endlabel' }, document.createTextNode(compact(s.values[n - 1]))));
      }
    });

    const cross = svg('line', { y1: m.t, y2: m.t + ph, stroke: 'rgba(244,236,220,.28)', 'stroke-width': 1, visibility: 'hidden' });
    const dots = series.map((s) => svg('circle', { r: 4.5, fill: s.color, stroke: '#14110e', 'stroke-width': 2, visibility: 'hidden' }));
    const hit = svg('rect', { x: m.l - 4, y: m.t, width: pw + 8, height: ph + 6, fill: 'transparent', style: 'touch-action:pan-y;cursor:crosshair' });
    el.append(cross, ...dots, hit);

    const show = (i) => {
      active = Math.max(0, Math.min(n - 1, i));
      const px = x(active);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      dots.forEach((d, k) => { d.setAttribute('cx', px); d.setAttribute('cy', y(series[k].values[active])); d.setAttribute('visibility', 'visible'); });
      tip.replaceChildren(h('div', { class: 't', text: dayLong(dates[active]) }),
        ...series.slice().reverse().map((s) => h('div', { class: 'r' }, h('span', null, h('i', { style: `border-color:${s.color}` }), s.name), h('b', { text: fmt(s.values[active]) }))));
      tip.hidden = false;
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(tw / 2 + 4, Math.min(px, W - tw / 2 - 4)) + 'px';
      tip.style.top = '0px';
      live.textContent = `${dayLong(dates[active])}: ` + series.map((s) => `${s.name} ${fmt(s.values[active])}`).join(', ');
    };
    const hideTip = () => { cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); tip.hidden = true; active = -1; };
    const idxFrom = (e) => { const r = hit.getBoundingClientRect(); return n === 1 ? 0 : Math.round(((e.clientX - r.left - 4) / pw) * (n - 1)); };
    hit.addEventListener('pointermove', (e) => show(idxFrom(e)));
    hit.addEventListener('pointerdown', (e) => show(idxFrom(e)));
    hit.addEventListener('pointerleave', hideTip);
    drawn = { show, hideTip };
    host.querySelector('svg')?.remove();
    host.prepend(el);
    if (active >= 0) show(active);
  }

  host.addEventListener('keydown', (e) => {
    if (!drawn) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); drawn.show(active < 0 ? 0 : active + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); drawn.show(active < 0 ? dates.length - 1 : active - 1); }
    else if (e.key === 'Escape' || e.key === 'Tab') drawn.hideTip();
  });
  host.addEventListener('blur', () => drawn && drawn.hideTip());
  requestAnimationFrame(draw);
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (host.isConnected) draw(); }).observe(host);
  return host;
}

/* ------------------------------- Ranked bars ----------------------------- */
// One series = one colour. Value sits at the bar tip; the full details live in the tooltip and the focusable row.
export function barList(items, { fmt, detail, empty = 'Nothing to show yet.' }) {
  if (!items.length) return h('p', { style: 'color:var(--faint);margin:0', text: empty });
  const max = Math.max(...items.map((i) => i.value), 1);
  return h('div', { class: 'bars' }, items.map((it) => {
    const row = h('div', { class: 'bar-row', tabindex: '0', role: 'group', 'aria-label': `${it.name}: ${fmt(it.value)}${detail ? ', ' + detail(it) : ''}` },
      h('span', { class: 'nm', text: it.name }),
      h('div', { class: 'track' }, h('span', { class: 'fill', style: `width:${Math.max(1, (it.value / max) * 62)}%` }), h('span', { class: 'val', text: fmt(it.value) })));
    attachTip(row, () => h('div', null, h('div', { class: 't', text: it.name }), h('div', { class: 'r' }, h('b', { text: fmt(it.value) })), detail ? h('div', { class: 't', style: 'margin:6px 0 0', text: detail(it) }) : null));
    return row;
  }));
}

/* ----------------------------- Thin segmented bar ------------------------ */
export function splitBar(parts, { unit = 'orders' } = {}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return h('p', { style: 'color:var(--faint);margin:0', text: 'No orders in this period yet.' });
  const pct = (v) => Math.round((v / total) * 100);
  const bar = h('div', { class: 'split', role: 'img', 'aria-label': parts.map((p) => `${p.name} ${pct(p.value)}%`).join(', ') },
    parts.filter((p) => p.value > 0).map((p) => h('i', { style: `width:${(p.value / total) * 100}%;background:${p.color}` })));
  const legend = h('div', { class: 'split-legend' }, parts.map((p) => h('div', null,
    h('span', null, h('i', { style: `background:${p.color}` }), p.name), h('b', { text: `${p.value} ${unit}, ${pct(p.value)}%` }))));
  return h('div', null, bar, legend);
}
