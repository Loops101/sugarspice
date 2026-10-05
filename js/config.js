/**
 * STORE_CONFIG
 * Single source of truth for business details used across the site.
 * Update values here — do not hardcode them elsewhere.
 */
const STORE_CONFIG = {
  name: "Sugar & Spice Couture",
  shortName: "Sugar & Spice",
  tagline: "Elegant pieces. Effortless style.",

  // WhatsApp number in international format, no "+", no spaces.
  // Sourced from the brand's Instagram bio (0711 766 189 -> 254711766189).
  // Replace with the confirmed business number if this changes.
  whatsappNumber: "254711766189",

  // Landline shown on Instagram, for display only (not used for WhatsApp).
  phoneDisplay: "0711 766 189 / 014 2832932",

  instagramHandle: "sugarspice_couture_",
  instagramUrl: "https://www.instagram.com/sugarspice_couture_/",

  address: {
    line1: "Superior Center, along Kimathi Street",
    line2: "Shop No L'11, 5th Floor",
    city: "Nairobi, Kenya",
  },

  currency: "KES",
  currencySymbol: "KSh",

  // Cloudinary cloud name, if/when product photography is hosted there.
  // Leave as-is while using placeholder imagery.
  cloudinaryCloudName: "REPLACE_WITH_CLOUDINARY_CLOUD_NAME",
};

/**
 * Format a number as a KSh price string, e.g. 1500 -> "KSh 1,500"
 */
function formatPrice(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "";
  return `${STORE_CONFIG.currencySymbol} ${amount.toLocaleString("en-KE")}`;
}
