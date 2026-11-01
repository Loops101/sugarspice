// Hand-drawn SVG jewelry used wherever a product has no uploaded photo, plus the hero illustration and brand mark.
// All markup here is static (no user data is ever interpolated, only a palette key), so parsing it is safe.
import { svgNode } from './ui.js';

let uid = 0;
const NS = 'xmlns="http://www.w3.org/2000/svg"';

const GEMS = {
  emerald: ['#9df0c4', '#25a872', '#0b5a3c'],
  sapphire: ['#b3cbff', '#4673e0', '#1a2d78'],
  ruby: ['#ffb0bb', '#d6304a', '#7a1024'],
  rose: ['#ffe0ea', '#e48fae', '#9c4565'],
  pearl: ['#ffffff', '#f1e8d8', '#c2b190'],
  clear: ['#ffffff', '#d5deec', '#8e9db6'],
};

export function gemFor(text = '') {
  const t = text.toLowerCase();
  if (/emerald|green/.test(t)) return 'emerald';
  if (/sapphire|blue/.test(t)) return 'sapphire';
  if (/ruby|red/.test(t)) return 'ruby';
  if (/rose|quartz|pink/.test(t)) return 'rose';
  if (/pearl/.test(t)) return 'pearl';
  return 'clear';
}

const defs = (id, g) => `
<linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3cf"/><stop offset=".45" stop-color="#d8b261"/><stop offset="1" stop-color="#8d6a2b"/></linearGradient>
<linearGradient id="${id}ga" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient>
<linearGradient id="${id}gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/></linearGradient>
<radialGradient id="${id}bg" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#3a2f1c"/><stop offset=".6" stop-color="#17130e"/><stop offset="1" stop-color="#0d0b09"/></radialGradient>`;

// A brilliant-cut gem centred on (cx, cy) with half-width s
function gem(id, cx, cy, s) {
  const gy = cy - 0.25 * s;
  const P = (x, y) => `${(cx + x * s).toFixed(1)},${(cy + y * s).toFixed(1)}`;
  return `<g stroke="#fff3cf" stroke-width="${Math.max(0.5, s / 28)}" stroke-linejoin="round" stroke-opacity=".75">
    <polygon points="${P(-1, -0.25)} ${P(-0.55, -0.7)} ${P(-0.3, -0.25)}" fill="url(#${id}ga)"/>
    <polygon points="${P(-0.55, -0.7)} ${P(0.55, -0.7)} ${P(0.3, -0.25)} ${P(-0.3, -0.25)}" fill="${'#fff'}" fill-opacity=".38"/>
    <polygon points="${P(-0.55, -0.7)} ${P(0.55, -0.7)} ${P(0.3, -0.25)} ${P(-0.3, -0.25)}" fill="url(#${id}ga)" fill-opacity=".8"/>
    <polygon points="${P(0.55, -0.7)} ${P(1, -0.25)} ${P(0.3, -0.25)}" fill="url(#${id}gb)"/>
    <polygon points="${P(-1, -0.25)} ${P(-0.3, -0.25)} ${P(0, 1)}" fill="url(#${id}gb)"/>
    <polygon points="${P(-0.3, -0.25)} ${P(0.3, -0.25)} ${P(0, 1)}" fill="url(#${id}ga)"/>
    <polygon points="${P(0.3, -0.25)} ${P(1, -0.25)} ${P(0, 1)}" fill="url(#${id}gb)" fill-opacity=".85"/>
  </g>
  <line x1="${cx - s}" y1="${gy}" x2="${cx + s}" y2="${gy}" stroke="#fff3cf" stroke-opacity=".5" stroke-width="${Math.max(0.5, s / 40)}"/>`;
}

const chainPath = (id, d, w = 2.6) => `<path d="${d}" fill="none" stroke="url(#${id}gold)" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="3.4 2.2"/>`;

const pieces = {
  necklace: (id) => `${chainPath(id, 'M34 26C44 128 156 128 166 26')}
    <circle cx="100" cy="106" r="3.6" fill="none" stroke="url(#${id}gold)" stroke-width="2"/>${gem(id, 100, 130, 16)}`,
  chain: (id) => `${chainPath(id, 'M30 22C40 112 160 112 170 22')}${chainPath(id, 'M44 22C54 150 146 150 156 22')}
    <circle cx="100" cy="120" r="4.5" fill="url(#${id}gold)"/>`,
  earrings: (id) => [64, 136].map((x) => `
    <circle cx="${x}" cy="56" r="6" fill="none" stroke="url(#${id}gold)" stroke-width="2.4"/>
    <line x1="${x}" y1="62" x2="${x}" y2="86" stroke="url(#${id}gold)" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="${x}" cy="90" r="3.2" fill="url(#${id}gold)"/>${gem(id, x, 118, 17)}`).join(''),
  bracelet: (id) => `<ellipse cx="100" cy="98" rx="64" ry="34" fill="none" stroke="url(#${id}gold)" stroke-opacity=".45" stroke-width="2"/>
    <ellipse cx="100" cy="110" rx="64" ry="36" fill="none" stroke="url(#${id}gold)" stroke-width="9" stroke-linecap="round" stroke-dasharray="0.1 10.8"/>
    <ellipse cx="100" cy="110" rx="64" ry="36" fill="none" stroke="url(#${id}gold)" stroke-opacity=".6" stroke-width="1.4"/>${gem(id, 100, 150, 11)}`,
  ring: (id) => `<ellipse cx="100" cy="132" rx="36" ry="42" fill="none" stroke="url(#${id}gold)" stroke-width="9"/>
    <ellipse cx="100" cy="132" rx="36" ry="42" fill="none" stroke="#fff6dc" stroke-opacity=".5" stroke-width="1.3" transform="translate(-2 -1)"/>
    <path d="M80 98l6 8M120 98l-6 8M100 92v10" stroke="url(#${id}gold)" stroke-width="3" stroke-linecap="round"/>${gem(id, 100, 82, 26)}`,
  set: (id) => `<g transform="translate(22 12) scale(.78)">${pieces.necklace(id)}</g><g transform="translate(50 142) scale(.5)">${pieces.earrings(id)}</g>`,
};
pieces.set = pieces.set; // composed from the pieces above

const STAR = 'M0-7C1-2 2-1 7 0C2 1 1 2 0 7C-1 2-2 1-7 0C-2-1-1-2 0-7Z';
const sparkle = (x, y, s = 1, delay = 0) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="twinkle" d="${STAR}" fill="#fff6dc" style="animation-delay:${delay}s"/></g>`;

/** Product / category artwork. kind: necklace | earrings | bracelet | ring | set | chain */
export function art(kind, seed = '', { bg = true } = {}) {
  const id = 'a' + ++uid;
  const g = GEMS[gemFor(seed)];
  const draw = pieces[kind] || pieces.necklace;
  const svg = svgNode(`<svg ${NS} class="art" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${kind} illustration">
    <defs>${defs(id, g)}</defs>
    ${bg ? `<rect width="200" height="200" fill="url(#${id}bg)"/>` : ''}
    ${draw(id)}
    ${sparkle(40, 60, 0.9, 0)}${sparkle(168, 92, 0.7, 1.2)}${sparkle(150, 40, 0.55, 2.2)}
  </svg>`);
  return svg;
}

/** Big hero illustration: a faceted emerald on a chain inside gold rings echoing the circular logo badge */
export function heroArt() {
  const id = 'h' + ++uid;
  const g = GEMS.emerald;
  const dots = [0, 60, 120, 180, 240, 300].map((a) => {
    const r = 225, x = 250 + r * Math.cos((a * Math.PI) / 180), y = 250 + r * Math.sin((a * Math.PI) / 180);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="url(#${id}gold)"/>`;
  }).join('');
  return svgNode(`<svg ${NS} class="art" viewBox="0 0 500 500" role="img" aria-label="A faceted emerald pendant on a gold chain inside concentric gold rings">
    <defs>${defs(id, g)}
      <radialGradient id="${id}glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e8c777" stop-opacity=".42"/><stop offset=".55" stop-color="#c9a45c" stop-opacity=".12"/><stop offset="1" stop-color="#c9a45c" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="250" cy="250" r="245" fill="url(#${id}glow)"/>
    <circle cx="250" cy="250" r="198" fill="none" stroke="url(#${id}gold)" stroke-opacity=".85" stroke-width="1.6"/>
    <circle cx="250" cy="250" r="160" fill="none" stroke="url(#${id}gold)" stroke-opacity=".38" stroke-width="1"/>
    <circle cx="250" cy="250" r="118" fill="rgba(255,255,255,.03)" stroke="url(#${id}gold)" stroke-opacity=".25" stroke-width="1"/>
    <g class="ring-spin"><circle cx="250" cy="250" r="225" fill="none" stroke="url(#${id}gold)" stroke-opacity=".5" stroke-width="1" stroke-dasharray="2 9"/>${dots}</g>
    ${chainPath(id, 'M118 -10C150 150 212 214 250 238', 3.2)}
    ${chainPath(id, 'M382 -10C350 150 288 214 250 238', 3.2)}
    <circle cx="250" cy="246" r="10" fill="none" stroke="url(#${id}gold)" stroke-width="3.4"/>
    <circle cx="250" cy="246" r="3" fill="url(#${id}gold)"/>
    <g>${gem(id, 250, 352, 100)}</g>
    <polygon class="sheen" points="195,300 232,300 214,335 175,335" fill="#fff" opacity=".25"/>
    ${sparkle(120, 150, 1.6, 0)}${sparkle(392, 130, 1.2, 0.9)}${sparkle(76, 330, 1, 1.7)}${sparkle(430, 330, 1.5, 2.4)}${sparkle(330, 460, 1, 0.5)}${sparkle(170, 470, 1.2, 2)}
  </svg>`);
}

/** The shop's logo mark (lady with hat and shopping bags), cut out on a transparent background */
export function brandMark() {
  const img = document.createElement('img');
  img.className = 'brand-mark';
  img.src = '/img/logo-mark.png';
  img.alt = '';
  img.width = 44; img.height = 44;
  img.decoding = 'async';
  return img;
}

/** Small empty-state glyph */
export function emptyGlyph() {
  const id = 'e' + ++uid;
  return svgNode(`<svg ${NS} class="glyph" viewBox="0 0 100 100" aria-hidden="true">
    <defs>${defs(id, GEMS.clear)}</defs>
    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#${id}gold)" stroke-opacity=".5"/>
    ${gem(id, 50, 52, 20)}
  </svg>`);
}

export const KINDS = ['necklace', 'earrings', 'bracelet', 'ring', 'set', 'chain'];
/** Pick artwork for a category tile */
export const kindForCategory = (c) => ({ Necklaces: 'necklace', Earrings: 'earrings', Bracelets: 'bracelet', Rings: 'ring', Sets: 'set', 'Stainless Steel': 'chain' }[c] || 'necklace');
