import { Product } from "../store/slices/productSlice";

export interface Coordinate3D {
  x: number;
  y: number;
  z: number;
  zone: string;
}

export interface PopularSpot {
  id: string;
  index: number;
  name: string;
  code: string;
  badge: string;
  anchorCoords: Coordinate3D;
  swappedCoords: Coordinate3D;
  podiumCoords: { x: number; y: number; z: number };
  color: number;
  neonColorHex: string;
}

// 🌟 3 SPACIOUS & PROMINENT HERO DISPLAY STATIONS (Far apart with high visibility)
export const POPULAR_FEATURE_SPOTS: PopularSpot[] = [
  {
    id: "spot-1",
    index: 0,
    name: "Hero Station 1: Prime Center Runway",
    code: "HERO 1",
    badge: "🌟 #1 CENTER RUNWAY",
    anchorCoords: { x: -0.85, y: 1.8, z: 2.8, zone: "Hero Station 1: Center Runway (Anchor)" },
    swappedCoords: { x: 0.85, y: 1.8, z: 2.8, zone: "Hero Station 1: Center Runway (Pair)" },
    podiumCoords: { x: 0.0, y: 0.0, z: 2.8 },
    color: 0xf59e0b, // Amber Gold
    neonColorHex: "#f59e0b",
  },
  {
    id: "spot-2",
    index: 1,
    name: "Hero Station 2: West Grand Promenade",
    code: "HERO 2",
    badge: "✨ #2 WEST PROMENADE",
    anchorCoords: { x: -10.3, y: 1.8, z: 5.2, zone: "Hero Station 2: West Promenade (Anchor)" },
    swappedCoords: { x: -8.7, y: 1.8, z: 5.2, zone: "Hero Station 2: West Promenade (Pair)" },
    podiumCoords: { x: -9.5, y: 0.0, z: 5.2 },
    color: 0x38bdf8, // Sky Blue
    neonColorHex: "#38bdf8",
  },
  {
    id: "spot-3",
    index: 2,
    name: "Hero Station 3: East Grand Promenade",
    code: "HERO 3",
    badge: "⚡ #3 EAST PROMENADE",
    anchorCoords: { x: 8.7, y: 1.8, z: 5.2, zone: "Hero Station 3: East Promenade (Anchor)" },
    swappedCoords: { x: 10.3, y: 1.8, z: 5.2, zone: "Hero Station 3: East Promenade (Pair)" },
    podiumCoords: { x: 9.5, y: 0.0, z: 5.2 },
    color: 0xa855f7, // Royal Purple
    neonColorHex: "#a855f7",
  },
];

export const getPopularSpotByIndex = (index: number): PopularSpot => {
  const safeIdx = Math.abs(index) % POPULAR_FEATURE_SPOTS.length;
  return POPULAR_FEATURE_SPOTS[safeIdx];
};

export const HERO_RUNWAY_ANCHOR: Coordinate3D = POPULAR_FEATURE_SPOTS[0].anchorCoords;
export const HERO_RUNWAY_SWAPPED: Coordinate3D = POPULAR_FEATURE_SPOTS[0].swappedCoords;

// 🏬 Cupboard Adjacency: Places the suggested cross-sell product directly next to the fast seller's cupboard/shelf
export const getCupboardAdjacentCoords = (anchorProduct: Product | undefined): Coordinate3D => {
  const base = getProductShelfLocation(anchorProduct);
  // Place on adjacent shelf bay in the same fixture/aisle
  const xOffset = base.x > 0 ? -1.8 : 1.8;
  return {
    x: Number((base.x + xOffset).toFixed(2)),
    y: base.y,
    z: base.z,
    zone: `${base.zone} (Adjacent Shelf Bay)`,
  };
};

export const getProductShelfLocation = (product: Product | undefined): Coordinate3D => {
  if (!product) {
    return { x: 6.5, y: 2.2, z: -5.5, zone: "Streetwear Chinos Bay" };
  }

  const cat = (product.category || "").toLowerCase();
  const name = (product.name || "").toLowerCase();

  // 1. Jeans & Chinos (Zone 2)
  if (cat.includes("jean") || cat.includes("denim") || cat.includes("trouser") || cat.includes("pant")) {
    if (name.includes("selvedge") || name.includes("raw") || name.includes("heavyweight")) {
      return { x: 12.5, y: 2.2, z: -13.5, zone: "Premium Denim Wall" };
    }
    if (name.includes("chino") || name.includes("ecru") || name.includes("sandstone")) {
      return { x: 6.5, y: 2.2, z: -5.5, zone: "Streetwear Chinos Bay" };
    }
    if (name.includes("distressed") || name.includes("stretch") || name.includes("acid")) {
      return { x: 6.5, y: 2.2, z: 0.5, zone: "Center Aisle: Raw & Distressed Denim" };
    }
    return { x: 17.2, y: 2.2, z: -6.5, zone: "Urban Chinos & Denim Bay" };
  }

  // 2. T-Shirts & Graphic Streetwear (Zone 2)
  if (cat.includes("t-shirt") || cat.includes("tee")) {
    if (name.includes("graphic") || name.includes("print") || name.includes("acid")) {
      return { x: 17.2, y: 2.2, z: 4.5, zone: "Streetwear Graphic Tees Wall" };
    }
    if (name.includes("studio") || name.includes("heavyweight") || name.includes("supima")) {
      return { x: 6.5, y: 2.2, z: 6.0, zone: "Heavyweight Studio Tees Bay" };
    }
    return { x: 12.5, y: 2.2, z: -5.5, zone: "East Arcade: Urban Street Tees" };
  }

  // 3. Collared & Dress Shirts (Zone 3)
  if (cat.includes("shirt")) {
    if (name.includes("oxford") || name.includes("royal") || name.includes("dress")) {
      return { x: -6.5, y: 2.2, z: 0.5, zone: "Royal Oxford Shirts Bay" };
    }
    if (name.includes("sateen") || name.includes("linen") || name.includes("twill")) {
      return { x: 2.5, y: 2.2, z: -3.0, zone: "Runway Sateen Shirts Bay" };
    }
    return { x: -6.5, y: 2.2, z: -6.0, zone: "Center Aisle Formal Shirts" };
  }

  // 4. Footwear & Shoes (Zone 4)
  if (cat.includes("shoe") || cat.includes("boot") || cat.includes("loafer") || cat.includes("sneaker") || cat.includes("footwear")) {
    if (name.includes("oxford") || name.includes("monk") || name.includes("boot") || name.includes("chelsea")) {
      return { x: 7.5, y: 1.8, z: 7.0, zone: "Luxury Footwear Vitrine East" };
    }
    return { x: -7.5, y: 1.8, z: 7.0, zone: "Luxury Footwear Vitrine West" };
  }

  // 5. Outerwear & Jackets (Zone 1)
  if (name.includes("blazer") || name.includes("tuxedo")) {
    return { x: -12.5, y: 2.2, z: -13.5, zone: "Savile Row Blazers Bay" };
  }
  if (name.includes("overcoat") || name.includes("cashmere")) {
    return { x: -17.2, y: 2.2, z: -6.5, zone: "Cashmere Overcoats Bay" };
  }
  return { x: -17.2, y: 2.2, z: 4.5, zone: "Trench & Evening Coats Wall" };
};

export type SwapMode = "cupboard" | "hero_showcase";

export const buildPlanogramCoordPayload = (
  pairId: string,
  anchorProduct: Product,
  pairedProduct: Product,
  suggestedProducts: Product[] = [],
  lift = "+82%",
  pairIndex = 0,
  swapMode: SwapMode = "cupboard"
) => {
  let idx = pairIndex;
  const match = pairId.match(/(\d+)/);
  if (match) {
    idx = parseInt(match[1], 10) - 1;
  }
  const spot = getPopularSpotByIndex(idx);
  const anchorHomeCoords = getProductShelfLocation(anchorProduct);
  const origCoords = getProductShelfLocation(pairedProduct);
  const cupboardAdjacentCoords = getCupboardAdjacentCoords(anchorProduct);

  const isCupboardMode = swapMode === "cupboard";
  const sourceCoordinates = isCupboardMode ? anchorHomeCoords : spot.anchorCoords;
  const swappedPairedCoordinates = isCupboardMode ? cupboardAdjacentCoords : spot.swappedCoords;

  const suggestedList = (suggestedProducts.length > 0 ? suggestedProducts : [pairedProduct]).map((p) => {
    const loc = getProductShelfLocation(p);
    return {
      productId: p._id,
      sku: p.sku,
      name: p.name,
      x: loc.x,
      y: loc.y,
      z: loc.z,
      zone: loc.zone,
    };
  });

  return {
    activePairId: pairId,
    swapMode,
    spotId: isCupboardMode ? "cupboard-adjacent" : spot.id,
    spotName: isCupboardMode
      ? `Adjacent Cupboard: Next to ${anchorProduct.name} (${anchorHomeCoords.zone})`
      : spot.name,
    lift,
    sourceProductId: anchorProduct._id,
    pairedProductId: pairedProduct._id,
    sourceCoordinates,
    originalPairedCoordinates: origCoords,
    swappedPairedCoordinates,
    suggestedCoordinatesList: suggestedList,
  };
};
