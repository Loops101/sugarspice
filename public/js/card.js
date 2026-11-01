// Product media + card, used by home, shop, product and cart views.
import { h, kes, toast } from './ui.js';
import { art } from './art.js';
import { addToCart, getStore } from './store.js';

/** Real photo when available, otherwise a drawn illustration. */
export function media(product, { eager = false, width = 640 } = {}) {
  const src = product.images && product.images[0];
  if (src) {
    const img = h('img', { src, alt: product.name, loading: eager ? 'eager' : 'lazy', decoding: 'async', width, height: width });
    img.addEventListener('error', () => img.replaceWith(art(product.art || 'necklace', product.name)), { once: true });
    return img;
  }
  return art(product.art || 'necklace', product.name);
}

export const mediaAt = (product, i) => {
  const src = product.images && product.images[i];
  if (!src) return art(product.art || 'necklace', product.name);
  const img = h('img', { src, alt: `${product.name}, photo ${i + 1}`, loading: i ? 'lazy' : 'eager', decoding: 'async' });
  img.addEventListener('error', () => img.replaceWith(art(product.art || 'necklace', product.name)), { once: true });
  return img;
};

export async function quickAdd(product, qty = 1, { open = true } = {}) {
  const res = addToCart(product.id, qty, product.stock);
  if (!res.ok) { toast(res.reason, 'err'); return false; }
  toast(res.capped ? `Added. That's all we have of ${product.name}.` : `${product.name} added to bag`);
  if (open) document.dispatchEvent(new CustomEvent('cart:added'));
  return true;
}

const isNew = (p) => Date.now() - p.createdAt < 14 * 24 * 3600 * 1000;

export function productCard(p, store) {
  const out = p.stock <= 0;
  const low = !out && p.stock <= (store ? store.lowStockThreshold : 3);
  const tags = h('div', { class: 'tags' },
    out ? h('span', { class: 'tag out', text: 'Sold out' }) : null,
    !out && p.oldPrice ? h('span', { class: 'tag sale', text: 'Sale' }) : null,
    !out && !p.oldPrice && p.bestseller ? h('span', { class: 'tag', text: 'Bestseller' }) : null,
    !out && !p.oldPrice && !p.bestseller && isNew(p) ? h('span', { class: 'tag', text: 'New' }) : null,
    low ? h('span', { class: 'tag low', text: `Only ${p.stock} left` }) : null);

  return h('article', { class: 'card' },
    h('div', { class: 'media' }, tags, media(p)),
    h('div', { class: 'body' },
      h('span', { class: 'cat', text: p.category }),
      h('h3', null, h('a', { href: `/product.html?id=${encodeURIComponent(p.id)}`, text: p.name })),
      h('div', { class: 'price-row' },
        h('span', { class: 'price', text: kes(p.price) }),
        p.oldPrice ? h('span', { class: 'was', 'aria-label': 'was', text: kes(p.oldPrice) }) : null),
      h('button', {
        class: 'btn btn-glass btn-sm btn-block add', type: 'button', disabled: out,
        'aria-label': out ? `${p.name} is sold out` : `Add ${p.name} to bag`,
        onclick: () => quickAdd(p),
        text: out ? 'Sold out' : 'Add to bag',
      })));
}

export function skeletons(n = 8) {
  return Array.from({ length: n }, () => h('div', { class: 'skel', 'aria-hidden': 'true' }));
}

export { getStore };
