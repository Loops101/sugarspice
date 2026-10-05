/**
 * WhatsApp checkout — the store's only checkout system.
 * Builds a formatted order message and opens it in WhatsApp via wa.me.
 */

function generateWhatsAppMessage(cart, customer = {}) {
  const lines = [];
  lines.push(`Hello ${STORE_CONFIG.name} 👋`);
  lines.push("");
  lines.push("I'd like to place an order:");
  lines.push("");

  cart.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(`   Quantity: ${item.quantity}`);
    lines.push(`   Price: ${formatPrice(item.price)} each`);
    lines.push("");
  });

  const total = calculateCartTotal(cart);
  lines.push(`Subtotal: ${formatPrice(total)}`);
  lines.push("");
  lines.push(`Customer name: ${customer.name || "-"}`);
  lines.push(`Delivery location: ${customer.location || "-"}`);
  lines.push(`Additional notes: ${customer.notes || "-"}`);
  lines.push("");
  lines.push("Please confirm availability and delivery details.");
  lines.push("");
  lines.push("Thank you!");

  return lines.join("\n");
}

function buildWhatsAppLink(message) {
  return `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function checkoutViaWhatsApp(cart, customer = {}) {
  if (!cart || cart.length === 0) return;
  const message = generateWhatsAppMessage(cart, customer);
  const url = buildWhatsAppLink(message);
  window.open(url, "_blank", "noopener");
}

/**
 * Generic "Chat on WhatsApp" buttons used outside checkout (nav, hero, etc.)
 * send a simple greeting rather than an order.
 */
function openGeneralWhatsAppChat() {
  const message = `Hi ${STORE_CONFIG.name}! I'd like to know more about your jewelry pieces.`;
  window.open(buildWhatsAppLink(message), "_blank", "noopener");
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-whatsapp-generic]");
  if (!btn) return;
  e.preventDefault();
  openGeneralWhatsAppChat();
});
