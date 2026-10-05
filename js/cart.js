/**
 * Cart storage (localStorage-backed).
 * Cart shape: [{ id, name, price, image, category, quantity }]
 */

const CART_KEY = "ssc_cart_v1";

function safeLocalStorage() {
  try {
    const testKey = "__ssc_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (err) {
    return null;
  }
}

function getCart() {
  const storage = safeLocalStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveCart(cart) {
  const storage = safeLocalStorage();
  if (!storage) return false;
  try {
    storage.setItem(CART_KEY, JSON.stringify(cart));
    return true;
  } catch (err) {
    return false;
  }
}

function addToCart(product, quantity = 1) {
  if (!product || !product.id) return getCart();
  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: (product.images && product.images[0]) || "",
      category: product.category,
      quantity,
    });
  }
  saveCart(cart);
  updateCartCount();
  return cart;
}

function removeFromCart(id) {
  const cart = getCart().filter((item) => item.id !== id);
  saveCart(cart);
  updateCartCount();
  return cart;
}

function updateCartQuantity(id, quantity) {
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (!item) return cart;
  item.quantity = Math.max(1, Math.floor(quantity) || 1);
  saveCart(cart);
  updateCartCount();
  return cart;
}

function clearCart() {
  saveCart([]);
  updateCartCount();
}

function calculateCartTotal(cart = getCart()) {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCartItemCount(cart = getCart()) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Updates every cart-count badge on the current page (header, mobile menu, etc.)
 */
function updateCartCount() {
  const count = getCartItemCount();
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = String(count);
    el.hidden = count === 0;
  });
}

/* ==========================================================================
   Cart page rendering (only runs where #cart-root exists)
   ========================================================================== */

function renderCartPage() {
  const root = document.getElementById("cart-root");
  if (!root) return;

  const cart = getCart();
  const emptyState = document.getElementById("cart-empty");
  const listEl = document.getElementById("cart-items");
  const summaryEl = document.getElementById("cart-summary");

  if (cart.length === 0) {
    if (emptyState) emptyState.hidden = false;
    if (listEl) listEl.hidden = true;
    if (summaryEl) summaryEl.hidden = true;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  if (listEl) listEl.hidden = false;
  if (summaryEl) summaryEl.hidden = false;

  listEl.innerHTML = cart
    .map(
      (item) => `
    <li class="cart-item" data-id="${item.id}">
      <img src="${cloudinaryUrl(item.image, { width: 160 })}" alt="${escapeHtml(item.name)}" loading="lazy" width="76" height="76">
      <div>
        <p class="cart-item-name">${escapeHtml(item.name)}</p>
        <p class="cart-item-cat">${escapeHtml(item.category || "")}</p>
        <p class="cart-item-price">${formatPrice(item.price)} each</p>
        <div class="cart-item-controls">
          <div class="qty-stepper" role="group" aria-label="Quantity for ${escapeHtml(item.name)}">
            <button type="button" data-action="decrease" aria-label="Decrease quantity">&minus;</button>
            <input type="number" min="1" value="${item.quantity}" data-action="set-qty" aria-label="Quantity" inputmode="numeric">
            <button type="button" data-action="increase" aria-label="Increase quantity">&plus;</button>
          </div>
          <button type="button" class="cart-item-remove" data-action="remove">Remove</button>
        </div>
      </div>
      <p class="cart-item-total">${formatPrice(item.price * item.quantity)}</p>
    </li>`
    )
    .join("");

  const total = calculateCartTotal(cart);
  const subtotalEl = document.getElementById("summary-subtotal");
  const totalEl = document.getElementById("summary-total");
  if (subtotalEl) subtotalEl.textContent = formatPrice(total);
  if (totalEl) totalEl.textContent = formatPrice(total);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function bindCartPageEvents() {
  const listEl = document.getElementById("cart-items");
  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const li = btn.closest(".cart-item");
      const id = li && li.dataset.id;
      if (!id) return;

      if (btn.dataset.action === "increase") {
        const item = getCart().find((i) => i.id === id);
        updateCartQuantity(id, (item ? item.quantity : 1) + 1);
        renderCartPage();
      } else if (btn.dataset.action === "decrease") {
        const item = getCart().find((i) => i.id === id);
        const next = (item ? item.quantity : 1) - 1;
        if (next < 1) {
          removeFromCart(id);
        } else {
          updateCartQuantity(id, next);
        }
        renderCartPage();
      } else if (btn.dataset.action === "remove") {
        removeFromCart(id);
        renderCartPage();
        showToast("Removed from cart");
      }
    });

    listEl.addEventListener("change", (e) => {
      const input = e.target.closest('input[data-action="set-qty"]');
      if (!input) return;
      const li = input.closest(".cart-item");
      const id = li && li.dataset.id;
      if (!id) return;
      updateCartQuantity(id, parseInt(input.value, 10));
      renderCartPage();
    });
  }

  const clearBtn = document.getElementById("clear-cart-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearCart();
      renderCartPage();
      showToast("Cart cleared");
    });
  }

  const form = document.getElementById("checkout-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const cart = getCart();
      if (cart.length === 0) {
        showToast("Your cart is empty");
        return;
      }
      const customer = {
        name: form.elements["customerName"].value.trim(),
        location: form.elements["deliveryLocation"].value.trim(),
        notes: form.elements["notes"].value.trim(),
      };
      checkoutViaWhatsApp(cart, customer);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderCartPage();
  bindCartPageEvents();
});
