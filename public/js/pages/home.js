import { h, $, mount, icon, kes, reveal } from '../ui.js';
import { initLayout, waLink } from '../layout.js';
import { heroArt, art, kindForCategory } from '../art.js';
import { getProducts } from '../store.js';
import { productCard, skeletons, media } from '../card.js';

const { store } = await initLayout();

// Hero art + gentle pointer parallax (skipped for reduced motion / touch)
const stage = $('#hero-stage');
stage.prepend(heroArt());
if (matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const chips = [...stage.querySelectorAll('.hero-chip')];
  const svg = stage.querySelector('svg');
  window.addEventListener('pointermove', (e) => {
    const x = (e.clientX / innerWidth - 0.5) * 2, y = (e.clientY / innerHeight - 0.5) * 2;
    svg.style.transform = `translate(${x * -8}px, ${y * -6}px)`;
    chips.forEach((c, i) => { c.style.translate = `${x * (i ? -14 : 14)}px ${y * 8}px`; });
  }, { passive: true });
}

mount($('#hero-proof'),
  [['lock', 'Guest checkout, no account needed'], ['phone', 'Pay with M-Pesa or on delivery'], ['truck', 'Delivery or shop pickup']]
    .map(([i, t]) => h('li', null, h('span', null, icon(i), t))));

mount($('#why'), [
  ['gem', 'Carefully selected', 'Every piece is chosen to feel elegant and easy to wear, from everyday chains to occasion sets.'],
  ['phone', 'Pay your way', 'Pay with an M-Pesa prompt on your phone, or choose cash on delivery.'],
  ['truck', 'Delivery or pickup', 'Have it delivered, or collect from our shop at Superior Center on Kimathi Street.'],
  ['chat', 'Real people', 'Questions about a piece? Message us on WhatsApp and we will help.'],
].map(([i, t, d]) => h('div', { class: 'panel reveal' }, icon(i), h('h3', { text: t }), h('p', { text: d }))));

const ig = store.instagram;
if (ig) { $('#ig-link').href = `https://www.instagram.com/${ig}/`; $('#ig-link').textContent = `Follow @${ig}`; }
else $('#ig-band').hidden = true;

$('#promo-art').append(art('set', 'sapphire', { bg: false }));

const grids = { new: $('#new-grid'), best: $('#best-grid') };
mount(grids.new, skeletons(4));
mount(grids.best, skeletons(4));

let products = [];
try { products = await getProducts(); } catch { /* shown below */ }

if (!products.length) {
  const msg = h('p', { style: 'grid-column:1/-1', text: 'Our collection is loading. Please refresh in a moment.' });
  mount(grids.new, msg.cloneNode(true)); mount(grids.best, msg);
} else {
  const inStock = (p) => p.stock > 0;
  const newest = [...products].filter(inStock).sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  let best = products.filter((p) => p.bestseller && inStock(p));
  if (best.length < 4) best = [...best, ...products.filter((p) => !p.bestseller && inStock(p) && !best.includes(p))].slice(0, 4);
  mount(grids.new, newest.map((p) => productCard(p, store)));
  mount(grids.best, best.slice(0, 4).map((p) => productCard(p, store)));

  // Categories that have pieces, each shown with a real photo from that category
  mount($('#cat-grid'), store.categories.filter((c) => products.some((p) => p.category === c)).map((c) => {
    const inCat = products.filter((p) => p.category === c);
    const n = inCat.length;
    const cover = inCat.find((p) => p.images && p.images.length) || inCat[0];
    const pic = cover.images && cover.images.length ? media(cover) : art(kindForCategory(c), c);
    if (pic.tagName === 'IMG') pic.className = 'cat-photo';
    return h('a', { class: 'cat-tile reveal', href: `/shop.html?category=${encodeURIComponent(c)}`, 'aria-label': `${c}, ${n} piece${n === 1 ? '' : 's'}` },
      pic, h('div', { class: 'label' }, h('span', { text: c }), h('small', { text: `${n} piece${n === 1 ? '' : 's'}` })));
  }));

  // Hero: real photos when we have them
  const shots = [...products.filter((p) => p.featured && p.images && p.images.length), ...products.filter((p) => !p.featured && p.images && p.images.length)]
    .filter((p, i, a) => a.findIndex((q) => q.category === p.category) === i || i < 3).slice(0, 3);
  if (shots.length >= 3) {
    const art0 = stage.querySelector('svg.art');
    const frame = h('div', { class: 'hero-photos', 'aria-hidden': 'true' }, shots.map((p, i) => h('a', { class: 'hp hp' + (i + 1), href: `/product.html?id=${encodeURIComponent(p.id)}`, tabindex: '-1' }, h('img', { src: p.images[0], alt: '', loading: i ? 'lazy' : 'eager', decoding: 'async' }))));
    if (art0) art0.replaceWith(frame); else stage.prepend(frame);
  }

  // Hero chips from real prices
  const from = (cat) => { const l = products.filter((p) => p.category === cat && p.stock > 0).map((p) => p.price); return l.length ? Math.min(...l) : null; };
  const chip = (el, label, price) => { if (price == null) return; mount(el, h('div', null, h('small', { text: label }), h('strong', { text: kes(price) }))); el.hidden = false; };
  const cats = store.categories.filter((c) => from(c) != null);
  const pick = ['Earrings', 'Rings', 'Hats', 'Sets'].filter((c) => cats.includes(c));
  const [ca, cb] = [pick[0] || cats[0], pick[1] || cats[1]];
  if (ca) chip($('#chip-a'), `${ca} from`, from(ca));
  if (cb) chip($('#chip-b'), `${cb} from`, from(cb));
}
reveal();
