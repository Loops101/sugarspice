// Injects the header, mobile menu, cart drawer and footer on every page.
import { h, $, mount, icon, waIcon, kes, toast, trapFocus, reveal } from './ui.js';
import { brandMark, emptyGlyph } from './art.js';
import { getStore, getMe, cartCount, cartLines, onCartChange, setQty, removeLine } from './store.js';
import { media } from './card.js';

const NAV = [
  ['/', 'Home', 'home'],
  ['/shop.html', 'Shop', 'shop'],
  ['/#collections', 'Collections', 'collections'],
  ['/about.html', 'About', 'about'],
  ['/contact.html', 'Contact', 'contact'],
];

export const waLink = (store, text) => `https://wa.me/${store.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`;

export async function initLayout() {
  const page = document.body.dataset.page || '';
  let store;
  try { store = await getStore(); } catch { store = { name: 'Sugar & Spice Couture', tagline: '', whatsapp: '', instagram: '', address: '', phone: '', categories: [] }; }
  const me = await getMe().catch(() => null);

  // Header
  const bagBadge = h('span', { class: 'badge-count', hidden: true, 'aria-hidden': 'true' });
  const bagBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Open shopping bag', 'aria-haspopup': 'dialog', id: 'bag-btn' }, icon('bag'), bagBadge);
  const menuBtn = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Open menu', 'aria-expanded': 'false', 'aria-controls': 'mobile-nav' }, icon('menu'));
  const acct = h('a', { class: 'icon-btn', href: '/account.html', 'aria-label': me ? `Your account, signed in as ${me.name}` : 'Sign in or create an account' },
    me ? h('span', { class: 'avatar-dot', text: (me.name || '?').trim().charAt(0).toUpperCase() }) : icon('user'));

  const navLinks = () => NAV.map(([href, label, key]) => h('a', { href, text: label, 'aria-current': key === page ? 'page' : false }));
  const header = h('header', { class: 'site-header' }, h('div', { class: 'wrap' },
    h('a', { class: 'brand', href: '/', 'aria-label': `${store.name} home` }, brandMark(), h('span', { class: 'brand-name' }, 'Sugar & Spice', h('small', { text: 'Couture' }))),
    h('nav', { class: 'nav', 'aria-label': 'Main' }, navLinks()),
    h('div', { class: 'head-actions' }, h('a', { class: 'icon-btn head-search', href: '/shop.html?focus=search', 'aria-label': 'Search the shop' }, icon('search')), acct, bagBtn, menuBtn)));

  const announce = h('div', { class: 'announce', text: store.tagline || 'Elegant pieces. Effortless style.' });

  // Mobile menu
  const mobile = h('div', { class: 'mobile-nav', id: 'mobile-nav', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menu' },
    h('div', { class: 'scrim' }),
    h('div', { class: 'sheet glass' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('span', { class: 'kicker', style: 'margin:0', text: 'Menu' }), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close menu', id: 'close-menu' }, icon('close'))),
      h('nav', { 'aria-label': 'Mobile' }, navLinks(), h('a', { href: '/shop.html?focus=search', text: 'Search' }), h('a', { href: '/track.html', text: 'Track an order' }), h('a', { href: '/account.html', text: me ? 'My account' : 'Sign in' }))));
  let releaseMenu = null;
  const setMenu = (open) => {
    mobile.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { releaseMenu = trapFocus(mobile, () => setMenu(false)); $('#close-menu', mobile).focus(); } else if (releaseMenu) { releaseMenu(); releaseMenu = null; }
  };
  menuBtn.addEventListener('click', () => setMenu(true));
  mobile.addEventListener('click', (e) => { if (e.target.closest('.scrim,#close-menu,a')) setMenu(false); });

  // Cart drawer
  const drawerBody = h('div', { class: 'drawer-body' });
  const drawerFoot = h('div', { class: 'drawer-foot', hidden: true });
  const drawer = h('div', { class: 'drawer', id: 'cart-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Shopping bag', inert: true },
    h('div', { class: 'scrim' }),
    h('div', { class: 'panel-side glass' },
      h('div', { class: 'drawer-head' }, h('h2', { text: 'Your bag' }), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close bag', id: 'close-bag' }, icon('close'))),
      drawerBody, drawerFoot));
  let releaseDrawer = null;
  const setDrawer = (open) => {
    drawer.classList.toggle('open', open);
    if (open) { drawer.removeAttribute('inert'); renderDrawer(); document.body.style.overflow = 'hidden'; releaseDrawer = trapFocus(drawer, () => setDrawer(false)); $('#close-bag', drawer).focus(); }
    else { drawer.setAttribute('inert', ''); document.body.style.overflow = ''; if (releaseDrawer) { releaseDrawer(); releaseDrawer = null; } }
  };
  bagBtn.addEventListener('click', () => setDrawer(true));
  drawer.addEventListener('click', (e) => { if (e.target.closest('.scrim,#close-bag')) setDrawer(false); });
  document.addEventListener('cart:added', () => setDrawer(true));

  async function renderDrawer() {
    let lines = [];
    try { lines = await cartLines(); } catch { /* offline: show empty */ }
    if (!lines.length) {
      drawerFoot.hidden = true;
      mount(drawerBody, h('div', { class: 'empty' }, emptyGlyph(), h('h3', { text: 'Your bag is empty' }), h('p', { text: 'Find a piece you love and it will wait for you here.' }),
        h('a', { class: 'btn btn-gold', href: '/shop.html', text: 'Explore the collection' })));
      return;
    }
    const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
    mount(drawerBody, lines.map(({ product: p, qty }) => h('div', { class: 'line' },
      h('a', { class: 'thumb', href: `/product.html?id=${encodeURIComponent(p.id)}`, 'aria-label': p.name }, media(p, { width: 160 })),
      h('div', null,
        h('a', { class: 'nm', href: `/product.html?id=${encodeURIComponent(p.id)}`, text: p.name }),
        h('span', { class: 'price', style: 'font-size:1.05rem', text: kes(p.price) }),
        h('div', { class: 'meta' },
          h('div', { class: 'qty', role: 'group', 'aria-label': `Quantity of ${p.name}` },
            h('button', { type: 'button', 'aria-label': 'Decrease quantity', onclick: () => setQty(p.id, qty - 1), text: '−' }),
            h('output', { 'aria-live': 'polite', text: String(qty) }),
            h('button', { type: 'button', 'aria-label': 'Increase quantity', disabled: qty >= p.stock, onclick: () => setQty(p.id, qty + 1), text: '+' })),
          h('button', { class: 'link-btn', type: 'button', onclick: () => { removeLine(p.id); toast('Removed from bag'); }, text: 'Remove' }))))));
    mount(drawerFoot,
      h('div', { class: 'sum-row total' }, h('span', { text: 'Subtotal' }), h('span', { text: kes(subtotal) })),
      h('p', { style: 'font-size:.88rem;color:var(--faint);margin:6px 0 16px', text: 'Delivery and any discount code are added at checkout. No account needed.' }),
      h('a', { class: 'btn btn-gold btn-block', href: '/checkout.html', text: 'Checkout as guest or member' }));
    drawerFoot.hidden = false;
  }

  const refreshBadge = () => {
    const n = cartCount();
    bagBadge.textContent = String(n);
    bagBadge.hidden = n === 0;
    bagBtn.setAttribute('aria-label', n ? `Open shopping bag, ${n} item${n > 1 ? 's' : ''}` : 'Open shopping bag');
    if (n) { bagBadge.classList.remove('bump'); void bagBadge.offsetWidth; bagBadge.classList.add('bump'); }
  };
  onCartChange(() => { refreshBadge(); if (drawer.classList.contains('open')) renderDrawer(); });
  refreshBadge();

  // Footer
  const footer = h('footer', { class: 'site-footer' }, h('div', { class: 'wrap' },
    h('div', { class: 'foot-grid' },
      h('div', null, h('a', { class: 'brand', href: '/', style: 'margin-bottom:16px' }, brandMark(), h('span', { class: 'brand-name' }, 'Sugar & Spice', h('small', { text: 'Couture' }))),
        h('p', { text: 'Elegant jewelry and accessories from Nairobi. Order online, pay with M-Pesa or on delivery.' })),
      h('div', null, h('h4', { text: 'Shop' }), h('ul', null,
        ...(store.categories || []).slice(0, 6).map((c) => h('li', null, h('a', { href: `/shop.html?category=${encodeURIComponent(c)}`, text: c }))))),
      h('div', null, h('h4', { text: 'Help' }), h('ul', null,
        h('li', null, h('a', { href: '/track.html', text: 'Track an order' })),
        h('li', null, h('a', { href: '/about.html#faq', text: 'Delivery & payment FAQs' })),
        h('li', null, h('a', { href: '/account.html', text: 'Your account' })),
        h('li', null, h('a', { href: '/contact.html', text: 'Contact us' })))),
      h('div', null, h('h4', { text: 'Visit & talk to us' }), h('ul', null,
        h('li', { style: 'color:var(--mist)', text: store.address || '' }),
        store.phone ? h('li', { style: 'color:var(--mist)', text: store.phone }) : null,
        store.whatsapp ? h('li', null, h('a', { href: waLink(store), target: '_blank', rel: 'noopener', text: 'Chat on WhatsApp' })) : null,
        store.instagram ? h('li', null, h('a', { href: `https://www.instagram.com/${store.instagram}/`, target: '_blank', rel: 'noopener', text: '@' + store.instagram })) : null))),
    h('div', { class: 'foot-bottom' }, h('span', { text: `© ${new Date().getFullYear()} ${store.name}. All rights reserved.` }), h('span', null, 'Payments by M-Pesa or cash on delivery'))));

  const skip = h('a', { class: 'skip', href: '#main', text: 'Skip to content' });
  const wa = store.whatsapp && page !== 'checkout'
    ? h('a', { class: 'float-wa', href: waLink(store, `Hello ${store.name}, I have a question.`), target: '_blank', rel: 'noopener', 'aria-label': 'Chat with us on WhatsApp' }, waIcon()) : null;

  document.body.prepend(skip, announce, header);
  document.body.append(mobile, drawer, footer);
  if (wa) document.body.append(wa);
  if (document.body.classList.contains('has-sticky-pay') && wa) wa.hidden = true;
  reveal();
  return { store, me, openCart: () => setDrawer(true) };
}
