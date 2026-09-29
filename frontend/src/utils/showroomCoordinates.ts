import { Product } from "../store/slices/productSlice";

export interface Coordinate3D {
  x: number;
  y: number;
  z: number;
  zone: string;
  shelf?: string;
  slot?: number;
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

// 🌟 3 SPACIOUS & PROMINENT HERO DISPLAY STATIONS (Center Runway & Promenades)
export const POPULAR_FEATURE_SPOTS: PopularSpot[] = [
  {
    id: "spot-1",
    index: 0,
    name: "Hero Station 1: Prime Center Runway",
    code: "HERO 1",
    badge: "🌟 #1 CENTER RUNWAY",
    anchorCoords: { x: -1.2, y: 1.6, z: 1.8, zone: "Hero Runway Station 1 (Anchor Podium)" },
    swappedCoords: { x: 1.2, y: 1.6, z: 1.8, zone: "Hero Runway Station 1 (Co-Purchase Podium)" },
    podiumCoords: { x: 0.0, y: 0.0, z: 1.8 },
    color: 0xf59e0b, // Amber Gold
    neonColorHex: "#f59e0b",
  },
  {
    id: "spot-2",
    index: 1,
    name: "Hero Station 2: West Promenade",
    code: "HERO 2",
    badge: "✨ #2 WEST PROMENADE",
    anchorCoords: { x: -8.0, y: 1.6, z: 1.8, zone: "Hero Station 2: West Promenade (Anchor)" },
    swappedCoords: { x: -5.6, y: 1.6, z: 1.8, zone: "Hero Station 2: West Promenade (Pair)" },
    podiumCoords: { x: -6.8, y: 0.0, z: 1.8 },
    color: 0x38bdf8, // Sky Blue
    neonColorHex: "#38bdf8",
  },
  {
    id: "spot-3",
    index: 2,
    name: "Hero Station 3: East Promenade",
    code: "HERO 3",
    badge: "⚡ #3 EAST PROMENADE",
    anchorCoords: { x: 5.6, y: 1.6, z: 1.8, zone: "Hero Station 3: East Promenade (Anchor)" },
    swappedCoords: { x: 8.0, y: 1.6, z: 1.8, zone: "Hero Station 3: East Promenade (Pair)" },
    podiumCoords: { x: 6.8, y: 0.0, z: 1.8 },
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

// Fallback deterministic coordinate computation if product does not yet have DB coordinates
export const computeFallbackShelfLocation = (product: Product): Coordinate3D => {
  const cat = (product.category || "").toLowerCase();
  // Extract number from SKU (e.g. SKU-1001 -> 0, SKU-1013 -> 0)
  const skuNum = parseInt((product.sku || "").replace(/\D/g, ""), 10);
  const indexInCat = !isNaN(skuNum) ? (skuNum - 1) % 12 : 0;

  // 1. Jackets (West Wing, x center: -12.5, z: -3.8)
  if (cat.includes("jacket")) {
    const shelfIndex = Math.floor(indexInCat / 4);
    const colIndex = indexInCat % 4;
    return {
      x: Number((-14.0 + colIndex * 1.0).toFixed(2)),
      y: shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0,
      z: -3.8,
      zone: "West Wing: Executive Outerwear Cupboard",
      shelf: shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf",
      slot: indexInCat + 1,
    };
  }

  // 2. Shirts (North-West Wing, x center: -12.5, z: 6.2)
  if (cat.includes("shirt") && !cat.includes("t-shirt") && !cat.includes("tee")) {
    const shelfIndex = Math.floor(indexInCat / 4);
    const colIndex = indexInCat % 4;
    return {
      x: Number((-14.0 + colIndex * 1.0).toFixed(2)),
      y: shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0,
      z: 6.2,
      zone: "North-West: Formal Shirts Wardrobe",
      shelf: shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf",
      slot: indexInCat + 1,
    };
  }

  // 3. Jeans (East Wing, x center: 12.5, z: -3.8)
  if (cat.includes("jean") || cat.includes("denim") || cat.includes("trouser")) {
    const shelfIndex = Math.floor(indexInCat / 4);
    const colIndex = indexInCat % 4;
    return {
      x: Number((11.0 + colIndex * 1.0).toFixed(2)),
      y: shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0,
      z: -3.8,
      zone: "East Wing: Premium Denim Cupboard",
      shelf: shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf",
      slot: indexInCat + 1,
    };
  }

  // 4. T-Shirts (North-East Wing, x center: 12.5, z: 6.2)
  if (cat.includes("t-shirt") || cat.includes("tee")) {
    const shelfIndex = Math.floor(indexInCat / 4);
    const colIndex = indexInCat % 4;
    return {
      x: Number((11.0 + colIndex * 1.0).toFixed(2)),
      y: shelfIndex === 0 ? 3.4 : shelfIndex === 1 ? 2.2 : 1.0,
      z: 6.2,
      zone: "North-East: Streetwear Tees Cupboard",
      shelf: shelfIndex === 0 ? "Top Shelf" : shelfIndex === 1 ? "Middle Shelf" : "Lower Shelf",
      slot: indexInCat + 1,
    };
  }

  // 5. Shoes (Center North Gallery)
  const isUpper = indexInCat < 6;
  const colIndex = isUpper ? indexInCat : indexInCat - 6;
  return {
    x: Number((-5.0 + colIndex * 2.0).toFixed(2)),
    y: isUpper ? 1.8 : 0.9,
    z: isUpper ? -12.0 : -10.0,
    zone: "Center Arcade: Footwear Vitrine Gallery",
    shelf: isUpper ? "Upper Vitrine Tier" : "Lower Vitrine Tier",
    slot: indexInCat + 1,
  };
};

export const getProductShelfLocation = (product: Product | undefined): Coordinate3D => {
  if (!product) {
    return { x: 12.0, y: 2.2, z: -3.8, zone: "East Wing: Premium Denim Cupboard", shelf: "Middle Shelf", slot: 1 };
  }

  // Check if real 3D coordinates are loaded from MongoDB
  if (product.coordinates3D && typeof product.coordinates3D.x === "number" && typeof product.coordinates3D.y === "number") {
    return {
      x: product.coordinates3D.x,
      y: product.coordinates3D.y,
      z: product.coordinates3D.z,
      zone: product.coordinates3D.zone || "Showroom Department",
      shelf: product.coordinates3D.shelf || "Display Shelf",
      slot: product.coordinates3D.slot || 1,
    };
  }

  return computeFallbackShelfLocation(product);
};

// 🏬 Cupboard Adjacency: Places the suggested cross-sell product directly next to the fast seller's cupboard slot
export const getCupboardAdjacentCoords = (anchorProduct: Product | undefined): Coordinate3D => {
  const base = getProductShelfLocation(anchorProduct);
  // Shift slightly on x (+0.6m or -0.6m depending on cupboard side) and pull slightly forward (+0.15m z)
  const xOffset = base.x < 0 ? 0.65 : -0.65;
  return {
    x: Number((base.x + xOffset).toFixed(2)),
    y: base.y,
    z: Number((base.z + 0.15).toFixed(2)),
    zone: `${base.zone} (Adjacent Slot)`,
    shelf: base.shelf,
    slot: (base.slot || 1) + 1,
  };
};

export type SwapMode = "cupboard" | "hero_showcase";

export const buildPlanogramCoordPayload = (
  pairId: string,
  anchorProduct: Product,
  pairedProduct: Product,
  suggestedProducts: Product[] = [],
  lift = "+82%",
  pairIndex = 0,
  swapMode: SwapMode = "cupboard",
  mutualSwapList: any[] = []
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
      shelf: loc.shelf,
      slot: loc.slot,
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
    mutualSwapList,
  };
};
