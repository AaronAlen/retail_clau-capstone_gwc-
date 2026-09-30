import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  Sparkles,
  RotateCw,
  Maximize2,
  Minimize2,
  Flame,
  Clock,
  CheckCircle2,
  ShoppingCart,
  X,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Zap,
  Store,
  MapPin,
  TrendingUp,
  Search,
  Crosshair,
  ArrowRightLeft,
  Smartphone,
  CheckSquare,
  Square,
  ClipboardCheck,
  Check,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import { fetchProducts, Product } from "../store/slices/productSlice";
import { getProductImage } from "../utils/productImages";
import { useSocket } from "../hooks/useSocket";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import {
  Coordinate3D,
  PopularSpot,
  POPULAR_FEATURE_SPOTS,
  getPopularSpotByIndex,
  getProductShelfLocation,
  getCupboardAdjacentCoords,
  buildPlanogramCoordPayload,
  SwapMode,
} from "../utils/showroomCoordinates";

interface VelocityRow {
  product: Product;
  velocityPerDay: number;
  stock: number;
  daysOfStockLeft: number | null;
  isFastMover: boolean;
}

interface Recommendation {
  sourceProduct: Product;
  similarProducts: Product[];
  reason: string;
}

export interface Store3DVisualizerProps {
  fastMovers?: VelocityRow[];
  recommendations?: Recommendation[];
  onSelectProduct?: (product: Product) => void;
  onRefreshData?: () => void;
  selectedPairIndex?: number;
  onPairChange?: (idx: number) => void;
}

interface CupboardFixture {
  id: string;
  name: string;
  department: string;
  category: string;
  x: number;
  z: number;
  accentColor: number;
  accentHex: string;
  products: Product[];
}

// Isolated Digital Clock to prevent parent component re-renders
const ShowroomClock = React.memo(() => {
  const [time, setTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;
  return (
    <div className="glass-panel px-3 py-1.5 rounded-xl hidden sm:flex items-center gap-1.5 text-xs text-amber-300 border border-amber-500/30">
      <Clock className="w-3.5 h-3.5 text-amber-400" />
      <span className="font-mono text-[11px] font-bold">{time}</span>
    </div>
  );
});

// Helper: Map product catalog color names to authentic luxury Three.js hex colors
export const getColorHexFromName = (colorName?: string, fallbackHex: number = 0x3b82f6): number => {
  if (!colorName) return fallbackHex;
  const c = colorName.toLowerCase().trim();
  if (c.includes("beige") || c.includes("tan") || c.includes("khaki")) return 0xd2b48c;
  if (c.includes("camel")) return 0xc19a6b;
  if (c.includes("navy")) return 0x1e3a8a;
  if (c.includes("black") || c.includes("noir") || c.includes("charcoal")) return 0x18181b;
  if (c.includes("white") || c.includes("ivory") || c.includes("cream")) return 0xf1f5f9;
  if (c.includes("sky") || c.includes("cyan")) return 0x38bdf8;
  if (c.includes("blue") || c.includes("indigo") || c.includes("oxford")) return 0x2563eb;
  if (c.includes("red") || c.includes("crimson") || c.includes("burgundy") || c.includes("wine")) return 0x991b1b;
  if (c.includes("olive") || c.includes("green") || c.includes("sage") || c.includes("forest")) return 0x4d533c;
  if (c.includes("brown") || c.includes("cognac") || c.includes("caramel") || c.includes("leather") || c.includes("espresso")) return 0x78350f;
  if (c.includes("grey") || c.includes("gray") || c.includes("slate")) return 0x475569;
  if (c.includes("gold") || c.includes("yellow") || c.includes("amber")) return 0xd97706;
  if (c.includes("purple") || c.includes("violet")) return 0x7c3aed;
  if (c.includes("pink") || c.includes("rose")) return 0xe11d48;
  return fallbackHex;
};

export const Store3DVisualizer: React.FC<Store3DVisualizerProps> = ({
  fastMovers,
  recommendations,
  onSelectProduct,
  onRefreshData,
  selectedPairIndex,
  onPairChange,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const catalogProducts = useSelector((state: RootState) => state.products.items);

  const visualizerRootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeView, setActiveView] = useState<string>("all");
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotateRef = useRef(false);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHeatmapMode, setIsHeatmapMode] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isHorizontalMode, setIsHorizontalMode] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [isForcedRotate90, setIsForcedRotate90] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<"none" | "inspect" | "strategy" | "tasks">("none");
  const [strategyTab, setStrategyTab] = useState<"strategy" | "floor_tasks">("strategy");
  const [floorCheckedItems, setFloorCheckedItems] = useState<Record<string, boolean>>({});
  const [executedFloorItems, setExecutedFloorItems] = useState<Record<string, boolean>>({});
  const [isSavingFloorSwap, setIsSavingFloorSwap] = useState(false);
  const hasUserSelectedRef = useRef(false);

  // Zoom / Pan Ref for toolbar buttons & mobile controls
  const zoomControlRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
    setHorizontalView: () => void;
  }>({
    zoomIn: () => {},
    zoomOut: () => {},
    resetView: () => {},
    setHorizontalView: () => {},
  });

  const toggleHorizontalView = () => {
    setIsHorizontalMode((prev) => {
      const next = !prev;
      if (next) {
        zoomControlRef.current.setHorizontalView();
        showToast("📱 Horizontal Runway View Activated (3 Stations Framed)", "info");
      } else {
        zoomControlRef.current.resetView();
        showToast("📐 360° Free Orbit View Restored", "info");
      }
      return next;
    });
  };

  // Active AI Planogram Selection (Pair 1 to Pair 5)
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(selectedPairIndex ?? 0);

  // Hovered / Inspected Product State for Rich Side Overlay
  const [hoveredProduct, setHoveredProduct] = useState<Product | null>(null);
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(null);
  const [hoveredMannequin, setHoveredMannequin] = useState<{
    mannequinIndex: number;
    part: "upper" | "pants" | "shoes";
    stationName: string;
    badge: string;
    outfit: {
      jacket: Product;
      tshirt: Product;
      pants: Product;
      shoes: Product;
    };
  } | null>(null);
  const hoveredProductIdRef = useRef<string | null>(null);
  const isMouseOverUIRef = useRef(false);

  const { showToast } = useToast();
  const [swapMode, setSwapMode] = useState<SwapMode>("cupboard");
  const [planogramApplied, setPlanogramApplied] = useState(false);
  const planogramAppliedRef = useRef(false);
  useEffect(() => {
    planogramAppliedRef.current = planogramApplied;
  }, [planogramApplied]);

  const [actionLoading, setActionLoading] = useState(false);
  const [isSwapAnimating, setIsSwapAnimating] = useState(false);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const triggerFlightAnimationRef = useRef<((forward?: boolean, specificProductIds?: string[]) => void) | null>(null);
  const snapToAppliedPositionsRef = useRef<(() => void) | null>(null);

  // Search Bar & 3D Scope Pointer States
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchedProduct, setSearchedProduct] = useState<Product | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const focusCameraOnPosRef = useRef<((pos: THREE.Vector3) => void) | null>(null);
  const scopePointerGroupRef = useRef<THREE.Group | null>(null);
  const productGroupsMapRef = useRef<Map<string, { group: THREE.Group; originalPos: THREE.Vector3; product: Product }>>(new Map());

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  // Sync external selectedPairIndex
  useEffect(() => {
    if (selectedPairIndex !== undefined && selectedPairIndex !== selectedSuggestionIdx) {
      hasUserSelectedRef.current = true;
      setSelectedSuggestionIdx(selectedPairIndex);
      setPlanogramApplied(false);
    }
  }, [selectedPairIndex]);

  // Load products if missing
  useEffect(() => {
    if (!catalogProducts || catalogProducts.length === 0) {
      dispatch(fetchProducts());
    }
  }, [dispatch, catalogProducts.length]);

  // Helper to ensure deterministic ordering by SKU
  const sortBySku = (list: Product[]) =>
    [...list].sort((a, b) => (a.sku || "").localeCompare(b.sku || "", undefined, { numeric: true }));

  // Group products by 5 categories (12 items each = 60 products total) - memoized and sorted strictly by SKU
  const jackets = React.useMemo(() => sortBySku(catalogProducts.filter((p) => p.category === "Jackets")), [catalogProducts]);
  const jeans = React.useMemo(() => sortBySku(catalogProducts.filter((p) => p.category === "Jeans")), [catalogProducts]);
  const shirts = React.useMemo(() => sortBySku(catalogProducts.filter((p) => p.category === "Shirts")), [catalogProducts]);
  const tshirts = React.useMemo(() => sortBySku(catalogProducts.filter((p) => p.category === "T-Shirts")), [catalogProducts]);
  const shoes = React.useMemo(() => sortBySku(catalogProducts.filter((p) => p.category === "Shoes")), [catalogProducts]);

  // Robust fallback items if catalog is still fetching
  const defaultFallbackAnchor: Product = React.useMemo(() => ({
    _id: "fb-anchor-1001",
    sku: "SKU-1001",
    name: "Beige Cashmere Overcoat",
    category: "Jackets",
    price: 18999,
    costPrice: 9500,
    stock: 24,
    reorderPoint: 5,
    color: "Beige",
    material: "Cashmere",
    tags: ["outerwear"],
    salesVelocity: 14.5,
  }), []);

  const defaultFallbackPartner: Product = React.useMemo(() => ({
    _id: "fb-partner-2001",
    sku: "SKU-2001",
    name: "Black Tailored Denim",
    category: "Jeans",
    price: 6499,
    costPrice: 2800,
    stock: 35,
    reorderPoint: 8,
    color: "Black",
    material: "Denim",
    tags: ["denim"],
    salesVelocity: 12.0,
  }), []);

  // Dynamic AI Planogram Suggestions (Cross-Cupboard Complementary Pairings)
  const suggestions = React.useMemo(() => {
    const fbAnchor = jackets[0] || catalogProducts[0] || defaultFallbackAnchor;
    const fbPartner = jeans[0] || catalogProducts[1] || defaultFallbackPartner;

    const curatedDefaultPairs = [
      {
        id: "sug-1",
        title: "Executive Outerwear + Contrast Denim Ensemble",
        dept: "Executive Outerwear",
        lift: "+84%",
        anchor: jackets.find((j) => j.color === "Beige" || j.name.includes("Cashmere")) || jackets[0] || fbAnchor,
        partner: jeans.find((j) => j.color === "Black" || j.name.includes("Tailored Slim")) || jeans[0] || fbPartner,
        similarProducts: [
          jeans.find((j) => j.color === "Black") || jeans[0] || fbPartner,
          shirts.find((s) => s.color === "White") || shirts[0] || fbAnchor,
          tshirts.find((t) => t.color === "Black") || tshirts[0] || fbAnchor,
          shoes.find((s) => s.color === "Black") || shoes[0] || fbPartner,
        ].filter(Boolean) as Product[],
        rationale: "High-contrast full-outfit pairing (Outerwear + Denim + Oxford Shirt + Oxford Shoe) lifts basket size by 84%.",
      },
      {
        id: "sug-2",
        title: "Streetwear Duo: Organic Tee + Layered Overshirt",
        dept: "Denim & Streetwear",
        lift: "+76%",
        anchor: tshirts.find((t) => t.color === "Black" || t.name.includes("Mercerized")) || tshirts[0] || fbAnchor,
        partner: shirts.find((s) => s.color === "White" || s.name.includes("Oxford")) || shirts[0] || fbPartner,
        similarProducts: [
          shirts.find((s) => s.color === "White") || shirts[0] || fbPartner,
          jeans.find((j) => j.color === "Blue" || j.color === "Navy") || jeans[1] || jeans[0] || fbPartner,
          jackets.find((j) => j.color === "Navy") || jackets[1] || jackets[0] || fbAnchor,
          shoes.find((s) => s.color === "White") || shoes[1] || shoes[0] || fbPartner,
        ].filter(Boolean) as Product[],
        rationale: "Customers buying basic black tees readily add open-collar overshirts, denim, and sneakers.",
      },
      {
        id: "sug-3",
        title: "Formal Suiting + Handcrafted Italian Footwear",
        dept: "Executive Suits",
        lift: "+72%",
        anchor: jackets.find((j) => j.color === "Navy" || j.name.includes("Blazer")) || jackets[1] || jackets[0] || fbAnchor,
        partner: shoes.find((s) => s.color === "Black" || s.name.includes("Oxford")) || shoes[0] || fbPartner,
        similarProducts: [
          shoes.find((s) => s.color === "Black") || shoes[0] || fbPartner,
          shirts.find((s) => s.color === "Light Blue" || s.color === "Blue") || shirts[1] || shirts[0] || fbPartner,
          jeans.find((j) => j.color === "Grey" || j.color === "Charcoal") || jeans[2] || jeans[0] || fbPartner,
          tshirts.find((t) => t.color === "White") || tshirts[1] || tshirts[0] || fbAnchor,
        ].filter(Boolean) as Product[],
        rationale: "Positioning handcrafted leather footwear directly with navy suits drives complete formal outfit conversion.",
      },
      {
        id: "sug-4",
        title: "Contemporary Casual: Earthy Tee + Tailored Chino",
        dept: "Contemporary Casual",
        lift: "+68%",
        anchor: tshirts.find((t) => t.color === "Olive" || t.color === "Beige") || tshirts[1] || tshirts[0] || fbAnchor,
        partner: jeans.find((j) => j.color === "Beige" || j.color === "Olive") || jeans[1] || jeans[0] || fbPartner,
        similarProducts: [
          jeans.find((j) => j.color === "Beige" || j.color === "Olive") || jeans[1] || jeans[0] || fbPartner,
          shirts.find((s) => s.color === "Beige" || s.color === "Brown") || shirts[2] || shirts[0] || fbPartner,
          shoes.find((s) => s.color === "Brown" || s.color === "Tan") || shoes[2] || shoes[0] || fbPartner,
          jackets.find((j) => j.color === "Olive" || j.color === "Brown") || jackets[2] || jackets[0] || fbAnchor,
        ].filter(Boolean) as Product[],
        rationale: "Matching earth-tone organic studio tees with neutral trousers and loafers lifts impulse multi-item checkout by 68%.",
      },
      {
        id: "sug-5",
        title: "Evening Monochromatic: Overcoat + Chelsea Boot",
        dept: "Luxury Showcase",
        lift: "+64%",
        anchor: jackets.find((j) => j.color === "Black" || j.name.includes("Trench")) || jackets[2] || jackets[0] || fbAnchor,
        partner: shoes.find((s) => s.color === "Maroon" || s.name.includes("Chelsea")) || shoes[1] || shoes[0] || fbPartner,
        similarProducts: [
          shoes.find((s) => s.color === "Maroon" || s.name.includes("Chelsea")) || shoes[1] || shoes[0] || fbPartner,
          jeans.find((j) => j.color === "Black") || jeans[0] || fbPartner,
          shirts.find((s) => s.color === "Black") || shirts[3] || shirts[0] || fbPartner,
          tshirts.find((t) => t.color === "Charcoal") || tshirts[2] || tshirts[0] || fbAnchor,
        ].filter(Boolean) as Product[],
        rationale: "Co-locating sleek all-black luxury evening coats with Chelsea boots and dark denim creates a full evening package.",
      },
    ];

    const dynamicPairs = (recommendations && recommendations.length > 0)
      ? recommendations.map((rec, idx) => ({
          id: `sug-${idx + 1}`,
          title: `${rec.sourceProduct?.name || "VIP Product"} + ${rec.similarProducts[0]?.name || "Cross-Sell Partner"}`,
          dept: rec.sourceProduct?.category || "Showcase",
          lift: idx === 0 ? "+84%" : idx === 1 ? "+76%" : idx === 2 ? "+72%" : idx === 3 ? "+68%" : "+64%",
          anchor: rec.sourceProduct || fbAnchor,
          partner: rec.similarProducts[0] || jeans[idx % (jeans.length || 1)] || jackets[0] || fbPartner,
          similarProducts: rec.similarProducts || [],
          rationale: rec.reason || "Cross-department attribute pairing recommended by velocity engine.",
        }))
      : [];

    const result = [...dynamicPairs];
    for (let i = result.length; i < 5; i++) {
      result.push(curatedDefaultPairs[i]);
    }
    return result.slice(0, 5);
  }, [recommendations, jackets, jeans, shirts, tshirts, shoes, catalogProducts, defaultFallbackAnchor, defaultFallbackPartner]);

  const activeSuggestion = suggestions[selectedSuggestionIdx] || suggestions[0] || {
    id: "sug-fallback",
    title: "Executive Outerwear + Contrast Denim",
    dept: "Executive Outerwear",
    lift: "+84%",
    anchor: defaultFallbackAnchor,
    partner: defaultFallbackPartner,
    similarProducts: [defaultFallbackPartner],
    rationale: "High-contrast full-outfit pairing lifts basket size.",
  };
  const targetSpot = getPopularSpotByIndex(selectedSuggestionIdx);
  const fastMoverProduct = activeSuggestion.anchor || defaultFallbackAnchor;
  const pairedProduct = activeSuggestion.partner || defaultFallbackPartner;

  // Active suggestions partner list directly from the recommendation
  const allSuggestingPartners = React.useMemo(() => {
    if (activeSuggestion.similarProducts && activeSuggestion.similarProducts.length > 0) {
      return activeSuggestion.similarProducts;
    }
    return pairedProduct ? [pairedProduct] : [];
  }, [pairedProduct, activeSuggestion]);

  // Products belonging to the fast mover's cupboard category
  const cupboardProducts = React.useMemo(() => {
    if (!fastMoverProduct) return [];
    const cat = (fastMoverProduct.category || "").toLowerCase();
    if (cat.includes("jacket")) return jackets;
    if (cat.includes("shirt") && !cat.includes("t-shirt") && !cat.includes("tee")) return shirts;
    if (cat.includes("jean") || cat.includes("denim")) return jeans;
    if (cat.includes("t-shirt") || cat.includes("tee")) return tshirts;
    return shoes;
  }, [fastMoverProduct, jackets, shirts, jeans, tshirts, shoes]);

  // Compute 1:1 Mutual Swap Pairs:
  // Each suggested partner S_i swaps with a strictly unique neighbor D_i in the fast mover's cupboard!
  const swapPairs = React.useMemo(() => {
    if (!fastMoverProduct || !allSuggestingPartners.length || !cupboardProducts.length) return [];
    const suggestedIds = new Set(allSuggestingPartners.map((p) => p._id));
    const availableNeighbors = cupboardProducts.filter(
      (p) => p._id !== fastMoverProduct._id && !suggestedIds.has(p._id)
    );

    // Sort neighbors by slot proximity to fast mover SKU
    const fSkuNum = parseInt((fastMoverProduct.sku || "").replace(/\D/g, ""), 10) || 0;
    availableNeighbors.sort((a, b) => {
      const aSku = parseInt((a.sku || "").replace(/\D/g, ""), 10) || 0;
      const bSku = parseInt((b.sku || "").replace(/\D/g, ""), 10) || 0;
      return Math.abs(aSku - fSkuNum) - Math.abs(bSku - fSkuNum);
    });

    const colors = [0xc084fc, 0x38bdf8, 0xf43f5e, 0x10b981, 0xfbbf24];
    const colorHexes = ["#c084fc", "#38bdf8", "#f43f5e", "#10b981", "#fbbf24"];

    const usedNeighborIds = new Set<string>();
    const pairs: Array<{
      suggested: Product;
      neighbor: Product;
      index: number;
      colorHex: number;
      colorCss: string;
    }> = [];

    allSuggestingPartners.forEach((suggested) => {
      // Find a neighbor in availableNeighbors that hasn't been used yet and is strictly NOT the suggested item
      let neighbor = availableNeighbors.find(
        (n) => n._id !== suggested._id && !usedNeighborIds.has(n._id)
      );

      // Fallback: any other product in cupboardProducts not used yet and not suggested
      if (!neighbor) {
        neighbor = cupboardProducts.find(
          (p) => p._id !== suggested._id && p._id !== fastMoverProduct._id && !usedNeighborIds.has(p._id)
        );
      }

      if (neighbor) {
        usedNeighborIds.add(neighbor._id);
        pairs.push({
          suggested,
          neighbor,
          index: pairs.length,
          colorHex: colors[pairs.length % colors.length],
          colorCss: colorHexes[pairs.length % colorHexes.length],
        });
      }
    });

    return pairs;
  }, [fastMoverProduct, allSuggestingPartners, cupboardProducts]);

  // 🌟 Hero Runway Full Outfit Bundles (Jacket + T-Shirt + Pants + Shoes) for 3 Grand Stations
  const heroRunwayOutfits = React.useMemo(() => {
    const stationNames = [
      "Hero Station 1: West Runway Pedestal",
      "Hero Station 2: Center VIP Apex Pedestal",
      "Hero Station 3: East Runway Pedestal",
    ];
    const badges = ["🌟 HERO 1", "👑 HERO 2 (VIP)", "⚡ HERO 3"];
    const colors = [0xf59e0b, 0x38bdf8, 0xa855f7];
    const colorHexes = ["#f59e0b", "#38bdf8", "#a855f7"];
    const mannequinsX = [-2.8, 0.0, 2.8];
    const mannequinsZ = [2.0, 1.45, 2.0];
    const mannequinsY = [1.80, 1.90, 1.80];

    return [0, 1, 2].map((idx) => {
      const sug = suggestions[idx] || suggestions[0];
      const jacket =
        (jackets.length > 0 ? jackets[idx % jackets.length] : null) ||
        sug?.anchor ||
        catalogProducts[0] ||
        defaultFallbackAnchor;
      const tshirt =
        (tshirts.length > 0 ? tshirts[idx % tshirts.length] : null) ||
        (shirts.length > 0 ? shirts[idx % shirts.length] : null) ||
        catalogProducts[1] ||
        defaultFallbackAnchor;
      const pants =
        (jeans.length > 0 ? jeans[idx % jeans.length] : null) ||
        sug?.partner ||
        catalogProducts[2] ||
        defaultFallbackPartner;
      const shoe =
        (shoes.length > 0 ? shoes[idx % shoes.length] : null) ||
        catalogProducts[3] ||
        defaultFallbackPartner;

      const jLoc = getProductShelfLocation(jacket);
      const tLoc = getProductShelfLocation(tshirt);
      const pLoc = getProductShelfLocation(pants);
      const sLoc = getProductShelfLocation(shoe);

      const targetX = mannequinsX[idx];
      const targetZ = mannequinsZ[idx];

      return {
        index: idx,
        mannequinId: `mannequin-hero-${idx + 1}`,
        stationName: stationNames[idx],
        badge: badges[idx],
        colorHex: colors[idx],
        colorCss: colorHexes[idx],
        lift: sug?.lift || "+82%",
        rationale: sug?.rationale || "High-conversion runway ensemble.",
        targetZone: `Hero Runway Stage: ${badges[idx]}`,
        worldTargetPos: new THREE.Vector3(targetX, mannequinsY[idx], targetZ),
        outfit: {
          jacket,
          tshirt,
          pants,
          shoes: shoe,
        },
        locations: {
          jacket: jLoc,
          tshirt: tLoc,
          pants: pLoc,
          shoes: sLoc,
        },
        anchor: sug?.anchor || jacket,
        suggested: jacket,
        partner: pants,
        sourceLocation: jLoc,
        anchorLocation: pLoc,
      };
    });
  }, [suggestions, jackets, tshirts, shirts, jeans, shoes, catalogProducts, defaultFallbackAnchor, defaultFallbackPartner]);

  const heroRunwayPairs = heroRunwayOutfits;

  // Search Results filtering over all 60 products
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return catalogProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.color && p.color.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [searchQuery, catalogProducts]);

  const handleSelectSearchedProduct = (prod: Product) => {
    setSearchedProduct(prod);
    setInspectedProduct(prod);
    setHoveredProduct(prod);
    setSearchQuery(prod.name);
    setIsSearchOpen(false);
    onSelectProduct?.(prod);

    const pGroup = productGroupsMapRef.current.get(prod._id);
    if (pGroup) {
      focusCameraOnPosRef.current?.(pGroup.group.position);
      if (scopePointerGroupRef.current) {
        scopePointerGroupRef.current.position.copy(pGroup.group.position);
        scopePointerGroupRef.current.visible = true;
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchedProduct(null);
    setIsSearchOpen(false);
    if (scopePointerGroupRef.current) {
      scopePointerGroupRef.current.visible = false;
    }
  };

  const fastMoverName = fastMoverProduct?.name || "Beige Cashmere Overcoat";
  const recItemName = pairedProduct?.name || "Black Tailored Denim";
  const anchorShelfLoc = getProductShelfLocation(fastMoverProduct);
  const adjacentCupboardLoc = getCupboardAdjacentCoords(fastMoverProduct);

  // Load Persisted Planogram State & Floor Swaps from MongoDB
  useEffect(() => {
    const loadPlanogram = async () => {
      try {
        const { data } = await api.get("/recommendations/planogram");
        if (data) {
          const isApplied = Boolean(data.applied);
          setPlanogramApplied(isApplied);
          planogramAppliedRef.current = isApplied;
          if (data.swapMode) setSwapMode(data.swapMode);
          if (!hasUserSelectedRef.current && data.activePairId) {
            const idx = suggestions.findIndex((s) => s.id === data.activePairId);
            if (idx !== -1) setSelectedSuggestionIdx(idx);
          }
          if (isApplied) {
            snapToAppliedPositionsRef.current?.();
          }
        }
      } catch {}

      // Also fetch persisted active floor swaps from MongoDB collection 'floorswaps'
      try {
        const { data: floorSwaps } = await api.get("/recommendations/floor-swaps");
        if (Array.isArray(floorSwaps) && floorSwaps.length > 0) {
          const executedMap: Record<string, boolean> = {};
          floorSwaps.forEach((fs: any) => {
            (fs.executedItems || []).forEach((it: any) => {
              if (it.productId) executedMap[it.productId] = true;
            });
            (fs.displacedItems || []).forEach((it: any) => {
              if (it.productId) executedMap[it.productId] = true;
            });
          });
          setExecutedFloorItems((prev) => ({ ...prev, ...executedMap }));
        }
      } catch {}
    };
    loadPlanogram();
  }, []);

  // WebSockets synchronization
  useSocket((event, payload) => {
    if (event === "planogram_updated") {
      const data = payload as any;
      if (data) {
        if (data.swapMode) setSwapMode(data.swapMode);
        const incomingApplied = Boolean(data.applied);
        if (incomingApplied !== planogramAppliedRef.current) {
          planogramAppliedRef.current = incomingApplied;
          setPlanogramApplied(incomingApplied);
          if (!incomingApplied) {
            setExecutedFloorItems({});
            setFloorCheckedItems({});
          }
          triggerFlightAnimationRef.current?.(incomingApplied);
        }
        if (data.applied && data.activePairId) {
          const idx = suggestions.findIndex((s) => s.id === data.activePairId);
          if (idx !== -1) setSelectedSuggestionIdx(idx);
        }
      }
    }
    if (event === "floor_swap_executed") {
      const data = payload as any;
      if (data) {
        if (data.swapMode) setSwapMode(data.swapMode);
        if (typeof data.spotIndex === "number") setSelectedSuggestionIdx(data.spotIndex);
        setPlanogramApplied(true);
        planogramAppliedRef.current = true;

        const productIds: string[] = (data.executedItems || []).map((it: any) => it.productId).filter(Boolean);

        // 🚀 Trigger 3D flight animation for ONLY the items executed by floor staff!
        triggerFlightAnimationRef.current?.(true, productIds);

        // Mark items as executed in local state
        setExecutedFloorItems((prev) => {
          const next = { ...prev };
          productIds.forEach((id) => {
            next[id] = true;
          });
          return next;
        });

        // NOTE: Camera zoom-in intentionally removed as requested by user! The view stays steady.

        const staff = data.staffName || "Floor Staff";
        showToast(`⚡ ${staff} executed ${productIds.length} floor swap(s)! Live 3D flight synchronized.`, "success");
      }
    }
    if (event === "floor_swap_reverted") {
      const data = payload as any;
      if (data) {
        if (data.all) {
          setExecutedFloorItems({});
          setFloorCheckedItems({});
          triggerFlightAnimationRef.current?.(false);
          setPlanogramApplied(false);
          planogramAppliedRef.current = false;
        } else {
          const revertedIds: string[] = data.revertedProductIds || [];
          setExecutedFloorItems((prev) => {
            const next = { ...prev };
            revertedIds.forEach((id) => {
              delete next[id];
            });
            return next;
          });
          // Trigger flight animation backwards to shelves for these items!
          triggerFlightAnimationRef.current?.(false, revertedIds);

          if (data.remainingActive === 0) {
            setPlanogramApplied(false);
            planogramAppliedRef.current = false;
          }
        }

        const staff = data.staffName || "Floor Staff";
        showToast(
          data.all
            ? "🔄 All showroom floor swaps reset to shelves."
            : `🔄 Reverted ${data.revertedProductIds?.length || 0} item(s) back to shelves.`,
          "info"
        );
      }
    }
    if (event === "product:updated") {
      dispatch(fetchProducts());
    }
  });

  // Sync fullscreen state with browser fullscreenchange event & auto-detect inspect/rotate
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullScreen(isFs);
      if (!isFs && isMobileLandscape && !isForcedRotate90) {
        setIsMobileLandscape(false);
      }
    };

    const handleWindowResizeCheck = () => {
      // When screen width > height (laptop inspect rotate or physical landscape), cancel forced 90deg CSS rotation
      if (window.innerWidth > window.innerHeight && isForcedRotate90) {
        setIsForcedRotate90(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    window.addEventListener("resize", handleWindowResizeCheck);
    window.addEventListener("orientationchange", handleWindowResizeCheck);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      window.removeEventListener("resize", handleWindowResizeCheck);
      window.removeEventListener("orientationchange", handleWindowResizeCheck);
    };
  }, [isMobileLandscape, isForcedRotate90]);

  const toggleFullScreen = async () => {
    if (!visualizerRootRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await visualizerRootRef.current.requestFullscreen();
        setIsFullScreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullScreen(false);
      }
    } catch {
      setIsFullScreen((prev) => !prev);
    }
  };

  // 📱 Mobile Landscape Widescreen & Rotation Handler (Works on both real phones & Laptop DevTools Inspect!)
  const handleToggleMobileLandscape = async () => {
    if (isMobileLandscape || isForcedRotate90) {
      // Exit landscape mode
      setIsMobileLandscape(false);
      setIsForcedRotate90(false);
      setIsHorizontalMode(false);
      zoomControlRef.current.resetView();
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      if (screen.orientation && (screen.orientation as any).unlock) {
        try {
          (screen.orientation as any).unlock();
        } catch {}
      }
      showToast("Exited Landscape 3D View", "info");
    } else {
      // Check if current viewport is ALREADY landscape (e.g. Laptop DevTools Inspect device rotated horizontally!)
      const isAlreadyWide = window.innerWidth > window.innerHeight;

      setIsMobileLandscape(true);
      setIsHorizontalMode(true);
      zoomControlRef.current.setHorizontalView();

      // If already physically wide or in devtools inspect landscape, NO forced 90° rotation needed!
      if (isAlreadyWide) {
        setIsForcedRotate90(false);
        showToast("📱 Widescreen Landscape Mode Active", "info");
        return;
      }

      // If in portrait phone screen, try native fullscreen & orientation lock
      if (visualizerRootRef.current && !document.fullscreenElement) {
        await visualizerRootRef.current.requestFullscreen().catch(() => {});
      }

      let lockSucceeded = false;
      if (screen.orientation && (screen.orientation as any).lock) {
        try {
          await (screen.orientation as any).lock("landscape");
          lockSucceeded = true;
        } catch {
          lockSucceeded = false;
        }
      }

      // If held in portrait and couldn't lock native orientation (e.g. iOS Safari), activate CSS 90° rotation
      if (window.innerWidth < window.innerHeight && !lockSucceeded) {
        setIsForcedRotate90(true);
        showToast("📱 90° Horizontal Runway Mode Activated", "info");
      } else {
        showToast("📱 Widescreen Landscape Mode Active", "info");
      }
    }
  };

  // Quick Restock action
  const handleQuickRestock = async (productId: string, currentStock: number) => {
    setActionLoading(true);
    try {
      await api.put(`/products/${productId}`, { stock: currentStock + 10 });
      if (onRefreshData) onRefreshData();
      showToast("Stock increased by +10 units in database!", "success");
      dispatch(fetchProducts());
    } catch {
      showToast("Failed to restock item.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Apply Planogram Action with Mutual Swaps
  const handleApplyPlanogram = async () => {
    if (!fastMoverProduct || !pairedProduct) return;
    setActionLoading(true);
    setIsSwapAnimating(true);
    try {
      const selectedHero = heroRunwayPairs[selectedSuggestionIdx] || heroRunwayPairs[0];
      const mutualSwapList =
        swapMode === "hero_showcase"
          ? [
              {
                suggestedId: selectedHero.outfit.jacket._id,
                suggestedName: selectedHero.outfit.jacket.name,
                originalCoordsForSuggested: getProductShelfLocation(selectedHero.outfit.jacket),
                targetCoordsForSuggested: {
                  x: selectedHero.worldTargetPos.x,
                  y: selectedHero.worldTargetPos.y,
                  z: selectedHero.worldTargetPos.z,
                  zone: `${selectedHero.targetZone} (Outerwear)`,
                },
                stationName: selectedHero.stationName,
                badge: `${selectedHero.badge} Outerwear`,
                lift: selectedHero.lift,
              },
              {
                suggestedId: selectedHero.outfit.tshirt._id,
                suggestedName: selectedHero.outfit.tshirt.name,
                originalCoordsForSuggested: getProductShelfLocation(selectedHero.outfit.tshirt),
                targetCoordsForSuggested: {
                  x: selectedHero.worldTargetPos.x,
                  y: selectedHero.worldTargetPos.y,
                  z: selectedHero.worldTargetPos.z,
                  zone: `${selectedHero.targetZone} (Topwear)`,
                },
                stationName: selectedHero.stationName,
                badge: `${selectedHero.badge} Topwear`,
                lift: selectedHero.lift,
              },
              {
                suggestedId: selectedHero.outfit.pants._id,
                suggestedName: selectedHero.outfit.pants.name,
                originalCoordsForSuggested: getProductShelfLocation(selectedHero.outfit.pants),
                targetCoordsForSuggested: {
                  x: selectedHero.worldTargetPos.x,
                  y: selectedHero.worldTargetPos.y - 0.7,
                  z: selectedHero.worldTargetPos.z,
                  zone: `${selectedHero.targetZone} (Bottomwear)`,
                },
                stationName: selectedHero.stationName,
                badge: `${selectedHero.badge} Bottomwear`,
                lift: selectedHero.lift,
              },
              {
                suggestedId: selectedHero.outfit.shoes._id,
                suggestedName: selectedHero.outfit.shoes.name,
                originalCoordsForSuggested: getProductShelfLocation(selectedHero.outfit.shoes),
                targetCoordsForSuggested: {
                  x: selectedHero.worldTargetPos.x,
                  y: selectedHero.worldTargetPos.y - 1.4,
                  z: selectedHero.worldTargetPos.z,
                  zone: `${selectedHero.targetZone} (Footwear)`,
                },
                stationName: selectedHero.stationName,
                badge: `${selectedHero.badge} Footwear`,
                lift: selectedHero.lift,
              },
            ]
          : swapPairs.map((pair) => {
              const sLoc = getProductShelfLocation(pair.suggested);
              const nLoc = getProductShelfLocation(pair.neighbor);
              return {
                suggestedId: pair.suggested._id,
                neighborId: pair.neighbor._id,
                suggestedName: pair.suggested.name,
                neighborName: pair.neighbor.name,
                originalCoordsForSuggested: sLoc,
                originalCoordsForNeighbor: nLoc,
                targetCoordsForSuggested: {
                  ...nLoc,
                  zone: `${nLoc.zone} (Planogram Swapped Beside Fast Mover)`,
                },
                targetCoordsForNeighbor: {
                  ...sLoc,
                  zone: `${sLoc.zone} (Relocated Vacancy Slot)`,
                },
              };
            });

      const payload = buildPlanogramCoordPayload(
        activeSuggestion.id,
        fastMoverProduct,
        pairedProduct,
        allSuggestingPartners,
        activeSuggestion.lift,
        selectedSuggestionIdx,
        swapMode,
        mutualSwapList
      );
      planogramAppliedRef.current = true;
      setPlanogramApplied(true);
      triggerFlightAnimationRef.current?.(true);
      await api.post("/recommendations/apply-planogram", payload);
      showToast(
        swapMode === "hero_showcase"
          ? `Planogram Active: ${selectedHero.badge} Outfit promoted to Runway Mannequin #${selectedSuggestionIdx + 1}!`
          : `Planogram Active: ${swapPairs.length} product pairs mutually swapped cleanly across cupboards!`,
        "success"
      );
      dispatch(fetchProducts());
    } catch {
      showToast("Failed to apply planogram.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Planogram
  const handleResetPlanogram = async () => {
    setActionLoading(true);
    try {
      planogramAppliedRef.current = false;
      setPlanogramApplied(false);
      setExecutedFloorItems({});
      setFloorCheckedItems({});
      triggerFlightAnimationRef.current?.(false);
      await api.post("/recommendations/reset-planogram");
      showToast("Showroom layout restored to baseline native shelves.", "info");
      dispatch(fetchProducts());
    } catch {
      showToast("Failed to reset planogram.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Replay Swap Animation
  const handleReplaySwap = () => {
    setIsSwapAnimating(true);
    triggerFlightAnimationRef.current?.(true);
  };

  // ⚡ Floor Staff Real-World Swap Execution Handler
  const handleExecuteFloorSwaps = async (
    tasksToExecute: Array<{
      role: string;
      item: Product;
      targetCoords: any;
      origLoc?: any;
      displaced?: { item: Product; targetCoords: any };
    }>
  ) => {
    if (!tasksToExecute.length) {
      showToast("Please check at least one item to save", "error");
      return;
    }
    setIsSavingFloorSwap(true);
    try {
      const executedItems = tasksToExecute.map((t) => ({
        productId: t.item._id,
        productName: t.item.name,
        role: t.role,
        targetCoords: t.targetCoords,
        originalCoords: t.origLoc
          ? {
              x: t.origLoc.x,
              y: t.origLoc.y,
              z: t.origLoc.z,
              zone: t.origLoc.zone || "Shelf Slot",
            }
          : undefined,
      }));

      const displacedItems = tasksToExecute
        .filter((t) => t.displaced && t.displaced.item)
        .map((t) => ({
          productId: t.displaced!.item._id,
          targetCoords: t.displaced!.targetCoords,
        }));

      const activePairId =
        swapMode === "hero_showcase"
          ? (heroRunwayPairs[selectedSuggestionIdx]?.mannequinId || `mannequin-hero-${selectedSuggestionIdx + 1}`)
          : (suggestions[selectedSuggestionIdx]?.id || `sug-${selectedSuggestionIdx + 1}`);

      const res = await api.post("/recommendations/floor-swap", {
        swapMode,
        activePairId,
        spotIndex: selectedSuggestionIdx,
        executedItems,
        displacedItems,
        staffName: "Showroom Floor Staff (Mobile)",
      });

      if (res.data?.success) {
        // Mark as executed in local state
        setExecutedFloorItems((prev) => {
          const next = { ...prev };
          tasksToExecute.forEach((t) => {
            next[t.item._id] = true;
            if (t.displaced?.item) next[t.displaced.item._id] = true;
          });
          return next;
        });

        // Clear checked state for these items
        setFloorCheckedItems((prev) => {
          const next = { ...prev };
          tasksToExecute.forEach((t) => {
            delete next[t.item._id];
          });
          return next;
        });

        setPlanogramApplied(true);
        planogramAppliedRef.current = true;

        // Trigger local flight animation for the executed items
        const prodIds = tasksToExecute.map((t) => t.item._id);
        triggerFlightAnimationRef.current?.(true, prodIds);

        showToast(
          `✓ Synced ${tasksToExecute.length} real-world swap(s)! Manager screen updated live.`,
          "success"
        );
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to sync floor swap", "error");
    } finally {
      setIsSavingFloorSwap(false);
    }
  };

  // 🔄 Revert a single floor swap item back to shelves
  const handleRevertFloorSwapItem = async (task: any) => {
    setIsSavingFloorSwap(true);
    try {
      const res = await api.post("/recommendations/floor-swap/revert", {
        productId: task.item._id,
      });
      if (res.data?.success) {
        setExecutedFloorItems((prev) => {
          const next = { ...prev };
          delete next[task.item._id];
          if (task.displaced?.item) delete next[task.displaced.item._id];
          return next;
        });
        // Trigger flight animation backwards to shelves for this item
        triggerFlightAnimationRef.current?.(false, [task.item._id]);
        dispatch(fetchProducts());
        showToast(`🔄 Reset ${task.item.name} back to original shelf slot!`, "info");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to reset item", "error");
    } finally {
      setIsSavingFloorSwap(false);
    }
  };

  // 🔄 Revert all items in current station / pair back to shelves
  const handleRevertActiveStation = async () => {
    setIsSavingFloorSwap(true);
    try {
      const activePairId =
        swapMode === "hero_showcase"
          ? (heroRunwayPairs[selectedSuggestionIdx]?.mannequinId || `mannequin-hero-${selectedSuggestionIdx + 1}`)
          : (suggestions[selectedSuggestionIdx]?.id || `sug-${selectedSuggestionIdx + 1}`);

      const res = await api.post("/recommendations/floor-swap/revert", {
        activePairId,
        spotIndex: selectedSuggestionIdx,
      });

      if (res.data?.success) {
        const revertedIds: string[] = res.data.payload?.revertedProductIds || [];
        setExecutedFloorItems((prev) => {
          const next = { ...prev };
          revertedIds.forEach((id) => {
            delete next[id];
          });
          return next;
        });
        triggerFlightAnimationRef.current?.(false, revertedIds);
        dispatch(fetchProducts());
        showToast(
          `🔄 Reset all ${revertedIds.length} item(s) in this station back to original shelves!`,
          "info"
        );
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to reset station", "error");
    } finally {
      setIsSavingFloorSwap(false);
    }
  };

  // =========================================================================
  // 🚀 MAIN THREE.JS SHOWROOM RENDERER (5 CUPBOARDS, ZERO LAG, ALL 60 PRODUCTS)
  // =========================================================================
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let width = isFullScreen ? window.innerWidth : container.clientWidth;
    let height = isFullScreen ? window.innerHeight : container.clientHeight || 740;

    // --- DAYLIGHT SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // Crisp luxury boutique daylight
    scene.fog = new THREE.FogExp2(0xf1f5f9, 0.009);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 150);
    camera.position.set(0, 20, 26);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      precision: "mediump", // Medium precision for high FPS on Intel UHD Graphics
      depth: true,
      stencil: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); // Capped at 1.25x for ultra-fast initial WebGL shader compilation and smooth 60 FPS
    renderer.shadowMap.enabled = false; // Disabled shadowMap to maintain 60 FPS
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // --- DAYLIGHT ARCHITECTURAL LIGHTING ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd8dc, 1.45);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    dirLight.position.set(16, 26, 14);
    scene.add(dirLight);

    const centerStageLight = new THREE.PointLight(0xfef3c7, 1.1, 18);
    centerStageLight.position.set(0, 7, 2);
    scene.add(centerStageLight);

    // --- EXPANSIVE WHITE CARRARA / TRAVERTINE MARBLE FLOOR ---
    const SHOWROOM_WIDTH = 36;
    const SHOWROOM_DEPTH = 30;

    // Lightweight marble grid
    const floorGeo = new THREE.PlaneGeometry(SHOWROOM_WIDTH, SHOWROOM_DEPTH);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.08,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    scene.add(floorMesh);

    const grid = new THREE.GridHelper(SHOWROOM_WIDTH, 36, 0xcfd8dc, 0xe2e8f0);
    grid.position.y = 0.01;
    scene.add(grid);

    // Perimeter Amber/Gold Accent Border
    const perimeterMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
    const perimeterGeo = new THREE.RingGeometry(18.0, 18.08, 4);
    const perimeter = new THREE.Mesh(perimeterGeo, perimeterMat);
    perimeter.rotation.x = -Math.PI / 2;
    perimeter.rotation.z = Math.PI / 4;
    perimeter.position.y = 0.02;
    scene.add(perimeter);

    // Gallery Walls (Warm Museum Alabaster)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(SHOWROOM_WIDTH, 8.0, 0.4), wallMat);
    backWall.position.set(0, 4.0, -SHOWROOM_DEPTH / 2);
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8.0, SHOWROOM_DEPTH), wallMat);
    leftWall.position.set(-SHOWROOM_WIDTH / 2, 4.0, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8.0, SHOWROOM_DEPTH), wallMat);
    rightWall.position.set(SHOWROOM_WIDTH / 2, 4.0, 0);
    scene.add(rightWall);

    // Common Materials
    const darkWalnutMat = new THREE.MeshStandardMaterial({ color: 0x1f1610, roughness: 0.45, metalness: 0.15 });
    const glassShelfMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.55,
      roughness: 0.05,
      metalness: 0.9,
    });
    const goldBrassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.92, roughness: 0.18 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });

    // Interactive raycaster registry
    const interactiveObjects: THREE.Object3D[] = [];
    const productMeshMap = new Map<string, THREE.Mesh>();
    const productGroupsMap = new Map<string, { group: THREE.Group; originalPos: THREE.Vector3; product: Product }>();

    // Helper: Overhead Department Signboard
    const createSignboard = (text: string, sub: string, accentHex: number) => {
      const group = new THREE.Group();
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.7, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x080c16, roughness: 0.3 })
      );
      group.add(board);

      const neonTrim = new THREE.Mesh(
        new THREE.BoxGeometry(4.7, 0.04, 0.1),
        new THREE.MeshBasicMaterial({ color: accentHex })
      );
      neonTrim.position.y = -0.35;
      group.add(neonTrim);

      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#080c16";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(text.toUpperCase(), 256, 60);
      ctx.fillStyle = `#${accentHex.toString(16).padStart(6, "0")}`;
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(sub.toUpperCase(), 256, 95);

      const tex = new THREE.CanvasTexture(canvas);
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(4.5, 0.65),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      labelMesh.position.z = 0.05;
      group.add(labelMesh);
      return group;
    };

    // Color mapper for 3D product token models
    const getColorHex = (colorName: string): number => {
      const c = (colorName || "").toLowerCase();
      if (c.includes("black")) return 0x111827;
      if (c.includes("white")) return 0xf8fafc;
      if (c.includes("navy") || c.includes("blue")) return 0x1e3a8a;
      if (c.includes("beige") || c.includes("camel") || c.includes("sand")) return 0xd4b996;
      if (c.includes("maroon") || c.includes("burgundy") || c.includes("red")) return 0x881337;
      if (c.includes("olive") || c.includes("green")) return 0x3f6212;
      if (c.includes("charcoal") || c.includes("grey") || c.includes("gray")) return 0x374151;
      return 0x64748b;
    };

    // ⚡ HIGH-PERFORMANCE SHARED GEOMETRIES & CACHED TEXTURES (Eliminates 350+ allocations)
    const sharedHangerGeo = new THREE.TorusGeometry(0.12, 0.015, 8, 12, Math.PI);
    const sharedJacketGeo = new THREE.BoxGeometry(0.7, 0.85, 0.22);
    const sharedShirtGeo = new THREE.BoxGeometry(0.68, 0.2, 0.55);
    const sharedJeanGeo = new THREE.BoxGeometry(0.68, 0.28, 0.55);
    const sharedTShirtGeo = new THREE.BoxGeometry(0.65, 0.16, 0.52);
    const sharedShoeGeo = new THREE.BoxGeometry(0.65, 0.22, 0.45);
    const sharedPlinthGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.04, 16);
    const sharedTagGeo = new THREE.PlaneGeometry(0.45, 0.16);
    const sharedHitBoxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const sharedHitBoxMat = new THREE.MeshBasicMaterial({ visible: false });

    // Cupboard shared geometries & transparent architectural boutique materials
    const sharedCupboardBackGeo = new THREE.BoxGeometry(4.8, 4.8, 0.06);
    const sharedCupboardGlassBackMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.12,
      metalness: 0.25,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
    });
    const sharedBackMullionGeoV = new THREE.CylinderGeometry(0.016, 0.016, 4.8, 8);
    const sharedBackMullionGeoH = new THREE.CylinderGeometry(0.012, 0.012, 4.8, 8);
    const sharedPillarGeo = new THREE.BoxGeometry(0.12, 4.8, 1.3);
    const sharedCanopyGeo = new THREE.BoxGeometry(5.0, 0.16, 1.4);
    const sharedBottomPlinthGeo = new THREE.BoxGeometry(5.0, 0.24, 1.4);
    const sharedNeonStripGeo = new THREE.BoxGeometry(4.98, 0.04, 0.04);
    const sharedGlassShelfGeo = new THREE.BoxGeometry(4.6, 0.08, 1.2);
    const sharedShelfLipGeo = new THREE.BoxGeometry(4.62, 0.03, 0.03);

    // Fast Canvas Texture Cache for Price Tags
    const priceTagTextureCache = new Map<number, THREE.CanvasTexture>();
    const getPriceTagTexture = (price: number): THREE.CanvasTexture => {
      const p = price || 0;
      if (priceTagTextureCache.has(p)) {
        return priceTagTextureCache.get(p)!;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 48;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "rgba(10, 15, 29, 0.92)";
        ctx.fillRect(0, 0, 128, 48);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 126, 46);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`₹${p}`, 64, 30);
      }
      const tagTex = new THREE.CanvasTexture(canvas);
      tagTex.generateMipmaps = false;
      tagTex.minFilter = THREE.LinearFilter;
      priceTagTextureCache.set(p, tagTex);
      return tagTex;
    };

    // Helper: Create an individual 3D Product Display Item on a shelf
    const createProductMesh = (product: Product, x: number, y: number, z: number): THREE.Group => {
      const prodGroup = new THREE.Group();
      prodGroup.position.set(x, y, z);

      const colorHex = getColorHex(product.color);
      const cat = (product.category || "").toLowerCase();

      let itemMesh: THREE.Mesh;

      if (cat.includes("jacket")) {
        const hanger = new THREE.Mesh(sharedHangerGeo, chromeMat);
        hanger.position.y = 0.55;
        prodGroup.add(hanger);
        itemMesh = new THREE.Mesh(
          sharedJacketGeo,
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, metalness: 0.1 })
        );
        itemMesh.position.y = 0.25;
      } else if (cat.includes("shirt")) {
        itemMesh = new THREE.Mesh(
          sharedShirtGeo,
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.15 })
        );
        itemMesh.position.y = 0.1;
      } else if (cat.includes("jean")) {
        itemMesh = new THREE.Mesh(
          sharedJeanGeo,
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7, metalness: 0.1 })
        );
        itemMesh.position.y = 0.14;
      } else if (cat.includes("t-shirt")) {
        itemMesh = new THREE.Mesh(
          sharedTShirtGeo,
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 })
        );
        itemMesh.position.y = 0.08;
      } else {
        itemMesh = new THREE.Mesh(
          sharedShoeGeo,
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.4 })
        );
        itemMesh.position.y = 0.11;
      }

      prodGroup.add(itemMesh);

      // Gold base plinth (shared geometry)
      const plinth = new THREE.Mesh(sharedPlinthGeo, goldBrassMat);
      plinth.position.y = 0.02;
      prodGroup.add(plinth);

      // Cached Price Tag Badge
      const tagTex = getPriceTagTexture(product.price);
      const tagMesh = new THREE.Mesh(
        sharedTagGeo,
        new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })
      );
      tagMesh.position.set(0, 0.04, 0.32);
      tagMesh.rotation.x = -Math.PI / 8;
      prodGroup.add(tagMesh);

      // Invisible interactive hitBox for seamless hovering & clicking (shared geometry & material)
      const hitBox = new THREE.Mesh(sharedHitBoxGeo, sharedHitBoxMat);
      hitBox.position.y = 0.4;
      hitBox.userData = { product, isProduct: true };
      prodGroup.add(hitBox);
      interactiveObjects.push(hitBox);
      productMeshMap.set(product._id, itemMesh);

      return prodGroup;
    };

    // =========================================================================
    // 🏛️ 5 STREAMLINED LUXURY DEPARTMENT CUPBOARDS (REDUCED COUNT & ZERO LAG)
    // =========================================================================
    const createGrandCupboard = (fixture: CupboardFixture) => {
      const group = new THREE.Group();
      group.position.set(fixture.x, 0, fixture.z);

      const WIDTH = 4.8;
      const HEIGHT = 4.8;
      const DEPTH = 1.3;

      // 1. Transparent Architectural Glass Back Panel (See-through 360-degree boutique view)
      const back = new THREE.Mesh(sharedCupboardBackGeo, sharedCupboardGlassBackMat);
      back.position.set(0, HEIGHT / 2, -DEPTH / 2);
      group.add(back);

      // Gold brass vertical architectural mullions on the back
      [-1.5, 0, 1.5].forEach((mx) => {
        const vMullion = new THREE.Mesh(sharedBackMullionGeoV, goldBrassMat);
        vMullion.position.set(mx, HEIGHT / 2, -DEPTH / 2);
        group.add(vMullion);
      });

      // Gold brass horizontal shelf tie rods on the back
      [3.4, 2.2, 1.0].forEach((sy) => {
        const hMullion = new THREE.Mesh(sharedBackMullionGeoH, goldBrassMat);
        hMullion.rotation.z = Math.PI / 2;
        hMullion.position.set(0, sy, -DEPTH / 2);
        group.add(hMullion);
      });

      // 2. Left and Right vertical side pillars (shared geometry)
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x182030, roughness: 0.4, metalness: 0.4 });
      const leftSide = new THREE.Mesh(sharedPillarGeo, sideMat);
      leftSide.position.set(-WIDTH / 2, HEIGHT / 2, 0);
      group.add(leftSide);

      const rightSide = new THREE.Mesh(sharedPillarGeo, sideMat);
      rightSide.position.set(WIDTH / 2, HEIGHT / 2, 0);
      group.add(rightSide);

      // 3. Top canopy & Bottom plinth (shared geometries)
      const topCanopy = new THREE.Mesh(sharedCanopyGeo, sideMat);
      topCanopy.position.set(0, HEIGHT, 0);
      group.add(topCanopy);

      const bottomPlinth = new THREE.Mesh(sharedBottomPlinthGeo, sideMat);
      bottomPlinth.position.set(0, 0.12, 0);
      group.add(bottomPlinth);

      // 4. Sleek Neon Accent strip on top cornice
      const neonStrip = new THREE.Mesh(
        sharedNeonStripGeo,
        new THREE.MeshBasicMaterial({ color: fixture.accentColor })
      );
      neonStrip.position.set(0, HEIGHT + 0.08, DEPTH / 2 + 0.04);
      group.add(neonStrip);

      // 5. Overhead illuminated signboard
      const signboard = createSignboard(fixture.name, fixture.department, fixture.accentColor);
      signboard.position.set(0, HEIGHT + 0.55, DEPTH / 2);
      group.add(signboard);

      // 6. 3 Glass / Walnut shelves (shared shelf and lip geometries)
      const shelfY = [3.4, 2.2, 1.0];
      shelfY.forEach((y) => {
        const shelfMesh = new THREE.Mesh(sharedGlassShelfGeo, glassShelfMat);
        shelfMesh.position.set(0, y, 0);
        group.add(shelfMesh);

        // Gold shelf lip
        const lip = new THREE.Mesh(sharedShelfLipGeo, goldBrassMat);
        lip.position.set(0, y + 0.04, DEPTH / 2 - 0.06);
        group.add(lip);
      });

      // 7. Place Products into the Cupboard Slots (Aligned 100% with database coordinates & shelf tiers)
      fixture.products.forEach((prod, pIdx) => {
        const loc = getProductShelfLocation(prod);
        const shelfIdx = Math.floor(pIdx / 4);
        const colIdx = pIdx % 4; // 0, 1, 2, 3
        const fallbackX = fixture.x + (-1.5 + colIdx * 1.0);
        const fallbackY = shelfY[shelfIdx];
        const fallbackZ = fixture.z + 0.1;

        // Enforce fixture bounds: products must physically sit strictly inside this cupboard
        const isWithinFixture = typeof loc.x === "number" && Math.abs(loc.x - fixture.x) <= 2.2 && Math.abs(loc.z - fixture.z) <= 1.5;
        const worldX = isWithinFixture ? loc.x : fallbackX;
        const worldY = isWithinFixture ? loc.y : fallbackY;
        const worldZ = isWithinFixture ? loc.z : fallbackZ;

        // Create product mesh in world space for smooth relocation
        const pMesh = createProductMesh(prod, worldX, worldY, worldZ);
        scene.add(pMesh);
        productGroupsMap.set(prod._id, {
          group: pMesh,
          originalPos: new THREE.Vector3(worldX, worldY, worldZ),
          product: prod,
        });
      });

      scene.add(group);
    };

    // Cupboard 1: Jackets (West Wing, x: -12.5, z: -3.8)
    createGrandCupboard({
      id: "cupboard-jackets",
      name: "Savile Row Outerwear",
      department: "Executive Tailoring",
      category: "Jackets",
      x: -12.5,
      z: -3.8,
      accentColor: 0x38bdf8,
      accentHex: "#38bdf8",
      products: jackets,
    });

    // Cupboard 2: Formal Shirts (North-West Wing, x: -12.5, z: 6.2)
    createGrandCupboard({
      id: "cupboard-shirts",
      name: "Royal Oxford Shirts",
      department: "Executive Wardrobe",
      category: "Shirts",
      x: -12.5,
      z: 6.2,
      accentColor: 0xf59e0b,
      accentHex: "#f59e0b",
      products: shirts,
    });

    // Cupboard 3: Jeans & Denim (East Wing, x: 12.5, z: -3.8)
    createGrandCupboard({
      id: "cupboard-jeans",
      name: "Premium Selvedge Denim",
      department: "Denim Studio",
      category: "Jeans",
      x: 12.5,
      z: -3.8,
      accentColor: 0xa855f7,
      accentHex: "#a855f7",
      products: jeans,
    });

    // Cupboard 4: T-Shirts (North-East Wing, x: 12.5, z: 6.2)
    createGrandCupboard({
      id: "cupboard-tshirts",
      name: "Streetwear Studio Tees",
      department: "Contemporary Casuals",
      category: "T-Shirts",
      x: 12.5,
      z: 6.2,
      accentColor: 0xf43f5e,
      accentHex: "#f43f5e",
      products: tshirts,
    });

    // Cupboard 5: Luxury Footwear Vitrine Gallery (Center North, x: 0, z: -11.0)
    const footwearGalleryGroup = new THREE.Group();
    footwearGalleryGroup.position.set(0, 0, -11.0);

    const fSign = createSignboard("LUXURY FOOTWEAR GALLERY", "Italian Leather Lounge", 0x10b981);
    fSign.position.set(0, 4.4, 0);
    footwearGalleryGroup.add(fSign);

    // Two Tier Pedestals for 12 shoes (6 upper tier, 6 lower tier) - shared geometry
    const sharedShoePedestalGeo = new THREE.BoxGeometry(12.5, 0.4, 1.2);
    const upperPedestal = new THREE.Mesh(sharedShoePedestalGeo, darkWalnutMat);
    upperPedestal.position.set(0, 1.6, -1.0);
    footwearGalleryGroup.add(upperPedestal);

    const lowerPedestal = new THREE.Mesh(sharedShoePedestalGeo, darkWalnutMat);
    lowerPedestal.position.set(0, 0.7, 1.0);
    footwearGalleryGroup.add(lowerPedestal);

    shoes.forEach((shoe, idx) => {
      const loc = getProductShelfLocation(shoe);
      const isUpper = idx < 6;
      const colIdx = isUpper ? idx : idx - 6;
      const fallbackX = -5.0 + colIdx * 2.0;
      const fallbackY = isUpper ? 1.8 : 0.9;
      const fallbackZ = isUpper ? -12.0 : -10.0;

      // Enforce footwear gallery bounds: shoes must sit on the vitrine gallery tiers
      const isShoeLocValid = typeof loc.x === "number" && loc.z <= -8.0 && Math.abs(loc.x) <= 6.0;
      const worldX = isShoeLocValid ? loc.x : fallbackX;
      const worldY = isShoeLocValid ? loc.y : fallbackY;
      const worldZ = isShoeLocValid ? loc.z : fallbackZ;

      const sMesh = createProductMesh(shoe, worldX, worldY, worldZ);
      scene.add(sMesh);
      productGroupsMap.set(shoe._id, {
        group: sMesh,
        originalPos: new THREE.Vector3(worldX, worldY, worldZ),
        product: shoe,
      });
    });

    scene.add(footwearGalleryGroup);

    // =========================================================================
    // 🌟 HERO PROMENADE RUNWAY & 3 MASCULINE MANNEQUINS (CENTER STAGE AT z = 1.8)
    // =========================================================================
    const runwayGroup = new THREE.Group();
    runwayGroup.position.set(0, 0, 1.8);

    // 1. Grand Center Runway Deck with Nero Marquina / Walnut Finish (Width ~11.5m, Depth ~8.8m)
    const runwayPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(4.0, 4.4, 0.24, 48),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3, metalness: 0.4 })
    );
    runwayPlinth.scale.set(1.3, 1.0, 1.0);
    runwayPlinth.position.y = 0.12;
    runwayGroup.add(runwayPlinth);

    // Gold brass rim
    const brassRim = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.4, 48), goldBrassMat);
    brassRim.scale.set(1.3, 1.0, 1.0);
    brassRim.rotation.x = -Math.PI / 2;
    brassRim.position.y = 0.245;
    runwayGroup.add(brassRim);

    // Glowing Amber Neon Halo
    const neonHalo = new THREE.Mesh(
      new THREE.RingGeometry(4.45, 4.55, 48),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
    );
    neonHalo.scale.set(1.3, 1.0, 1.0);
    neonHalo.rotation.x = -Math.PI / 2;
    neonHalo.position.y = 0.25;
    runwayGroup.add(neonHalo);

    // 2. 3 MASCULINE MANNEQUINS (Athletic V-Tapered Shoulders, Pedestals & Dynamic Outfits)
    interface MannequinTarget {
      id: string;
      index: number;
      label: string;
      sublabel: string;
      group: THREE.Group;
      jacketMat: THREE.MeshStandardMaterial;
      innerTopMat: THREE.MeshStandardMaterial;
      pantsMat: THREE.MeshStandardMaterial;
      shoesMat: THREE.MeshStandardMaterial;
      badgeMesh: THREE.Mesh;
      badgeTexture: THREE.CanvasTexture;
      worldChestPos: THREE.Vector3;
      worldPantsPos: THREE.Vector3;
      worldShoesPos: THREE.Vector3;
      defaultTorsoColor: number;
      defaultInnerColor: number;
      defaultPantsColor: number;
      defaultShoesColor: number;
      glowHalo: THREE.Mesh;
      currentOutfit: { jacket: Product; tshirt: Product; pants: Product; shoes: Product } | null;
      currentProduct: Product | null;
      updateOutfit: (outfit: { jacket: Product; tshirt: Product; pants: Product; shoes: Product } | null) => void;
    }

    const mannequins: MannequinTarget[] = [];

    const mannequinConfigs = [
      {
        id: "mannequin-hero-1",
        index: 0,
        x: -2.8,
        y: 0.18,
        z: 0.2,
        accentColor: 0xf59e0b, // Amber Gold
        accentHex: "#f59e0b",
        defaultColor: 0x334155, // Slate Bespoke
        label: "HERO 1 • OVERCOAT OUTFIT",
        sublabel: "Pair 1 • Cashmere Elegance",
      },
      {
        id: "mannequin-hero-2",
        index: 1,
        x: 0.0,
        y: 0.28,
        z: -0.35, // Elevated VIP Centerpiece
        accentColor: 0x38bdf8, // Sky Blue
        accentHex: "#38bdf8",
        defaultColor: 0x1e293b, // Midnight Navy Bespoke
        label: "HERO 2 • PRIME VELOCITY SUIT",
        sublabel: "Pair 2 • High-Volume Showcase",
      },
      {
        id: "mannequin-hero-3",
        index: 2,
        x: 2.8,
        y: 0.18,
        z: 0.2,
        accentColor: 0xa855f7, // Royal Purple
        accentHex: "#a855f7",
        defaultColor: 0x374151, // Charcoal Bespoke
        label: "HERO 3 • STREETWEAR CAPSULE",
        sublabel: "Pair 3 • High-Margin Trend",
      },
    ];

    mannequinConfigs.forEach((cfg) => {
      const mGroup = new THREE.Group();
      mGroup.position.set(cfg.x, cfg.y + 0.12, cfg.z);

      // Base Pedestal
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.16, 32), darkWalnutMat);
      pedestal.position.y = 0.08;
      mGroup.add(pedestal);

      const pRim = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.79, 32), goldBrassMat);
      pRim.rotation.x = -Math.PI / 2;
      pRim.position.y = 0.165;
      mGroup.add(pRim);

      const glowHalo = new THREE.Mesh(
        new THREE.RingGeometry(0.81, 0.86, 32),
        new THREE.MeshBasicMaterial({ color: cfg.accentColor, side: THREE.DoubleSide })
      );
      glowHalo.rotation.x = -Math.PI / 2;
      glowHalo.position.y = 0.17;
      mGroup.add(glowHalo);

      // Gold Brass Stand Pole
      const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.98, 16), goldBrassMat);
      standPole.position.y = 0.54;
      mGroup.add(standPole);

      // 1. Italian Handcrafted Footwear (Shoes Sculpt on Pedestal)
      const shoesMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a, // Default Charcoal Leather
        roughness: 0.35,
        metalness: 0.25,
      });

      // Left Shoe (Sole + Leather Upper + Sculpted Toe Cap)
      const leftShoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.28), darkWalnutMat);
      leftShoeSole.position.set(-0.13, 0.03, 0.03);
      mGroup.add(leftShoeSole);

      const leftShoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.25), shoesMat);
      leftShoeUpper.position.set(-0.13, 0.08, 0.02);
      mGroup.add(leftShoeUpper);

      const leftToeCap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), shoesMat);
      leftToeCap.scale.set(1.0, 0.65, 1.2);
      leftToeCap.position.set(-0.13, 0.06, 0.14);
      mGroup.add(leftToeCap);

      // Right Shoe (Sole + Leather Upper + Sculpted Toe Cap)
      const rightShoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.28), darkWalnutMat);
      rightShoeSole.position.set(0.13, 0.03, 0.03);
      mGroup.add(rightShoeSole);

      const rightShoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.25), shoesMat);
      rightShoeUpper.position.set(0.13, 0.08, 0.02);
      mGroup.add(rightShoeUpper);

      const rightToeCap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), shoesMat);
      rightToeCap.scale.set(1.0, 0.65, 1.2);
      rightToeCap.position.set(0.13, 0.06, 0.14);
      mGroup.add(rightToeCap);

      // 2. Tailored Straight-Leg Trousers (Masculine Athletic Stance with Cuffs & Belt)
      const pantsMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.65,
        metalness: 0.15,
      });
      const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.82, 16), pantsMat);
      leftLeg.position.set(-0.13, 0.58, 0);
      mGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.82, 16), pantsMat);
      rightLeg.position.set(0.13, 0.58, 0);
      mGroup.add(rightLeg);

      // Trouser Ankle Cuffs
      const leftCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.082, 0.06, 16), pantsMat);
      leftCuff.position.set(-0.13, 0.18, 0);
      mGroup.add(leftCuff);

      const rightCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.082, 0.06, 16), pantsMat);
      rightCuff.position.set(0.13, 0.18, 0);
      mGroup.add(rightCuff);

      const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.20, 16), pantsMat);
      pelvis.position.y = 1.05;
      mGroup.add(pelvis);

      // Leather Belt & Gold Buckle
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.23, 0.06, 16), darkWalnutMat);
      belt.position.y = 1.13;
      mGroup.add(belt);

      const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), goldBrassMat);
      beltBuckle.position.set(0, 1.13, 0.24);
      mGroup.add(beltBuckle);

      // 3. UPPER BODY: Inner T-Shirt / Shirt Layer
      const innerTopMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9, // Crisp Studio White
        roughness: 0.55,
        metalness: 0.10,
      });
      const innerChest = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.19, 0.48, 16), innerTopMat);
      innerChest.position.set(0, 1.50, 0.02);
      mGroup.add(innerChest);

      const innerCollar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 20), innerTopMat);
      innerCollar.rotation.x = Math.PI / 2;
      innerCollar.position.set(0, 1.76, 0.04);
      mGroup.add(innerCollar);

      // 4. UPPER BODY: Outer Tailored Jacket / Coat Layer
      const jacketMat = new THREE.MeshStandardMaterial({
        color: cfg.defaultColor,
        roughness: 0.45,
        metalness: 0.18,
      });

      // Tapered Narrow Waist
      const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.20, 16), jacketMat);
      waist.position.y = 1.20;
      mGroup.add(waist);

      // Left & Right Chest Panels (Open-front showing inner t-shirt)
      const leftChestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.24), jacketMat);
      leftChestPanel.position.set(-0.16, 1.50, 0.02);
      mGroup.add(leftChestPanel);

      const rightChestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.24), jacketMat);
      rightChestPanel.position.set(0.16, 1.50, 0.02);
      mGroup.add(rightChestPanel);

      // Broad Shoulder Yoke (0.80m Athletic Yoke)
      const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.18, 0.28), jacketMat);
      shoulders.position.y = 1.68;
      mGroup.add(shoulders);

      // Sculpted Rounded Shoulder Deltoids
      const leftDeltoid = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), jacketMat);
      leftDeltoid.position.set(-0.39, 1.68, 0);
      mGroup.add(leftDeltoid);

      const rightDeltoid = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), jacketMat);
      rightDeltoid.position.set(0.39, 1.68, 0);
      mGroup.add(rightDeltoid);

      // Tailored Sleeves angled down naturally
      const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.58, 16), jacketMat);
      leftSleeve.position.set(-0.45, 1.40, 0);
      leftSleeve.rotation.z = 0.20;
      mGroup.add(leftSleeve);

      const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.58, 16), jacketMat);
      rightSleeve.position.set(0.45, 1.40, 0);
      rightSleeve.rotation.z = -0.20;
      mGroup.add(rightSleeve);

      // Gold Brass Sleeve Cuffs / Wrist Finials
      const leftWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.072, 0.05, 16), goldBrassMat);
      leftWrist.position.set(-0.51, 1.10, 0);
      mGroup.add(leftWrist);

      const rightWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.072, 0.05, 16), goldBrassMat);
      rightWrist.position.set(0.51, 1.10, 0);
      mGroup.add(rightWrist);

      // Inverted Gold Brass Lapel V-Neck Trim & Double Buttons
      const lapel = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.016, 8, 20, Math.PI), goldBrassMat);
      lapel.rotation.z = Math.PI;
      lapel.position.set(0, 1.70, 0.14);
      mGroup.add(lapel);

      const btn1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 12), goldBrassMat);
      btn1.rotation.x = Math.PI / 2;
      btn1.position.set(0, 1.38, 0.22);
      mGroup.add(btn1);

      const btn2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 12), goldBrassMat);
      btn2.rotation.x = Math.PI / 2;
      btn2.position.set(0, 1.26, 0.21);
      mGroup.add(btn2);

      // Polished Gold Brass Neck
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.18, 16), goldBrassMat);
      neck.position.y = 1.84;
      mGroup.add(neck);

      // Minimalist Faceless High-Fashion Milan Head Sculpt
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.135, 24, 20),
        new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.35, metalness: 0.35 })
      );
      head.scale.set(1.0, 1.36, 1.10);
      head.position.y = 2.02;
      mGroup.add(head);

      // Overhead Warm Spotlight
      const mLight = new THREE.PointLight(0xfffbeb, 0.85, 4.8);
      mLight.position.set(0, 3.4, 0.4);
      mGroup.add(mLight);

      // Floating Holographic Luxury Badge (Canvas 2D)
      const badgeCanvas = document.createElement("canvas");
      badgeCanvas.width = 384;
      badgeCanvas.height = 112;
      const badgeCtx = badgeCanvas.getContext("2d")!;
      const badgeTexture = new THREE.CanvasTexture(badgeCanvas);

      const renderBadgeText = (title: string, subtitle: string) => {
        badgeCtx.clearRect(0, 0, 384, 112);
        badgeCtx.fillStyle = "rgba(15, 12, 22, 0.88)";
        badgeCtx.strokeStyle = cfg.accentHex;
        badgeCtx.lineWidth = 3.5;
        badgeCtx.beginPath();
        badgeCtx.roundRect(4, 4, 376, 104, 20);
        badgeCtx.fill();
        badgeCtx.stroke();

        badgeCtx.fillStyle = cfg.accentHex;
        badgeCtx.font = "bold 20px sans-serif";
        badgeCtx.textAlign = "center";
        badgeCtx.fillText(title, 192, 42);

        badgeCtx.fillStyle = "#ffffff";
        badgeCtx.font = "600 17px sans-serif";
        badgeCtx.fillText(subtitle, 192, 78);
        badgeTexture.needsUpdate = true;
      };
      renderBadgeText(cfg.label, cfg.sublabel);

      const badgeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.46),
        new THREE.MeshBasicMaterial({ map: badgeTexture, transparent: true, depthWrite: false })
      );
      badgeMesh.position.set(0, 2.45, 0);
      mGroup.add(badgeMesh);

      // 🎯 3 DISTINCT BODY PART HITBOXES FOR PRECISE INTERACTIVE HOVER & CLICK:
      // A. Upper Body Hitbox (Jacket / Coat + T-Shirt):
      const upperHitBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.05, 0.60), sharedHitBoxMat);
      upperHitBox.position.y = 1.62;
      upperHitBox.userData = { isMannequinPart: true, part: "upper", mannequinIndex: cfg.index };
      mGroup.add(upperHitBox);
      interactiveObjects.push(upperHitBox);

      // B. Lower Body Hitbox (Pants / Jeans / Trousers):
      const pantsHitBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.50), sharedHitBoxMat);
      pantsHitBox.position.y = 0.68;
      pantsHitBox.userData = { isMannequinPart: true, part: "pants", mannequinIndex: cfg.index };
      mGroup.add(pantsHitBox);
      interactiveObjects.push(pantsHitBox);

      // C. Footwear Hitbox (Shoes / Footwear):
      const shoesHitBox = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.30, 0.50), sharedHitBoxMat);
      shoesHitBox.position.set(0, 0.14, 0.03);
      shoesHitBox.userData = { isMannequinPart: true, part: "shoes", mannequinIndex: cfg.index };
      mGroup.add(shoesHitBox);
      interactiveObjects.push(shoesHitBox);

      runwayGroup.add(mGroup);

      const worldChest = new THREE.Vector3(
        cfg.x + runwayGroup.position.x,
        cfg.y + 0.12 + 1.62,
        cfg.z + runwayGroup.position.z
      );
      const worldPants = new THREE.Vector3(
        cfg.x + runwayGroup.position.x,
        cfg.y + 0.12 + 0.68,
        cfg.z + runwayGroup.position.z
      );
      const worldShoes = new THREE.Vector3(
        cfg.x + runwayGroup.position.x,
        cfg.y + 0.12 + 0.14,
        cfg.z + runwayGroup.position.z
      );

      let curOutfit: { jacket: Product; tshirt: Product; pants: Product; shoes: Product } | null = null;
      const updateOutfit = (outfit: { jacket: Product; tshirt: Product; pants: Product; shoes: Product } | null) => {
        curOutfit = outfit;
        if (outfit) {
          const jHex = getColorHexFromName(outfit.jacket.color, cfg.accentColor);
          const tHex = getColorHexFromName(outfit.tshirt.color, 0xf1f5f9);
          const pHex = getColorHexFromName(outfit.pants.color, 0x1e293b);
          const sHex = getColorHexFromName(outfit.shoes.color, 0x0f172a);

          jacketMat.color.setHex(jHex);
          innerTopMat.color.setHex(tHex);
          pantsMat.color.setHex(pHex);
          shoesMat.color.setHex(sHex);

          renderBadgeText(
            cfg.label,
            `${outfit.jacket.name.slice(0, 16)} + ${outfit.pants.name.slice(0, 14)}`
          );
        } else {
          jacketMat.color.setHex(cfg.defaultColor);
          innerTopMat.color.setHex(0xf1f5f9);
          pantsMat.color.setHex(0x1e293b);
          shoesMat.color.setHex(0x0f172a);
          renderBadgeText(cfg.label, cfg.sublabel);
        }
      };

      mannequins.push({
        id: cfg.id,
        index: cfg.index,
        label: cfg.label,
        sublabel: cfg.sublabel,
        group: mGroup,
        jacketMat,
        innerTopMat,
        pantsMat,
        shoesMat,
        badgeMesh,
        badgeTexture,
        worldChestPos: worldChest,
        worldPantsPos: worldPants,
        worldShoesPos: worldShoes,
        defaultTorsoColor: cfg.defaultColor,
        defaultInnerColor: 0xf1f5f9,
        defaultPantsColor: 0x1e293b,
        defaultShoesColor: 0x0f172a,
        glowHalo,
        get currentOutfit() {
          return curOutfit;
        },
        get currentProduct() {
          return curOutfit?.jacket || null;
        },
        updateOutfit,
      });
    });

    scene.add(runwayGroup);

    // Save product groups reference for search targeting
    productGroupsMapRef.current = productGroupsMap;

    // 🎯 Camera target focus helper (Aisle-oriented front-view positioning)
    focusCameraOnPosRef.current = (pos: THREE.Vector3) => {
      // 1. Center Footwear vitrine
      if (pos.z < -8) {
        targetLookAt.set(pos.x, pos.y + 0.25, pos.z);
        targetRadius = 7.0;
        targetPhi = Math.PI / 3.0;
        targetTheta = 0.08;
      }
      // 2. West Wing cupboards (Jackets, Shirts) - open front faces +Z, aisle is to the right (+X)
      else if (pos.x < -4) {
        targetLookAt.set(pos.x, pos.y + 0.25, pos.z);
        targetRadius = 7.2;
        targetPhi = Math.PI / 2.9;
        targetTheta = 0.48; // Position camera in front of cupboard, shifted towards center aisle
      }
      // 3. East Wing cupboards (Jeans, T-Shirts) - open front faces +Z, aisle is to the left (-X)
      else if (pos.x > 4) {
        targetLookAt.set(pos.x, pos.y + 0.25, pos.z);
        targetRadius = 7.2;
        targetPhi = Math.PI / 2.9;
        targetTheta = -0.48; // Position camera in front of cupboard, shifted towards center aisle
      }
      // 4. Center Hero Runway / Mannequins
      else {
        targetLookAt.set(pos.x, pos.y + 0.3, pos.z);
        targetRadius = 6.8;
        targetPhi = Math.PI / 2.85;
        targetTheta = 0.32;
      }
    };

    // List of pulsing aura meshes
    const pulsingAuras: THREE.Mesh[] = [];
    const animatedGuidePulses: Array<{ mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; offset: number }> = [];

    // =========================================================================
    // 🎯 3D TACTICAL SCOPE POINTER (EXACT PRODUCT SCALE: 0.55m RADIUS)
    // Matches the physical 3D product token mesh scale with precision!
    // =========================================================================
    const scopeGroup = new THREE.Group();
    scopeGroup.visible = false;
    scopePointerGroupRef.current = scopeGroup;

    // 1. Primary Reticle Ring at Ground Plinth Level (Inner 0.50m, Outer 0.56m)
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4, // Cyan Hologram
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const reticleRing = new THREE.Mesh(new THREE.RingGeometry(0.50, 0.56, 48), reticleMat);
    reticleRing.rotation.x = -Math.PI / 2;
    reticleRing.position.y = 0.02;
    scopeGroup.add(reticleRing);

    // 2. Outer Rotating 4-Corner Bracket Reticle (Radius 0.58m to 0.60m)
    const bracketMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const bracketRing = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.60, 4), bracketMat);
    bracketRing.rotation.x = -Math.PI / 2;
    bracketRing.position.y = 0.025;
    scopeGroup.add(bracketRing);

    // 3. 4 Crosshair Ticks pointing inwards at radius 0.52m
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.02, 0.03),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      const angle = (i * Math.PI) / 2;
      tick.position.set(Math.cos(angle) * 0.52, 0.03, Math.sin(angle) * 0.52);
      tick.rotation.y = -angle;
      scopeGroup.add(tick);
    }

    // 4. Vertical Holographic Scanning Cylinder (Radius 0.53m, Height 1.0m)
    const holoCylMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const holoCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 1.0, 32, 1, true), holoCylMat);
    holoCyl.position.y = 0.5;
    scopeGroup.add(holoCyl);

    // 5. Vertical Oscillating Scan Ring (Radius 0.51m to 0.55m)
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const scanRing = new THREE.Mesh(new THREE.RingGeometry(0.51, 0.55, 36), scanRingMat);
    scanRing.rotation.x = -Math.PI / 2;
    scanRing.position.y = 0.5;
    scopeGroup.add(scanRing);

    // 6. Overhead 3D Target Billboard Label
    const scopeCanvas = document.createElement("canvas");
    scopeCanvas.width = 384;
    scopeCanvas.height = 96;
    const scCtx = scopeCanvas.getContext("2d")!;
    scCtx.fillStyle = "rgba(6, 182, 212, 0.95)";
    scCtx.fillRect(0, 0, 384, 96);
    scCtx.strokeStyle = "#ffffff";
    scCtx.lineWidth = 4;
    scCtx.strokeRect(3, 3, 378, 90);
    scCtx.fillStyle = "#022c22";
    scCtx.font = "bold 26px sans-serif";
    scCtx.textAlign = "center";
    scCtx.fillText("🎯 SCOPE TARGET LOCKED", 192, 58);

    const scopeTex = new THREE.CanvasTexture(scopeCanvas);
    const scopeSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.35),
      new THREE.MeshBasicMaterial({ map: scopeTex, transparent: true })
    );
    scopeSign.position.y = 1.25;
    scopeGroup.add(scopeSign);

    scene.add(scopeGroup);

    // =========================================================================
    // 🌟 NEON ARROW LINES & BEACONS FOR EACH MUTUAL 1:1 SWAP PAIR
    // =========================================================================
    const arrowConeGeo = new THREE.ConeGeometry(0.12, 0.32, 16);

    // Fast Mover Anchor Aura
    const anchorAura = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    anchorAura.rotation.x = -Math.PI / 2;
    anchorAura.position.set(anchorShelfLoc.x, 0.05, anchorShelfLoc.z);
    scene.add(anchorAura);
    pulsingAuras.push(anchorAura);

    // Swap Beacons list for each pair
    const swapBeaconGroups: THREE.Group[] = [];

    const isHeroMode = swapMode === "hero_showcase";
    const activeRouteItems: Array<{
      suggested: Product;
      neighbor?: Product;
      targetPt: THREE.Vector3;
      colorHex: number;
      badgeText: string;
      role: string;
    }> =
      isHeroMode
        ? (() => {
            const hero = heroRunwayPairs[selectedSuggestionIdx] || heroRunwayPairs[0];
            const m = mannequins[hero.index];
            if (!m) return [];
            return [
              {
                suggested: hero.outfit.jacket,
                targetPt: m.worldChestPos,
                colorHex: 0xf59e0b, // Amber Gold
                badgeText: `★ ${hero.badge} COAT`,
                role: "Outerwear",
              },
              {
                suggested: hero.outfit.tshirt,
                targetPt: m.worldChestPos,
                colorHex: 0x38bdf8, // Sky Blue
                badgeText: `★ ${hero.badge} SHIRT`,
                role: "Topwear",
              },
              {
                suggested: hero.outfit.pants,
                targetPt: m.worldPantsPos,
                colorHex: 0x10b981, // Emerald Green
                badgeText: `★ ${hero.badge} PANTS`,
                role: "Bottomwear",
              },
              {
                suggested: hero.outfit.shoes,
                targetPt: m.worldShoesPos,
                colorHex: 0xa855f7, // Royal Purple
                badgeText: `★ ${hero.badge} SHOES`,
                role: "Footwear",
              },
            ];
          })()
        : swapPairs.map((pair, idx) => {
            const nLoc = getProductShelfLocation(pair.neighbor);
            return {
              suggested: pair.suggested,
              neighbor: pair.neighbor,
              targetPt: new THREE.Vector3(nLoc.x, nLoc.y + 0.3, nLoc.z),
              colorHex: pair.colorHex,
              badgeText: `★ CUPBOARD SWAP #${idx + 1}`,
              role: "Mutual Partner",
            };
          });

    activeRouteItems.forEach((item, sIdx) => {
      const pShelfLoc = getProductShelfLocation(item.suggested);
      const originShelfPt = new THREE.Vector3(pShelfLoc.x, pShelfLoc.y + 0.3, pShelfLoc.z);
      const targetPt = item.targetPt;

      const arcApexY = Math.max(originShelfPt.y, targetPt.y) + 2.8 + sIdx * 0.35;
      const arcMidPt = new THREE.Vector3(
        (originShelfPt.x + targetPt.x) / 2,
        arcApexY,
        (originShelfPt.z + targetPt.z) / 2
      );

      const neonCurve = new THREE.QuadraticBezierCurve3(originShelfPt, arcMidPt, targetPt);
      const neonColor = item.colorHex;

      // Glowing Tube line connecting suggested item to target
      const tubeGeo = new THREE.TubeGeometry(neonCurve, 36, 0.024, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color: neonColor });
      scene.add(new THREE.Mesh(tubeGeo, tubeMat));

      // Arrow cone pointing into target slot or mannequin
      const arrowCone = new THREE.Mesh(arrowConeGeo, new THREE.MeshBasicMaterial({ color: neonColor }));
      const ptBefore = neonCurve.getPoint(0.93);
      const ptEnd = neonCurve.getPoint(0.98);
      arrowCone.position.copy(ptEnd);
      arrowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ptEnd.clone().sub(ptBefore).normalize());
      scene.add(arrowCone);

      // Return arrow cone pointing into the other cupboard (in cupboard mutual mode only)
      if (!isHeroMode && item.neighbor) {
        const returnArrowCone = new THREE.Mesh(arrowConeGeo, new THREE.MeshBasicMaterial({ color: neonColor }));
        const rPtBefore = neonCurve.getPoint(0.07);
        const rPtEnd = neonCurve.getPoint(0.02);
        returnArrowCone.position.copy(rPtEnd);
        returnArrowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rPtEnd.clone().sub(rPtBefore).normalize());
        scene.add(returnArrowCone);
      }

      // Flowing animated pulse along line
      const pulseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      scene.add(pulseMesh);
      animatedGuidePulses.push({ mesh: pulseMesh, curve: neonCurve, offset: sIdx * 0.22 });

      // Floating Beacon at target (only 1 central beacon for hero mode on chest)
      if (!isHeroMode || sIdx === 0) {
        const bGroup = new THREE.Group();
        bGroup.position.set(targetPt.x, targetPt.y + (isHeroMode ? 1.05 : 0.85), targetPt.z);
        const bCanvas = document.createElement("canvas");
        bCanvas.width = 300;
        bCanvas.height = 68;
        const bCtx = bCanvas.getContext("2d")!;
        bCtx.fillStyle = isHeroMode ? "rgba(245, 158, 11, 0.95)" : "rgba(16, 185, 129, 0.95)";
        bCtx.fillRect(0, 0, 300, 68);
        bCtx.strokeStyle = "#ffffff";
        bCtx.lineWidth = 3;
        bCtx.strokeRect(2, 2, 296, 64);
        bCtx.fillStyle = "#ffffff";
        bCtx.font = "bold 19px sans-serif";
        bCtx.textAlign = "center";
        bCtx.fillText(
          isHeroMode
            ? `👑 ${(heroRunwayPairs[selectedSuggestionIdx] || heroRunwayPairs[0]).badge}: 4-PIECE OUTFIT`
            : `★ CUPBOARD SWAP #${sIdx + 1}`,
          150,
          42
        );
        const bTex = new THREE.CanvasTexture(bCanvas);
        const bMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.25), new THREE.MeshBasicMaterial({ map: bTex, transparent: true }));
        bGroup.add(bMesh);
        bGroup.visible = Boolean(planogramAppliedRef.current);
        scene.add(bGroup);
        swapBeaconGroups.push(bGroup);
      }
    });

    // If planogram was already applied before this scene mount, immediately set swapped positions & dress only selected mannequin
    if (planogramAppliedRef.current) {
      if (isHeroMode) {
        const selectedHero = heroRunwayOutfits[selectedSuggestionIdx] || heroRunwayOutfits[0];
        mannequins.forEach((m, idx) => {
          if (idx === selectedHero.index) {
            const jGroup = productGroupsMap.get(selectedHero.outfit.jacket._id);
            const tGroup = productGroupsMap.get(selectedHero.outfit.tshirt._id);
            const pGroup = productGroupsMap.get(selectedHero.outfit.pants._id);
            const sGroup = productGroupsMap.get(selectedHero.outfit.shoes._id);

            // Position at mannequin and HIDE the shelf box tokens since the mannequin is wearing actual 3D clothing!
            if (jGroup) { jGroup.group.position.copy(m.worldChestPos); jGroup.group.visible = false; }
            if (tGroup) { tGroup.group.position.copy(m.worldChestPos); tGroup.group.visible = false; }
            if (pGroup) { pGroup.group.position.copy(m.worldPantsPos); pGroup.group.visible = false; }
            if (sGroup) { sGroup.group.position.copy(m.worldShoesPos); sGroup.group.visible = false; }

            m.updateOutfit(selectedHero.outfit);
          } else {
            m.updateOutfit(null);
          }
        });
      } else {
        swapPairs.forEach((pair) => {
          const itemS = productGroupsMap.get(pair.suggested._id);
          const itemN = productGroupsMap.get(pair.neighbor._id);
          if (itemS && itemN) {
            itemS.group.position.copy(itemN.originalPos);
            itemN.group.position.copy(itemS.originalPos);
            itemS.group.visible = true;
            itemN.group.visible = true;
          }
        });
      }
    } else {
      // Default baseline: all shelf products are visible in their neat folded box shapes on the shelves!
      productGroupsMap.forEach((entry) => {
        entry.group.position.copy(entry.originalPos);
        entry.group.visible = true;
        entry.group.scale.setScalar(1.0);
      });
      mannequins.forEach((m) => {
        m.updateOutfit(null);
      });
    }

    snapToAppliedPositionsRef.current = () => {
      if (isHeroMode) {
        const selectedHero = heroRunwayOutfits[selectedSuggestionIdx] || heroRunwayOutfits[0];
        mannequins.forEach((m, idx) => {
          if (idx === selectedHero.index) {
            const jGroup = productGroupsMap.get(selectedHero.outfit.jacket._id);
            const tGroup = productGroupsMap.get(selectedHero.outfit.tshirt._id);
            const pGroup = productGroupsMap.get(selectedHero.outfit.pants._id);
            const sGroup = productGroupsMap.get(selectedHero.outfit.shoes._id);

            // Position at mannequin and HIDE the shelf box tokens since the mannequin is wearing actual 3D clothing!
            if (jGroup) { jGroup.group.position.copy(m.worldChestPos); jGroup.group.visible = false; }
            if (tGroup) { tGroup.group.position.copy(m.worldChestPos); tGroup.group.visible = false; }
            if (pGroup) { pGroup.group.position.copy(m.worldPantsPos); pGroup.group.visible = false; }
            if (sGroup) { sGroup.group.position.copy(m.worldShoesPos); sGroup.group.visible = false; }

            m.updateOutfit(selectedHero.outfit);
          } else {
            m.updateOutfit(null);
          }
        });
      } else {
        swapPairs.forEach((pair) => {
          const itemS = productGroupsMap.get(pair.suggested._id);
          const itemN = productGroupsMap.get(pair.neighbor._id);
          if (itemS && itemN) {
            itemS.group.position.copy(itemN.originalPos);
            itemN.group.position.copy(itemS.originalPos);
            itemS.group.visible = true;
            itemN.group.visible = true;
          }
        });
      }
      swapBeaconGroups.forEach((bg) => {
        bg.visible = true;
      });
    };

    // 🚀 Flight Animation Controller for Dramatic 3D Swap (Supports selective item-by-item live floor execution!)
    const flightAnim = {
      active: false,
      startTime: 0,
      duration: 2000,
      forward: true,
      specificProductIds: undefined as Set<string> | undefined,
    };

    triggerFlightAnimationRef.current = (forward = true, specificProductIds?: string[]) => {
      flightAnim.active = true;
      flightAnim.startTime = performance.now();
      flightAnim.duration = 2000;
      flightAnim.forward = forward;
      flightAnim.specificProductIds = specificProductIds && specificProductIds.length > 0 ? new Set(specificProductIds) : undefined;
      setIsSwapAnimating(true);
      setTimeout(() => setIsSwapAnimating(false), 2050);
    };

    // =========================================================================
    // 🕹️ INTERACTION: MOUSE ORBIT, PAN, ZOOM, AND HOVER OVER 60 PRODUCTS
    // =========================================================================
    let targetTheta = Math.PI / 4.2;
    let targetPhi = Math.PI / 3.4;
    let currentTheta = Math.PI / 4.2;
    let currentPhi = Math.PI / 3.4;
    let currentRadius = 32;
    let targetRadius = 32;
    const currentLookAt = new THREE.Vector3(0, 1.5, 0);
    const targetLookAt = new THREE.Vector3(0, 1.5, 0);

    const updateCameraPosition = () => {
      camera.position.x = currentLookAt.x + currentRadius * Math.sin(currentPhi) * Math.sin(currentTheta);
      camera.position.y = currentLookAt.y + currentRadius * Math.cos(currentPhi);
      camera.position.z = currentLookAt.z + currentRadius * Math.sin(currentPhi) * Math.cos(currentTheta);
      camera.lookAt(currentLookAt);
    };
    updateCameraPosition();

    zoomControlRef.current = {
      zoomIn: () => {
        targetRadius = Math.max(10, targetRadius - 4);
      },
      zoomOut: () => {
        targetRadius = Math.min(50, targetRadius + 4);
      },
      resetView: () => {
        targetRadius = 32;
        targetTheta = Math.PI / 4.2;
        targetPhi = Math.PI / 3.4;
        targetLookAt.set(0, 1.5, 0);
      },
      setHorizontalView: () => {
        targetRadius = 19;
        targetTheta = 0.0; // Straight centered horizontal front view of all 3 hero mannequins
        targetPhi = Math.PI / 2.7; // Elevated eye-level framing
        targetLookAt.set(0, 1.5, 0);
      },
    };

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (isMouseOverUIRef.current) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastRaycastTime = 0;
    let lastHoveredMesh: THREE.Mesh | null = null;

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        targetTheta -= deltaX * 0.006;
        targetPhi = Math.max(0.12, Math.min(Math.PI / 2.1, targetPhi - deltaY * 0.006));
      } else {
        // ✨ PRODUCT HOVER DETECTION (OVER ALL 60 PRODUCTS)
        if (isMouseOverUIRef.current || !renderer?.domElement || e.target !== renderer.domElement) {
          if (renderer?.domElement) renderer.domElement.style.cursor = "default";
          return;
        }

        const now = performance.now();
        if (now - lastRaycastTime < 35) return; // Throttle to 30fps
        lastRaycastTime = now;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactiveObjects);

        if (intersects.length > 0) {
          const hit = intersects[0].object;
          if (hit.userData?.isMannequinPart) {
            const mIdx = hit.userData.mannequinIndex;
            const part = hit.userData.part as "upper" | "pants" | "shoes";
            renderer.domElement.style.cursor = "pointer";
            const m = mannequins[mIdx];
            if (m) {
              const heroStation = heroRunwayOutfits[mIdx];
              const outfit = m.currentOutfit || heroStation?.outfit;
              if (outfit) {
                setHoveredMannequin({
                  mannequinIndex: mIdx,
                  part,
                  stationName: heroStation.stationName,
                  badge: heroStation.badge,
                  outfit,
                });

                let targetProd: Product | null = null;
                if (part === "upper") {
                  targetProd = outfit.jacket || outfit.tshirt;
                } else if (part === "pants") {
                  targetProd = outfit.pants;
                } else if (part === "shoes") {
                  targetProd = outfit.shoes;
                }

                if (targetProd && hoveredProductIdRef.current !== targetProd._id) {
                  hoveredProductIdRef.current = targetProd._id;
                  setHoveredProduct(targetProd);
                  setInspectedProduct(targetProd);
                }
              }
            }
            return;
          }
          if (hit.userData?.isProduct && hit.userData.product) {
            setHoveredMannequin(null);
            const prod = hit.userData.product as Product;
            renderer.domElement.style.cursor = "pointer";

            // Restore previously hovered mesh
            if (lastHoveredMesh && lastHoveredMesh !== productMeshMap.get(prod._id)) {
              lastHoveredMesh.scale.set(1, 1, 1);
            }

            // Highlight current product mesh
            const pMesh = productMeshMap.get(prod._id);
            if (pMesh) {
              pMesh.scale.set(1.18, 1.18, 1.18);
              lastHoveredMesh = pMesh;
            }

            // Update React state for Side Overlay only when hovered product actually changes!
            if (hoveredProductIdRef.current !== prod._id) {
              hoveredProductIdRef.current = prod._id;
              setHoveredProduct(prod);
              setInspectedProduct(prod);
            }
            return;
          }
        } else {
          setHoveredMannequin(null);
          if (lastHoveredMesh) {
            lastHoveredMesh.scale.set(1, 1, 1);
            lastHoveredMesh = null;
          }
          hoveredProductIdRef.current = null;
          renderer.domElement.style.cursor = "grab";
        }
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (isMouseOverUIRef.current) return;
      e.preventDefault();
      targetRadius = Math.max(10, Math.min(50, targetRadius + e.deltaY * 0.025));
    };

    const onClick = (e: MouseEvent) => {
      if (isMouseOverUIRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjects);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData?.isMannequinPart) {
          const mIdx = hit.userData.mannequinIndex;
          const part = hit.userData.part as "upper" | "pants" | "shoes";
          const m = mannequins[mIdx];
          if (m) {
            const heroStation = heroRunwayOutfits[mIdx];
            const outfit = m.currentOutfit || heroStation?.outfit;
            let targetProd: Product | null = null;
            let focusPos = m.worldChestPos;
            if (part === "upper") {
              targetProd = outfit?.jacket || outfit?.tshirt || heroStation?.suggested;
              focusPos = m.worldChestPos;
            } else if (part === "pants") {
              targetProd = outfit?.pants || heroStation?.partner;
              focusPos = m.worldPantsPos;
            } else if (part === "shoes") {
              targetProd = outfit?.shoes || shoes[mIdx];
              focusPos = m.worldShoesPos;
            }
            if (targetProd) {
              setInspectedProduct(targetProd);
              onSelectProduct?.(targetProd);
              onPairChange?.(mIdx);
              focusCameraOnPosRef.current?.(focusPos);
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                setMobileDrawer("inspect");
              }
            }
          }
          return;
        }
        if (hit.userData?.isProduct && hit.userData.product) {
          const prod = hit.userData.product as Product;
          setInspectedProduct(prod);
          onSelectProduct?.(prod);
          if (typeof window !== "undefined" && window.innerWidth < 1024) {
            setMobileDrawer("inspect");
          }
        }
      }
    };

    // 📱 Mobile / Tablet Touch Support (1-finger orbit, 2-finger pinch zoom)
    let initialPinchDist = 0;
    let initialPinchRadius = targetRadius;

    const onTouchStart = (e: TouchEvent) => {
      if (isMouseOverUIRef.current) return;
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
        initialPinchRadius = targetRadius;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isMouseOverUIRef.current) return;
      if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - prevMouseX;
        const deltaY = e.touches[0].clientY - prevMouseY;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;

        targetTheta -= deltaX * 0.007;
        targetPhi = Math.max(0.12, Math.min(Math.PI / 2.1, targetPhi - deltaY * 0.007));
      } else if (e.touches.length === 2 && initialPinchDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (dist > 10) {
          const factor = initialPinchDist / dist;
          targetRadius = Math.max(10, Math.min(50, initialPinchRadius * factor));
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isDragging = false;
        initialPinchDist = 0;
      } else if (e.touches.length === 1) {
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
        isDragging = true;
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    domElement.addEventListener("wheel", onWheel, { passive: false });
    domElement.addEventListener("click", onClick);
    domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    // --- ANIMATION LOOP (LOCKED TO 30 FPS FOR ROCK-SOLID SMOOTHNESS) ---
    let reqId: number;
    const clock = new THREE.Clock();
    let isRenderingActive = true;

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isRenderingActive = entry.isIntersecting && !document.hidden;
      },
      { threshold: 0.02 }
    );
    visibilityObserver.observe(container);

    let lastRenderTimestamp = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (!isRenderingActive) return;

      const now = performance.now();
      if (now - lastRenderTimestamp < 32) return; // 30 FPS throttle
      lastRenderTimestamp = now;

      const elapsed = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta(), 0.05);

      // Camera lerp
      currentLookAt.lerp(targetLookAt, 0.08);
      currentRadius += (targetRadius - currentRadius) * 0.12;
      currentTheta += (targetTheta - currentTheta) * 0.12;
      currentPhi += (targetPhi - currentPhi) * 0.12;

      // Auto rotation
      if (autoRotateRef.current && !isDragging) {
        targetTheta += delta * 0.04;
      }

      updateCameraPosition();

      // Pulsing Auras
      const auraScale = 1 + 0.05 * Math.cos(elapsed * 4.0);
      pulsingAuras.forEach((mesh) => mesh.scale.set(auraScale, auraScale, 1));

      // Guide pulses along neon curves
      animatedGuidePulses.forEach((p) => {
        const progress = (elapsed * 0.4 + p.offset) % 1;
        p.mesh.position.copy(p.curve.getPoint(progress));
      });

      // Update swap beacon visibility
      swapBeaconGroups.forEach((bg) => {
        bg.visible = Boolean(planogramAppliedRef.current);
        bg.quaternion.copy(camera.quaternion);
      });

      // Animate 3D Scope Pointer reticle, scan line, and target tracking
      if (scopeGroup.visible) {
        reticleRing.rotation.z += delta * 1.5;
        bracketRing.rotation.z -= delta * 0.8;
        scanRing.position.y = 0.5 + Math.sin(elapsed * 4.5) * 0.38;
        holoCylMat.opacity = 0.16 + 0.1 * Math.sin(elapsed * 5);
        scopeSign.quaternion.copy(camera.quaternion);

        if (searchedProduct) {
          const targetGroup = productGroupsMap.get(searchedProduct._id);
          if (targetGroup) {
            scopeGroup.position.copy(targetGroup.group.position);
          }
        }
      }

      // 🌟 DRAMATIC 3D FLIGHT ARCS & DYNAMIC OUTFIT SWAP ANIMATION
      if (flightAnim.active) {
        const elapsedMs = performance.now() - flightAnim.startTime;
        const progress = Math.min(1.0, elapsedMs / flightAnim.duration);
        const t = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        const arcY = Math.sin(progress * Math.PI) * 4.2;

        if (isHeroMode) {
          // 🌟 HERO SHOWCASE: Only the selected hero outfit flies to its dedicated runway mannequin!
          const selectedHero = heroRunwayOutfits[selectedSuggestionIdx] || heroRunwayOutfits[0];
          const m = mannequins[selectedHero.index];
          if (m) {
            const jGroup = productGroupsMap.get(selectedHero.outfit.jacket._id);
            const tGroup = productGroupsMap.get(selectedHero.outfit.tshirt._id);
            const pGroup = productGroupsMap.get(selectedHero.outfit.pants._id);
            const sGroup = productGroupsMap.get(selectedHero.outfit.shoes._id);
            const animItems = [
              { id: selectedHero.outfit.jacket._id, group: jGroup, target: m.worldChestPos },
              { id: selectedHero.outfit.tshirt._id, group: tGroup, target: m.worldChestPos },
              { id: selectedHero.outfit.pants._id, group: pGroup, target: m.worldPantsPos },
              { id: selectedHero.outfit.shoes._id, group: sGroup, target: m.worldShoesPos },
            ];

            animItems.forEach(({ id, group, target }) => {
              if (!group) return;
              if (flightAnim.specificProductIds && !flightAnim.specificProductIds.has(id)) return;
              const pStart = group.originalPos;
              const pEnd = target;
              group.group.visible = true;

              if (flightAnim.forward) {
                group.group.position.x = pStart.x + (pEnd.x - pStart.x) * t;
                group.group.position.y = pStart.y + (pEnd.y - pStart.y) * t + arcY;
                group.group.position.z = pStart.z + (pEnd.z - pStart.z) * t;
                group.group.rotation.y = t * Math.PI * 4;

                // Box dissolves seamlessly into the mannequin as it arrives
                const s = t < 0.65 ? 1.0 : Math.max(0.001, (1.0 - t) / 0.35);
                group.group.scale.setScalar(s);
              } else {
                group.group.position.x = pEnd.x + (pStart.x - pEnd.x) * t;
                group.group.position.y = pEnd.y + (pStart.y - pEnd.y) * t + arcY;
                group.group.position.z = pEnd.z + (pStart.z - pEnd.z) * t;
                group.group.rotation.y = -t * Math.PI * 4;

                // Box expands back to 1.0 as it returns to shelf
                const s = t < 0.35 ? Math.max(0.001, t / 0.35) : 1.0;
                group.group.scale.setScalar(s);
              }
            });

            // Smooth color morphing for only the selected mannequin during flight
            const targetJHex = getColorHexFromName(selectedHero.outfit.jacket.color, selectedHero.colorHex);
            const targetTHex = getColorHexFromName(selectedHero.outfit.tshirt.color, 0xf1f5f9);
            const targetPHex = getColorHexFromName(selectedHero.outfit.pants.color, 0x1e293b);
            const targetSHex = getColorHexFromName(selectedHero.outfit.shoes.color, 0x0f172a);

            if (flightAnim.forward) {
              m.jacketMat.color.copy(new THREE.Color(m.defaultTorsoColor)).lerp(new THREE.Color(targetJHex), t);
              m.innerTopMat.color.copy(new THREE.Color(m.defaultInnerColor)).lerp(new THREE.Color(targetTHex), t);
              m.pantsMat.color.copy(new THREE.Color(m.defaultPantsColor)).lerp(new THREE.Color(targetPHex), t);
              m.shoesMat.color.copy(new THREE.Color(m.defaultShoesColor)).lerp(new THREE.Color(targetSHex), t);
            } else {
              m.jacketMat.color.copy(new THREE.Color(targetJHex)).lerp(new THREE.Color(m.defaultTorsoColor), t);
              m.innerTopMat.color.copy(new THREE.Color(targetTHex)).lerp(new THREE.Color(m.defaultInnerColor), t);
              m.pantsMat.color.copy(new THREE.Color(targetPHex)).lerp(new THREE.Color(m.defaultPantsColor), t);
              m.shoesMat.color.copy(new THREE.Color(targetSHex)).lerp(new THREE.Color(m.defaultShoesColor), t);
            }
          }
        } else {
          // 🏬 CUPBOARD MUTUAL 1:1 SWAP: Outfits swap cleanly between cupboards without duplicate targets
          swapPairs.forEach((pair) => {
            if (flightAnim.specificProductIds && !flightAnim.specificProductIds.has(pair.suggested._id)) return;
            const itemS = productGroupsMap.get(pair.suggested._id);
            const itemN = productGroupsMap.get(pair.neighbor._id);
            if (!itemS || !itemN) return;

            const pStartS = itemS.originalPos;
            const pStartN = itemN.originalPos;

            if (flightAnim.forward) {
              itemS.group.position.x = pStartS.x + (pStartN.x - pStartS.x) * t;
              itemS.group.position.y = pStartS.y + (pStartN.y - pStartS.y) * t + arcY;
              itemS.group.position.z = pStartS.z + (pStartN.z - pStartS.z) * t;
              itemS.group.rotation.y = t * Math.PI * 4;

              itemN.group.position.x = pStartN.x + (pStartS.x - pStartN.x) * t;
              itemN.group.position.y = pStartN.y + (pStartS.y - pStartN.y) * t + arcY;
              itemN.group.position.z = pStartN.z + (pStartS.z - pStartN.z) * t;
              itemN.group.rotation.y = -t * Math.PI * 4;
            } else {
              itemS.group.position.x = pStartN.x + (pStartS.x - pStartN.x) * t;
              itemS.group.position.y = pStartN.y + (pStartS.y - pStartN.y) * t + arcY;
              itemS.group.position.z = pStartN.z + (pStartS.z - pStartN.z) * t;
              itemS.group.rotation.y = -t * Math.PI * 4;

              itemN.group.position.x = pStartS.x + (pStartN.x - pStartS.x) * t;
              itemN.group.position.y = pStartN.y + (pStartS.y - pStartN.y) * t + arcY;
              itemN.group.position.z = pStartN.z + (pStartS.z - pStartN.z) * t;
              itemN.group.rotation.y = t * Math.PI * 4;
            }
          });
        }

        if (progress >= 1.0) {
          flightAnim.active = false;
          if (isHeroMode) {
            const selectedHero = heroRunwayOutfits[selectedSuggestionIdx] || heroRunwayOutfits[0];
            mannequins.forEach((m, idx) => {
              if (idx === selectedHero.index) {
                const jGroup = productGroupsMap.get(selectedHero.outfit.jacket._id);
                const tGroup = productGroupsMap.get(selectedHero.outfit.tshirt._id);
                const pGroup = productGroupsMap.get(selectedHero.outfit.pants._id);
                const sGroup = productGroupsMap.get(selectedHero.outfit.shoes._id);

                const animItems = [
                  { id: selectedHero.outfit.jacket._id, group: jGroup, target: m.worldChestPos },
                  { id: selectedHero.outfit.tshirt._id, group: tGroup, target: m.worldChestPos },
                  { id: selectedHero.outfit.pants._id, group: pGroup, target: m.worldPantsPos },
                  { id: selectedHero.outfit.shoes._id, group: sGroup, target: m.worldShoesPos },
                ];

                animItems.forEach(({ id, group, target }) => {
                  if (!group) return;
                  if (flightAnim.specificProductIds && !flightAnim.specificProductIds.has(id)) return;
                  group.group.rotation.y = 0;
                  if (flightAnim.forward) {
                    // Forward swap: box reached mannequin -> hide shelf box, mannequin wears actual 3D accessories!
                    group.group.position.copy(target);
                    group.group.visible = false;
                    group.group.scale.setScalar(1.0);
                  } else {
                    // Revert swap: box back on shelf -> show box in shelf at original position!
                    group.group.position.copy(group.originalPos);
                    group.group.visible = true;
                    group.group.scale.setScalar(1.0);
                  }
                });

                if (flightAnim.forward) {
                  m.updateOutfit(selectedHero.outfit);
                } else {
                  m.updateOutfit(null);
                }
              } else {
                m.updateOutfit(null);
              }
            });
          } else {
            swapPairs.forEach((pair) => {
              if (flightAnim.specificProductIds && !flightAnim.specificProductIds.has(pair.suggested._id)) return;
              const itemS = productGroupsMap.get(pair.suggested._id);
              const itemN = productGroupsMap.get(pair.neighbor._id);
              if (itemS && itemN) {
                itemS.group.rotation.y = 0;
                itemN.group.rotation.y = 0;
                if (flightAnim.forward) {
                  itemS.group.position.copy(itemN.originalPos);
                  itemN.group.position.copy(itemS.originalPos);
                } else {
                  itemS.group.position.copy(itemS.originalPos);
                  itemN.group.position.copy(itemN.originalPos);
                }
              }
            });
          }
        }
      }

      // Keep mannequin floating luxury badges facing camera & pulse halos
      mannequins.forEach((m) => {
        m.badgeMesh.quaternion.copy(camera.quaternion);
        m.glowHalo.scale.setScalar(1.0 + Math.sin(elapsed * 3.5) * 0.04);
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      width = rect.width || container.clientWidth || window.innerWidth;
      height = rect.height || container.clientHeight || window.innerHeight || 740;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (container) resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(reqId);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("wheel", onWheel);
      domElement.removeEventListener("click", onClick);
      domElement.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", handleResize);

      // Cleanup
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
          }
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      if (domElement && domElement.parentNode) {
        domElement.parentNode.removeChild(domElement);
      }
    };
  }, [
    isFullScreen,
    isPerformanceMode,
    selectedSuggestionIdx,
    catalogProducts.length,
    swapMode,
  ]);

  // Fallback product display if none hovered yet
  const activeDisplayProduct = inspectedProduct || hoveredProduct || fastMoverProduct;
  const activeProductCoords = React.useMemo(() => {
    if (!activeDisplayProduct) {
      return getProductShelfLocation(undefined);
    }

    if (planogramApplied) {
      if (swapMode === "hero_showcase") {
        let matchingHero: (typeof heroRunwayOutfits)[0] | undefined;
        let partLabel = "";
        let targetY = 1.74;

        for (const hero of heroRunwayOutfits) {
          if (hero.outfit?.jacket?._id === activeDisplayProduct._id) {
            matchingHero = hero;
            partLabel = "Outerwear: Tailored Jacket";
            targetY = 1.74;
            break;
          }
          if (hero.outfit?.tshirt?._id === activeDisplayProduct._id) {
            matchingHero = hero;
            partLabel = "Inner Layer: T-Shirt / Shirt";
            targetY = 1.74;
            break;
          }
          if (hero.outfit?.pants?._id === activeDisplayProduct._id) {
            matchingHero = hero;
            partLabel = "Lower Body: Tailored Trousers / Denim";
            targetY = 0.80;
            break;
          }
          if (hero.outfit?.shoes?._id === activeDisplayProduct._id) {
            matchingHero = hero;
            partLabel = "Footwear: Handcrafted Italian Shoes";
            targetY = 0.26;
            break;
          }
        }

        if (matchingHero) {
          const origLoc = getProductShelfLocation(activeDisplayProduct);
          return {
            x: matchingHero.worldTargetPos.x,
            y: targetY,
            z: matchingHero.worldTargetPos.z,
            zone: `${matchingHero.targetZone} (${partLabel})`,
            shelf: "Runway Stage Pedestal",
            slot: matchingHero.badge,
            isRelocated: true,
            originalZone: origLoc.zone,
            originalShelf: origLoc.shelf,
            originalSlot: origLoc.slot,
            swappedWith: `Mannequin Model #${matchingHero.index + 1} (${partLabel})`,
            swappedWithSku: `HERO-RUNWAY-${matchingHero.index + 1}`,
          };
        }
      } else if (swapPairs.length > 0) {
        // Check if activeDisplayProduct is part of any mutual swap pair
        const matchingPair = swapPairs.find(
          (p) => p.suggested?._id === activeDisplayProduct._id || p.neighbor?._id === activeDisplayProduct._id
        );

        if (matchingPair && matchingPair.suggested && matchingPair.neighbor) {
          const isSuggested = matchingPair.suggested._id === activeDisplayProduct._id;
          const targetProd = isSuggested ? matchingPair.neighbor : matchingPair.suggested;
          const targetLoc = getProductShelfLocation(targetProd);
          const origLoc = getProductShelfLocation(activeDisplayProduct);

          return {
            x: targetLoc.x,
            y: targetLoc.y,
            z: targetLoc.z,
            zone: isSuggested
              ? `${targetLoc.zone} (Planogram Swapped Beside Fast Mover)`
              : `${targetLoc.zone} (Relocated Vacancy Slot)`,
            shelf: targetLoc.shelf,
            slot: targetLoc.slot,
            isRelocated: true,
            originalZone: origLoc.zone,
            originalShelf: origLoc.shelf,
            originalSlot: origLoc.slot,
            swappedWith: targetProd.name,
            swappedWithSku: targetProd.sku,
          };
        }
      }
    }

    return getProductShelfLocation(activeDisplayProduct);
  }, [planogramApplied, activeDisplayProduct, swapPairs, heroRunwayPairs, swapMode]);

  const activeProductImg = activeDisplayProduct
    ? getProductImage(activeDisplayProduct.category, activeDisplayProduct.color, activeDisplayProduct.name, activeDisplayProduct.imageUrl)
    : "";

  // 📱 REUSABLE INSPECTOR CARD (SHARED BETWEEN DESKTOP SIDE PANEL & MOBILE BOTTOM DRAWER)
  const renderInspectorCard = (onClose?: () => void) => {
    if (!hoveredMannequin && !activeDisplayProduct) {
      if (onClose) {
        return (
          <div className="glass-panel rounded-3xl p-5 flex flex-col shadow-2xl border border-amber-500/35 bg-stone-950/95 text-center space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-amber-400" />
                <span>3D Item Inspector</span>
              </span>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-6 space-y-1.5">
              <p className="text-xs font-bold text-white">No Item or Mannequin Selected</p>
              <p className="text-[11px] text-stone-400">
                Tap any mannequin on the runway or product on the shelves to view instant 3D coordinates, inventory, and restock actions.
              </p>
            </div>
          </div>
        );
      }
      return null;
    }

    return (
      <div
        className={`glass-panel rounded-3xl p-3.5 flex flex-col h-full shadow-2xl border border-amber-500/35 overflow-hidden ${
          onClose ? "bg-stone-950/95 h-full" : ""
        }`}
      >
        {onClose && (
          <div className="shrink-0 flex items-center justify-between pb-2 mb-1 border-b border-amber-500/20">
            <span className="text-[11px] font-black uppercase text-amber-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span>Floor Staff 3D Inspector</span>
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {hoveredMannequin ? (
          // 🌟 MANNEQUIN ENSEMBLE INSPECTOR
          <>
            <div className="shrink-0 flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">
                  {hoveredMannequin.badge} Mannequin
                </h4>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 shrink-0">
                {hoveredMannequin.part === "upper"
                  ? "Upper Ensemble (2)"
                  : hoveredMannequin.part === "pants"
                  ? "Lower Body"
                  : "Footwear"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0 custom-scrollbar my-2">
              {hoveredMannequin.part === "upper" && (
                <>
                  <div className="flex items-center justify-between text-[10px] font-bold text-amber-300 px-1">
                    <span>👔 Upper Body Ensemble</span>
                    <span className="text-stone-400">Jacket + T-Shirt</span>
                  </div>

                  {/* 1. Tailored Jacket / Coat */}
                  {hoveredMannequin.outfit?.jacket && (
                    <div className="bg-stone-950/85 p-2.5 rounded-2xl border border-amber-500/30 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <img
                          src={getProductImage(
                            hoveredMannequin.outfit.jacket.category,
                            hoveredMannequin.outfit.jacket.color,
                            hoveredMannequin.outfit.jacket.name,
                            hoveredMannequin.outfit.jacket.imageUrl
                          )}
                          alt={hoveredMannequin.outfit.jacket.name}
                          className="w-14 h-14 rounded-xl object-cover border border-amber-500/40 shrink-0 shadow"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                            🧥 Outerwear Layer
                          </span>
                          <h5 className="text-xs font-black text-white truncate">
                            {hoveredMannequin.outfit.jacket.name}
                          </h5>
                          <div className="flex items-center justify-between text-[10px] mt-1">
                            <span className="font-mono text-stone-300">
                              {hoveredMannequin.outfit.jacket.color} • {hoveredMannequin.outfit.jacket.sku}
                            </span>
                            <span className="text-xs font-black text-orange-400">
                              ₹{hoveredMannequin.outfit.jacket.price}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Inner T-Shirt / Shirt */}
                  {hoveredMannequin.outfit?.tshirt && (
                    <div className="bg-stone-950/85 p-2.5 rounded-2xl border border-amber-500/30 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <img
                          src={getProductImage(
                            hoveredMannequin.outfit.tshirt.category,
                            hoveredMannequin.outfit.tshirt.color,
                            hoveredMannequin.outfit.tshirt.name,
                            hoveredMannequin.outfit.tshirt.imageUrl
                          )}
                          alt={hoveredMannequin.outfit.tshirt.name}
                          className="w-14 h-14 rounded-xl object-cover border border-amber-500/40 shrink-0 shadow"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-sky-400">
                            👕 Inner Shirt / Tee
                          </span>
                          <h5 className="text-xs font-black text-white truncate">
                            {hoveredMannequin.outfit.tshirt.name}
                          </h5>
                          <div className="flex items-center justify-between text-[10px] mt-1">
                            <span className="font-mono text-stone-300">
                              {hoveredMannequin.outfit.tshirt.color} • {hoveredMannequin.outfit.tshirt.sku}
                            </span>
                            <span className="text-xs font-black text-orange-400">
                              ₹{hoveredMannequin.outfit.tshirt.price}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {hoveredMannequin.part === "pants" && hoveredMannequin.outfit?.pants && (
                <div className="bg-stone-950/85 p-2.5 rounded-2xl border border-amber-500/30 space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 block px-1">
                    👖 Lower Body: Tailored Athletic Denim / Trousers
                  </span>
                  <div className="flex items-start gap-3">
                    <img
                      src={getProductImage(
                        hoveredMannequin.outfit.pants.category,
                        hoveredMannequin.outfit.pants.color,
                        hoveredMannequin.outfit.pants.name,
                        hoveredMannequin.outfit.pants.imageUrl
                      )}
                      alt={hoveredMannequin.outfit.pants.name}
                      className="w-16 h-16 rounded-xl object-cover border border-amber-500/40 shrink-0 shadow"
                    />
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-black text-white line-clamp-2">
                        {hoveredMannequin.outfit.pants.name}
                      </h5>
                      <p className="text-[10px] text-amber-300/90 font-mono mt-0.5">
                        SKU: {hoveredMannequin.outfit.pants.sku} • {hoveredMannequin.outfit.pants.color}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-black text-orange-400">
                          ₹{hoveredMannequin.outfit.pants.price}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {hoveredMannequin.outfit.pants.stock} in stock
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {hoveredMannequin.part === "shoes" && hoveredMannequin.outfit?.shoes && (
                <div className="bg-stone-950/85 p-2.5 rounded-2xl border border-amber-500/30 space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 block px-1">
                    👞 Footwear: Handcrafted Italian Shoes
                  </span>
                  <div className="flex items-start gap-3">
                    <img
                      src={getProductImage(
                        hoveredMannequin.outfit.shoes.category,
                        hoveredMannequin.outfit.shoes.color,
                        hoveredMannequin.outfit.shoes.name,
                        hoveredMannequin.outfit.shoes.imageUrl
                      )}
                      alt={hoveredMannequin.outfit.shoes.name}
                      className="w-16 h-16 rounded-xl object-cover border border-amber-500/40 shrink-0 shadow"
                    />
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-black text-white line-clamp-2">
                        {hoveredMannequin.outfit.shoes.name}
                      </h5>
                      <p className="text-[10px] text-amber-300/90 font-mono mt-0.5">
                        SKU: {hoveredMannequin.outfit.shoes.sku} • {hoveredMannequin.outfit.shoes.color}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-black text-orange-400">
                          ₹{hoveredMannequin.outfit.shoes.price}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {hoveredMannequin.outfit.shoes.stock} in stock
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 📍 EXACT 3D MANNEQUIN SHOWROOM LOCATION */}
              <div className="p-2.5 bg-stone-900/90 rounded-2xl border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>Runway Pedestal #{hoveredMannequin.mannequinIndex + 1}</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold bg-amber-400/20 text-amber-300 border border-amber-500/30">
                    {hoveredMannequin.badge}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                  <div className="bg-stone-950 p-1.5 rounded-lg border border-stone-800">
                    <span className="text-[9px] text-stone-400 block">X COORD</span>
                    <span className="text-xs font-bold text-sky-400">
                      {([-2.8, 0.0, 2.8][hoveredMannequin.mannequinIndex]).toFixed(2)}m
                    </span>
                  </div>
                  <div className="bg-stone-950 p-1.5 rounded-lg border border-stone-800">
                    <span className="text-[9px] text-stone-400 block">Y COORD</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {hoveredMannequin.part === "upper"
                        ? "1.74m"
                        : hoveredMannequin.part === "pants"
                        ? "0.80m"
                        : "0.26m"}
                    </span>
                  </div>
                  <div className="bg-stone-950 p-1.5 rounded-lg border border-stone-800">
                    <span className="text-[9px] text-stone-400 block">Z COORD</span>
                    <span className="text-xs font-bold text-purple-400">
                      {([2.0, 1.45, 2.0][hoveredMannequin.mannequinIndex]).toFixed(2)}m
                    </span>
                  </div>
                </div>

                <div className="text-[10px] space-y-1 pt-1 border-t border-stone-800 text-stone-300">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Station Name:</span>
                    <span className="font-bold text-white truncate max-w-[170px]">
                      {hoveredMannequin.stationName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Anatomy Zone:</span>
                    <span className="font-semibold text-amber-300">
                      {hoveredMannequin.part === "upper"
                        ? "Upper Torso (Jacket + Shirt Layer)"
                        : hoveredMannequin.part === "pants"
                        ? "Lower Body (Straight-Leg Athletic Jeans)"
                        : "Footwear (Italian Leather Shoes Plinth)"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Button - Pinned */}
            <div className="shrink-0 pt-2 border-t border-amber-500/20 mt-auto">
              <button
                onClick={() => {
                  const prodToRestock =
                    hoveredMannequin.part === "upper"
                      ? hoveredMannequin.outfit.jacket
                      : hoveredMannequin.part === "pants"
                      ? hoveredMannequin.outfit.pants
                      : hoveredMannequin.outfit.shoes;
                  handleQuickRestock(prodToRestock._id, prodToRestock.stock);
                }}
                disabled={actionLoading}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-stone-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>
                  Restock {hoveredMannequin.part === "upper" ? "Outerwear" : hoveredMannequin.part === "pants" ? "Denim" : "Footwear"} (+10)
                </span>
              </button>
            </div>
          </>
        ) : activeDisplayProduct ? (
          // 🏬 REGULAR PRODUCT INSPECTOR
          <>
            <div className="shrink-0 flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">
                  3D Product Inspector
                </h4>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                {activeDisplayProduct.category}
              </span>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0 custom-scrollbar my-2">
              {/* Product Visual & Details */}
              <div className="flex items-start gap-3 bg-stone-950/80 p-2.5 rounded-2xl border border-stone-800">
                <img
                  src={activeProductImg}
                  alt={activeDisplayProduct.name}
                  className="w-16 h-16 rounded-xl object-cover border border-amber-500/40 shrink-0 shadow-md"
                />
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-black text-white line-clamp-2">{activeDisplayProduct.name}</h5>
                  <p className="text-[10px] text-amber-300/90 font-mono mt-0.5">SKU: {activeDisplayProduct.sku}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs font-black text-orange-400">₹{activeDisplayProduct.price}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        activeDisplayProduct.stock > 10
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-rose-950 text-rose-400 border border-rose-800"
                      }`}
                    >
                      {activeDisplayProduct.stock} in stock
                    </span>
                  </div>
                </div>
              </div>

              {/* 📍 EXACT 3D DATABASE COORDINATES BADGE */}
              <div className="p-2.5 bg-stone-900/90 rounded-2xl border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>3D Showroom Location</span>
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      (activeProductCoords as any).isRelocated
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-400/20 text-amber-300"
                    }`}
                  >
                    {(activeProductCoords as any).isRelocated ? "Planogram Live ✓" : "DB Stored ✓"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                  <div className="bg-stone-950 p-1.5 rounded-lg border border-stone-800">
                    <span className="text-[9px] text-stone-400 block">X COORD</span>
                    <span className="text-xs font-bold text-sky-400">{activeProductCoords.x.toFixed(2)}m</span>
                  </div>
                  <div className="bg-stone-950 p-1.5 rounded-lg border border-stone-800">
                    <span className="text-[9px] text-stone-400 block">Y COORD</span>
                    <span className="text-xs font-bold text-emerald-400">{activeProductCoords.y.toFixed(2)}m</span>
                  </div>
                  <div className="bg-stone-950 p-1.5 rounded-lg border border-stone-800">
                    <span className="text-[9px] text-stone-400 block">Z COORD</span>
                    <span className="text-xs font-bold text-purple-400">{activeProductCoords.z.toFixed(2)}m</span>
                  </div>
                </div>

                <div className="text-[10px] space-y-1 pt-1 border-t border-stone-800 text-stone-300">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Cupboard / Zone:</span>
                    <span className="font-bold text-white truncate max-w-[170px]">{activeProductCoords.zone}</span>
                  </div>
                  {activeProductCoords.shelf && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400">Shelf Tier:</span>
                      <span className="font-semibold text-amber-300">
                        {activeProductCoords.shelf} (Slot #{activeProductCoords.slot || 1})
                      </span>
                    </div>
                  )}
                  {(activeProductCoords as any).swappedWith && (
                    <div className="p-1.5 mt-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[9px] text-amber-200">
                      <span className="font-bold block text-amber-300">⇄ Swapped With Mutual Partner:</span>
                      <span className="truncate block">{(activeProductCoords as any).swappedWith}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Button - Pinned */}
            <div className="shrink-0 pt-2 border-t border-amber-500/20 mt-auto">
              <button
                onClick={() => handleQuickRestock(activeDisplayProduct._id, activeDisplayProduct.stock)}
                disabled={actionLoading}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-stone-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Quick Restock (+10 units)</span>
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  };

  // 📱 REUSABLE FLOOR STAFF REAL-WORLD SWAP CHECKLIST CARD
  const renderFloorTasksCard = (onClose?: () => void) => {
    const hero = heroRunwayPairs[selectedSuggestionIdx] || heroRunwayPairs[0];

    const heroTasks = hero
      ? [
          {
            role: "jacket",
            roleLabel: "Outerwear (Jacket / Coat)",
            icon: "🧥",
            item: hero.outfit.jacket,
            targetZone: `${hero.badge} Mannequin Torso`,
            targetCoords: {
              x: hero.worldTargetPos.x,
              y: 1.74,
              z: hero.worldTargetPos.z,
              zone: `${hero.badge} Mannequin Torso`,
            },
            origLoc: hero.locations.jacket,
          },
          {
            role: "tshirt",
            roleLabel: "Topwear (Shirt / T-Shirt)",
            icon: "👔",
            item: hero.outfit.tshirt,
            targetZone: `${hero.badge} Inner Top`,
            targetCoords: {
              x: hero.worldTargetPos.x,
              y: 1.70,
              z: hero.worldTargetPos.z,
              zone: `${hero.badge} Inner Top`,
            },
            origLoc: hero.locations.tshirt,
          },
          {
            role: "pants",
            roleLabel: "Bottomwear (Trousers / Denim)",
            icon: "👖",
            item: hero.outfit.pants,
            targetZone: `${hero.badge} Mannequin Legs`,
            targetCoords: {
              x: hero.worldTargetPos.x,
              y: 0.8,
              z: hero.worldTargetPos.z,
              zone: `${hero.badge} Mannequin Legs`,
            },
            origLoc: hero.locations.pants,
          },
          {
            role: "shoes",
            roleLabel: "Footwear (Shoes / Boots)",
            icon: "👞",
            item: hero.outfit.shoes,
            targetZone: `${hero.badge} Pedestal`,
            targetCoords: {
              x: hero.worldTargetPos.x,
              y: 0.15,
              z: hero.worldTargetPos.z,
              zone: `${hero.badge} Pedestal`,
            },
            origLoc: hero.locations.shoes,
          },
        ].filter((t) => Boolean(t.item))
      : [];

    const cupboardTasks = swapPairs.map((pair, idx) => ({
      role: `suggested-${idx}`,
      roleLabel: `Mutual Pair #${idx + 1}`,
      icon: "⇄",
      item: pair.suggested,
      targetZone: `Beside ${fastMoverProduct?.name || "Fast Mover"} (${anchorShelfLoc.zone})`,
      targetCoords: {
        x: pair.neighbor.coordinates3D?.x ?? 0,
        y: pair.neighbor.coordinates3D?.y ?? 1.2,
        z: pair.neighbor.coordinates3D?.z ?? -3.5,
        zone: `Beside ${fastMoverProduct?.name || "Fast Mover"} in ${anchorShelfLoc.zone}`,
      },
      displaced: {
        item: pair.neighbor,
        targetCoords: {
          x: pair.suggested.coordinates3D?.x ?? 0,
          y: pair.suggested.coordinates3D?.y ?? 1.2,
          z: pair.suggested.coordinates3D?.z ?? 3.5,
          zone: `Donor Cupboard Shelf`,
        },
      },
      origLoc: getProductShelfLocation(pair.suggested),
    }));

    const activeTasks = swapMode === "hero_showcase" ? heroTasks : cupboardTasks;
    const unexecutedTasks = activeTasks.filter(
      (t) => !executedFloorItems[t.item._id] && !t.item.coordinates3D?.isRelocated
    );
    const executedTasksInStation = activeTasks.filter(
      (t) => Boolean(executedFloorItems[t.item._id] || t.item.coordinates3D?.isRelocated)
    );
    const isStationAllExecuted = activeTasks.length > 0 && unexecutedTasks.length === 0;

    const checkedCount = activeTasks.filter((t) => floorCheckedItems[t.item._id]).length;
    const allChecked = activeTasks.length > 0 && checkedCount === activeTasks.length;

    const toggleCheckItem = (id: string) => {
      setFloorCheckedItems((prev) => ({
        ...prev,
        [id]: !prev[id],
      }));
    };

    const toggleSelectAll = () => {
      setFloorCheckedItems((prev) => {
        const next = { ...prev };
        if (allChecked) {
          activeTasks.forEach((t) => delete next[t.item._id]);
        } else {
          activeTasks.forEach((t) => {
            next[t.item._id] = true;
          });
        }
        return next;
      });
    };

    return (
      <div
        className={`glass-panel rounded-3xl p-3.5 flex flex-col h-full shadow-2xl border border-amber-500/35 overflow-hidden ${
          onClose ? "bg-stone-950/95 h-full" : ""
        }`}
      >
        {/* Pinned Header */}
        <div className="shrink-0 flex items-center justify-between pb-2 border-b border-amber-500/20">
          <div className="flex items-center gap-1.5 min-w-0">
            <ClipboardCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">
              Floor Staff Live Checklist
            </h4>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
              Live DB Sync
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab switch between Planogram Strategy and Floor Checklist */}
        <div className="flex p-0.5 bg-stone-900/90 rounded-xl border border-amber-500/25 my-1.5 shrink-0">
          <button
            onClick={() => setStrategyTab("strategy")}
            className="flex-1 py-1 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer text-stone-300 hover:text-white"
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Planogram</span>
          </button>
          <button
            onClick={() => setStrategyTab("floor_tasks")}
            className="flex-1 py-1 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow"
          >
            <ClipboardCheck className="w-3 h-3 text-stone-950" />
            <span>⚡ Floor Tasks</span>
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 custom-scrollbar my-2">
          {/* Mode Switch: Mutual Cupboard vs Hero Runway */}
          <div className="flex p-1 bg-stone-950/90 rounded-2xl border border-amber-500/30 gap-1 text-[10px]">
            <button
              onClick={() => {
                setSwapMode("cupboard");
                setPlanogramApplied(false);
              }}
              className={`flex-1 py-1.5 px-2 rounded-xl font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                swapMode === "cupboard"
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow-md shadow-orange-500/30"
                  : "text-stone-300 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>🏬 Cupboard</span>
            </button>
            <button
              onClick={() => {
                setSwapMode("hero_showcase");
                setPlanogramApplied(false);
              }}
              className={`flex-1 py-1.5 px-2 rounded-xl font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                swapMode === "hero_showcase"
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow-md shadow-orange-500/30"
                  : "text-stone-300 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Hero Runway</span>
            </button>
          </div>

          {/* Station / Pair Selection Tabs */}
          {swapMode === "hero_showcase" ? (
            <div className="flex gap-1 p-1 bg-stone-950/80 rounded-xl border border-amber-500/25">
              {heroRunwayPairs.map((h, idx) => (
                <button
                  key={h.mannequinId}
                  onClick={() => {
                    hasUserSelectedRef.current = true;
                    setSelectedSuggestionIdx(idx);
                    onPairChange?.(idx);
                    setInspectedProduct(h.suggested);
                    focusCameraOnPosRef.current?.(h.worldTargetPos);
                  }}
                  className={`flex-1 py-1 px-1 rounded-lg text-[9px] font-black transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer ${
                    selectedSuggestionIdx === idx
                      ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow-md"
                      : "text-slate-300 hover:text-amber-200"
                  }`}
                >
                  <span className="truncate max-w-[80px]">{h.badge}</span>
                  <span className="text-[8px] opacity-80">{h.lift}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1 p-1 bg-stone-950/80 rounded-xl border border-amber-500/25">
              {suggestions.map((sug, idx) => (
                <button
                  key={sug.id}
                  onClick={() => {
                    hasUserSelectedRef.current = true;
                    setSelectedSuggestionIdx(idx);
                    onPairChange?.(idx);
                  }}
                  className={`flex-1 py-1 px-1 rounded-lg text-[9px] font-black transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer ${
                    selectedSuggestionIdx === idx
                      ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow-md"
                      : "text-slate-300 hover:text-amber-200"
                  }`}
                >
                  <span>Pair {idx + 1}</span>
                  <span className="text-[8px] opacity-80">{sug.lift}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Staff Notice Pill */}
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-200 flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <strong className="text-white">Ground Staff Action:</strong> Swap physical products on showroom racks/mannequins. Save 1 item or entire outfit to immediately fly the 3D model on the manager&apos;s laptop & update MongoDB coordinates!
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold px-1 text-stone-300">
              <span>{swapMode === "hero_showcase" ? "Full Outfit Wearables (4)" : "Mutual Swap Products"}</span>
              <button
                onClick={toggleSelectAll}
                className="text-amber-400 hover:text-amber-300 cursor-pointer text-[10px] font-black underline"
              >
                {allChecked ? "Deselect All" : "Select All"}
              </button>
            </div>

            {activeTasks.map((task) => {
              const isChecked = Boolean(floorCheckedItems[task.item._id]);
              const isExecuted = Boolean(
                executedFloorItems[task.item._id] || task.item.coordinates3D?.isRelocated
              );

              return (
                <div
                  key={task.item._id}
                  className={`p-2 rounded-2xl border transition-all text-[11px] space-y-1.5 ${
                    isExecuted
                      ? "bg-emerald-950/40 border-emerald-500/50"
                      : isChecked
                      ? "bg-amber-950/30 border-amber-400/80 shadow-md shadow-amber-500/10"
                      : "bg-stone-950/70 border-stone-800 hover:border-amber-500/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleCheckItem(task.item._id)}
                      className="p-1 rounded-lg text-amber-400 hover:text-white cursor-pointer shrink-0 transition-colors"
                      title={isChecked ? "Uncheck item" : "Check item for swap execution"}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-500" />
                      )}
                    </button>

                    {/* Thumbnail */}
                    <img
                      src={getProductImage(
                        task.item.category,
                        task.item.color,
                        task.item.name,
                        task.item.imageUrl
                      )}
                      alt={task.item.name}
                      className="w-10 h-10 rounded-lg object-cover border border-amber-500/40 shrink-0"
                    />

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                          {task.icon} {task.roleLabel}:
                        </span>
                      </div>
                      <h5 className="font-bold text-white text-xs truncate">{task.item.name}</h5>
                      <div className="flex items-center justify-between text-[10px] text-stone-400 mt-0.5">
                        <span className="font-mono text-stone-300">
                          {task.item.sku} • {task.item.color}
                        </span>
                        <span className="font-mono text-amber-300 font-bold">₹{task.item.price}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Route */}
                  <div className="text-[9px] text-stone-400 pl-7 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-stone-500 shrink-0">From:</span>
                      <span className="text-stone-300 truncate">
                        {task.origLoc?.zone || `${task.item.category} Cupboard`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-amber-400 shrink-0">To:</span>
                      <strong className="text-amber-200 truncate">{task.targetZone}</strong>
                    </div>
                  </div>

                  {/* Status & Quick Action Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-800/80 pl-7">
                    <div className="flex items-center gap-1">
                      {isExecuted ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/40">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>✓ Live Synced (In DB)</span>
                        </span>
                      ) : isChecked ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40 animate-pulse">
                          <span>Ready to Sync</span>
                        </span>
                      ) : (
                        <span className="text-[9px] text-stone-400">Pending Real Swap</span>
                      )}
                    </div>

                    {isExecuted ? (
                      <button
                        onClick={() => handleRevertFloorSwapItem(task)}
                        disabled={isSavingFloorSwap}
                        className="py-1 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 hover:text-white border border-rose-500/40 text-[9px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow disabled:opacity-50"
                        title="Reset this item back to original cupboard shelf in showroom & DB"
                      >
                        <RotateCcw className="w-2.5 h-2.5 text-rose-400" />
                        <span>🔄 Reset Item</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleExecuteFloorSwaps([task])}
                        disabled={isSavingFloorSwap}
                        className="py-1 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 hover:text-white border border-amber-500/40 text-[9px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow disabled:opacity-50"
                        title="Save this single item and trigger flight animation live on manager screen"
                      >
                        <Zap className="w-2.5 h-2.5 text-amber-400" />
                        <span>⚡ Save Item</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pinned Action Buttons - ALWAYS VISIBLE AT BOTTOM */}
        <div className="shrink-0 pt-2 border-t border-amber-500/20 mt-auto space-y-1.5">
          {isStationAllExecuted ? (
            <div className="space-y-1.5">
              <div className="w-full py-1.5 px-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-[10px] text-emerald-300 font-bold flex items-center justify-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>All {activeTasks.length} Station Items Deployed & Synced to DB</span>
              </div>
              <button
                onClick={handleRevertActiveStation}
                disabled={isSavingFloorSwap}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:brightness-110 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSavingFloorSwap ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting Station in DB...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>🔄 Reset Station (Revert All {activeTasks.length} to Shelves)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={() => {
                  const unexecutedChecked = activeTasks.filter(
                    (t) =>
                      floorCheckedItems[t.item._id] &&
                      !executedFloorItems[t.item._id] &&
                      !t.item.coordinates3D?.isRelocated
                  );
                  handleExecuteFloorSwaps(
                    unexecutedChecked.length > 0 ? unexecutedChecked : unexecutedTasks
                  );
                }}
                disabled={isSavingFloorSwap || unexecutedTasks.length === 0}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-stone-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSavingFloorSwap ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Store DB & Synching Live...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {checkedCount > 0
                        ? `⚡ Save ${checkedCount} Checked Swap(s) to Showroom`
                        : `⚡ Save ${unexecutedTasks.length} Unsaved Swaps (Live Sync)`}
                    </span>
                  </>
                )}
              </button>

              {executedTasksInStation.length > 0 && (
                <button
                  onClick={handleRevertActiveStation}
                  disabled={isSavingFloorSwap}
                  className="w-full py-1.5 px-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-rose-300 hover:text-white border border-rose-500/30 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3 text-rose-400" />
                  <span>Reset Station ({executedTasksInStation.length} currently deployed)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 📱 REUSABLE STRATEGY CARD (SHARED BETWEEN DESKTOP SIDE PANEL & MOBILE BOTTOM DRAWER)
  const renderStrategyCard = (onClose?: () => void) => {
    if (strategyTab === "floor_tasks") {
      return renderFloorTasksCard(onClose);
    }

    return (
      <div
        className={`glass-panel rounded-3xl p-3.5 flex flex-col h-full shadow-2xl border border-amber-500/35 overflow-hidden ${
          onClose ? "bg-stone-950/95 h-full" : ""
        }`}
      >
        {/* Pinned Header */}
        <div className="shrink-0 flex items-center justify-between pb-2 border-b border-amber-500/20">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Planogram Strategy</h4>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
              {swapMode === "hero_showcase" ? "3 Hero Stations" : `${swapPairs.length} Mutual Pairs`}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab switch between Planogram Strategy and Floor Checklist */}
        <div className="flex p-0.5 bg-stone-900/90 rounded-xl border border-amber-500/25 my-1.5 shrink-0">
          <button
            onClick={() => setStrategyTab("strategy")}
            className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
              strategyTab === "strategy"
                ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow"
                : "text-stone-300 hover:text-white"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Planogram</span>
          </button>
          <button
            onClick={() => setStrategyTab("floor_tasks")}
            className="flex-1 py-1 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer text-stone-300 hover:text-white"
          >
            <ClipboardCheck className="w-3 h-3 text-amber-400" />
            <span>⚡ Floor Tasks</span>
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0 custom-scrollbar my-2">
          {/* Strategy Mode Buttons */}
          <div className="flex p-1 bg-stone-950/90 rounded-2xl border border-amber-500/30 gap-1 text-[10px]">
            <button
              onClick={() => {
                setSwapMode("cupboard");
                setPlanogramApplied(false);
              }}
              className={`flex-1 py-1.5 px-2 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                swapMode === "cupboard"
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow-md shadow-orange-500/30"
                  : "text-stone-300 hover:text-white"
              }`}
              title="Neighbor products swap with cross-sell suggestions in individual slots"
            >
              <Store className="w-3.5 h-3.5" />
              <span>🏬 Mutual Cupboard Swap</span>
            </button>
            <button
              onClick={() => {
                setSwapMode("hero_showcase");
                setPlanogramApplied(false);
              }}
              className={`flex-1 py-1.5 px-2 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                swapMode === "hero_showcase"
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow-md shadow-orange-500/30"
                  : "text-stone-300 hover:text-white"
              }`}
              title="Promote high-affinity pair to center stage Hero Runway"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Hero Runway</span>
            </button>
          </div>

          {/* Recommendation Tabs */}
          <div className="space-y-1.5">
            {swapMode === "hero_showcase" ? (
              /* 3 Hero Runway Station Tabs */
              <div className="flex gap-1 p-1 bg-stone-950/80 rounded-xl border border-amber-500/25">
                {heroRunwayPairs.map((hero, idx) => (
                  <button
                    key={hero.mannequinId}
                    onClick={() => {
                      hasUserSelectedRef.current = true;
                      setSelectedSuggestionIdx(idx);
                      onPairChange?.(idx);
                      setPlanogramApplied(false);
                      setInspectedProduct(hero.suggested);
                      focusCameraOnPosRef.current?.(hero.worldTargetPos);
                    }}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-[9px] font-black transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer ${
                      selectedSuggestionIdx === idx
                        ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow-md shadow-orange-500/30"
                        : "text-slate-300 hover:text-amber-200"
                    }`}
                  >
                    <span className="truncate max-w-[80px]">{hero.badge}</span>
                    <span className="text-[8px] opacity-80">{hero.lift}</span>
                  </button>
                ))}
              </div>
            ) : (
              /* 5 Cupboard Pair Tabs */
              <div className="flex gap-1 p-1 bg-stone-950/80 rounded-xl border border-amber-500/25">
                {suggestions.map((sug, idx) => (
                  <button
                    key={sug.id}
                    onClick={() => {
                      hasUserSelectedRef.current = true;
                      setSelectedSuggestionIdx(idx);
                      onPairChange?.(idx);
                      setPlanogramApplied(false);
                    }}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-[9px] font-black transition-all text-center flex flex-col items-center gap-0.5 cursor-pointer ${
                      selectedSuggestionIdx === idx
                        ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 shadow-md shadow-orange-500/30"
                        : "text-slate-300 hover:text-amber-200"
                    }`}
                  >
                    <span>Pair {idx + 1}</span>
                    <span className="text-[8px] opacity-80">{sug.lift}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-stone-900/90 border border-amber-500/30 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <span className="font-extrabold text-amber-300 block truncate">
                  {swapMode === "cupboard"
                    ? `Anchor: ${anchorShelfLoc.zone}`
                    : `Grand Runway Stage: 3 VIP Mannequin Stations`}
                </span>
                <span className="text-[9px] text-stone-400 block truncate">
                  {swapMode === "hero_showcase"
                    ? "3 Outfits Promoted from Cupboards to Grand Runway Stage"
                    : `${swapPairs.length} mutual 1-to-1 swap pairs active`}
                </span>
              </div>
            </div>
          </div>

          {/* Active Pair Details */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-white">
              <span className="truncate font-black">
                {swapMode === "hero_showcase"
                  ? `${heroRunwayPairs[selectedSuggestionIdx]?.badge || "🌟 HERO"}: ${heroRunwayPairs[selectedSuggestionIdx]?.stationName || activeSuggestion?.title || "Runway VIP"}`
                  : activeSuggestion?.title || "VIP Showcase"}
              </span>
              <span className="text-amber-400 font-black shrink-0 text-xs">
                {swapMode === "hero_showcase"
                  ? `${heroRunwayPairs[selectedSuggestionIdx]?.lift || activeSuggestion?.lift || "+82%"} Lift`
                  : `${activeSuggestion?.lift || "+82%"} Lift`}
              </span>
            </div>

            {/* 🔄 RECOMMENDATIONS LIST (HERO RUNWAY 3 STATIONS vs MUTUAL CUPBOARD SWAPS) */}
            {swapMode === "hero_showcase" ? (
              <div className="space-y-1.5">
                <span className="text-[9px] uppercase font-bold text-amber-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Center Runway Showcase (3 Stations):</span>
                  </span>
                  <span className="text-amber-400 font-mono text-[8px] bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                    3 VIP STATIONS
                  </span>
                </span>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {heroRunwayPairs.map((hero) => {
                    const isSelected = selectedSuggestionIdx === hero.index;
                    const outfitItems = [
                      { role: "Outerwear", icon: "🧥", item: hero.outfit.jacket, loc: hero.locations.jacket },
                      { role: "Topwear", icon: "👔", item: hero.outfit.tshirt, loc: hero.locations.tshirt },
                      { role: "Bottomwear", icon: "👖", item: hero.outfit.pants, loc: hero.locations.pants },
                      { role: "Footwear", icon: "👞", item: hero.outfit.shoes, loc: hero.locations.shoes },
                    ];
                    const outfitTotal = outfitItems.reduce((acc, o) => acc + (o.item?.price || 0), 0);

                    return (
                      <div
                        key={hero.mannequinId}
                        onClick={() => {
                          hasUserSelectedRef.current = true;
                          setSelectedSuggestionIdx(hero.index);
                          onPairChange?.(hero.index);
                          setPlanogramApplied(false);
                          if (hero.suggested) setInspectedProduct(hero.suggested);
                          focusCameraOnPosRef.current?.(hero.worldTargetPos);
                        }}
                        className={`p-2 rounded-xl bg-stone-950/80 border transition-all cursor-pointer text-[10px] space-y-1.5 shadow-sm group ${
                          isSelected
                            ? "border-amber-400 bg-stone-900/95 ring-1 ring-amber-400/40"
                            : "border-amber-500/30 hover:border-amber-400/80 hover:bg-stone-900/70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: hero.colorCss }}
                            />
                            <span className="font-extrabold text-amber-300 text-[10px]">{hero.badge}</span>
                            <span className="text-stone-400 text-[9px] truncate">
                              ({(hero.stationName || "").split(":")[1]?.trim() || hero.stationName || "Runway"})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-mono text-amber-300 font-bold">
                              ₹{outfitTotal}
                            </span>
                            <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                              {hero.lift} Lift
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          /* Full 4-piece Head-to-Toe Outfit Details */
                          <div className="space-y-1 pt-1 border-t border-amber-500/20">
                            <span className="text-[8px] font-extrabold uppercase tracking-wider text-amber-400 block">
                              Complete 4-Piece Runway Ensemble:
                            </span>
                            <div className="grid grid-cols-1 gap-1">
                              {outfitItems.map((piece, pIdx) => (
                                <div
                                  key={pIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (piece.item) setInspectedProduct(piece.item);
                                  }}
                                  className="flex items-center justify-between p-1 rounded-lg bg-stone-900/80 border border-stone-800 hover:border-amber-400/60 transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-[11px] shrink-0">{piece.icon}</span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className="text-[8px] font-bold text-amber-400/80 uppercase">
                                          {piece.role}:
                                        </span>
                                        <span className="font-bold text-white text-[9px] truncate max-w-[130px]">
                                          {piece.item?.name || "Product"}
                                        </span>
                                      </div>
                                      <span className="text-[8px] text-stone-400 truncate block">
                                        From <strong className="text-stone-300">{piece.loc?.zone || "Cupboard"}</strong>
                                      </span>
                                    </div>
                                  </div>
                                  <span className="font-mono text-amber-300 text-[9px] font-bold shrink-0 ml-1">
                                    {piece.item?.price ? `₹${piece.item.price}` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* Collapsed Summary */
                          <div className="pl-3 border-l-2 border-amber-500/40 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white group-hover:text-amber-200 truncate max-w-[170px]">
                                🧥 {hero.outfit.jacket?.name || "Runway Outerwear"}
                              </span>
                              <span className="text-[8px] text-amber-300/80 font-mono">
                                +3 pieces
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="text-[9px] uppercase font-bold text-stone-400 flex items-center justify-between">
                  <span>Mutual Multi-Product Swaps (1-to-1):</span>
                  <span className="text-amber-400 font-mono text-[8px]">NO OVERLAPS</span>
                </span>

                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {swapPairs.map((pair, pIdx) => (
                    <div
                      key={pair.suggested?._id ? `${pair.suggested._id}-${pair.neighbor?._id || pIdx}` : `pair-${pIdx}`}
                      onClick={() => pair.suggested && setInspectedProduct(pair.suggested)}
                      className="p-1.5 rounded-xl bg-stone-950/70 border border-stone-800 hover:border-amber-400/80 transition-colors cursor-pointer text-[10px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pair.colorCss }} />
                          <span className="font-bold text-white truncate max-w-[170px]">
                            {pair.suggested?.name || "Product"}
                          </span>
                        </div>
                        <span className="font-mono text-amber-300 shrink-0 font-bold">
                          {pair.suggested?.price ? `₹${pair.suggested.price}` : ""}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-[9px] text-stone-400 pl-3">
                        <div className="flex items-center gap-1">
                          <ArrowRightLeft className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span className="truncate text-stone-300">
                            Moves beside <strong className="text-amber-200">{fastMoverProduct?.name || "Fast Mover"}</strong> in {anchorShelfLoc.zone}
                          </span>
                        </div>
                        <div className="text-[8px] text-stone-400 truncate">
                          ⇄ Displaced: <span className="text-stone-300">{pair.neighbor?.name || "Neighbor Slot"}</span> moves to donor shelf
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-200 leading-relaxed bg-stone-950/70 p-2 rounded-xl border border-stone-800 font-medium">
              {swapMode === "hero_showcase"
                ? (heroRunwayPairs[selectedSuggestionIdx]?.rationale || activeSuggestion?.rationale || "Center runway showcase pairing.")
                : (activeSuggestion?.rationale || "Velocity planogram recommendation.")}
            </p>
          </div>
        </div>

        {/* Pinned Action Buttons - ALWAYS VISIBLE AT BOTTOM */}
        <div className="shrink-0 pt-2 border-t border-amber-500/20 mt-auto space-y-1.5">
          {planogramApplied ? (
            <>
              <div className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500/20 via-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black flex items-center justify-center gap-1.5 shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Planogram Active ({activeSuggestion.lift} Lift) ✓</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={handleReplaySwap}
                  disabled={actionLoading}
                  className="py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border border-amber-500/40"
                  title="Watch products fly across showroom again"
                >
                  <Play className="w-3 h-3 text-amber-400" />
                  <span>Replay Flight</span>
                </button>
                <button
                  onClick={handleResetPlanogram}
                  disabled={actionLoading}
                  className="py-1.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border border-stone-700"
                >
                  <RotateCw className="w-3 h-3 text-amber-400" />
                  <span>Reset Baseline</span>
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleApplyPlanogram}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-stone-950 shadow-orange-500/25 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Planogram in 3D Showroom</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={visualizerRootRef}
      style={
        isForcedRotate90
          ? {
              position: "fixed",
              top: 0,
              left: "100%",
              width: "100vh",
              height: "100vw",
              transform: "rotate(90deg)",
              transformOrigin: "top left",
              zIndex: 99999,
            }
          : isMobileLandscape
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 99999,
            }
          : undefined
      }
      className={`relative w-full rounded-3xl overflow-hidden bg-slate-900 border border-[#E5D7BE] shadow-2xl transition-all duration-300 isolate ${
        isFullScreen || isMobileLandscape || isForcedRotate90
          ? "fixed inset-0 z-[100] rounded-none border-none"
          : isHorizontalMode
          ? "h-[500px] sm:h-[620px] lg:h-[720px] z-10"
          : "h-[560px] sm:h-[680px] lg:h-[740px] z-10"
      }`}
    >
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 📱 MOBILE LANDSCAPE FLOATING CONTROL PILL */}
      {(isMobileLandscape || isForcedRotate90) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-2">
          <div className="glass-panel px-3.5 py-1.5 rounded-full flex items-center gap-2.5 border border-amber-400 shadow-2xl bg-stone-950/95 text-xs font-black text-amber-300">
            <span className="flex items-center gap-1.5 text-white">
              <Smartphone className="w-4 h-4 text-amber-400 rotate-90 animate-pulse" />
              <span>Landscape Runway</span>
            </span>
            <button
              onClick={() => setIsForcedRotate90((prev) => !prev)}
              className="px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-bold border border-amber-500/40 cursor-pointer"
            >
              🔄 {isForcedRotate90 ? "Normal" : "Force 90°"}
            </button>
            <button
              onClick={handleToggleMobileLandscape}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-extrabold shadow cursor-pointer transition-all"
            >
              <X className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      )}

      {/* 🌟 1. TOP HEADER BAR: STORE BRANDING, 3D SCOPE SEARCH & CONTROLS */}
      <div className="absolute top-3 left-2 sm:left-4 right-2 sm:right-4 z-20 flex items-center justify-between gap-1.5 sm:gap-2.5 pointer-events-none">
        {/* Left: Department Store Badge */}
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="glass-panel px-2.5 sm:px-3 py-1.5 rounded-2xl flex items-center gap-2 pointer-events-auto border border-amber-500/35 shadow-2xl shrink-0"
        >
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-stone-950 font-black text-xs shadow-md shadow-amber-500/25 shrink-0">
            VR
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-white drop-shadow-sm whitespace-nowrap">
                VELOCITY <span className="hidden xl:inline">SHOWROOM</span>
              </h3>
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            </div>
            <p className="text-[9px] text-amber-300 font-semibold drop-shadow-sm hidden 2xl:block whitespace-nowrap">
              5 Cupboards • 60 Live SKUs
            </p>
          </div>
        </div>

        {/* 🎯 CENTER: PRODUCT SEARCH BAR WITH 3D SCOPE POINTER TARGETING */}
        <div
          ref={searchContainerRef}
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="relative pointer-events-auto flex-1 min-w-[70px] max-w-[130px] sm:max-w-xs md:max-w-sm z-30"
        >
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 sm:left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search..."
              className="w-full glass-search-input text-white placeholder-amber-200/75 pl-7 sm:pl-9 pr-6 sm:pr-8 py-1.5 sm:py-2 rounded-2xl text-[11px] sm:text-xs focus:outline-none transition-all font-semibold"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 p-1 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer drop-shadow"
                title="Clear Search & Scope Pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown with Unified Luxury Glassmorphism */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 max-h-72 overflow-y-auto rounded-2xl glass-panel p-1.5 space-y-1 shadow-2xl border border-amber-500/35 custom-scrollbar z-50">
              <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between border-b border-stone-800">
                <span>Matching Products ({searchResults.length})</span>
                <span className="text-stone-400 font-semibold">Click to lock 3D Scope</span>
              </div>
              {searchResults.map((prod) => (
                <div
                  key={prod._id}
                  onClick={() => handleSelectSearchedProduct(prod)}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30 transition-all cursor-pointer group"
                >
                  <img
                    src={getProductImage(prod.category, prod.color, prod.name, prod.imageUrl)}
                    alt={prod.name}
                    className="w-9 h-9 rounded-lg object-cover border border-amber-500/40 shrink-0 shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate">{prod.name}</p>
                      <span className="text-[10px] font-bold text-amber-400 font-mono ml-2 shrink-0">₹{prod.price}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400">
                      <span className="font-mono text-stone-300 font-semibold">{prod.sku}</span>
                      <span>•</span>
                      <span className="text-amber-400/90 font-semibold">{prod.category}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-bold">{prod.stock} in stock</span>
                    </div>
                  </div>
                  <Crosshair className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Controls (Always visible, shrink-0 prevents truncation) */}
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0"
        >
          <div className="shrink-0 hidden 2xl:block">
            <ShowroomClock />
          </div>

          {/* Toggle Sidebar Overlay Button (Desktop) */}
          <button
            onClick={() => setIsOverlayVisible((prev) => !prev)}
            className={`hidden md:flex px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5 transition-all border shrink-0 ${
              isOverlayVisible
                ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 border-amber-400 shadow-lg shadow-orange-500/30 font-black"
                : "glass-panel text-amber-200 border-amber-500/40 hover:text-white"
            }`}
            title={isOverlayVisible ? "Hide overlay to view full 3D showroom" : "Show Product & Strategy Overlay"}
          >
            {isOverlayVisible ? <EyeOff className="w-3.5 h-3.5 text-amber-300 shrink-0" /> : <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            <span className="hidden xl:inline">{isOverlayVisible ? "Hide Overlay" : "Show Overlay"}</span>
          </button>

          {/* 📱 360° Horizontal Runway Mode Button */}
          <button
            onClick={toggleHorizontalView}
            className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shrink-0 ${
              isHorizontalMode
                ? "bg-amber-500 text-stone-950 border-amber-400 shadow-lg shadow-amber-500/30 font-black"
                : "glass-panel text-amber-200 border-amber-500/40 hover:text-white"
            }`}
            title={isHorizontalMode ? "Switch to 360° Free Orbit" : "Focus on 3-Station Horizontal Runway View"}
          >
            <Smartphone className="w-3.5 h-3.5 rotate-90 shrink-0" />
            <span className="hidden 2xl:inline">{isHorizontalMode ? "360°" : "Runway"}</span>
          </button>

          {/* Auto Rotate Button */}
          <button
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`p-1.5 sm:p-2 rounded-xl transition-all border shrink-0 ${
              autoRotate
                ? "bg-amber-500/25 border-amber-500/70 text-amber-300 shadow-md shadow-amber-500/20"
                : "glass-panel text-slate-300 border-amber-500/30 hover:text-white"
            }`}
            title="Toggle Auto Orbit"
          >
            <RotateCw className={`w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0 ${autoRotate ? "animate-spin text-amber-400" : ""}`} />
          </button>

          {/* Zoom Controls (Hidden on small screens) */}
          <div className="hidden lg:flex items-center glass-panel rounded-xl border border-amber-500/30 p-0.5 shadow-sm shrink-0">
            <button
              onClick={() => zoomControlRef.current.zoomIn()}
              className="p-1 sm:p-1.5 rounded-lg text-slate-200 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-stone-700/60" />
            <button
              onClick={() => zoomControlRef.current.zoomOut()}
              className="p-1 sm:p-1.5 rounded-lg text-slate-200 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-stone-700/60" />
            <button
              onClick={() => zoomControlRef.current.resetView()}
              className="p-1 sm:p-1.5 rounded-lg text-slate-200 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
              title="Reset View (⟲)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 🌟 FULLSCREEN BUTTON - GUARANTEED 100% VISIBLE WITH GLOWING AMBER ACCENT */}
          <button
            onClick={toggleFullScreen}
            className={`p-1.5 sm:p-2 rounded-xl transition-all shadow-lg cursor-pointer shrink-0 border ${
              isFullScreen
                ? "bg-amber-500 text-stone-950 border-amber-300 font-bold shadow-amber-500/30 ring-2 ring-amber-400/50"
                : "glass-panel text-amber-300 hover:text-white border-amber-500/60 hover:border-amber-400 hover:bg-amber-500/20"
            }`}
            title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullScreen ? (
              <Minimize2 className="w-4 h-4 shrink-0 text-stone-950" />
            ) : (
              <Maximize2 className="w-4 h-4 shrink-0 text-amber-300" />
            )}
          </button>
        </div>
      </div>

      {/* 📱 HORIZONTAL RUNWAY MODE NOTIFICATION PILL */}
      {isHorizontalMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="glass-panel px-3.5 py-1.5 rounded-full flex items-center gap-2 border border-amber-500/50 shadow-xl bg-stone-950/90 text-[11px] font-black text-amber-300">
            <Smartphone className="w-3.5 h-3.5 rotate-90 text-amber-400 shrink-0" />
            <span>3-Station Horizontal Runway View Active</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* 🌟 2. LEFT SIDE OVERLAY: PRODUCT DETAIL & EXACT 3D COORDINATES ON HOVER (DESKTOP) */}
      {isOverlayVisible && (hoveredMannequin || activeDisplayProduct) && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute top-16 left-4 bottom-14 z-10 w-84 max-w-[350px] pointer-events-auto hidden lg:flex flex-col animate-in fade-in slide-in-from-left duration-200"
        >
          {renderInspectorCard()}
        </div>
      )}

      {/* 🌟 3. RIGHT SIDE OVERLAY: AI MERCHANDISING STRATEGY & NEON LINES (DESKTOP) */}
      {isOverlayVisible && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute top-16 right-4 bottom-14 z-10 w-84 max-w-[345px] pointer-events-auto hidden lg:flex flex-col animate-in fade-in slide-in-from-right duration-200"
        >
          {renderStrategyCard()}
        </div>
      )}

      {/* 📱 MOBILE OVERLAYS & SLIDE-UP DRAWERS (STAFF TABLET & MOBILE FRIENDLY) */}
      {/* Mobile Drawer Backdrop (Light blur so 3D background is visible) */}
      {mobileDrawer !== "none" && (
        <div
          onClick={() => setMobileDrawer("none")}
          className="lg:hidden absolute inset-0 z-40 bg-black/35 backdrop-blur-[2px] pointer-events-auto animate-in fade-in duration-200"
        />
      )}

      {/* Mobile Inspector Drawer (Right-docked, 3D showroom visible on left, full height) */}
      {mobileDrawer === "inspect" && (
        <div className="lg:hidden absolute right-2 sm:right-3 top-14 bottom-16 z-50 w-[88vw] max-w-[340px] sm:max-w-[360px] flex flex-col pointer-events-auto shadow-2xl animate-in slide-in-from-right duration-250">
          {renderInspectorCard(() => setMobileDrawer("none"))}
        </div>
      )}

      {/* Mobile Planogram Strategy Drawer (Right-docked, 3D showroom visible on left, full height) */}
      {mobileDrawer === "strategy" && (
        <div className="lg:hidden absolute right-2 sm:right-3 top-14 bottom-16 z-50 w-[88vw] max-w-[340px] sm:max-w-[360px] flex flex-col pointer-events-auto shadow-2xl animate-in slide-in-from-right duration-250">
          {renderStrategyCard(() => setMobileDrawer("none"))}
        </div>
      )}

      {/* Mobile Floor Staff Real-World Swap Tasks Drawer (Right-docked, 3D showroom visible on left, full height) */}
      {mobileDrawer === "tasks" && (
        <div className="lg:hidden absolute right-2 sm:right-3 top-14 bottom-16 z-50 w-[88vw] max-w-[340px] sm:max-w-[360px] flex flex-col pointer-events-auto shadow-2xl animate-in slide-in-from-right duration-250">
          {renderFloorTasksCard(() => setMobileDrawer("none"))}
        </div>
      )}

      {/* 📱 MOBILE QUICK ACTION BOTTOM DOCK FOR FLOOR STAFF */}
      <div className="lg:hidden absolute bottom-2.5 left-2 sm:left-3 right-2 sm:right-3 z-30 flex items-center justify-between gap-1 p-1 rounded-2xl glass-panel border border-amber-500/40 bg-stone-950/90 shadow-2xl pointer-events-auto">
        <button
          onClick={() => setMobileDrawer(mobileDrawer === "inspect" ? "none" : "inspect")}
          className={`flex-1 py-1.5 px-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all border ${
            mobileDrawer === "inspect" || (activeDisplayProduct && mobileDrawer === "none")
              ? "bg-amber-500/25 border-amber-500/70 text-amber-300"
              : "border-stone-800 text-stone-300 hover:text-white"
          }`}
        >
          <Search className="w-3 h-3 text-amber-400" />
          <span className="truncate">
            {hoveredMannequin ? hoveredMannequin.badge : activeDisplayProduct ? "Item" : "Inspect"}
          </span>
        </button>

        <button
          onClick={() => setMobileDrawer(mobileDrawer === "strategy" ? "none" : "strategy")}
          className={`flex-1 py-1.5 px-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all border ${
            mobileDrawer === "strategy"
              ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 border-amber-400 shadow-md font-black"
              : planogramApplied
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
              : "border-amber-500/40 text-amber-300 bg-amber-500/10"
          }`}
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Plan</span>
        </button>

        <button
          onClick={() => setMobileDrawer(mobileDrawer === "tasks" ? "none" : "tasks")}
          className={`flex-1 py-1.5 px-1.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all border ${
            mobileDrawer === "tasks"
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 border-amber-300 shadow font-black"
              : "border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
          }`}
          title="Floor Staff Real-World Swap Checklist"
        >
          <ClipboardCheck className="w-3 h-3 text-amber-400" />
          <span>⚡ Tasks</span>
        </button>

        {/* 📱 Mobile Landscape 3D View / Rotate Button */}
        <button
          onClick={handleToggleMobileLandscape}
          className={`py-1.5 px-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all border shrink-0 ${
            isMobileLandscape || isForcedRotate90
              ? "bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-500/30 font-black"
              : "border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
          }`}
          title="Rotate to Landscape 3D Runway View"
        >
          <RotateCw className="w-3 h-3 text-amber-400" />
          <span>{isMobileLandscape || isForcedRotate90 ? "Exit" : "3D Land"}</span>
        </button>

        {/* Fullscreen Button for Mobile */}
        <button
          onClick={toggleFullScreen}
          className={`p-1.5 rounded-xl text-slate-200 hover:text-white border border-amber-500/30 transition-all shadow-md cursor-pointer shrink-0 ${
            isFullScreen ? "bg-amber-500 text-stone-950 border-amber-400" : "bg-stone-900/80"
          }`}
          title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3 text-amber-300" />}
        </button>
      </div>

      {/* 🌟 4. BOTTOM STATUS TICKER */}
      <div className="absolute bottom-3 left-4 right-4 z-10 hidden lg:flex items-center justify-between pointer-events-none text-[10px] text-stone-400">
        <div className="glass-panel px-3 py-1 rounded-xl pointer-events-auto flex items-center gap-2 border border-amber-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Interactive 3D Showroom: Hover any of the 60 items to inspect 3D DB coordinates</span>
        </div>
        <div className="glass-panel px-3 py-1 rounded-xl pointer-events-auto hidden sm:flex items-center gap-2 border border-amber-500/20">
          <span>Orbit: Click + Drag • Zoom: Scroll Wheel • Pan: Right Click</span>
        </div>
      </div>
    </div>
  );
};

export default Store3DVisualizer;
