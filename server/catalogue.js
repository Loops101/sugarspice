/**
 * The shop's real starting catalogue (photos live in public/products).
 * Loaded once on first start. After that everything is managed in Admin > Products.
 * Fields: name, category, price, art (shown only if the photo fails), photos, description, stock, featured, bestseller, active.
 * Stock numbers are a starting guess: set the real counts in Admin > Products.
 */
const P = (f) => `/products/${f}.jpg`;

module.exports = [
  // Rings (KSh 750)
  { name: 'Pearl Oval Statement Ring', category: 'Rings', price: 750, art: 'ring', photos: ['pearl-oval-ring'], stock: 5, featured: true, bestseller: false, description: 'A bold gold-tone oval ring with a textured band and a pearl-look centre. Adjustable fit.' },
  { name: 'Hammered Triangle Ring', category: 'Rings', price: 750, art: 'ring', photos: ['triangle-ring'], stock: 5, featured: false, bestseller: false, description: 'A statement triangle ring with a hammered gold-tone finish.' },
  { name: 'Textured Disc Ring', category: 'Rings', price: 750, art: 'ring', photos: ['disc-ring'], stock: 5, featured: false, bestseller: true, description: 'A round, textured gold-tone ring that makes any outfit stand out.' },
  { name: 'Black Gem Triangle Ring', category: 'Rings', price: 750, art: 'ring', photos: ['black-triangle-ring'], stock: 5, featured: true, bestseller: false, description: 'A bold triangle ring with a faceted black stone in a polished gold-tone frame. Adjustable fit.' },
  { name: 'Rippled Gold Disc Ring', category: 'Rings', price: 750, art: 'ring', photos: ['rippled-disc-ring'], stock: 5, featured: false, bestseller: false, description: 'An oversized round ring with a rippled, liquid-gold finish. A true statement piece.' },
  // Earrings (KSh 700)
  { name: 'Gold Shell Earrings with Black Stone', category: 'Earrings', price: 700, art: 'earrings', photos: ['shell-earrings-a', 'shell-earrings-b'], stock: 5, featured: true, bestseller: true, description: 'Ridged gold-tone shell earrings topped with a black stone. A dressy evening favourite.' },
  { name: 'Black & Gold Double Triangle Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['double-triangle-earrings'], stock: 5, featured: false, bestseller: false, description: 'Glossy black and gold-tone triangles stacked into a sharp, modern drop.' },
  { name: 'Green Crystal Swirl Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['green-swirl-earrings'], stock: 5, featured: true, bestseller: false, description: 'Interlocking swirl studs set with green crystals in a gold-tone frame.' },
  { name: 'Black Crystal Swirl Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['black-swirl-earrings'], stock: 5, featured: false, bestseller: false, description: 'Interlocking swirl studs set with black crystals in a gold-tone frame.' },
  { name: 'Chunky Gold Hoop Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['chunky-hoop-earrings'], stock: 5, featured: false, bestseller: false, description: 'Wide, polished gold-tone hoops with a smooth, curved shape.' },
  { name: 'Hammered Gold Drop Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['hammered-drop-earrings'], stock: 5, featured: false, bestseller: false, description: 'Two-tier hammered gold-tone drops with a crinkled texture.' },
  { name: 'Black Crystal Rope Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['black-rope-earrings'], stock: 5, featured: false, bestseller: false, description: 'Woven black rope discs topped with a large black crystal and a crystal border.' },
  { name: 'Amber Crystal Rope Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['amber-rope-earrings'], stock: 5, featured: false, bestseller: false, description: 'Woven amber rope discs topped with a large amber crystal and a crystal border.' },
  { name: 'Emerald Crystal Rope Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['emerald-rope-earrings'], stock: 5, featured: false, bestseller: false, description: 'Woven deep green rope discs topped with a large emerald-green crystal.' },
  { name: 'Abstract Gold Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['abstract-earrings-a', 'abstract-earrings-b'], stock: 5, featured: false, bestseller: false, description: 'Smooth, open abstract shapes in polished gold tone.' },
  { name: 'Gold Flower Drop Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['flower-drop-earrings'], stock: 5, featured: true, bestseller: false, description: 'Hand-shaped gold-tone flowers on a leafy stem. Light and eye-catching.' },
  { name: 'Black Triangle Stud Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['triangle-stud-earrings'], stock: 5, featured: false, bestseller: false, description: 'Simple black triangle studs framed in gold tone.' },
  { name: 'Crystal Bow Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['bow-earrings'], stock: 5, featured: false, bestseller: false, description: 'Crinkled gold-tone bow drops with clear crystal centres.' },
  { name: 'Textured Twist Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['twist-earrings'], stock: 5, featured: false, bestseller: false, description: 'Folded, textured gold-tone statement earrings.' },
  { name: 'Ribbon Twist Drop Earrings', category: 'Earrings', price: 700, art: 'earrings', photos: ['ribbon-earrings'], stock: 5, featured: false, bestseller: false, description: 'Long twisting ribbon drops in a hammered gold-tone finish.' },
  // Brooches (KSh 1,000)
  { name: 'Pearl & Crystal Brooch Set', category: 'Brooches', price: 1000, art: 'set', photos: ['pearl-brooch-set'], stock: 5, featured: true, bestseller: false, description: 'A set of three gold-tone brooches with pearl-look beads and crystals: a bow, an oval and a perfume-bottle shape.' },
  { name: 'Emerald Crystal Brooch Set', category: 'Brooches', price: 1000, art: 'set', photos: ['emerald-brooch-set'], stock: 5, featured: false, bestseller: false, description: 'A set of three gold-tone brooches set with green crystals: a leaf, a heart and a clover flower.' },
  // Hats (KSh 2,000)
  { name: 'Fringe-Edge Straw Hat', category: 'Hats', price: 2000, art: 'set', photos: ['fringe-straw-hat-a', 'fringe-straw-hat-b'], stock: 5, featured: true, bestseller: true, description: 'A wide-brim straw hat with a frayed edge and a band of tiny coloured charms. Made for sun and style.' },
  { name: 'Beaded Straw Sun Hat', category: 'Hats', price: 2000, art: 'set', photos: ['beaded-straw-hat'], stock: 5, featured: false, bestseller: false, description: 'A wide-brim straw hat with a frayed edge and a colourful stone band.' },
  // Necklaces and the set: starting prices (1,350 / 1,500). Change any price in Admin > Products at any time.
  { name: 'Gold Ring-Link Necklace', category: 'Necklaces', price: 1500, art: 'necklace', photos: ['ring-link-necklace'], stock: 5, featured: false, bestseller: false, description: 'A necklace of open gold-tone rings with a textured finish.' },
  { name: 'Branch Pendant Necklace', category: 'Necklaces', price: 1500, art: 'necklace', photos: ['branch-necklace'], stock: 5, featured: false, bestseller: false, description: 'A fine gold-tone necklace with an abstract branch-shaped front piece.' },
  { name: 'Flower Choker', category: 'Necklaces', price: 1350, art: 'necklace', photos: ['flower-choker'], stock: 5, featured: false, bestseller: false, description: 'A slim open choker with two cream-gold flowers at the front.' },
  { name: 'Crystal Bow Tie Necklace', category: 'Necklaces', price: 1350, art: 'necklace', photos: ['tennis-bow-necklace'], stock: 5, featured: false, bestseller: false, description: 'A fine crystal-style chain that ties into a bow at the front.' },
  { name: 'Square Link Necklace', category: 'Necklaces', price: 1350, art: 'necklace', photos: ['square-link-necklace'], stock: 5, featured: false, bestseller: false, description: 'A gold-tone necklace of small square links.' },
  { name: 'Open Gold Choker', category: 'Necklaces', price: 1500, art: 'necklace', photos: ['open-choker'], stock: 5, featured: false, bestseller: false, description: 'A sculpted open choker in polished gold tone.' },
  { name: 'Hammered Chain Necklace & Earrings Set', category: 'Sets', price: 1500, art: 'set', photos: ['chain-set'], stock: 5, featured: false, bestseller: false, description: 'A chunky hammered-link necklace with matching long drop earrings.' },
].map((p) => ({ ...p, photos: p.photos.map(P), active: p.active !== false }));
