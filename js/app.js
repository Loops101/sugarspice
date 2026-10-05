/**
 * Shared behaviors used on every page: mobile nav, search panel,
 * toast notifications, scroll-reveal, footer year, cart count.
 */

function showToast(message) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  stack.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 220);
  }, 2200);
}

function initMobileNav() {
  const hamburger = document.querySelector(".hamburger");
  const menu = document.querySelector(".mobile-menu");
  if (!hamburger || !menu) return;

  hamburger.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    hamburger.setAttribute("aria-expanded", String(isOpen));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("is-open");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });
}

function initSearchPanel() {
  const toggle = document.querySelector("[data-search-toggle]");
  const panel = document.querySelector(".search-panel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      const input = panel.querySelector("input");
      if (input) input.focus();
    }
  });

  const form = panel.querySelector("form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = form.elements["q"].value.trim();
      window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
    });
  }
}

function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => observer.observe(el));
}

function setFooterYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initSearchPanel();
  initScrollReveal();
  setFooterYear();
  if (typeof updateCartCount === "function") updateCartCount();
});
