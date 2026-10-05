/**
 * Product detail page: reads ?id= from the URL and renders that product.
 */

function initProductPage() {
  const root = document.getElementById("product-root");
  if (!root) return;

  const id = getQueryParam("id");
  const product = getProductById(id);
  const notFound = document.getElementById("product-not-found");

  if (!product) {
    root.hidden = true;
    if (notFound) notFound.hidden = false;
    document.title = "Product not found | Sugar & Spice Couture";
    return;
  }

  if (notFound) notFound.hidden = true;
  root.hidden = false;

  document.title = `${product.name} | Sugar & Spice Couture`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", product.description.slice(0, 155));

  // Breadcrumb
  const crumbCat = document.getElementById("crumb-category");
  const crumbName = document.getElementById("crumb-product");
  if (crumbCat) {
    crumbCat.textContent = product.category;
    crumbCat.href = `shop.html?category=${encodeURIComponent(product.category)}`;
  }
  if (crumbName) crumbName.textContent = product.name;

  // Gallery
  const galleryMain = document.getElementById("gallery-main");
  const galleryThumbs = document.getElementById("gallery-thumbs");
  const images = product.images && product.images.length ? product.images : [placeholderImage("fallback")];

  galleryMain.innerHTML = images
    .map((src) => `<img src="${cloudinaryUrl(src, { width: 900 })}" alt="${escapeAttr(product.name)}" loading="lazy">`)
    .join("");

  galleryThumbs.innerHTML = images
    .map(
      (src, i) => `
      <button type="button" data-index="${i}" aria-current="${i === 0}" aria-label="View image ${i + 1} of ${product.name}">
        <img src="${cloudinaryUrl(src, { width: 160 })}" alt="" loading="lazy">
      </button>`
    )
    .join("");

  galleryThumbs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-index]");
    if (!btn) return;
    const index = Number(btn.dataset.index);
    const targetImg = galleryMain.children[index];
    if (targetImg) targetImg.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    galleryThumbs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", "false"));
    btn.setAttribute("aria-current", "true");
  });

  // Text content
  document.getElementById("pd-category").textContent = product.category;
  document.getElementById("pd-name").textContent = product.name;
  document.getElementById("pd-description").textContent = product.description;

  const priceNow = document.getElementById("pd-price-now");
  const priceOld = document.getElementById("pd-price-old");
  priceNow.textContent = formatPrice(product.price);
  if (product.oldPrice && product.oldPrice > product.price) {
    priceOld.textContent = formatPrice(product.oldPrice);
    priceOld.hidden = false;
  } else {
    priceOld.hidden = true;
  }

  const availability = document.getElementById("pd-availability");
  if (product.available) {
    availability.textContent = "In stock — ready to ship";
    availability.classList.add("in-stock");
  } else {
    availability.textContent = "Currently unavailable";
    availability.classList.add("out-stock");
  }

  document.getElementById("pd-detail-category").textContent = product.category;
  document.getElementById("pd-detail-availability").textContent = product.available ? "In stock" : "Unavailable";

  // Quantity stepper
  const qtyInput = document.getElementById("pd-qty");
  document.getElementById("qty-decrease").addEventListener("click", () => {
    qtyInput.value = Math.max(1, parseInt(qtyInput.value, 10) - 1);
  });
  document.getElementById("qty-increase").addEventListener("click", () => {
    qtyInput.value = Math.max(1, parseInt(qtyInput.value, 10) + 1);
  });

  // Actions
  const addBtn = document.getElementById("pd-add-to-cart");
  const orderBtn = document.getElementById("pd-order-whatsapp");

  if (!product.available) {
    addBtn.disabled = true;
    addBtn.textContent = "Unavailable";
    orderBtn.disabled = true;
  }

  addBtn.addEventListener("click", () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    addToCart(product, qty);
    showToast(`${product.name} added to cart ✓`);
    addBtn.classList.add("is-added");
    window.setTimeout(() => addBtn.classList.remove("is-added"), 320);
  });

  orderBtn.addEventListener("click", () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const cartItem = [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
      },
    ];
    checkoutViaWhatsApp(cartItem, {});
  });

  // Related products
  const related = getRelatedProducts(product, 4);
  const relatedGrid = document.getElementById("related-grid");
  const relatedSection = document.getElementById("related-section");
  if (related.length && relatedGrid) {
    renderProducts(related, relatedGrid);
  } else if (relatedSection) {
    relatedSection.hidden = true;
  }

  // JSON-LD structured data (only confirmed fields; no invented ratings/reviews)
  const ld = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: product.category,
    image: images.map((src) => cloudinaryUrl(src, { width: 900 })),
    offers: {
      "@type": "Offer",
      priceCurrency: STORE_CONFIG.currency,
      price: product.price,
      availability: product.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: window.location.href,
    },
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(ld);
  document.head.appendChild(script);
}

document.addEventListener("DOMContentLoaded", initProductPage);
