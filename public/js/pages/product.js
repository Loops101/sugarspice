import { h, $, mount, kes, icon, waIcon } from '../ui.js';
import { initLayout, waLink } from '../layout.js';
import { getProducts } from '../store.js';
import { mediaAt, productCard, quickAdd } from '../card.js';
import { addToCart } from '../store.js';
import { emptyGlyph } from '../art.js';

const { store } = await initLayout();
const root = $('#pdp-root');
const id = new URLSearchParams(location.search).get('id') || '';

let products = [];
try { products = await getProducts(); } catch { /* handled below */ }
const p = products.find((x) => x.id === id);

if (!p) {
  document.title = 'Piece not found | Sugar & Spice Couture';
  mount(root, h('div', { class: 'empty' }, emptyGlyph(), h('h1', { style: 'font-size:2.2rem', text: products.length ? 'We could not find that piece' : 'We could not load this piece' }),
    h('p', { text: products.length ? 'It may have sold out or been removed. Have a look at what is available now.' : 'Please check your connection and try again.' }),
    h('a', { class: 'btn btn-gold', href: '/shop.html', text: 'Browse the collection' })));
} else {
  // SEO: title, description, canonical and structured data for this product
  document.title = `${p.name} | Sugar & Spice Couture`;
  const desc = (p.description || `${p.name} from Sugar & Spice Couture.`).slice(0, 155);
  document.querySelector('meta[name="description"]').setAttribute('content', desc);
  $('#canonical').href = `${location.origin}/product.html?id=${encodeURIComponent(p.id)}`;
  $('#og-title').setAttribute('content', p.name);
  $('#og-desc').setAttribute('content', desc);
  if (p.images[0]) $('#og-img').setAttribute('content', new URL(p.images[0], location.origin).href);
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: desc, category: p.category,
    ...(p.images.length ? { image: p.images.map((i) => new URL(i, location.origin).href) } : {}),
    brand: { '@type': 'Brand', name: store.name },
    offers: { '@type': 'Offer', priceCurrency: 'KES', price: p.price, availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: location.href },
  });
  document.head.append(ld);

  $('#crumbs').append(' / ', h('a', { href: `/shop.html?category=${encodeURIComponent(p.category)}`, text: p.category }), ' / ', h('span', { 'aria-current': 'page', text: p.name }));

  const out = p.stock <= 0;
  const low = !out && p.stock <= store.lowStockThreshold;
  let qty = 1;
  const qtyOut = h('output', { 'aria-live': 'polite', text: '1' });
  const minus = h('button', { type: 'button', 'aria-label': 'Decrease quantity', disabled: true, text: '−' });
  const plus = h('button', { type: 'button', 'aria-label': 'Increase quantity', disabled: p.stock <= 1, text: '+' });
  const setQ = (n) => { qty = Math.max(1, Math.min(n, p.stock, 20)); qtyOut.textContent = String(qty); minus.disabled = qty <= 1; plus.disabled = qty >= Math.min(p.stock, 20); };
  minus.addEventListener('click', () => setQ(qty - 1));
  plus.addEventListener('click', () => setQ(qty + 1));

  // Gallery: swipeable on mobile (scroll-snap), thumbnails on desktop
  const count = Math.max(1, p.images.length);
  const main = h('div', { class: 'main', tabindex: '0', role: 'group', 'aria-label': `${p.name} photos` }, Array.from({ length: count }, (_, i) => mediaAt(p, i)));
  const thumbs = h('div', { class: 'thumbs' });
  if (count > 1) {
    const btns = Array.from({ length: count }, (_, i) => h('button', { type: 'button', 'aria-label': `Show photo ${i + 1}`, 'aria-current': String(i === 0), onclick: () => main.scrollTo({ left: main.clientWidth * i, behavior: 'smooth' }) }, mediaAt(p, i)));
    mount(thumbs, btns);
    main.addEventListener('scroll', () => { const i = Math.round(main.scrollLeft / main.clientWidth); btns.forEach((b, j) => b.setAttribute('aria-current', String(i === j))); }, { passive: true });
  }

  const askText = `Hello ${store.name}, I'd like to ask about "${p.name}" (${kes(p.price)}).`;
  mount(root, h('div', { class: 'pdp' },
    h('div', { class: 'gallery' }, main, thumbs),
    h('div', { class: 'info' },
      h('span', { class: 'kicker', text: p.category }),
      h('h1', { text: p.name }),
      h('div', { class: 'price-row', style: 'margin-bottom:14px' }, h('span', { class: 'price', text: kes(p.price) }), p.oldPrice ? h('span', { class: 'was', text: kes(p.oldPrice) }) : null,
        p.oldPrice ? h('span', { class: 'tag sale', text: `Save ${kes(p.oldPrice - p.price)}` }) : null),
      h('div', { class: 'stock-note' + (out ? ' out' : low ? ' low' : ''), text: out ? 'Sold out' : low ? `Only ${p.stock} left` : 'In stock' }),
      p.description ? h('p', { text: p.description }) : null,
      out
        ? h('div', { class: 'buy-row' }, h('a', { class: 'btn btn-wa', href: waLink(store, `Hello ${store.name}, will "${p.name}" be back in stock?`), target: '_blank', rel: 'noopener' }, waIcon(), 'Ask about restock'), h('a', { class: 'btn btn-glass', href: '/shop.html', text: 'Keep browsing' }))
        : h('div', null,
          h('div', { class: 'buy-row', style: 'margin-bottom:0' },
            h('div', { class: 'qty', role: 'group', 'aria-label': 'Quantity' }, minus, qtyOut, plus),
            h('button', { class: 'btn btn-gold', type: 'button', onclick: () => quickAdd(p, qty), text: 'Add to bag' })),
          h('div', { class: 'buy-row' },
            h('button', { class: 'btn btn-glass', type: 'button', onclick: () => { const r = addToCart(p.id, qty, p.stock); if (r.ok || /already/.test(r.reason)) location.href = '/checkout.html'; }, text: 'Buy now' }),
            h('a', { class: 'btn btn-glass', href: waLink(store, askText), target: '_blank', rel: 'noopener' }, waIcon(), 'Ask on WhatsApp'))),
      h('dl', { class: 'details' },
        h('div', null, h('dt', { text: 'Category' }), h('dd', null, h('a', { href: `/shop.html?category=${encodeURIComponent(p.category)}`, text: p.category }))),
        h('div', null, h('dt', { text: 'Payment' }), h('dd', { text: 'M-Pesa or cash on delivery' })),
        h('div', null, h('dt', { text: 'Checkout' }), h('dd', { text: 'Guest checkout, no account needed' }))))));

  const related = products.filter((x) => x.category === p.category && x.id !== p.id && x.stock > 0).slice(0, 4);
  const more = related.length >= 4 ? related : [...related, ...products.filter((x) => x.category !== p.category && x.stock > 0 && x.id !== p.id)].slice(0, 4);
  if (more.length) { mount($('#related-grid'), more.map((x) => productCard(x, store))); $('#related').hidden = false; }
}
