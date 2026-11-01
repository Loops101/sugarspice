// Admin shell: login gate, sidebar, hash router.
import { h, mount, icon, toast } from '/js/ui.js';
import { api } from '/js/api.js';
import { brandMark } from '/js/art.js';
import { field, errorBox, showError } from './common.js';

const app = document.getElementById('app');

const ROUTES = [
  { path: 'dashboard', label: 'Dashboard', icon: 'grid', load: () => import('./dashboard.js') },
  { path: 'orders', label: 'Orders', icon: 'receipt', load: () => import('./orders.js') },
  { path: 'products', label: 'Products', icon: 'gem', load: () => import('./products.js') },
  { path: 'customers', label: 'Customers', icon: 'users', load: () => import('./customers.js') },
  { path: 'coupons', label: 'Coupons', icon: 'tag', owner: true, load: () => import('./coupons.js') },
  { path: 'team', label: 'Team', icon: 'user', owner: true, load: () => import('./team.js') },
  { path: 'settings', label: 'Settings', icon: 'cog', owner: true, load: () => import('./settings.js') },
  { path: 'account', label: 'My account', icon: 'lock', load: () => import('./account.js') },
];
const isOwner = () => user && user.role === 'admin';
const allowed = () => ROUTES.filter((r) => !r.owner || isOwner());
const roleLabel = () => (isOwner() ? 'Owner' : 'Staff');

let user = null;
let navCount = null;
let stats = null; // last dashboard stats, used for the sidebar badge

function parseHash() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { path: path || 'dashboard', params: new URLSearchParams(query) };
}

async function signOut() {
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ }
  user = null;
  location.hash = '';
  renderLogin();
}

function renderLogin(notAdmin) {
  document.title = 'Admin sign in | Sugar & Spice Couture';
  const err = errorBox();
  const form = h('form', { novalidate: true },
    field('Email', 'email', { type: 'email', autocomplete: 'username', required: true }),
    field('Password', 'password', { type: 'password', autocomplete: 'current-password', required: true }),
    err,
    h('button', { class: 'btn btn-gold', type: 'submit', style: 'width:100%;margin-top:6px', text: 'Sign in' }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email: form.email.value, password: form.password.value } });
      if (r.user.role !== 'admin' && r.user.role !== 'staff') {
        await api('/auth/logout', { method: 'POST', body: {} });
        throw new Error('That account does not have shop access.');
      }
      user = r.user;
      start();
    } catch (ex) { showError(err, ex); } finally { btn.disabled = false; }
  });
  mount(app, h('div', { class: 'login-wrap' }, h('main', { class: 'login-box glass' },
    h('img', { src: '/img/logo.png', alt: 'Sugar & Spice Couture', width: 150, height: 141, style: 'display:block;margin:0 auto 14px;width:150px;height:auto;border-radius:22px' }),
    h('h1', { style: 'font-size:2rem;text-align:center;margin:0 0 6px', text: 'Shop sign in' }),
    h('p', { style: 'text-align:center;margin:0 auto 22px', text: 'For the owner and shop staff.' }),
    notAdmin ? h('div', { class: 'form-error', role: 'alert', text: 'You are signed in without admin access. Sign in with the admin account.' }) : null,
    form,
    h('p', { style: 'text-align:center;margin:20px auto 0;font-size:.92rem' }, h('a', { href: '/', text: 'Back to the shop' })))));
  form.email.focus();
}

function renderShell() {
  const links = allowed().map((r) => h('a', { href: '#/' + r.path, 'data-route': r.path }, icon(r.icon), h('span', { text: r.label }),
    r.path === 'orders' ? h('span', { class: 'count', id: 'nav-count', hidden: true }) : null));
  const signOutBtn = h('button', { type: 'button', onclick: signOut }, icon('logout'), h('span', { text: 'Sign out' }));
  const side = h('header', { class: 'side' },
    h('div', { class: 'side-top' },
      h('a', { class: 'brand', href: '#/dashboard', 'aria-label': 'Sugar & Spice Couture admin' }, brandMark ? brandMark(32) : null, h('span', { class: 'brand-name', text: 'Sugar & Spice' })),
      h('div', { class: 'mobile-actions' },
        h('a', { class: 'icon-btn', href: '/', target: '_blank', rel: 'noopener', 'aria-label': 'View shop' }, icon('external')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sign out', onclick: signOut }, icon('logout')))),
    h('nav', { class: 'nav-a', 'aria-label': 'Admin' }, links),
    h('div', { class: 'side-foot' },
      h('a', { href: '/', target: '_blank', rel: 'noopener' }, icon('external'), h('span', { text: 'View shop' })),
      h('div', { style: 'padding:6px 16px;color:var(--faint);font-size:.84rem;overflow-wrap:anywhere' }, h('b', { style: 'color:var(--gold-light);font-weight:500', text: roleLabel() }), h('br'), user.email),
      signOutBtn));
  const main = h('main', { class: 'main', id: 'view', tabindex: '-1' });
  mount(app, h('div', { class: 'shell' }, side, main));
  navCount = document.getElementById('nav-count');
  return main;
}

let token = 0;
async function route() {
  window.__adminUser = user;
  const { path, params } = parseHash();
  const def = allowed().find((r) => r.path === path) || allowed()[0];
  if (def.path !== path) history.replaceState(null, '', '#/' + def.path);
  document.querySelectorAll('[data-route]').forEach((a) => (a.getAttribute('data-route') === def.path ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.title = `${def.label} | Sugar & Spice admin`;
  const main = document.getElementById('view');
  const mine = ++token;
  mount(main, h('div', { class: 'skel', style: 'height:180px;border-radius:20px', 'aria-hidden': 'true' }));
  try {
    const mod = await def.load();
    if (mine !== token) return;
    const root = h('div');
    await mod.render(root, { params, user, setBadge, go: (p) => { location.hash = '#/' + p; } });
    if (mine !== token) return;
    mount(main, root);
    scrollTo(0, 0);
  } catch (e) {
    if (mine !== token) return;
    if (e.status === 401 || e.status === 403) { user = null; renderLogin(e.status === 403); return; }
    mount(main, h('div', { class: 'empty-a' }, h('p', { text: e.message || 'Could not load this page.' }), h('button', { class: 'btn btn-glass', type: 'button', onclick: route, text: 'Try again' })));
  }
}

function setBadge(n) {
  if (!navCount) return;
  navCount.textContent = n > 99 ? '99+' : String(n);
  navCount.hidden = !n;
  navCount.setAttribute('aria-label', `${n} orders to fulfil`);
}

function start() {
  renderShell();
  route();
}

window.addEventListener('hashchange', () => { if (user) route(); });

(async () => {
  try {
    const r = await api('/auth/me');
    if (r.user && (r.user.role === 'admin' || r.user.role === 'staff')) { user = r.user; start(); } else renderLogin(!!r.user);
  } catch (e) {
    mount(app, h('div', { class: 'login-wrap' }, h('div', { class: 'login-box glass' }, h('p', { text: e.message }), h('button', { class: 'btn btn-gold', onclick: () => location.reload(), text: 'Retry' }))));
  }
})();
