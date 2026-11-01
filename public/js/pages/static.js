// About, Contact and 404 pages: small dynamic bits driven by store settings.
import { h, $, mount, icon, waIcon } from '../ui.js';
import { initLayout, waLink } from '../layout.js';

const { store } = await initLayout();
const page = document.body.dataset.page;

if (page === 'about') {
  const faqs = [
    ['How do I order?', 'Add pieces to your bag and go to checkout. You can check out as a guest with your name and phone number. An account is optional.'],
    ['How can I pay?', 'Pay with M-Pesa (we send a prompt to your phone) or choose to pay when your order arrives or when you collect it.'],
    ['How does delivery work?', 'Pick a delivery option at checkout and you will see the delivery fee before you pay. You can also collect from our shop.'],
    ['Where is the shop?', store.address || 'Please contact us for our address.'],
    ['Can I track my order?', 'Yes. Use the link on your confirmation page, or look it up any time with your order number and phone number on the Track an order page.'],
    ['What if something is sold out?', 'Stock is shown on every piece and reserved the moment you order. If something sells out, message us on WhatsApp and we will tell you about restocks.'],
  ];
  mount($('#faq-list'), faqs.map(([q, a]) => h('details', null, h('summary', { text: q }), h('p', { text: a }))));
}

if (page === 'contact') {
  const cards = [
    h('div', { class: 'panel' }, icon('pin', 30), h('h3', { style: 'margin-top:14px', text: 'Visit the shop' }), h('p', { text: store.address })),
    h('div', { class: 'panel' }, waIcon(), h('h3', { style: 'margin-top:14px', text: 'WhatsApp & phone' }), store.phone ? h('p', null, h('a', { href: 'tel:+' + store.whatsapp, text: store.phone, style: 'display:inline-block;padding:8px 0' })) : null,
      store.whatsapp ? h('a', { class: 'btn btn-wa btn-sm', href: waLink(store, `Hello ${store.name}!`), target: '_blank', rel: 'noopener', text: 'Chat on WhatsApp' }) : null),
    h('div', { class: 'panel' }, icon('ig', 30), h('h3', { style: 'margin-top:14px', text: 'Instagram' }), store.instagram ? h('p', { text: '@' + store.instagram }) : null,
      store.instagram ? h('a', { class: 'btn btn-glass btn-sm', href: `https://www.instagram.com/${store.instagram}/`, target: '_blank', rel: 'noopener', text: 'Follow us' }) : null),
  ];
  cards.forEach((c) => { c.style.padding = '26px'; c.querySelector('svg').style.cssText = 'width:30px;height:30px;stroke:var(--gold);fill:none;stroke-width:1.4'; });
  // The WhatsApp glyph is filled, not stroked
  cards[1].querySelector('svg').style.cssText = 'width:30px;height:30px;fill:var(--gold)';
  mount($('#contact-cards'), cards);
}

if (page === '404' && store.whatsapp) {
  const a = $('#wa-404');
  a.href = waLink(store, `Hello ${store.name}, I could not find a page on your site.`);
  a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Chat on WhatsApp';
}
