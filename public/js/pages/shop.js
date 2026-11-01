import { h, $, mount, debounce } from '../ui.js';
import { initLayout } from '../layout.js';
import { getProducts } from '../store.js';
import { productCard, skeletons } from '../card.js';

const { store } = await initLayout();
const grid = $('#grid'), count = $('#count'), empty = $('#empty');
const params = new URLSearchParams(location.search);

const state = {
  category: store.categories.includes(params.get('category')) ? params.get('category') : 'All',
  q: (params.get('q') || '').slice(0, 60),
  sort: ['featured', 'newest', 'price-asc', 'price-desc', 'name'].includes(params.get('sort')) ? params.get('sort') : 'featured',
  instock: params.get('instock') === '1',
};

mount(grid, skeletons(8));
let products = [];
try { products = await getProducts(); } catch {
  mount(grid);
  count.textContent = 'We could not load the collection. Please check your connection and refresh.';
}

const sorters = {
  featured: (a, b) => (b.featured - a.featured) || (b.bestseller - a.bestseller) || (b.createdAt - a.createdAt),
  newest: (a, b) => b.createdAt - a.createdAt,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name),
};

function matches(p) {
  if (state.category !== 'All' && p.category !== state.category) return false;
  if (state.instock && p.stock <= 0) return false;
  if (!state.q) return true;
  const hay = `${p.name} ${p.category} ${p.description}`.toLowerCase();
  return state.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

function syncUrl() {
  const u = new URLSearchParams();
  if (state.category !== 'All') u.set('category', state.category);
  if (state.q) u.set('q', state.q);
  if (state.sort !== 'featured') u.set('sort', state.sort);
  if (state.instock) u.set('instock', '1');
  history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));
}

function render() {
  const list = products.filter(matches).sort((a, b) => sorters[state.sort](a, b) || (a.stock <= 0) - (b.stock <= 0));
  // Sold-out pieces sink to the bottom unless the user chose a price/name sort
  if (state.sort === 'featured' || state.sort === 'newest') list.sort((a, b) => (a.stock <= 0) - (b.stock <= 0));
  mount(grid, list.map((p) => productCard(p, store)));
  empty.hidden = list.length > 0 || !products.length;
  count.textContent = products.length ? `${list.length} piece${list.length === 1 ? '' : 's'}` : count.textContent;
  const filtered = state.category !== 'All' || state.q || state.instock;
  $('#reset').hidden = !filtered;
  $('#shop-title').textContent = state.category === 'All' ? 'The collection' : state.category;
  document.title = `${state.category === 'All' ? 'Shop Jewelry & Accessories' : state.category} | Sugar & Spice Couture`;
  $('#chips').querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === state.category)));
  syncUrl();
}

mount($('#chips'), ['All', ...store.categories].map((c) => h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: () => { state.category = c; render(); }, text: c })));

const reset = () => { state.category = 'All'; state.q = ''; state.instock = false; state.sort = 'featured'; $('#q').value = ''; $('#sort').value = 'featured'; $('#instock').checked = false; render(); };
$('#q').value = state.q; $('#sort').value = state.sort; $('#instock').checked = state.instock;
$('#q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim().slice(0, 60); render(); }, 180));
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
$('#instock').addEventListener('change', (e) => { state.instock = e.target.checked; render(); });
$('#reset').addEventListener('click', reset);
$('#empty-reset').addEventListener('click', reset);
if (params.get('focus') === 'search') $('#q').focus();
if (products.length) render();
