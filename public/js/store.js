// Shared state: store info, product catalogue and the cart.
// The cart saves only {id, qty} in this browser. Prices are always re-read from the server.
import { api } from './api.js';

const CART_KEY = 'ssc_cart_v2';
const MAX_QTY = 20;
const listeners = new Set();

let info = null;
let products = null;
let me;

export async function getStore() {
  if (!info) info = await api('/store');
  return info;
}

export async function getProducts() {
  if (!products) products = (await api('/products')).products;
  return products;
}

export const getProduct = (id) => products && products.find((p) => p.id === id);

export async function getMe() {
  if (me === undefined) me = (await api('/auth/me')).user;
  return me;
}
export const setMe = (u) => { me = u; };

/* ------------------------------- Cart ---------------------------------- */
function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((l) => l && typeof l.id === 'string' && Number.isInteger(l.qty) && l.qty > 0).map((l) => ({ id: l.id, qty: Math.min(l.qty, MAX_QTY) }));
  } catch { return []; }
}
let memoryCart = null; // used when localStorage is blocked
function write(cart) {
  memoryCart = cart;
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* private mode: keep in memory */ }
  listeners.forEach((fn) => fn(cart));
}

export const getCart = () => (memoryCart && !localStorage.getItem(CART_KEY) ? memoryCart : read());
export const cartCount = () => getCart().reduce((s, l) => s + l.qty, 0);
export const onCartChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function addToCart(id, qty = 1, stock = MAX_QTY) {
  const cart = getCart();
  const line = cart.find((l) => l.id === id);
  const cap = Math.min(stock, MAX_QTY);
  const have = line ? line.qty : 0;
  if (have >= cap) return { ok: false, reason: `You already have the last ${cap} in your cart.` };
  const next = Math.min(have + qty, cap);
  if (line) line.qty = next; else cart.push({ id, qty: next });
  write(cart);
  return { ok: true, capped: have + qty > cap };
}

export function setQty(id, qty) {
  let cart = getCart();
  if (qty <= 0) cart = cart.filter((l) => l.id !== id);
  else cart = cart.map((l) => (l.id === id ? { ...l, qty: Math.min(qty, MAX_QTY) } : l));
  write(cart);
}
export const removeLine = (id) => setQty(id, 0);
export const clearCart = () => write([]);

/** Cart lines joined with live product data. Drops items that no longer exist. */
export async function cartLines() {
  const [all, cart] = [await getProducts(), getCart()];
  const lines = [];
  let changed = false;
  const clean = [];
  for (const l of cart) {
    const p = all.find((x) => x.id === l.id);
    if (!p || p.stock <= 0) { changed = true; continue; }
    const qty = Math.min(l.qty, p.stock);
    if (qty !== l.qty) changed = true;
    clean.push({ id: l.id, qty });
    lines.push({ product: p, qty });
  }
  if (changed) write(clean);
  return lines;
}

window.addEventListener('storage', (e) => { if (e.key === CART_KEY) listeners.forEach((fn) => fn(read())); });
