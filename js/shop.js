/**
 * Shop page logic: category filters, search, sorting, product grid.
 */

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

function filterProducts(list, { category, search }) {
  let result = list;

  if (category && category !== "All") {
    result = result.filter((p) => p.category === category);
  }

  if (search) {
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
  }

  return result;
}

function sortProducts(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "newest":
      sorted.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      break;
    case "featured":
    default:
      sorted.sort((a, b) => (b.featured === true) - (a.featured === true));
      break;
  }
  return sorted;
}

function initShopPage() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  const chips = document.querySelectorAll(".filter-chip");
  const sortSelect = document.getElementById("sort-select");
  const searchInput = document.getElementById("shop-search-input");
  const countEl = document.getElementById("result-count");
  const emptyState = document.getElementById("shop-empty");

  const state = {
    category: getQueryParam("category") || "All",
    search: getQueryParam("search") || "",
    sort: "featured",
  };

  function syncChips() {
    chips.forEach((chip) => {
      const isActive = chip.dataset.category === state.category;
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function render() {
    const filtered = filterProducts(products, state);
    const sorted = sortProducts(filtered, state.sort);

    renderProducts(sorted, grid);

    if (countEl) {
      countEl.textContent = `${sorted.length} ${sorted.length === 1 ? "piece" : "pieces"}`;
    }

    if (emptyState) {
      emptyState.hidden = sorted.length !== 0;
      grid.hidden = sorted.length === 0;
    }
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.category = chip.dataset.category;
      syncChips();
      render();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      render();
    });
  }

  if (searchInput) {
    searchInput.value = state.search;
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value;
      render();
    });
  }

  syncChips();
  render();
}

document.addEventListener("DOMContentLoaded", initShopPage);
