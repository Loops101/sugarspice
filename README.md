# Sugar & Spice Couture — Website

A frontend-only e-commerce website for Sugar & Spice Couture, a Nairobi jewelry
and accessories shop. Pure HTML, CSS and vanilla JavaScript — no backend,
no database, no build step. Checkout happens through WhatsApp.

## 1. Project structure

```
/project
├── index.html          Homepage
├── shop.html            Product browsing, search, filter, sort
├── product.html          Single product page (?id=spc-001)
├── cart.html             Cart + WhatsApp checkout
├── about.html            Brand story, FAQs
├── contact.html          Contact details
├── 404.html               Custom not-found page
│
├── css/
│   ├── style.css          Design tokens, layout, components
│   ├── responsive.css      Breakpoints
│   └── animations.css      Micro-interactions
│
├── js/
│   ├── config.js           Business config (WhatsApp number, Instagram, address)
│   ├── products.js          Product catalog + rendering helpers
│   ├── cart.js               localStorage cart logic + cart page
│   ├── whatsapp.js            WhatsApp message + checkout
│   ├── shop.js                 Shop page: filter / search / sort
│   ├── product.js               Product detail page logic
│   └── app.js                    Shared nav, search, toasts, reveal
│
├── favicon/favicon.svg
├── robots.txt
├── sitemap.xml
└── README.md
```

## 2. How to add a product

Open `js/products.js` and add a new object to the `products` array:

```js
{
  id: "spc-017",                 // unique, no spaces
  name: "New Piece Name",
  category: "Necklaces",         // must match one of CATEGORIES
  price: 1500,
  oldPrice: null,                 // or a number higher than price, to show a sale badge
  description: "Short description shown on the product page.",
  images: ["https://res.cloudinary.com/.../image1.jpg"],
  featured: false,                 // shows on homepage "Featured pieces"
  bestseller: false,
  available: true,
  dateAdded: "2026-09-16",          // used by the "Newest" sort
}
```

No other file needs to change — the shop grid, homepage, search, and product
page all read from this one array.

## 3. How to change prices

Edit the `price` (and optional `oldPrice`) field for the relevant product in
`js/products.js`. Prices are plain numbers in KES; formatting (e.g. "KSh
1,500") is handled automatically by `formatPrice()` in `js/config.js`.

## 4. How to change Cloudinary images

Replace the `images` array for a product with your Cloudinary URLs, e.g.:

```js
images: [
  "https://res.cloudinary.com/your-cloud-name/image/upload/v123/necklace-1.jpg",
  "https://res.cloudinary.com/your-cloud-name/image/upload/v123/necklace-2.jpg",
]
```

The site automatically applies Cloudinary transformations (resizing, auto
quality/format) through the `cloudinaryUrl()` helper in `js/products.js` — you
don't need to build transformation URLs by hand. Also set your cloud name in
`STORE_CONFIG.cloudinaryCloudName` in `js/config.js` for reference.

Until real photography is added, products use placeholder images from
picsum.photos so the site looks complete — these are safe to leave in a demo
but should be replaced before launch.

## 5. How to change the WhatsApp number

Open `js/config.js` and update:

```js
whatsappNumber: "254711766189",
```

Use the international format with no `+`, spaces, or leading `0` (e.g. a
Kenyan number `0711 766 189` becomes `254711766189`). This single value
powers every WhatsApp button and the checkout flow site-wide.

## 6. How to change the Instagram link

Also in `js/config.js`:

```js
instagramHandle: "sugarspice_couture_",
instagramUrl: "https://www.instagram.com/sugarspice_couture_/",
```

## 7. How to change business information

Store name, tagline, address, and phone display all live in the
`STORE_CONFIG` object at the top of `js/config.js`. Update the values there;
pages that display this information (footer, contact page, structured data)
pull from the same source, so most of it does not need editing per page.

The physical address is currently also written directly into the footer
markup on each HTML page and into the `JewelryStore` structured data on
`index.html` — update those if the shop location changes.

## 8. How to deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New Project** → import the repository.
3. Framework preset: **Other** (static site) — no build command needed.
4. Output directory: leave as the project root (`.`).
5. Deploy. The site works the same on Netlify (drag-and-drop the folder, or
   connect the repo) and GitHub Pages (enable Pages on the repo, root branch).

## 9. How WhatsApp checkout works

There is no payment gateway or server. When a customer clicks **Checkout via
WhatsApp** on the cart page (or **Order on WhatsApp** on a product page),
`js/whatsapp.js` builds a plain-text order message from the cart contents and
opens:

```
https://wa.me/<whatsappNumber>?text=<url-encoded order message>
```

This opens WhatsApp (app or Web) with the message pre-filled, ready for the
customer to send to the shop's WhatsApp number. Sugar & Spice Couture then
confirms availability, delivery and payment directly in that chat.

## 10. How the localStorage cart works

`js/cart.js` stores the cart as a JSON array under the key `ssc_cart_v1` in
the browser's `localStorage`, so it survives page refreshes and revisits on
the same device/browser. Nothing is sent to a server. Customer checkout
details entered on the cart page (name, location, notes) are only used to
build the WhatsApp message and are not saved to localStorage.

If `localStorage` is unavailable (e.g. private browsing with storage
disabled), the cart still functions for the current page view but won't
persist — `js/cart.js` guards every storage call so this fails gracefully
rather than throwing errors.

---

**Note on placeholder data:** product photography, and the homepage/Instagram
gallery images, use picsum.photos placeholders. Business name, address, phone
numbers and Instagram handle were taken directly from the brand's Instagram
profile. No reviews, ratings, delivery promises, or product claims were
invented — replace placeholder imagery before launch.
