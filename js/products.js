/**
 * Product catalog.
 *
 * Images are placeholder photography (picsum.photos) so the store looks
 * complete out of the box. Replace each "images" array with real Cloudinary
 * URLs from your product photos — see README.md for how.
 */

const CATEGORIES = [
  "Necklaces",
  "Earrings",
  "Bracelets",
  "Rings",
  "Sets",
  "Stainless Steel",
];

function placeholderImage(seed, w = 900, h = 900) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

/**
 * Applies Cloudinary transformations to an image URL when it is actually
 * hosted on Cloudinary. Non-Cloudinary URLs (e.g. placeholder images) are
 * returned unchanged, so this is safe to call on any image source.
 */
function cloudinaryUrl(
  url,
  { width = 800, quality = "auto", crop = "fill" } = {},
) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com"))
    return url;
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const transform = `c_${crop},w_${width},q_${quality},f_auto/`;
  return (
    url.slice(0, idx + marker.length) +
    transform +
    url.slice(idx + marker.length)
  );
}

const products = [
  {
    id: "spc-001",
    name: "Layered Gold Chain Necklace",
    category: "Necklaces",
    price: 1500,
    oldPrice: null,
    description:
      "A delicate double-layer chain necklace finished in a warm gold tone, designed to sit beautifully whether worn alone or stacked with your other favourites.",
    images: [
      "https://images.pexels.com/photos/12133990/pexels-photo-12133990.jpeg",
      "https://images.pexels.com/photos/35756968/pexels-photo-35756968.jpeg",
    ],
    featured: true,
    bestseller: true,
    available: true,
    dateAdded: "2026-08-20",
  },
  {
    id: "spc-002",
    name: "Emerald Drop Earrings",
    category: "Earrings",
    price: 1200,
    oldPrice: 1500,
    description:
      "Elegant drop earrings with a faceted emerald-tone stone, catching the light with every turn of the head. A refined finish for evenings out.",
    images: [
      "https://images.pexels.com/photos/9471044/pexels-photo-9471044.jpeg",
      "https://images.pexels.com/photos/31285201/pexels-photo-31285201.jpeg",
    ],
    featured: true,
    bestseller: false,
    available: true,
    dateAdded: "2026-09-01",
  },
  {
    id: "spc-003",
    name: "Sapphire Statement Ring",
    category: "Rings",
    price: 1800,
    oldPrice: null,
    description:
      "A statement ring set with a deep sapphire-tone centre stone in a polished gold-tone band. Comfortable enough for daily wear, striking enough for occasions.",
    images: [
      "https://images.pexels.com/photos/17261921/pexels-photo-17261921.jpeg",
      "https://images.pexels.com/photos/34971630/pexels-photo-34971630.jpeg",
    ],
    featured: true,
    bestseller: true,
    available: true,
    dateAdded: "2026-07-10",
  },
  {
    id: "spc-004",
    name: "Sapphire Set — Necklace & Earrings",
    category: "Sets",
    price: 1500,
    oldPrice: null,
    description:
      "A matching necklace and earring set finished with sapphire-tone stones, boxed together so you can gift or wear the complete look in one go.",
    images: [
      "https://images.pexels.com/photos/5301351/pexels-photo-5301351.jpeg",
      "https://images.pexels.com/photos/38863479/pexels-photo-38863479.jpeg",
    ],
    featured: true,
    bestseller: true,
    available: true,
    dateAdded: "2026-08-05",
  },
  {
    id: "spc-005",
    name: "Classic Stainless Steel Chain",
    category: "Stainless Steel",
    price: 1000,
    oldPrice: null,
    description:
      "A hardy everyday chain in tarnish-resistant stainless steel with a warm gold-tone plating, built to handle daily wear without losing its shine.",
    images: [
      "https://images.pexels.com/photos/416339/pexels-photo-416339.jpeg",
      "https://images.pexels.com/photos/29003596/pexels-photo-29003596.jpeg",
    ],
    featured: false,
    bestseller: true,
    available: true,
    dateAdded: "2026-06-18",
  },
  {
    id: "spc-006",
    name: "Pearl Cluster Bracelet",
    category: "Bracelets",
    price: 900,
    oldPrice: null,
    description:
      "A soft, feminine bracelet with a cluster of pearl-tone beads on a fine gold-tone chain. Pairs easily with both everyday and dressed-up looks.",
    images: [
      "https://images.pexels.com/photos/7092289/pexels-photo-7092289.jpeg",
      "https://images.pexels.com/photos/37401986/pexels-photo-37401986.jpeg",
    ],
    featured: false,
    bestseller: false,
    available: true,
    dateAdded: "2026-08-28",
  },
  {
    id: "spc-007",
    name: "Huggie Hoop Earrings",
    category: "Earrings",
    price: 800,
    oldPrice: null,
    description:
      "Small, close-fitting hoop earrings in polished gold tone — an easy everyday pair that works from desk to dinner.",
    images: [
      "https://images.pexels.com/photos/9421333/pexels-photo-9421333.jpeg",
      "https://images.pexels.com/photos/8841386/pexels-photo-8841386.jpeg",
    ],
    featured: false,
    bestseller: true,
    available: true,
    dateAdded: "2026-09-05",
  },
  {
    id: "spc-008",
    name: "Beaded Waist Chain",
    category: "Necklaces",
    price: 1300,
    oldPrice: 1600,
    description:
      "An eye-catching beaded body chain that layers beautifully over a simple outfit for a night out.",
    images: [
      "https://images.pexels.com/photos/33561789/pexels-photo-33561789.jpeg",
      "https://images.pexels.com/photos/28976815/pexels-photo-28976815.jpeg",
    ],
    featured: false,
    bestseller: false,
    available: true,
    dateAdded: "2026-07-22",
  },
  {
    id: "spc-009",
    name: "Stainless Steel Cuban Link Bracelet",
    category: "Stainless Steel",
    price: 1100,
    oldPrice: null,
    description:
      "A bold Cuban link bracelet in gold-tone stainless steel, sized to layer with a watch or wear solo.",
    images: [
      "https://images.pexels.com/photos/34372566/pexels-photo-34372566.jpeg",
      "https://images.pexels.com/photos/5488304/pexels-photo-5488304.jpeg",
    ],
    featured: false,
    bestseller: false,
    available: true,
    dateAdded: "2026-08-11",
  },
  {
    id: "spc-010",
    name: "Delicate Solitaire Ring",
    category: "Rings",
    price: 700,
    oldPrice: null,
    description:
      "A minimal band with a single clear stone — easy to wear alone or stacked with other rings.",
    images: [
      "https://images.pexels.com/photos/29612229/pexels-photo-29612229.jpeg",
      "https://images.pexels.com/photos/33028023/pexels-photo-33028023.jpeg",
    ],
    featured: false,
    bestseller: false,
    available: true,
    dateAdded: "2026-09-08",
  },
  {
    id: "spc-011",
    name: "Rose Quartz Drop Necklace",
    category: "Necklaces",
    price: 1400,
    oldPrice: null,
    description:
      "A single rose-quartz-tone drop pendant on a fine gold chain, quietly elegant for daily wear.",
    images: [
      "https://images.pexels.com/photos/29043373/pexels-photo-29043373.jpeg",
      "https://images.pexels.com/photos/12133990/pexels-photo-12133990.jpeg",
    ],
    featured: false,
    bestseller: false,
    available: true,
    dateAdded: "2026-06-30",
  },
  {
    id: "spc-012",
    name: "Everyday Set — Chain & Studs",
    category: "Sets",
    price: 1600,
    oldPrice: 1900,
    description:
      "A no-fuss set pairing a fine chain necklace with matching stud earrings, ready to wear straight out of the box.",
    images: [
      "https://images.pexels.com/photos/35528702/pexels-photo-35528702.jpeg",
      "https://images.pexels.com/photos/18016511/pexels-photo-18016511.jpeg",
    ],
    featured: false,
    bestseller: true,
    available: true,
    dateAdded: "2026-08-15",
  },
  {
    id: "spc-013",
    name: "Twist Hoop Earrings",
    category: "Earrings",
    price: 850,
    oldPrice: null,
    description:
      "Medium hoops with a subtle twisted texture in gold tone, light enough for all-day wear.",
    images: [
      "https://images.pexels.com/photos/31285201/pexels-photo-31285201.jpeg",
      "https://images.pexels.com/photos/9471044/pexels-photo-9471044.jpeg",
    ],
    featured: false,
    bestseller: false,
    available: false,
    dateAdded: "2026-05-25",
  },
  {
    id: "spc-014",
    name: "Stainless Steel Signet Ring",
    category: "Stainless Steel",
    price: 950,
    oldPrice: null,
    description:
      "A clean, modern signet-style ring in stainless steel with gold-tone plating that resists everyday wear.",
    images: [
      "https://images.pexels.com/photos/416339/pexels-photo-416339.jpeg",
      "https://images.pexels.com/photos/29003596/pexels-photo-29003596.jpeg",
    ],
    featured: false,
    bestseller: false,
    available: true,
    dateAdded: "2026-07-02",
  },
  {
    id: "spc-015",
    name: "Chain Link Bracelet",
    category: "Bracelets",
    price: 1000,
    oldPrice: null,
    description:
      "A sturdy chain-link bracelet with a secure lobster clasp, easy to dress up or keep casual.",
    images: [
      "https://images.pexels.com/photos/17505428/pexels-photo-17505428.jpeg",
      "https://images.pexels.com/photos/1191536/pexels-photo-1191536.jpeg",
    ],
    featured: false,
    bestseller: false,
    available: true,
    dateAdded: "2026-06-05",
  },
  {
    id: "spc-016",
    name: "Bridal Set — Necklace, Earrings & Bracelet",
    category: "Sets",
    price: 2600,
    oldPrice: 3000,
    description:
      "A complete three-piece set for special occasions, finished with clear stones for a soft sparkle from every angle.",
    images: [
      "https://images.pexels.com/photos/5301351/pexels-photo-5301351.jpeg",
      "https://images.pexels.com/photos/38863479/pexels-photo-38863479.jpeg",
    ],
    featured: true,
    bestseller: false,
    available: true,
    dateAdded: "2026-09-10",
  },
];

/**
 * Returns a product by id, or null if not found.
 */
function getProductById(id) {
  if (!id) return null;
  return products.find((p) => p.id === id) || null;
}

/**
 * Returns up to `limit` products from the same category as the given
 * product, excluding the product itself.
 */
function getRelatedProducts(product, limit = 4) {
  if (!product) return [];
  return products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, limit);
}

function getFeaturedProducts(limit = 8) {
  return products.filter((p) => p.featured).slice(0, limit);
}

/**
 * Builds the HTML for a single product card.
 */
function renderProductCard(product) {
  const img = cloudinaryUrl(product.images[0], { width: 500 });
  const soldOut = !product.available;
  const onSale = product.oldPrice && product.oldPrice > product.price;

  let badge = "";
  if (soldOut) {
    badge = `<span class="badge">Sold out</span>`;
  } else if (onSale) {
    badge = `<span class="badge badge-sale">Sale</span>`;
  } else if (product.bestseller) {
    badge = `<span class="badge">Bestseller</span>`;
  }

  return `
  <article class="product-card">
    <a class="product-media" href="product.html?id=${product.id}" aria-label="View ${escapeAttr(product.name)}">
      ${badge}
      <img src="${img}" alt="${escapeAttr(product.name)}" loading="lazy" width="500" height="500">
      ${soldOut ? '<span class="unavailable-flag">Currently unavailable</span>' : ""}
    </a>
    <div class="product-body">
      <span class="product-cat">${escapeAttr(product.category)}</span>
      <h3 class="product-name"><a href="product.html?id=${product.id}">${escapeAttr(product.name)}</a></h3>
      <div class="product-price">
        <span class="price-now">${formatPrice(product.price)}</span>
        ${onSale ? `<span class="price-old">${formatPrice(product.oldPrice)}</span>` : ""}
      </div>
      <div class="product-actions">
        <button type="button" class="btn btn-outline" data-add-to-cart="${product.id}" ${soldOut ? "disabled" : ""}>
          ${soldOut ? "Unavailable" : "Add to Cart"}
        </button>
      </div>
    </div>
  </article>`;
}

function renderProducts(list, container) {
  if (!container) return;
  if (!list.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = list.map(renderProductCard).join("");
}

function escapeAttr(str) {
  return String(str == null ? "" : str).replace(/"/g, "&quot;");
}

/**
 * Delegated "Add to Cart" handling for any product grid on the page.
 */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add-to-cart]");
  if (!btn || btn.disabled) return;
  const product = getProductById(btn.dataset.addToCart);
  if (!product) return;
  addToCart(product, 1);
  if (typeof showToast === "function")
    showToast(`${product.name} added to cart ✓`);
  const cartIcon = document.querySelector(".icon-btn[data-cart-icon]");
  if (cartIcon) {
    cartIcon.classList.add("bump");
    window.setTimeout(() => cartIcon.classList.remove("bump"), 380);
  }
  btn.classList.add("is-added");
  window.setTimeout(() => btn.classList.remove("is-added"), 320);
});
