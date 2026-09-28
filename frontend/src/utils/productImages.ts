// High-resolution curated apparel imagery for Velocity Retail
// Maps category & color combinations to verified, local high-definition assets

const COLOR_PALETTES: Record<string, { primary: string; light: string; dark: string }> = {
  maroon: { primary: "#6e1a24", light: "#8c2633", dark: "#4a1017" },
  olive: { primary: "#4d5d3b", light: "#61744b", dark: "#354028" },
  beige: { primary: "#d4b996", light: "#e5cfb3", dark: "#b09472" },
  navy: { primary: "#1a2b4c", light: "#253d6b", dark: "#101b30" },
  black: { primary: "#18181b", light: "#27272a", dark: "#09090b" },
  white: { primary: "#f8fafc", light: "#ffffff", dark: "#cbd5e1" },
};

export const getFallbackProductSVG = (category: string, color: string, name?: string): string => {
  const cat = (category || "apparel").toLowerCase();
  const col = (color || "black").toLowerCase();
  const palette = COLOR_PALETTES[col] || COLOR_PALETTES.black;
  const label = name || `${color} ${category}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#edf2f7"/>
      </linearGradient>
      <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.light}"/>
        <stop offset="50%" stop-color="${palette.primary}"/>
        <stop offset="100%" stop-color="${palette.dark}"/>
      </linearGradient>
      <filter id="ds" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="rgba(15, 23, 42, 0.12)"/>
      </filter>
    </defs>
    <rect width="400" height="400" fill="url(#bg)"/>
    <ellipse cx="200" cy="345" rx="130" ry="18" fill="rgba(15, 23, 42, 0.08)"/>
    <g filter="url(#ds)">
      <rect x="110" y="100" width="180" height="210" rx="16" fill="url(#cloth)" stroke="${palette.dark}" stroke-width="2"/>
      <rect x="110" y="100" width="180" height="32" rx="10" fill="${palette.light}" stroke="${palette.dark}" stroke-width="1.5"/>
      <circle cx="200" cy="116" r="4" fill="#ffffff" stroke="${palette.dark}" stroke-width="1.5"/>
    </g>
    <rect x="100" y="358" width="200" height="26" rx="13" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <text x="200" y="374" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="700" letter-spacing="1.5" fill="#475569">VELOCITY • ${label.toUpperCase()}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const CLOUDINARY_BASE = "https://res.cloudinary.com/yqs5ezyx/image/upload/velocity_retail";

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  // --- T-SHIRTS ---
  "t-shirts:black": `${CLOUDINARY_BASE}/categories/t-shirts-black.jpg`,
  "t-shirts:white": `${CLOUDINARY_BASE}/categories/t-shirts-white.jpg`,
  "t-shirts:navy": `${CLOUDINARY_BASE}/categories/t-shirts-navy.jpg`,
  "t-shirts:beige": `${CLOUDINARY_BASE}/categories/t-shirts-beige.jpg`,
  "t-shirts:olive": `${CLOUDINARY_BASE}/categories/t-shirts-olive.jpg`,
  "t-shirts:maroon": `${CLOUDINARY_BASE}/categories/t-shirts-maroon.jpg`,

  // --- SHIRTS ---
  "shirts:black": `${CLOUDINARY_BASE}/categories/shirts-black.jpg`,
  "shirts:white": `${CLOUDINARY_BASE}/categories/shirts-white.jpg`,
  "shirts:navy": `${CLOUDINARY_BASE}/categories/shirts-navy.jpg`,
  "shirts:beige": `${CLOUDINARY_BASE}/categories/shirts-beige.jpg`,
  "shirts:olive": `${CLOUDINARY_BASE}/categories/shirts-olive.jpg`,
  "shirts:maroon": `${CLOUDINARY_BASE}/categories/shirts-maroon.jpg`,

  // --- JEANS & CHINOS ---
  "jeans:black": `${CLOUDINARY_BASE}/categories/jeans-black.jpg`,
  "jeans:white": `${CLOUDINARY_BASE}/categories/jeans-white.jpg`,
  "jeans:navy": `${CLOUDINARY_BASE}/categories/jeans-navy.jpg`,
  "jeans:beige": `${CLOUDINARY_BASE}/categories/jeans-beige.jpg`,
  "jeans:olive": `${CLOUDINARY_BASE}/categories/jeans-olive.jpg`,
  "jeans:maroon": `${CLOUDINARY_BASE}/categories/jeans-maroon.jpg`,

  // --- JACKETS & OUTERWEAR ---
  "jackets:black": `${CLOUDINARY_BASE}/categories/jackets-black.jpg`,
  "jackets:white": `${CLOUDINARY_BASE}/categories/jackets-white.jpg`,
  "jackets:navy": `${CLOUDINARY_BASE}/categories/jackets-navy.jpg`,
  "jackets:beige": `${CLOUDINARY_BASE}/categories/jackets-beige.jpg`,
  "jackets:olive": `${CLOUDINARY_BASE}/categories/jackets-olive.jpg`,
  "jackets:maroon": `${CLOUDINARY_BASE}/categories/jackets-maroon.jpg`,

  // --- SHOES & FOOTWEAR ---
  "shoes:black": `${CLOUDINARY_BASE}/categories/shoes-black.jpg`,
  "shoes:white": `${CLOUDINARY_BASE}/categories/shoes-white.jpg`,
  "shoes:navy": `${CLOUDINARY_BASE}/categories/shoes-navy.jpg`,
  "shoes:beige": `${CLOUDINARY_BASE}/categories/shoes-beige.jpg`,
  "shoes:olive": `${CLOUDINARY_BASE}/categories/shoes-olive.jpg`,
  "shoes:maroon": `${CLOUDINARY_BASE}/categories/shoes-maroon.jpg`,
};

export const getProductImage = (category: string, color: string, name?: string, imageUrl?: string): string => {
  // 1. Direct explicit image URL
  if (imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0) {
    return imageUrl.trim();
  }

  // 2. Map unique product by #ID directly from Cloudinary CDN
  if (name) {
    const match = name.match(/#(\d+)/);
    if (match && match[1]) {
      const id = parseInt(match[1], 10);
      if (id >= 1 && id <= 60) {
        return `${CLOUDINARY_BASE}/products/product-${id}.jpg`;
      }
    }
  }

  const cat = (category || "").trim().toLowerCase();
  const col = (color || "").trim().toLowerCase();

  // Normalize category key
  let normalizedCat = "shirts";
  if (cat.includes("t-shirt") || cat.includes("tee")) {
    normalizedCat = "t-shirts";
  } else if (cat.includes("shirt")) {
    normalizedCat = "shirts";
  } else if (cat.includes("jean") || cat.includes("pant") || cat.includes("trouser") || cat.includes("denim")) {
    normalizedCat = "jeans";
  } else if (cat.includes("jacket") || cat.includes("blazer") || cat.includes("coat") || cat.includes("outerwear")) {
    normalizedCat = "jackets";
  } else if (cat.includes("shoe") || cat.includes("sneaker") || cat.includes("footwear") || cat.includes("boot")) {
    normalizedCat = "shoes";
  }

  // Normalize color key
  let normalizedCol = "black";
  if (col.includes("white")) normalizedCol = "white";
  else if (col.includes("navy") || col.includes("blue")) normalizedCol = "navy";
  else if (col.includes("beige") || col.includes("tan") || col.includes("khaki") || col.includes("cream") || col.includes("camel")) normalizedCol = "beige";
  else if (col.includes("olive") || col.includes("green")) normalizedCol = "olive";
  else if (col.includes("maroon") || col.includes("burgundy") || col.includes("red")) normalizedCol = "maroon";
  else if (col.includes("charcoal") || col.includes("grey") || col.includes("gray") || col.includes("black")) normalizedCol = "black";

  const key = `${normalizedCat}:${normalizedCol}`;
  if (PRODUCT_IMAGE_MAP[key]) {
    return PRODUCT_IMAGE_MAP[key];
  }

  return getFallbackProductSVG(category, color, name);
};
