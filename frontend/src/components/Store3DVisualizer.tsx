import React, { useEffect, useRef, useState, useCallback } from "react";
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
  UserCheck,
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
  id?: string;
  pairIndex?: number;
  pairNumber?: number;
  pairType?: "hero_runway" | "cupboard_bay";
  stationBadge?: string;
  stationName?: string;
  department?: string;
  lift?: string;
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
  initialSwapMode?: SwapMode;
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
    <div className="h-9 glass-panel px-3 rounded-xl hidden sm:flex items-center gap-1.5 text-xs text-amber-300 border border-amber-500/30">
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
  initialSwapMode,
  onPairChange,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const catalogProducts = useSelector((state: RootState) => state.products.items);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const canManageShowroom = currentUser?.role === "admin" || currentUser?.role === "manager";

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
  const [mobileDrawer, setMobileDrawer] = useState<"none" | "search" | "inspect" | "strategy" | "tasks">("none");
  const [mobileSearchDept, setMobileSearchDept] = useState<string>("All");
  const [strategyTab, setStrategyTab] = useState<"strategy" | "floor_tasks">("strategy");
  const [floorCheckedItems, setFloorCheckedItems] = useState<Record<string, boolean>>({});
  const [executedFloorItems, setExecutedFloorItems] = useState<Record<string, boolean>>({});
  const [floorSwapStaffMap, setFloorSwapStaffMap] = useState<Record<string, { staffName: string; timestamp?: string }>>({});
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
  const [swapMode, setSwapMode] = useState<SwapMode>(initialSwapMode || "cupboard");
  const [planogramApplied, setPlanogramApplied] = useState(false);
  const planogramAppliedRef = useRef(false);
  useEffect(() => {
    planogramAppliedRef.current = planogramApplied;
  }, [planogramApplied]);

  const [actionLoading, setActionLoading] = useState(false);
  const [isSwapAnimating, setIsSwapAnimating] = useState(false);
  const isSwapAnimatingRef = useRef(false);
  useEffect(() => {
    isSwapAnimatingRef.current = isSwapAnimating;
  }, [isSwapAnimating]);

  const strategyTabRef = useRef(strategyTab);
  useEffect(() => {
    strategyTabRef.current = strategyTab;
  }, [strategyTab]);

  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const triggerFlightAnimationRef = useRef<((forward?: boolean, specificProductIds?: string[]) => void) | null>(null);
  const snapToAppliedPositionsRef = useRef<(() => void) | null>(null);
  const executedFloorItemsRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    executedFloorItemsRef.current = executedFloorItems;
  }, [executedFloorItems]);
  const selectedSuggestionIdxRef = useRef(selectedSuggestionIdx);
  const rebuildGuideRoutesRef = useRef<((idx: number) => void) | null>(null);
  useEffect(() => {
    selectedSuggestionIdxRef.current = selectedSuggestionIdx;
    rebuildGuideRoutesRef.current?.(selectedSuggestionIdx);
  }, [selectedSuggestionIdx]);

  // Search Bar & 3D Scope Pointer States
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchedProduct, setSearchedProduct] = useState<Product | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const focusCameraOnPosRef = useRef<((pos: THREE.Vector3) => void) | null>(null);
  const scopePointerGroupRef = useRef<THREE.Group | null>(null);
  const scopedTargetProductIdRef = useRef<string | null>(null);
  const updateScopeSignRef = useRef<((title: string, subtitle?: string) => void) | null>(null);
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


  // Sync external selectedPairIndex and initialSwapMode
  useEffect(() => {
    if (selectedPairIndex !== undefined && selectedPairIndex !== selectedSuggestionIdx) {
      hasUserSelectedRef.current = true;
      setSelectedSuggestionIdx(selectedPairIndex);
      setPlanogramApplied(false);
    }
    if (initialSwapMode && initialSwapMode !== swapMode) {
      setSwapMode(initialSwapMode);
    }
  }, [selectedPairIndex, initialSwapMode]);

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

  // Dynamic AI Planogram Suggestions (Balanced across all 5 Showroom Cupboards / Departments)
  const suggestions = React.useMemo(() => {
    const fbAnchor = jackets[0] || catalogProducts[0] || defaultFallbackAnchor;
    const fbPartner = jeans[0] || catalogProducts[1] || defaultFallbackPartner;

    const curatedDefaultPairs = [
      {
        id: "sug-1",
        title: "Executive Outerwear + Contrast Denim Ensemble",
        dept: "Savile Row Outerwear",
        category: "Jackets",
        lift: "+84%",
        anchor: jackets.find((j) => j.color === "Beige" && j.name.includes("Cashmere")) || jackets[1] || jackets[0] || fbAnchor,
        partner: jeans.find((j) => j.color === "Black" && j.name.includes("Tailored Slim")) || jeans[1] || jeans[0] || fbPartner,
        similarProducts: [
          jeans.find((j) => j.color === "Black" && j.name.includes("Tailored Slim")) || jeans[1] || jeans[0] || fbPartner,
          shirts.find((s) => s.name.includes("Oxford") || s.color === "White") || shirts[0] || fbAnchor,
          tshirts.find((t) => t.color === "White" || t.name.includes("Crewneck")) || tshirts[0] || fbAnchor,
          shoes.find((s) => s.name.includes("Monk") || s.name.includes("Derby") || s.name.includes("Loafer")) || shoes[0] || fbPartner,
        ].filter(Boolean) as Product[],
        rationale: "High-contrast full-outfit pairing (Outerwear + Denim + Oxford + Shoes) lifts basket size by 84%.",
      },
      {
        id: "sug-2",
        title: "Royal Oxford Shirt + Handcrafted Loafers",
        dept: "Royal Oxford Wardrobe",
        category: "Shirts",
        lift: "+76%",
        anchor: shirts.find((s) => s.name.includes("Oxford") || s.color === "White") || shirts[0] || fbAnchor,
        partner: shoes.find((s) => s.name.includes("Loafer") || s.name.includes("Oxford")) || shoes[0] || fbPartner,
        similarProducts: [
          shoes.find((s) => s.name.includes("Loafer") || s.name.includes("Oxford")) || shoes[0] || fbPartner,
          jeans.find((j) => j.color === "Navy" || j.name.includes("Selvedge")) || jeans[0] || fbPartner,
          jackets.find((j) => j.name.includes("Blazer") || j.color === "Navy") || jackets[0] || fbAnchor,
          tshirts.find((t) => t.name.includes("Crewneck") || t.color === "White") || tshirts[0] || fbAnchor,
        ].filter(Boolean) as Product[],
        rationale: "Positioning handcrafted footwear and selvedge denim beside luxury oxford dress shirts converts complete formal wardrobes.",
      },
      {
        id: "sug-3",
        title: "Premium Selvedge Denim + Graphic Tee",
        dept: "Premium Denim Studio",
        category: "Jeans",
        lift: "+72%",
        anchor: jeans.find((j) => j.color === "Navy" && j.name.includes("Selvedge")) || jeans[0] || fbPartner,
        partner: tshirts.find((t) => t.name.includes("Crewneck") || t.color === "White") || tshirts[0] || fbAnchor,
        similarProducts: [
          tshirts.find((t) => t.name.includes("Crewneck") || t.color === "White") || tshirts[0] || fbAnchor,
          jackets.find((j) => j.name.includes("Bomber") || j.name.includes("Leather")) || jackets[1] || jackets[0] || fbAnchor,
          shoes.find((s) => s.name.includes("Sneaker") || s.name.includes("Derby")) || shoes[1] || shoes[0] || fbPartner,
          shirts.find((s) => s.name.includes("Linen") || s.color === "Blue") || shirts[1] || shirts[0] || fbAnchor,
        ].filter(Boolean) as Product[],
        rationale: "Customers buying premium raw selvedge denim eagerly add clean heavyweight cotton crewneck tees and bomber jackets.",
      },
      {
        id: "sug-4",
        title: "Streetwear Studio Tee + Layered Jacket",
        dept: "Streetwear Studio",
        category: "T-Shirts",
        lift: "+68%",
        anchor: tshirts.find((t) => t.color === "Charcoal" || t.name.includes("Pigment")) || tshirts[1] || fbAnchor,
        partner: jackets.find((j) => j.name.includes("Peacoat") || j.name.includes("Bomber")) || jackets[2] || fbAnchor,
        similarProducts: [
          jackets.find((j) => j.name.includes("Peacoat") || j.name.includes("Bomber")) || jackets[2] || fbAnchor,
          jeans.find((j) => j.color === "Black" || j.name.includes("Slim")) || jeans[2] || jeans[0] || fbPartner,
          shoes.find((s) => s.name.includes("Sneaker") || s.name.includes("Chelsea")) || shoes[2] || shoes[0] || fbPartner,
          shirts.find((s) => s.color === "Olive" || s.name.includes("Twill")) || shirts[2] || shirts[0] || fbAnchor,
        ].filter(Boolean) as Product[],
        rationale: "Pairing street-ready relaxed tees with outerwear bombers and slim denim lifts casual multi-category conversions by 68%.",
      },
      {
        id: "sug-5",
        title: "Luxury Footwear Vitrine + Tailored Chino",
        dept: "Luxury Footwear Lounge",
        category: "Shoes",
        lift: "+64%",
        anchor: shoes.find((s) => s.name.includes("Monk") || s.name.includes("Derby")) || shoes[1] || fbPartner,
        partner: shirts.find((s) => s.color === "Olive" || s.name.includes("Twill")) || shirts[2] || fbPartner,
        similarProducts: [
          shirts.find((s) => s.color === "Olive" || s.name.includes("Twill")) || shirts[2] || fbPartner,
          jeans.find((j) => j.name.includes("Chino") || j.name.includes("Slim")) || jeans[0] || fbPartner,
          jackets.find((j) => j.name.includes("Cashmere") || j.name.includes("Overcoat")) || jackets[0] || fbAnchor,
          tshirts.find((t) => t.color === "Charcoal" || t.name.includes("Pigment")) || tshirts[1] || tshirts[0] || fbAnchor,
        ].filter(Boolean) as Product[],
        rationale: "Co-locating hand-burnished luxury footwear with complementary tailored shirts and cashmere outerwear completes formal styling.",
      },
    ];

    const storeDepartments = ["Jackets", "Shirts", "Jeans", "T-Shirts", "Shoes"];
    const normalizeCat = (cat?: string) => {
      const c = (cat || "").toLowerCase();
      if (c.includes("jacket") || c.includes("coat") || c.includes("blazer")) return "Jackets";
      if (c.includes("t-shirt") || c.includes("tee")) return "T-Shirts";
      if (c.includes("shirt") || c.includes("oxford") || c.includes("linen")) return "Shirts";
      if (c.includes("jean") || c.includes("denim") || c.includes("trouser")) return "Jeans";
      if (c.includes("shoe") || c.includes("boot") || c.includes("loafer") || c.includes("sneaker")) return "Shoes";
      return "General";
    };

    const lifts = ["+84%", "+76%", "+72%", "+68%", "+64%"];

    // Filter specifically for the 5 In-Aisle Cupboard Bays (Pairs 4 to 8, indices 3 to 7)
    // to ensure each cupboard receives its dedicated 4-partner cross-cupboard recommendation
    const cupboardRecs = (recommendations || []).filter(
      (r, rIdx) => r.pairType === "cupboard_bay" || (typeof r.pairIndex === "number" ? r.pairIndex >= 3 : rIdx >= 3)
    );

    const results = storeDepartments.map((dept, idx) => {
      const matchingRec =
        cupboardRecs.find((r) => normalizeCat(r.sourceProduct?.category) === dept) ||
        cupboardRecs[idx] ||
        (recommendations || []).find(
          (r, rIdx) => (r.pairType === "cupboard_bay" || rIdx >= 3) && normalizeCat(r.sourceProduct?.category) === dept
        ) ||
        (recommendations || []).find(
          (r) => normalizeCat(r.sourceProduct?.category) === dept
        );

      if (matchingRec && matchingRec.sourceProduct) {
        const topPartner = matchingRec.similarProducts?.[0] || curatedDefaultPairs[idx].partner;
        const validSimilar = (matchingRec.similarProducts && matchingRec.similarProducts.length > 0)
          ? matchingRec.similarProducts
          : curatedDefaultPairs[idx].similarProducts;
        return {
          id: `sug-${idx + 1}`,
          title: `${matchingRec.sourceProduct.name} + ${topPartner?.name || "Cross-Sell Partner"}`,
          dept: curatedDefaultPairs[idx].dept,
          category: dept,
          lift: lifts[idx],
          anchor: matchingRec.sourceProduct,
          partner: topPartner,
          similarProducts: validSimilar,
          rationale: matchingRec.reason || curatedDefaultPairs[idx].rationale,
        };
      }
      return curatedDefaultPairs[idx];
    });

    return results;
  }, [recommendations, jackets, jeans, shirts, tshirts, shoes, catalogProducts, defaultFallbackAnchor, defaultFallbackPartner]);

  const activeSuggestion = suggestions[selectedSuggestionIdx] || suggestions[0] || {
    id: "sug-fallback",
    title: "Executive Outerwear + Contrast Denim",
    dept: "Savile Row Outerwear",
    category: "Jackets",
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

  // Compute 1:1 Mutual Swap Pairs for ALL suggestions so animations work cleanly without cupboard crowding
  const allCupboardSwapPairs = React.useMemo(() => {
    const colors = [0xc084fc, 0x38bdf8, 0xf43f5e, 0x10b981, 0xfbbf24];
    const colorHexes = ["#c084fc", "#38bdf8", "#f43f5e", "#10b981", "#fbbf24"];

    // 1. Collect all product IDs assigned to ANY recommendation pair (Hero Runways + Cupboard recommendations)
    const allAssignedProductIds = new Set<string>();
    (recommendations || []).forEach((r) => {
      if (r.sourceProduct?._id) allAssignedProductIds.add(String(r.sourceProduct._id));
      (r.similarProducts || []).forEach((p: any) => {
        if (p?._id) allAssignedProductIds.add(String(p._id));
      });
    });

    // 2. Global tracking to ensure each cupboard gets 4 distinct, unassigned neighbor items with 0 cross-store collision
    const globallyUsedNeighborIds = new Set<string>();

    return suggestions.map((sug, sugIdx) => {
      const anchor = sug.anchor || defaultFallbackAnchor;
      const partners: Product[] = (sug.similarProducts && sug.similarProducts.length > 0)
        ? sug.similarProducts
        : (sug.partner ? [sug.partner] : [defaultFallbackPartner]);

      const cat = (anchor.category || "").toLowerCase();
      let cupboardProds = shoes;
      if (cat.includes("jacket")) cupboardProds = jackets;
      else if (cat.includes("shirt") && !cat.includes("t-shirt") && !cat.includes("tee")) cupboardProds = shirts;
      else if (cat.includes("jean") || cat.includes("denim")) cupboardProds = jeans;
      else if (cat.includes("t-shirt") || cat.includes("tee")) cupboardProds = tshirts;

      // Available neighbors inside the anchor's cupboard:
      // MUST NOT be part of ANY recommendation pair across the store, and MUST NOT be allocated to another cupboard!
      const unassignedNeighbors = cupboardProds.filter(
        (p) =>
          !allAssignedProductIds.has(String(p._id)) &&
          !globallyUsedNeighborIds.has(String(p._id)) &&
          String(p._id) !== String(anchor._id)
      );

      const selectedNeighbors: Product[] = [];
      for (const cand of unassignedNeighbors) {
        if (selectedNeighbors.length >= partners.length) break;
        selectedNeighbors.push(cand);
        globallyUsedNeighborIds.add(String(cand._id));
      }

      // Safe fallback if catalog products are still loading or small test dataset:
      if (selectedNeighbors.length < partners.length) {
        const partnerIds = new Set(partners.map((p) => String(p._id)));
        for (const cand of cupboardProds) {
          if (selectedNeighbors.length >= partners.length) break;
          const cId = String(cand._id);
          if (
            cId !== String(anchor._id) &&
            !partnerIds.has(cId) &&
            !selectedNeighbors.some((n) => String(n._id) === cId) &&
            !globallyUsedNeighborIds.has(cId)
          ) {
            selectedNeighbors.push(cand);
            globallyUsedNeighborIds.add(cId);
          }
        }
      }

      // 🎯 Dedicated 1-to-1 mutual bilateral swap between Anchor Cupboard and each Partner Cupboard
      return partners.map((suggested, pIdx) => {
        const neighbor = selectedNeighbors[pIdx] || cupboardProds.find((p) => p._id !== anchor._id) || cupboardProds[0];
        return {
          suggested,
          neighbor,
          index: pIdx,
          colorHex: colors[(sugIdx + pIdx) % colors.length],
          colorCss: colorHexes[(sugIdx + pIdx) % colorHexes.length],
        };
      });
    });
  }, [suggestions, recommendations, defaultFallbackAnchor, defaultFallbackPartner, jackets, shirts, jeans, tshirts, shoes]);

  const swapPairs = allCupboardSwapPairs[selectedSuggestionIdx] || allCupboardSwapPairs[0] || [];
  const allFlattenedCupboardPairs = React.useMemo(() => allCupboardSwapPairs.flat(), [allCupboardSwapPairs]);

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
      const heroRec = (recommendations || []).find((r, rIdx) => r.pairIndex === idx || (rIdx === idx && idx < 3));
      const heroItems = heroRec ? [heroRec.sourceProduct, ...(heroRec.similarProducts || [])].filter(Boolean) : [];
      const recJacket = heroItems.find((p) => (p.category || "").toLowerCase().includes("jacket"));
      const recTop = heroItems.find((p) => {
        const c = (p.category || "").toLowerCase();
        return (c.includes("shirt") || c.includes("tee")) && !c.includes("jacket");
      });
      const recPants = heroItems.find((p) => {
        const c = (p.category || "").toLowerCase();
        return c.includes("jean") || c.includes("denim") || c.includes("trouser");
      });
      const recShoe = heroItems.find((p) => {
        const c = (p.category || "").toLowerCase();
        return c.includes("shoe") || c.includes("boot") || c.includes("loafer") || c.includes("sneaker");
      });

      const sug = suggestions[idx] || suggestions[0];
      const jacket =
        recJacket ||
        (jackets.length > 0 ? jackets[idx % jackets.length] : null) ||
        sug?.anchor ||
        catalogProducts[0] ||
        defaultFallbackAnchor;
      const tshirt =
        recTop ||
        (tshirts.length > 0 ? tshirts[idx % tshirts.length] : null) ||
        (shirts.length > 0 ? shirts[idx % shirts.length] : null) ||
        catalogProducts[1] ||
        defaultFallbackAnchor;
      const pants =
        recPants ||
        (jeans.length > 0 ? jeans[idx % jeans.length] : null) ||
        sug?.partner ||
        catalogProducts[2] ||
        defaultFallbackPartner;
      const shoe =
        recShoe ||
        (shoes.length > 0 ? shoes[idx % shoes.length] : null) ||
        catalogProducts[3] ||
        defaultFallbackPartner;

      const candJacket =
        jackets.find((j) => String(j._id) !== String(jacket._id)) ||
        jackets[(idx + 4) % jackets.length] ||
        jacket;
      const candTshirt =
        (tshirts.length > 0 ? tshirts : shirts).find((t) => String(t._id) !== String(tshirt._id)) ||
        tshirts[(idx + 4) % (tshirts.length || 1)] ||
        shirts[0] ||
        tshirt;
      const candPants =
        jeans.find((p) => String(p._id) !== String(pants._id)) ||
        jeans[(idx + 4) % jeans.length] ||
        pants;
      const candShoe =
        shoes.find((s) => String(s._id) !== String(shoe._id)) ||
        shoes[(idx + 4) % shoes.length] ||
        shoe;

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
        displacedOutfit: {
          jacket: candJacket,
          tshirt: candTshirt,
          pants: candPants,
          shoes: candShoe,
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
        scopedTargetProductIdRef.current = prod._id;
        updateScopeSignRef.current?.("🎯 SEARCH TARGET", prod.name);
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchedProduct(null);
    setIsSearchOpen(false);
    if (fastMoverProduct) {
      const pGroup = productGroupsMapRef.current.get(fastMoverProduct._id);
      const loc = pGroup?.group.position || getProductShelfLocation(fastMoverProduct);
      if (scopePointerGroupRef.current && loc) {
        scopePointerGroupRef.current.position.set(loc.x, loc.y, loc.z);
        scopePointerGroupRef.current.visible = true;
        scopedTargetProductIdRef.current = fastMoverProduct._id;
        updateScopeSignRef.current?.("★ FAST-SELLING PRODUCT", fastMoverProduct.name);
      }
    } else if (scopePointerGroupRef.current) {
      scopePointerGroupRef.current.visible = false;
    }
  };

  const handleCloseInspector = useCallback(() => {
    setInspectedProduct(null);
    setHoveredProduct(null);
    setHoveredMannequin(null);
    setMobileDrawer("none");
    isMouseOverUIRef.current = false;
    if (scopePointerGroupRef.current) {
      scopePointerGroupRef.current.visible = false;
    }
  }, []);

  // Ensure isMouseOverUIRef is cleared when overlays are closed / unmounted
  useEffect(() => {
    if (!hoveredMannequin && !inspectedProduct && !searchedProduct) {
      isMouseOverUIRef.current = false;
    }
  }, [hoveredMannequin, inspectedProduct, searchedProduct]);

  const fastMoverName = fastMoverProduct?.name || "Beige Cashmere Overcoat";
  const recItemName = pairedProduct?.name || "Black Tailored Denim";
  const anchorShelfLoc = getProductShelfLocation(fastMoverProduct);
  const adjacentCupboardLoc = getCupboardAdjacentCoords(fastMoverProduct);

  // 🎯 Highlight Active Fast-Selling Product with 3D Accuracy Reticle (WITHOUT CAMERA ZOOM)
  useEffect(() => {
    if (!fastMoverProduct) return;
    const pGroup = productGroupsMapRef.current.get(fastMoverProduct._id);
    const loc = pGroup?.group.position || getProductShelfLocation(fastMoverProduct);
    if (scopePointerGroupRef.current && loc) {
      scopePointerGroupRef.current.position.set(loc.x, loc.y, loc.z);
      scopePointerGroupRef.current.visible = true;
      scopedTargetProductIdRef.current = fastMoverProduct._id;
      updateScopeSignRef.current?.("★ FAST-SELLING PRODUCT", fastMoverProduct.name);
    }
  }, [selectedSuggestionIdx, fastMoverProduct, swapMode]);

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
          const staffMap: Record<string, { staffName: string; timestamp?: string }> = {};
          floorSwaps.forEach((fs: any) => {
            const who = fs.staffName || "Floor Staff";
            const time = fs.createdAt;
            (fs.executedItems || []).forEach((it: any) => {
              if (it.productId) {
                executedMap[it.productId] = true;
                staffMap[it.productId] = { staffName: who, timestamp: it.executedAt || time };
              }
            });
          });
          setExecutedFloorItems((prev) => ({ ...prev, ...executedMap }));
          setFloorSwapStaffMap((prev) => ({ ...prev, ...staffMap }));
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
            setFloorSwapStaffMap({});
            setFloorCheckedItems({});
          }
          let appliedProdIds: string[] | undefined;
          if (incomingApplied && data.activePairId) {
            const idx = suggestions.findIndex((s) => s.id === data.activePairId);
            if (idx !== -1) {
              const hero = heroRunwayPairs[idx] || heroRunwayPairs[0];
              appliedProdIds = [hero.outfit.jacket._id, hero.outfit.tshirt._id, hero.outfit.pants._id, hero.outfit.shoes._id];
            }
          }
          triggerFlightAnimationRef.current?.(incomingApplied, appliedProdIds);
        }
        if (!hasUserSelectedRef.current && data.applied && data.activePairId) {
          const idx = suggestions.findIndex((s) => s.id === data.activePairId);
          if (idx !== -1) setSelectedSuggestionIdx(idx);
        }
      }
    }
    if (event === "floor_swap_executed") {
      const data = payload as any;
      if (data) {
        if (data.swapMode) setSwapMode(data.swapMode);
        // If user manually chose a station tab on their screen, don't hijack their tab selection,
        // but the 3D visualizer will animate the swapped station in full 3D right in front of them!
        if (!hasUserSelectedRef.current && typeof data.spotIndex === "number") {
          setSelectedSuggestionIdx(data.spotIndex);
        }
        setPlanogramApplied(true);
        planogramAppliedRef.current = true;

        const productIds: string[] = (data.executedItems || []).map((it: any) => String(it.productId)).filter(Boolean);
        const staff = data.staffName || "Floor Staff";
        const time = data.timestamp || new Date().toISOString();

        productIds.forEach((id) => {
          executedFloorItemsRef.current[id] = true;
        });

        // 🚀 Trigger 3D flight animation for the executed items across whatever station was swapped!
        if (!isSwapAnimatingRef.current) {
          triggerFlightAnimationRef.current?.(true, productIds);
        }

        // Mark items as executed in local state
        setExecutedFloorItems((prev) => {
          const next = { ...prev };
          productIds.forEach((id) => {
            next[id] = true;
          });
          return next;
        });

        // Record who executed this swap for immediate UI badge display
        setFloorSwapStaffMap((prev) => {
          const next = { ...prev };
          productIds.forEach((id) => {
            next[id] = { staffName: staff, timestamp: time };
          });
          return next;
        });

        // NOTE: Camera zoom-in intentionally removed as requested by user! The view stays steady.

        showToast(`⚡ ${staff} executed ${productIds.length} floor swap(s)! Live 3D flight synchronized.`, "success");
      }
    }
    if (event === "floor_swap_reverted") {
      const data = payload as any;
      if (data) {
        if (data.all) {
          executedFloorItemsRef.current = {};
          setExecutedFloorItems({});
          setFloorSwapStaffMap({});
          setFloorCheckedItems({});
          setPlanogramApplied(false);
          planogramAppliedRef.current = false;
          if (!isSwapAnimatingRef.current) {
            triggerFlightAnimationRef.current?.(false);
          }
        } else {
          const revertedIds: string[] = (data.revertedProductIds || []).map(String);
          revertedIds.forEach((id) => {
            delete executedFloorItemsRef.current[id];
          });
          setExecutedFloorItems((prev) => {
            const next = { ...prev };
            revertedIds.forEach((id) => {
              delete next[id];
            });
            return next;
          });
          setFloorSwapStaffMap((prev) => {
            const next = { ...prev };
            revertedIds.forEach((id) => {
              delete next[id];
            });
            return next;
          });

          if (data.remainingActive === 0 || Object.keys(executedFloorItemsRef.current).length === 0) {
            setPlanogramApplied(false);
            planogramAppliedRef.current = false;
          }
          // Trigger flight animation backwards to shelves for these items!
          if (!isSwapAnimatingRef.current) {
            triggerFlightAnimationRef.current?.(false, revertedIds);
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

  // Apply Planogram Action (Local Visual Simulation only - DB & WebSockets are strictly Floor Tasks)
  // Helper to get active product IDs for the currently selected suggestion pair (single pair animation)
  const getSelectedAppliedProductIds = (): string[] => {
    if (swapMode === "hero_showcase") {
      const selectedHero = heroRunwayPairs[selectedSuggestionIdx] || heroRunwayPairs[0];
      if (!selectedHero) return [];
      return [
        selectedHero.outfit.jacket._id,
        selectedHero.outfit.tshirt._id,
        selectedHero.outfit.pants._id,
        selectedHero.outfit.shoes._id,
      ];
    } else {
      if (!swapPairs.length) return [];
      return swapPairs.flatMap((p) => [p.suggested._id, p.neighbor._id]);
    }
  };

  const handleApplyPlanogram = async () => {
    if (!fastMoverProduct || !pairedProduct) return;
    setActionLoading(true);
    setIsSwapAnimating(true);
    try {
      const selectedHero = heroRunwayPairs[selectedSuggestionIdx] || heroRunwayPairs[0];
      planogramAppliedRef.current = true;
      setPlanogramApplied(true);
      const appliedProdIds = getSelectedAppliedProductIds();
      triggerFlightAnimationRef.current?.(true, appliedProdIds);
      // NOTE: User requested AI Planogram to be purely local visual simulation (no DB update, no WebSockets).
      // Only Floor Tasks will persist to MongoDB and broadcast via WebSockets.
      showToast(
        swapMode === "hero_showcase"
          ? `✨ Visual Simulation: ${selectedHero.badge} Outfit promoted to Runway Mannequin #${selectedSuggestionIdx + 1}! (Floor Tasks-ல் சேமித்தால் மட்டுமே DB & WebSockets-ல் sync ஆகும்)`
          : `✨ Visual Simulation: Product pair flying across cupboards! (Floor Tasks-ல் சேமித்தால் மட்டுமே DB & WebSockets-ல் sync ஆகும்)`,
        "success"
      );
    } catch {
      showToast("Failed to simulate planogram.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Planogram (Local Visual Simulation only)
  const handleResetPlanogram = async () => {
    setActionLoading(true);
    try {
      planogramAppliedRef.current = false;
      setPlanogramApplied(false);
      const appliedProdIds = getSelectedAppliedProductIds();
      triggerFlightAnimationRef.current?.(false, appliedProdIds);
      // NOTE: User requested AI Planogram to be purely local visual simulation.
      // Floor Tasks records are preserved and only managed via Floor Tasks tab.
      showToast("🔄 Showroom visual simulation reset locally to baseline shelves.", "info");
    } catch {
      showToast("Failed to reset visual preview.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Replay Swap Animation (Single selected pair only)
  const handleReplaySwap = () => {
    setIsSwapAnimating(true);
    const appliedProdIds = getSelectedAppliedProductIds();
    triggerFlightAnimationRef.current?.(true, appliedProdIds);
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
        .map((t) => {
          const dLoc = getProductShelfLocation(t.displaced!.item);
          return {
            productId: t.displaced!.item._id,
            targetCoords: t.displaced!.targetCoords,
            originalCoords: {
              x: dLoc.x,
              y: dLoc.y,
              z: dLoc.z,
              zone: dLoc.zone || "Shelf Slot",
            },
          };
        });

      const activePairId =
        swapMode === "hero_showcase"
          ? (heroRunwayPairs[selectedSuggestionIdx]?.mannequinId || `mannequin-hero-${selectedSuggestionIdx + 1}`)
          : (suggestions[selectedSuggestionIdx]?.id || `sug-${selectedSuggestionIdx + 1}`);

      const staffLabel = currentUser ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : "Floor Staff";
      const res = await api.post("/recommendations/floor-swap", {
        swapMode,
        activePairId,
        spotIndex: selectedSuggestionIdx,
        executedItems,
        displacedItems,
        staffName: staffLabel,
      });

      if (res.data?.success) {
        // Mark as executed in local state (strictly for primary task items)
        setExecutedFloorItems((prev) => {
          const next = { ...prev };
          tasksToExecute.forEach((t) => {
            next[t.item._id] = true;
          });
          return next;
        });

        // Store staff attribution for UI overlay
        setFloorSwapStaffMap((prev) => {
          const next = { ...prev };
          const time = new Date().toISOString();
          tasksToExecute.forEach((t) => {
            next[t.item._id] = { staffName: staffLabel, timestamp: time };
          });
          return next;
        });

        tasksToExecute.forEach((t) => {
          executedFloorItemsRef.current[t.item._id] = true;
          executedFloorItemsRef.current[String(t.item._id)] = true;
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
          `✓ ${staffLabel} saved ${tasksToExecute.length} real-world swap(s)! Manager screen updated live.`,
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
      const staffLabel = currentUser ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : "Floor Staff";
      const res = await api.post("/recommendations/floor-swap/revert", {
        productId: task.item._id,
        staffName: staffLabel,
      });
      if (res.data?.success) {
        delete executedFloorItemsRef.current[task.item._id];
        delete executedFloorItemsRef.current[String(task.item._id)];
        if (task.displaced?.item) {
          delete executedFloorItemsRef.current[task.displaced.item._id];
          delete executedFloorItemsRef.current[String(task.displaced.item._id)];
        }
        setExecutedFloorItems((prev) => {
          const next = { ...prev };
          delete next[task.item._id];
          if (task.displaced?.item) delete next[task.displaced.item._id];
          return next;
        });
        setFloorSwapStaffMap((prev) => {
          const next = { ...prev };
          delete next[task.item._id];
          if (task.displaced?.item) delete next[task.displaced.item._id];
          return next;
        });
        if (Object.keys(executedFloorItemsRef.current).length === 0) {
          planogramAppliedRef.current = false;
          setPlanogramApplied(false);
        }
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

      // Collect all candidate product IDs in this active station
      const stationProductIds: string[] = [];
      if (swapMode === "hero_showcase") {
        const hero = heroRunwayPairs[selectedSuggestionIdx] || heroRunwayPairs[0];
        if (hero) {
          [hero.outfit.jacket, hero.outfit.tshirt, hero.outfit.pants, hero.outfit.shoes].forEach((p) => {
            if (p?._id) stationProductIds.push(String(p._id));
          });
          if (hero.displacedOutfit) {
            [hero.displacedOutfit.jacket, hero.displacedOutfit.tshirt, hero.displacedOutfit.pants, hero.displacedOutfit.shoes].forEach((p) => {
              if (p?._id) stationProductIds.push(String(p._id));
            });
          }
        }
      } else {
        const pairs = allCupboardSwapPairs[selectedSuggestionIdx] || swapPairs;
        pairs.forEach((p) => {
          if (p.suggested?._id) stationProductIds.push(String(p.suggested._id));
          if (p.neighbor?._id) stationProductIds.push(String(p.neighbor._id));
        });
      }

      const staffLabel = currentUser ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : "Floor Staff";
      const res = await api.post("/recommendations/floor-swap/revert", {
        activePairId,
        spotIndex: selectedSuggestionIdx,
        productIds: stationProductIds,
        staffName: staffLabel,
      });

      if (res.data?.success) {
        const rawReverted: string[] = (res.data.payload?.revertedProductIds || []).map(String);
        const allReverted = Array.from(new Set([...rawReverted, ...stationProductIds]));

        allReverted.forEach((id) => {
          delete executedFloorItemsRef.current[id];
        });
        setExecutedFloorItems((prev) => {
          const next = { ...prev };
          allReverted.forEach((id) => {
            delete next[id];
          });
          return next;
        });
        setFloorSwapStaffMap((prev) => {
          const next = { ...prev };
          allReverted.forEach((id) => {
            delete next[id];
          });
          return next;
        });
        if (Object.keys(executedFloorItemsRef.current).length === 0) {
          planogramAppliedRef.current = false;
          setPlanogramApplied(false);
        }

        const idsToFly = rawReverted.length > 0 ? rawReverted : stationProductIds;
        if (idsToFly.length > 0) {
          triggerFlightAnimationRef.current?.(false, idsToFly);
        }
        dispatch(fetchProducts());
        showToast(
          `🔄 Reset all ${idsToFly.length} item(s) in this station back to original shelves!`,
          "info"
        );
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to reset station", "error");
    } finally {
      setIsSavingFloorSwap(false);
    }
  };

  // 🔄 Explicit Seasonal Reset: Reset ALL 8 stations back to home shelves (Managers only)
  const handleResetEntireShowroom = async () => {
    if (
      !window.confirm(
        "Seasonal Store Reset: Are you sure you want to revert all 8 stations back to their baseline home shelves? This will reset all active floor swaps."
      )
    ) {
      return;
    }
    setIsSavingFloorSwap(true);
    try {
      const res = await api.post("/recommendations/reset-all-showroom");
      if (res.data?.success) {
        executedFloorItemsRef.current = {};
        planogramAppliedRef.current = false;
        setPlanogramApplied(false);
        setExecutedFloorItems({});
        setFloorSwapStaffMap({});
        setFloorCheckedItems({});
        triggerFlightAnimationRef.current?.(false);
        dispatch(fetchProducts());
        showToast("🔄 Entire Showroom reset to baseline home shelves!", "info");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to reset showroom", "error");
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

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 150);
    camera.position.set(0, 20, 26);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      precision: "highp", // High precision to eliminate mobile GPU z-fighting and texture flicker
      logarithmicDepthBuffer: true, // Prevents depth buffer fighting between floor, grid and platforms
      depth: true,
      stencil: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); // Crisp rendering on mobile & Retina screens
    renderer.shadowMap.enabled = false; // Disabled shadowMap to maintain 60 FPS
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const domElement = renderer.domElement;
    domElement.style.touchAction = "none";
    domElement.style.userSelect = "none";
    (domElement.style as any).webkitUserSelect = "none";

    container.innerHTML = "";
    container.appendChild(domElement);

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

    // Lightweight marble grid with polygon offset to guarantee zero z-fighting
    const floorGeo = new THREE.PlaneGeometry(SHOWROOM_WIDTH, SHOWROOM_DEPTH);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    scene.add(floorMesh);

    const grid = new THREE.GridHelper(SHOWROOM_WIDTH, 36, 0xcfd8dc, 0xe2e8f0);
    grid.position.y = 0.02;
    if (grid.material) {
      const gMat = grid.material as THREE.Material;
      gMat.depthWrite = false;
      gMat.transparent = true;
      gMat.opacity = 0.85;
    }
    scene.add(grid);

    // Perimeter Amber/Gold Accent Border
    const perimeterMat = new THREE.MeshBasicMaterial({ color: 0xd97706, depthWrite: false });
    const perimeterGeo = new THREE.RingGeometry(18.0, 18.08, 4);
    const perimeter = new THREE.Mesh(perimeterGeo, perimeterMat);
    perimeter.rotation.x = -Math.PI / 2;
    perimeter.rotation.z = Math.PI / 4;
    perimeter.position.y = 0.025;
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
        const pEntry = {
          group: pMesh,
          originalPos: new THREE.Vector3(worldX, worldY, worldZ),
          product: prod,
        };
        productGroupsMap.set(prod._id, pEntry);
        productGroupsMap.set(String(prod._id), pEntry);
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
      const sEntry = {
        group: sMesh,
        originalPos: new THREE.Vector3(worldX, worldY, worldZ),
        product: shoe,
      };
      productGroupsMap.set(shoe._id, sEntry);
      productGroupsMap.set(String(shoe._id), sEntry);
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
      currentOutfit: { jacket?: Product | null; tshirt?: Product | null; pants?: Product | null; shoes?: Product | null } | null;
      currentProduct: Product | null;
      updateOutfit: (outfit: { jacket?: Product | null; tshirt?: Product | null; pants?: Product | null; shoes?: Product | null } | null) => void;
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

      // 1. Italian Handcrafted Luxury Footwear (Resting prominently on top of Pedestal, y >= 0.165)
      const shoesMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a, // Default Charcoal Leather
        roughness: 0.35,
        metalness: 0.25,
      });

      // Left Shoe (Sole + Leather Upper + Sculpted Toe Cap + Heel Welt)
      const leftShoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.30), darkWalnutMat);
      leftShoeSole.position.set(-0.13, 0.185, 0.04);
      mGroup.add(leftShoeSole);

      const leftShoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.26), shoesMat);
      leftShoeUpper.position.set(-0.13, 0.225, 0.03);
      mGroup.add(leftShoeUpper);

      const leftToeCap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), shoesMat);
      leftToeCap.scale.set(1.0, 0.7, 1.35);
      leftToeCap.position.set(-0.13, 0.21, 0.15);
      mGroup.add(leftToeCap);

      const leftShoeCollar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), shoesMat);
      leftShoeCollar.position.set(-0.13, 0.265, -0.01);
      mGroup.add(leftShoeCollar);

      // Right Shoe (Sole + Leather Upper + Sculpted Toe Cap + Heel Welt)
      const rightShoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.30), darkWalnutMat);
      rightShoeSole.position.set(0.13, 0.185, 0.04);
      mGroup.add(rightShoeSole);

      const rightShoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.26), shoesMat);
      rightShoeUpper.position.set(0.13, 0.225, 0.03);
      mGroup.add(rightShoeUpper);

      const rightToeCap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), shoesMat);
      rightToeCap.scale.set(1.0, 0.7, 1.35);
      rightToeCap.position.set(0.13, 0.21, 0.15);
      mGroup.add(rightToeCap);

      const rightShoeCollar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), shoesMat);
      rightShoeCollar.position.set(0.13, 0.265, -0.01);
      mGroup.add(rightShoeCollar);

      // 2. Tailored Straight-Leg Trousers (Masculine Athletic Stance with Cuffs & Belt)
      const pantsMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.65,
        metalness: 0.15,
      });
      const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.076, 0.72, 16), pantsMat);
      leftLeg.position.set(-0.13, 0.68, 0);
      mGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.076, 0.72, 16), pantsMat);
      rightLeg.position.set(0.13, 0.68, 0);
      mGroup.add(rightLeg);

      // Trouser Ankle Cuffs (Resting seamlessly over the luxury shoes)
      const leftCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.086, 0.06, 16), pantsMat);
      leftCuff.position.set(-0.13, 0.29, 0);
      mGroup.add(leftCuff);

      const rightCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.086, 0.06, 16), pantsMat);
      rightCuff.position.set(0.13, 0.29, 0);
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
      shoesHitBox.position.set(0, 0.23, 0.03);
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
        cfg.y + 0.12 + 0.23,
        cfg.z + runwayGroup.position.z
      );

      let curOutfit: { jacket?: Product | null; tshirt?: Product | null; pants?: Product | null; shoes?: Product | null } | null = null;
      const updateOutfit = (outfit: { jacket?: Product | null; tshirt?: Product | null; pants?: Product | null; shoes?: Product | null } | null) => {
        curOutfit = outfit;
        if (outfit) {
          if (outfit.jacket) {
            jacketMat.color.setHex(getColorHexFromName(outfit.jacket.color, cfg.accentColor));
          } else {
            jacketMat.color.setHex(cfg.defaultColor);
          }

          if (outfit.tshirt) {
            innerTopMat.color.setHex(getColorHexFromName(outfit.tshirt.color, 0xf1f5f9));
          } else {
            innerTopMat.color.setHex(0xf1f5f9);
          }

          if (outfit.pants) {
            pantsMat.color.setHex(getColorHexFromName(outfit.pants.color, 0x1e293b));
          } else {
            pantsMat.color.setHex(0x1e293b);
          }

          if (outfit.shoes) {
            shoesMat.color.setHex(getColorHexFromName(outfit.shoes.color, 0x0f172a));
          } else {
            shoesMat.color.setHex(0x0f172a);
          }

          const activePieces = [
            outfit.jacket?.name,
            outfit.pants?.name,
            outfit.tshirt?.name,
            outfit.shoes?.name,
          ].filter(Boolean);

          if (activePieces.length > 0) {
            renderBadgeText(
              cfg.label,
              activePieces.map((n) => n!.slice(0, 14)).join(" + ")
            );
          } else {
            renderBadgeText(cfg.label, cfg.sublabel);
          }
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

    // 🌟 Displaced Garment Meshes for Hero Runway Mannequins (for mutual 2-way swaps back to shelf)
    const heroDisplacedGroupsMap = new Map<
      number,
      {
        jacket: THREE.Group;
        tshirt: THREE.Group;
        pants: THREE.Group;
        shoes: THREE.Group;
      }
    >();

    heroRunwayOutfits.forEach((hero) => {
      const dispJacket = createProductMesh(
        hero.displacedOutfit.jacket,
        hero.locations.jacket.x,
        hero.locations.jacket.y,
        hero.locations.jacket.z
      );
      dispJacket.visible = false;
      scene.add(dispJacket);

      const dispTshirt = createProductMesh(
        hero.displacedOutfit.tshirt,
        hero.locations.tshirt.x,
        hero.locations.tshirt.y,
        hero.locations.tshirt.z
      );
      dispTshirt.visible = false;
      scene.add(dispTshirt);

      const dispPants = createProductMesh(
        hero.displacedOutfit.pants,
        hero.locations.pants.x,
        hero.locations.pants.y,
        hero.locations.pants.z
      );
      dispPants.visible = false;
      scene.add(dispPants);

      const dispShoes = createProductMesh(
        hero.displacedOutfit.shoes,
        hero.locations.shoes.x,
        hero.locations.shoes.y,
        hero.locations.shoes.z
      );
      dispShoes.visible = false;
      scene.add(dispShoes);

      heroDisplacedGroupsMap.set(hero.index, {
        jacket: dispJacket,
        tshirt: dispTshirt,
        pants: dispPants,
        shoes: dispShoes,
      });
    });

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
    const scopeTex = new THREE.CanvasTexture(scopeCanvas);
    const scopeSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.35),
      new THREE.MeshBasicMaterial({ map: scopeTex, transparent: true })
    );
    scopeSign.position.y = 1.25;
    scopeGroup.add(scopeSign);

    const updateScopeSign = (title: string, subtitle?: string) => {
      scCtx.clearRect(0, 0, 384, 96);
      scCtx.fillStyle = "rgba(14, 165, 233, 0.95)";
      scCtx.fillRect(0, 0, 384, 96);
      scCtx.strokeStyle = "#ffffff";
      scCtx.lineWidth = 4;
      scCtx.strokeRect(3, 3, 378, 90);
      scCtx.fillStyle = "#ffffff";
      scCtx.textAlign = "center";
      if (subtitle) {
        scCtx.font = "bold 20px sans-serif";
        scCtx.fillText(title, 192, 38);
        scCtx.font = "bold 18px sans-serif";
        scCtx.fillStyle = "#fef08a";
        const trimmed = subtitle.length > 24 ? subtitle.slice(0, 22) + "..." : subtitle;
        scCtx.fillText(trimmed, 192, 70);
      } else {
        scCtx.font = "bold 22px sans-serif";
        scCtx.fillText(title, 192, 56);
      }
      scopeTex.needsUpdate = true;
    };
    updateScopeSignRef.current = updateScopeSign;
    updateScopeSign("🎯 SCOPE TARGET LOCKED");

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

    // Neon Guide Routes & Floating Beacons (grouped so they can dynamically update per suggestion without scene remount)
    const routesGuideGroup = new THREE.Group();
    scene.add(routesGuideGroup);

    const rebuildGuideRoutes = (sIdxSelected: number) => {
      // Clear previous routes and meshes
      while (routesGuideGroup.children.length > 0) {
        const obj = routesGuideGroup.children[0];
        routesGuideGroup.remove(obj);
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
          }
        }
      }
      animatedGuidePulses.length = 0;
      swapBeaconGroups.length = 0;

      // 🎯 Synchronize Fast Mover Aura and Accuracy Reticle onto this suggestion's anchor product (WITHOUT CAMERA ZOOM)
      const curSug = suggestions[sIdxSelected] || suggestions[0];
      const curAnchor = curSug?.anchor || defaultFallbackAnchor;
      if (curAnchor) {
        const curAnchorLoc = getProductShelfLocation(curAnchor);
        anchorAura.position.set(curAnchorLoc.x, 0.05, curAnchorLoc.z);
        const pGroup = productGroupsMap.get(curAnchor._id);
        const targetPos = pGroup?.group.position || curAnchorLoc;
        if (scopeGroup && targetPos) {
          scopeGroup.position.set(targetPos.x, targetPos.y, targetPos.z);
          scopeGroup.visible = true;
          scopedTargetProductIdRef.current = curAnchor._id;
          updateScopeSign("★ FAST-SELLING PRODUCT", curAnchor.name);
        }
      }

      type RouteItem = {
        suggested: Product;
        neighbor?: Product;
        targetPt: THREE.Vector3;
        colorHex: number;
        badgeText: string;
        role: string;
      };

      const activeRouteItems: RouteItem[] = isHeroMode
        ? (() => {
            const hero = heroRunwayPairs[sIdxSelected] || heroRunwayPairs[0];
            const m = mannequins[hero.index];
            if (!m) return [];
            return [
              { suggested: hero.outfit.jacket, targetPt: m.worldChestPos, colorHex: 0xf59e0b, badgeText: `★ ${hero.badge} COAT`, role: "Outerwear" },
              { suggested: hero.outfit.tshirt, targetPt: m.worldChestPos, colorHex: 0x38bdf8, badgeText: `★ ${hero.badge} SHIRT`, role: "Topwear" },
              { suggested: hero.outfit.pants, targetPt: m.worldPantsPos, colorHex: 0x10b981, badgeText: `★ ${hero.badge} PANTS`, role: "Bottomwear" },
              { suggested: hero.outfit.shoes, targetPt: m.worldShoesPos, colorHex: 0xa855f7, badgeText: `★ ${hero.badge} SHOES`, role: "Footwear" },
            ];
          })()
        : (allCupboardSwapPairs[sIdxSelected] || allCupboardSwapPairs[0] || []).map((pair, idx) => {
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
        routesGuideGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

        // Arrow cone pointing into target slot or mannequin
        const arrowCone = new THREE.Mesh(arrowConeGeo, new THREE.MeshBasicMaterial({ color: neonColor }));
        const ptBefore = neonCurve.getPoint(0.93);
        const ptEnd = neonCurve.getPoint(0.98);
        arrowCone.position.copy(ptEnd);
        arrowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ptEnd.clone().sub(ptBefore).normalize());
        routesGuideGroup.add(arrowCone);

        // Return arrow cone pointing into the other cupboard (in cupboard mutual mode only)
        if (!isHeroMode && item.neighbor) {
          const returnArrowCone = new THREE.Mesh(arrowConeGeo, new THREE.MeshBasicMaterial({ color: neonColor }));
          const rPtBefore = neonCurve.getPoint(0.07);
          const rPtEnd = neonCurve.getPoint(0.02);
          returnArrowCone.position.copy(rPtEnd);
          returnArrowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rPtEnd.clone().sub(rPtBefore).normalize());
          routesGuideGroup.add(returnArrowCone);
        }

        // Flowing animated pulse along line
        const pulseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        routesGuideGroup.add(pulseMesh);
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
              ? `👑 ${(heroRunwayPairs[sIdxSelected] || heroRunwayPairs[0]).badge}: 4-PIECE OUTFIT`
              : `★ CUPBOARD SWAP #${sIdx + 1}`,
            150,
            42
          );
          const bTex = new THREE.CanvasTexture(bCanvas);
          const bMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.25), new THREE.MeshBasicMaterial({ map: bTex, transparent: true }));
          bGroup.add(bMesh);
          bGroup.visible = Boolean(planogramAppliedRef.current);
          routesGuideGroup.add(bGroup);
          swapBeaconGroups.push(bGroup);
        }
      });
    };

    rebuildGuideRoutesRef.current = rebuildGuideRoutes;
    rebuildGuideRoutes(selectedSuggestionIdxRef.current);

    // 🚀 Flight Animation Controller for Dramatic 3D Swap (Supports selective item-by-item live floor execution!)
    const flightAnim = {
      active: false,
      startTime: 0,
      duration: 2000,
      forward: true,
      specificProductIds: undefined as Set<string> | undefined,
    };

    // Synchronize 3D products and mannequin outfits according to applied and executed floor swaps
    const syncPositionsAndOutfits = () => {
      if (flightAnim.active) return; // Prevent mid-flight disruption

      if (isHeroMode) {
        heroRunwayOutfits.forEach((hero) => {
          const m = mannequins[hero.index];
          if (!m) return;
          const jGroup = productGroupsMap.get(hero.outfit.jacket._id) || productGroupsMap.get(String(hero.outfit.jacket._id));
          const tGroup = productGroupsMap.get(hero.outfit.tshirt._id) || productGroupsMap.get(String(hero.outfit.tshirt._id));
          const pGroup = productGroupsMap.get(hero.outfit.pants._id) || productGroupsMap.get(String(hero.outfit.pants._id));
          const sGroup = productGroupsMap.get(hero.outfit.shoes._id) || productGroupsMap.get(String(hero.outfit.shoes._id));

          // In AI Planogram visual simulation mode (when user is in strategy tab), full station is previewed
          const isPlanogramSimulated = Boolean(
            planogramAppliedRef.current &&
            strategyTabRef.current !== "floor_tasks" &&
            hero.index === selectedSuggestionIdxRef.current
          );

          const isJacketActive = Boolean(executedFloorItemsRef.current[hero.outfit.jacket._id] || executedFloorItemsRef.current[String(hero.outfit.jacket._id)]) || isPlanogramSimulated;
          const isTshirtActive = Boolean(executedFloorItemsRef.current[hero.outfit.tshirt._id] || executedFloorItemsRef.current[String(hero.outfit.tshirt._id)]) || isPlanogramSimulated;
          const isPantsActive = Boolean(executedFloorItemsRef.current[hero.outfit.pants._id] || executedFloorItemsRef.current[String(hero.outfit.pants._id)]) || isPlanogramSimulated;
          const isShoesActive = Boolean(executedFloorItemsRef.current[hero.outfit.shoes._id] || executedFloorItemsRef.current[String(hero.outfit.shoes._id)]) || isPlanogramSimulated;

          const dispMeshes = heroDisplacedGroupsMap.get(hero.index);

          // 1. Outerwear Jacket
          if (jGroup) {
            if (isJacketActive) {
              jGroup.group.position.copy(m.worldChestPos);
              jGroup.group.visible = false;
              if (dispMeshes?.jacket) {
                dispMeshes.jacket.position.copy(jGroup.originalPos);
                dispMeshes.jacket.visible = true;
                dispMeshes.jacket.scale.setScalar(1.0);
              }
            } else {
              jGroup.group.position.copy(jGroup.originalPos);
              jGroup.group.visible = true;
              jGroup.group.scale.setScalar(1.0);
              if (dispMeshes?.jacket) {
                dispMeshes.jacket.visible = false;
              }
            }
          }

          // 2. Topwear Shirt / T-Shirt
          if (tGroup) {
            if (isTshirtActive) {
              tGroup.group.position.copy(m.worldChestPos);
              tGroup.group.visible = false;
              if (dispMeshes?.tshirt) {
                dispMeshes.tshirt.position.copy(tGroup.originalPos);
                dispMeshes.tshirt.visible = true;
                dispMeshes.tshirt.scale.setScalar(1.0);
              }
            } else {
              tGroup.group.position.copy(tGroup.originalPos);
              tGroup.group.visible = true;
              tGroup.group.scale.setScalar(1.0);
              if (dispMeshes?.tshirt) {
                dispMeshes.tshirt.visible = false;
              }
            }
          }

          // 3. Bottomwear Pants / Denim
          if (pGroup) {
            if (isPantsActive) {
              pGroup.group.position.copy(m.worldPantsPos);
              pGroup.group.visible = false;
              if (dispMeshes?.pants) {
                dispMeshes.pants.position.copy(pGroup.originalPos);
                dispMeshes.pants.visible = true;
                dispMeshes.pants.scale.setScalar(1.0);
              }
            } else {
              pGroup.group.position.copy(pGroup.originalPos);
              pGroup.group.visible = true;
              pGroup.group.scale.setScalar(1.0);
              if (dispMeshes?.pants) {
                dispMeshes.pants.visible = false;
              }
            }
          }

          // 4. Footwear Shoes
          if (sGroup) {
            if (isShoesActive) {
              sGroup.group.position.copy(m.worldShoesPos);
              sGroup.group.visible = false;
              if (dispMeshes?.shoes) {
                dispMeshes.shoes.position.copy(sGroup.originalPos);
                dispMeshes.shoes.visible = true;
                dispMeshes.shoes.scale.setScalar(1.0);
              }
            } else {
              sGroup.group.position.copy(sGroup.originalPos);
              sGroup.group.visible = true;
              sGroup.group.scale.setScalar(1.0);
              if (dispMeshes?.shoes) {
                dispMeshes.shoes.visible = false;
              }
            }
          }

          m.updateOutfit({
            jacket: isJacketActive ? hero.outfit.jacket : null,
            tshirt: isTshirtActive ? hero.outfit.tshirt : null,
            pants: isPantsActive ? hero.outfit.pants : null,
            shoes: isShoesActive ? hero.outfit.shoes : null,
          });
        });
      } else {
        // Reset all products to baseline shelf position first so other cupboards are undisturbed
        productGroupsMap.forEach((entry) => {
          entry.group.position.copy(entry.originalPos);
          entry.group.visible = true;
          entry.group.scale.setScalar(1.0);
        });

        // If planogram applied, swap ONLY the current active station's 4 pairs!
        if (planogramAppliedRef.current) {
          swapPairs.forEach((pair) => {
            const itemS = productGroupsMap.get(pair.suggested._id);
            const itemN = productGroupsMap.get(pair.neighbor._id);
            if (itemS && itemN) {
              itemS.group.position.copy(itemN.originalPos);
              itemN.group.position.copy(itemS.originalPos);
            }
          });
        }

        // Apply any specific floor tasks executed by staff
        Object.keys(executedFloorItemsRef.current).forEach((executedId) => {
          const matchingPair = allFlattenedCupboardPairs.find((p) => p.suggested._id === executedId);
          if (matchingPair) {
            const itemS = productGroupsMap.get(matchingPair.suggested._id);
            const itemN = productGroupsMap.get(matchingPair.neighbor._id);
            if (itemS && itemN) {
              itemS.group.position.copy(itemN.originalPos);
              itemN.group.position.copy(itemS.originalPos);
            }
          }
        });
      }
    };

    syncPositionsAndOutfits();

    snapToAppliedPositionsRef.current = () => {
      syncPositionsAndOutfits();
      swapBeaconGroups.forEach((bg) => {
        bg.visible = true;
      });
    };

    triggerFlightAnimationRef.current = (forward = true, specificProductIds?: string[]) => {
      if (specificProductIds !== undefined && specificProductIds.length === 0) {
        return;
      }
      flightAnim.active = true;
      flightAnim.startTime = performance.now();
      flightAnim.duration = 2000;
      flightAnim.forward = forward;
      flightAnim.specificProductIds = specificProductIds && specificProductIds.length > 0 ? new Set(specificProductIds.map(String)) : undefined;
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
      // If clicking directly on the 3D canvas, always unblock dragging
      if (e.target === domElement) {
        isMouseOverUIRef.current = false;
      }
      if (isMouseOverUIRef.current && e.target !== domElement) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastRaycastTime = 0;
    let lastHoveredMesh: THREE.Mesh | null = null;

    const onMouseMove = (e: MouseEvent) => {
      if (e.target === renderer?.domElement) {
        isMouseOverUIRef.current = false;
      }
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
              const outfit = heroStation?.outfit;
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

            // Update React state for Side Overlay ONLY on hover!
            if (hoveredProductIdRef.current !== prod._id) {
              hoveredProductIdRef.current = prod._id;
              setHoveredProduct(prod);
            }
            return;
          }
        } else {
          setHoveredMannequin(null);
          setHoveredProduct(null);
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
      if (e.target === domElement) {
        isMouseOverUIRef.current = false;
      }
      if (isMouseOverUIRef.current && e.target !== domElement) return;
      e.preventDefault();
      targetRadius = Math.max(10, Math.min(50, targetRadius + e.deltaY * 0.025));
    };

    const onClick = (e: MouseEvent) => {
      if (e.target === domElement) {
        isMouseOverUIRef.current = false;
      }
      if (isMouseOverUIRef.current && e.target !== domElement) return;
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
      if (e.touches.length === 1 && isDragging) {
        if (e.cancelable) e.preventDefault();
        const deltaX = e.touches[0].clientX - prevMouseX;
        const deltaY = e.touches[0].clientY - prevMouseY;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;

        targetTheta -= deltaX * 0.007;
        targetPhi = Math.max(0.12, Math.min(Math.PI / 2.1, targetPhi - deltaY * 0.007));
      } else if (e.touches.length === 2 && initialPinchDist > 0) {
        if (e.cancelable) e.preventDefault();
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

    domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    domElement.addEventListener("wheel", onWheel, { passive: false });
    domElement.addEventListener("click", onClick);
    domElement.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", () => { isDragging = false; initialPinchDist = 0; }, { passive: true });

    // --- ANIMATION LOOP (SYNCHRONIZED WITH HARDWARE V-SYNC FOR BUTTERY-SMOOTH MOBILE FPS) ---
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

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (!isRenderingActive) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Camera lerp
      currentLookAt.lerp(targetLookAt, 0.08);
      currentRadius += (targetRadius - currentRadius) * 0.12;
      currentPhi += (targetPhi - currentPhi) * 0.12;

      // Auto rotation (Gentle, ultra-slow luxury showroom orbit at ~4°/sec)
      if (autoRotateRef.current && !isDragging) {
        const orbitSpeed = Math.max(delta, 0.016) * 0.08;
        targetTheta += orbitSpeed;
        currentTheta += orbitSpeed;
      } else {
        currentTheta += (targetTheta - currentTheta) * 0.12;
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

        const targetId = scopedTargetProductIdRef.current || searchedProduct?._id;
        if (targetId) {
          const targetGroup = productGroupsMap.get(targetId);
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
          // 🌟 HERO SHOWCASE: Dedicated 4-piece outfit flies between shelf and mannequin
          const specificIds = flightAnim.specificProductIds;
          const targetHeroes = specificIds
            ? heroRunwayOutfits.filter((hero) => {
                const hIds = [
                  String(hero.outfit.jacket._id),
                  String(hero.outfit.tshirt._id),
                  String(hero.outfit.pants._id),
                  String(hero.outfit.shoes._id),
                ];
                return hIds.some((id) => specificIds.has(id));
              })
            : [heroRunwayOutfits[selectedSuggestionIdxRef.current] || heroRunwayOutfits[0]];

          targetHeroes.forEach((hero) => {
            const m = mannequins[hero.index];
            if (!m) return;

            const dispMeshes = heroDisplacedGroupsMap.get(hero.index);
            const jGroup = productGroupsMap.get(hero.outfit.jacket._id) || productGroupsMap.get(String(hero.outfit.jacket._id));
            const tGroup = productGroupsMap.get(hero.outfit.tshirt._id) || productGroupsMap.get(String(hero.outfit.tshirt._id));
            const pGroup = productGroupsMap.get(hero.outfit.pants._id) || productGroupsMap.get(String(hero.outfit.pants._id));
            const sGroup = productGroupsMap.get(hero.outfit.shoes._id) || productGroupsMap.get(String(hero.outfit.shoes._id));
            const animItems = [
              { id: String(hero.outfit.jacket._id), group: jGroup, target: m.worldChestPos, dispGroup: dispMeshes?.jacket },
              { id: String(hero.outfit.tshirt._id), group: tGroup, target: m.worldChestPos, dispGroup: dispMeshes?.tshirt },
              { id: String(hero.outfit.pants._id), group: pGroup, target: m.worldPantsPos, dispGroup: dispMeshes?.pants },
              { id: String(hero.outfit.shoes._id), group: sGroup, target: m.worldShoesPos, dispGroup: dispMeshes?.shoes },
            ];

            let hasFlightItemForThisHero = false;
            animItems.forEach(({ id, group, target, dispGroup }) => {
              if (!group) return;
              if (specificIds && !specificIds.has(id)) return;
              hasFlightItemForThisHero = true;
              const pStart = group.originalPos;
              const pEnd = target;
              group.group.visible = true;

              if (flightAnim.forward) {
                // 1. Promoted item flies: Shelf -> Mannequin
                group.group.position.x = pStart.x + (pEnd.x - pStart.x) * t;
                group.group.position.y = pStart.y + (pEnd.y - pStart.y) * t + arcY;
                group.group.position.z = pStart.z + (pEnd.z - pStart.z) * t;
                group.group.rotation.y = t * Math.PI * 4;

                // Box dissolves seamlessly into the mannequin as it arrives
                const s = t < 0.65 ? 1.0 : Math.max(0.001, (1.0 - t) / 0.35);
                group.group.scale.setScalar(s);

                // 2. 🌟 Displaced mannequin alternate product flies: Mannequin -> Shelf!
                if (dispGroup) {
                  dispGroup.visible = true;
                  dispGroup.position.x = pEnd.x + (pStart.x - pEnd.x) * t;
                  dispGroup.position.y = pEnd.y + (pStart.y - pEnd.y) * t + arcY;
                  dispGroup.position.z = pEnd.z + (pStart.z - pEnd.z) * t;
                  dispGroup.rotation.y = -t * Math.PI * 4;
                  dispGroup.scale.setScalar(1.0);
                }
              } else {
                // Revert flight:
                // 1. Promoted shelf item flies: Mannequin -> Shelf
                group.group.position.x = pEnd.x + (pStart.x - pEnd.x) * t;
                group.group.position.y = pEnd.y + (pStart.y - pEnd.y) * t + arcY;
                group.group.position.z = pEnd.z + (pStart.z - pEnd.z) * t;
                group.group.rotation.y = -t * Math.PI * 4;
                group.group.scale.setScalar(1.0);

                // 2. Displaced alternate item flies: Shelf -> Mannequin!
                if (dispGroup) {
                  dispGroup.visible = true;
                  dispGroup.position.x = pStart.x + (pEnd.x - pStart.x) * t;
                  dispGroup.position.y = pStart.y + (pEnd.y - pStart.y) * t + arcY;
                  dispGroup.position.z = pStart.z + (pEnd.z - pStart.z) * t;
                  dispGroup.rotation.y = t * Math.PI * 4;
                  const s = t < 0.65 ? 1.0 : Math.max(0.001, (1.0 - t) / 0.35);
                  dispGroup.scale.setScalar(s);
                }
              }
            });

            // Smooth color morphing for this mannequin during flight if its items are flying
            if (hasFlightItemForThisHero || !specificIds) {
              const targetJHex = getColorHexFromName(hero.outfit.jacket.color, hero.colorHex);
              const targetTHex = getColorHexFromName(hero.outfit.tshirt.color, 0xf1f5f9);
              const targetPHex = getColorHexFromName(hero.outfit.pants.color, 0x1e293b);
              const targetSHex = getColorHexFromName(hero.outfit.shoes.color, 0x0f172a);

              const isJFlying = !specificIds || specificIds.has(String(hero.outfit.jacket._id));
              const isTFlying = !specificIds || specificIds.has(String(hero.outfit.tshirt._id));
              const isPFlying = !specificIds || specificIds.has(String(hero.outfit.pants._id));
              const isSFlying = !specificIds || specificIds.has(String(hero.outfit.shoes._id));

              if (flightAnim.forward) {
                if (isJFlying) m.jacketMat.color.copy(new THREE.Color(m.defaultTorsoColor)).lerp(new THREE.Color(targetJHex), t);
                if (isTFlying) m.innerTopMat.color.copy(new THREE.Color(m.defaultInnerColor)).lerp(new THREE.Color(targetTHex), t);
                if (isPFlying) m.pantsMat.color.copy(new THREE.Color(m.defaultPantsColor)).lerp(new THREE.Color(targetPHex), t);
                if (isSFlying) m.shoesMat.color.copy(new THREE.Color(m.defaultShoesColor)).lerp(new THREE.Color(targetSHex), t);
              } else {
                if (isJFlying) m.jacketMat.color.copy(new THREE.Color(targetJHex)).lerp(new THREE.Color(m.defaultTorsoColor), t);
                if (isTFlying) m.innerTopMat.color.copy(new THREE.Color(targetTHex)).lerp(new THREE.Color(m.defaultInnerColor), t);
                if (isPFlying) m.pantsMat.color.copy(new THREE.Color(targetPHex)).lerp(new THREE.Color(m.defaultPantsColor), t);
                if (isSFlying) m.shoesMat.color.copy(new THREE.Color(targetSHex)).lerp(new THREE.Color(m.defaultShoesColor), t);
              }
            }
          });
        } else {
          // 🏬 CUPBOARD MUTUAL 1:1 SWAP: Only animate the 4 pairs of the active cupboard!
          const specificIds = flightAnim.specificProductIds;
          const targetPairs = specificIds
            ? allFlattenedCupboardPairs.filter(
                (p) =>
                  specificIds.has(p.suggested._id) ||
                  specificIds.has(p.neighbor._id)
              )
            : (allCupboardSwapPairs[selectedSuggestionIdxRef.current] || swapPairs);
          targetPairs.forEach((pair) => {
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
            const specificIds = flightAnim.specificProductIds;
            const targetHeroes = specificIds
              ? heroRunwayOutfits.filter((hero) => {
                  const hIds = [
                    String(hero.outfit.jacket._id),
                    String(hero.outfit.tshirt._id),
                    String(hero.outfit.pants._id),
                    String(hero.outfit.shoes._id),
                  ];
                  return hIds.some((id) => specificIds.has(id));
                })
              : [heroRunwayOutfits[selectedSuggestionIdxRef.current] || heroRunwayOutfits[0]];

            targetHeroes.forEach((hero) => {
              const m = mannequins[hero.index];
              if (!m) return;

              const dispMeshes = heroDisplacedGroupsMap.get(hero.index);
              const jGroup = productGroupsMap.get(hero.outfit.jacket._id) || productGroupsMap.get(String(hero.outfit.jacket._id));
              const tGroup = productGroupsMap.get(hero.outfit.tshirt._id) || productGroupsMap.get(String(hero.outfit.tshirt._id));
              const pGroup = productGroupsMap.get(hero.outfit.pants._id) || productGroupsMap.get(String(hero.outfit.pants._id));
              const sGroup = productGroupsMap.get(hero.outfit.shoes._id) || productGroupsMap.get(String(hero.outfit.shoes._id));

              const animItems = [
                { id: String(hero.outfit.jacket._id), group: jGroup, target: m.worldChestPos, dispGroup: dispMeshes?.jacket },
                { id: String(hero.outfit.tshirt._id), group: tGroup, target: m.worldChestPos, dispGroup: dispMeshes?.tshirt },
                { id: String(hero.outfit.pants._id), group: pGroup, target: m.worldPantsPos, dispGroup: dispMeshes?.pants },
                { id: String(hero.outfit.shoes._id), group: sGroup, target: m.worldShoesPos, dispGroup: dispMeshes?.shoes },
              ];

              animItems.forEach(({ id, group, target, dispGroup }) => {
                if (!group) return;
                if (specificIds && !specificIds.has(id)) return;
                group.group.rotation.y = 0;
                if (flightAnim.forward) {
                  // Forward swap: box reached mannequin -> hide shelf box, mannequin wears actual 3D accessories!
                  group.group.position.copy(target);
                  group.group.visible = false;
                  group.group.scale.setScalar(1.0);

                  // 🌟 Displaced product lands squarely in shelf slot so slot is never empty!
                  if (dispGroup) {
                    dispGroup.position.copy(group.originalPos);
                    dispGroup.visible = true;
                    dispGroup.scale.setScalar(1.0);
                    dispGroup.rotation.y = 0;
                  }
                } else {
                  // Revert swap: box back on shelf -> show box in shelf at original position!
                  group.group.position.copy(group.originalPos);
                  group.group.visible = true;
                  group.group.scale.setScalar(1.0);

                  // Displaced product returns to mannequin and hides
                  if (dispGroup) {
                    dispGroup.position.copy(target);
                    dispGroup.visible = false;
                    dispGroup.scale.setScalar(1.0);
                    dispGroup.rotation.y = 0;
                  }
                }
              });

              // Update positions and mannequin styling according to active executed items
              syncPositionsAndOutfits();
            });
          } else {
            const specificIds = flightAnim.specificProductIds;
            const targetPairs = specificIds
              ? allFlattenedCupboardPairs.filter(
                  (p) =>
                    specificIds.has(p.suggested._id) ||
                    specificIds.has(p.neighbor._id)
                )
              : (allCupboardSwapPairs[selectedSuggestionIdxRef.current] || swapPairs);
            targetPairs.forEach((pair) => {
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

    let resizeRafId: number | null = null;
    const doResize = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = rect.width || container.clientWidth || window.innerWidth;
      const newHeight = rect.height || container.clientHeight || window.innerHeight || 740;
      if (newWidth <= 0 || newHeight <= 0) return;
      if (Math.abs(newWidth - width) < 1 && Math.abs(newHeight - height) < 1) return;
      width = newWidth;
      height = newHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const handleResize = () => {
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(doResize);
    };

    const handleOrientationChange = () => {
      // Allow mobile browser viewport geometry 80ms to settle during screen rotation
      setTimeout(handleResize, 80);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (container) resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(reqId);
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
      domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("wheel", onWheel);
      domElement.removeEventListener("click", onClick);
      domElement.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);

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
    catalogProducts.length,
    swapMode,
  ]);

  // Active product display: ONLY when user hovered a product, clicked/inspected a product, or searched a product
  const activeDisplayProduct = hoveredProduct || inspectedProduct || searchedProduct || null;
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

  // 📱 REUSABLE MOBILE SEARCH DRAWER (FAST SEARCH ACROSS ALL 60 PRODUCTS WITH 3D SCOPE TARGETING)
  const renderMobileSearchDrawer = (onClose?: () => void) => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = catalogProducts.filter((p) => {
      const matchDept = mobileSearchDept === "All" || p.category.toLowerCase() === mobileSearchDept.toLowerCase();
      if (!matchDept) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.color && p.color.toLowerCase().includes(q))
      );
    });

    const storeDepts = ["All", "Jackets", "Shirts", "Jeans", "T-Shirts", "Shoes"];

    return (
      <div
        className={`glass-panel rounded-3xl p-3.5 flex flex-col h-full shadow-2xl border border-amber-500/35 overflow-hidden ${
          onClose ? "bg-stone-950/95 h-full" : ""
        }`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between pb-2 border-b border-amber-500/20">
          <div className="flex items-center gap-1.5 min-w-0">
            <Search className="w-4 h-4 text-amber-400 shrink-0" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">
              Product Search & 3D Scope
            </h4>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
              {filtered.length} SKUs
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

        {/* Search Input Box */}
        <div className="my-2 relative shrink-0">
          <Search className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, color, category, SKU..."
            autoFocus
            className="w-full glass-search-input text-white placeholder-stone-400 pl-9 pr-8 py-2 rounded-xl text-xs focus:outline-none transition-all font-semibold border border-amber-500/30 bg-stone-900/90 focus:border-amber-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-white rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Department Filter Chips */}
        <div className="flex gap-1 overflow-x-auto pb-1.5 custom-scrollbar shrink-0">
          {storeDepts.map((dept) => {
            const isSelected = mobileSearchDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setMobileSearchDept(dept)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border shrink-0 ${
                  isSelected
                    ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 border-amber-400 shadow-sm"
                    : "bg-stone-900/80 text-stone-300 border-stone-800 hover:border-amber-500/40 hover:text-white"
                }`}
              >
                {dept}
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 custom-scrollbar my-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center space-y-1 text-stone-400 text-xs">
              <p className="font-bold text-stone-300">No matching products</p>
              <p className="text-[10px]">Try searching for "Blazer", "Denim", "Navy", "Boot", etc.</p>
            </div>
          ) : (
            filtered.map((prod) => {
              const isLocked = searchedProduct?._id === prod._id;
              const shelf = getProductShelfLocation(prod);
              return (
                <div
                  key={prod._id}
                  onClick={() => {
                    handleSelectSearchedProduct(prod);
                    setMobileDrawer("inspect");
                    showToast(`🎯 3D Scope locked onto ${prod.name}!`, "success");
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer group ${
                    isLocked
                      ? "bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/50"
                      : "bg-stone-900/70 border-stone-800/80 hover:border-amber-500/40 hover:bg-stone-900"
                  }`}
                >
                  <img
                    src={getProductImage(prod.category, prod.color, prod.name, prod.imageUrl)}
                    alt={prod.name}
                    className="w-10 h-10 rounded-lg object-cover border border-amber-500/30 shrink-0 shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate">
                        {prod.name}
                      </p>
                      <span className="text-[10px] font-bold text-amber-400 font-mono shrink-0">
                        ₹{prod.price}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-stone-400">
                      <span className="font-semibold text-amber-300/90">{prod.category}</span>
                      <span>•</span>
                      <span className="text-stone-300">{prod.color}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">{prod.stock} in stock</span>
                    </div>
                    <p className="text-[8px] text-stone-400 truncate mt-0.5">
                      📍 {shelf?.zone || "Shelf Slot"}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-stone-950 text-amber-400 transition-colors">
                    <Crosshair className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

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
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 shrink-0">
                  {hoveredMannequin.part === "upper"
                    ? "Upper Ensemble (2)"
                    : hoveredMannequin.part === "pants"
                    ? "Lower Body"
                    : "Footwear"}
                </span>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer"
                    title="Close Inspector"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
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
            <div className="shrink-0 pt-2 border-t border-amber-500/20 mt-auto space-y-1.5">
              <button
                onClick={() => {
                  const heroStation = heroRunwayPairs[hoveredMannequin.mannequinIndex];
                  const focusPos = heroStation?.worldTargetPos || new THREE.Vector3(0, 1.8, 1.8);
                  focusCameraOnPosRef.current?.(focusPos);
                  if (scopePointerGroupRef.current) {
                    scopePointerGroupRef.current.position.copy(focusPos);
                    scopePointerGroupRef.current.visible = true;
                  }
                  if (onClose && typeof window !== "undefined" && window.innerWidth < 1024) {
                    onClose();
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 hover:border-amber-400 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm group"
                title="Zoom Camera to Mannequin & Lock Tactical Target Reticle"
              >
                <Crosshair className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Zoom & Target in 3D</span>
                <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
              </button>

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
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  {activeDisplayProduct.category}
                </span>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer"
                    title="Close Inspector"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
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

            {/* Quick Action Buttons - Pinned */}
            <div className="shrink-0 pt-2 border-t border-amber-500/20 mt-auto space-y-1.5">
              {/* 🎯 3D Tactical Zoom & Accuracy Targeting Button */}
              <button
                onClick={() => {
                  const pGroup = productGroupsMapRef.current.get(activeDisplayProduct._id);
                  const targetPos = pGroup
                    ? pGroup.group.position
                    : new THREE.Vector3(activeProductCoords.x, activeProductCoords.y, activeProductCoords.z);
                  focusCameraOnPosRef.current?.(targetPos);
                  if (scopePointerGroupRef.current) {
                    scopePointerGroupRef.current.position.copy(targetPos);
                    scopePointerGroupRef.current.visible = true;
                  }
                  setSearchedProduct(activeDisplayProduct);
                  if (onClose && typeof window !== "undefined" && window.innerWidth < 1024) {
                    onClose();
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 hover:border-amber-400 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm group"
                title="Zoom Camera to 3D Shelf & Lock Tactical Target Reticle"
              >
                <Crosshair className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Zoom & Target in 3D</span>
                <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
              </button>

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
            displaced: {
              item: hero.displacedOutfit.jacket,
              targetCoords: {
                x: hero.locations.jacket.x,
                y: hero.locations.jacket.y,
                z: hero.locations.jacket.z,
                zone: `${hero.locations.jacket.zone || "Executive Outerwear Cupboard"} (Slot ${hero.locations.jacket.slot || 1})`,
              },
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
            displaced: {
              item: hero.displacedOutfit.tshirt,
              targetCoords: {
                x: hero.locations.tshirt.x,
                y: hero.locations.tshirt.y,
                z: hero.locations.tshirt.z,
                zone: `${hero.locations.tshirt.zone || "Formal Shirts Wardrobe"} (Slot ${hero.locations.tshirt.slot || 1})`,
              },
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
            displaced: {
              item: hero.displacedOutfit.pants,
              targetCoords: {
                x: hero.locations.pants.x,
                y: hero.locations.pants.y,
                z: hero.locations.pants.z,
                zone: `${hero.locations.pants.zone || "Premium Denim Cupboard"} (Slot ${hero.locations.pants.slot || 1})`,
              },
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
            displaced: {
              item: hero.displacedOutfit.shoes,
              targetCoords: {
                x: hero.locations.shoes.x,
                y: hero.locations.shoes.y,
                z: hero.locations.shoes.z,
                zone: `${hero.locations.shoes.zone || "Footwear Vitrine Gallery"} (Slot ${hero.locations.shoes.slot || 1})`,
              },
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
      (t) => !executedFloorItems[t.item._id]
    );
    const executedTasksInStation = activeTasks.filter(
      (t) => Boolean(executedFloorItems[t.item._id])
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
            {canManageShowroom && (
              <button
                onClick={handleResetEntireShowroom}
                disabled={isSavingFloorSwap}
                className="text-[9px] bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30 cursor-pointer transition-colors"
                title="Seasonal Store Reset: Revert all 8 stations back to baseline home shelves"
              >
                Reset Store
              </button>
            )}
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
        {!onClose && (
          <div className="hidden lg:flex p-0.5 bg-stone-900/90 rounded-xl border border-amber-500/25 my-1.5 shrink-0">
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
        )}

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
              const isExecuted = Boolean(executedFloorItems[task.item._id]);

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

                  {/* Displaced Alternate Product Return Route */}
                  {task.displaced && task.displaced.item && (
                    <div className="ml-7 flex items-center gap-1.5 text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-200 px-2 py-1 rounded-xl">
                      <ArrowRightLeft className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="text-amber-400 font-bold shrink-0">⇄ Displaced to Shelf:</span>
                      <strong className="text-white truncate font-bold">{task.displaced.item.name}</strong>
                    </div>
                  )}

                  {/* Swapped By Staff Attribution Badge */}
                  {isExecuted && floorSwapStaffMap[task.item._id] && (
                    <div className="ml-7 flex items-center gap-1.5 text-[9px] text-emerald-300 bg-emerald-950/80 px-2 py-1 rounded-xl border border-emerald-500/40 shadow-sm">
                      <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        Swapped by: <strong className="text-white font-extrabold">{floorSwapStaffMap[task.item._id]?.staffName}</strong>
                      </span>
                      {floorSwapStaffMap[task.item._id]?.timestamp && (
                        <span className="text-emerald-400/80 text-[8px] ml-auto shrink-0 font-mono">
                          {new Date(floorSwapStaffMap[task.item._id]!.timestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )}

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
                      !executedFloorItems[t.item._id]
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
        {!onClose && (
          <div className="hidden lg:flex p-0.5 bg-stone-900/90 rounded-xl border border-amber-500/25 my-1.5 shrink-0">
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
        )}

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
                <span>Visual Simulation Active ({activeSuggestion.lift} Lift) ✓</span>
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
                  <span>Reset Preview</span>
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
              <span>Simulate Planogram in 3D (Visual Preview)</span>
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
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing select-none" style={{ touchAction: "none" }} />

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
          className="h-9 glass-panel px-2.5 sm:px-3 rounded-xl sm:rounded-2xl flex items-center gap-1.5 sm:gap-2 pointer-events-auto border border-amber-500/35 shadow-2xl shrink-0"
        >
          <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-stone-950 font-black text-[10px] sm:text-[11px] shadow-sm shrink-0">
            VR
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm whitespace-nowrap">
              VELOCITY <span className="hidden xl:inline">SHOWROOM</span>
            </h3>
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          </div>
        </div>

        {/* 🎯 CENTER: PRODUCT SEARCH BAR WITH 3D SCOPE POINTER TARGETING (Flex-1 flow, zero collision) */}
        <div
          ref={searchContainerRef}
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="flex-1 min-w-0 max-w-xs md:max-w-sm mx-1.5 sm:mx-3 pointer-events-auto relative z-30 h-9"
        >
          <div className="relative flex items-center h-full">
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
              className="w-full h-full glass-search-input text-white placeholder-amber-200/75 pl-7 sm:pl-9 pr-6 sm:pr-8 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs focus:outline-none transition-all font-semibold"
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

          {/* Toggle Sidebar Overlay Button (Desktop Only) */}
          <button
            onClick={() => setIsOverlayVisible((prev) => !prev)}
            className={`h-9 hidden lg:flex px-2 sm:px-2.5 rounded-xl text-xs font-bold items-center gap-1.5 transition-all border shrink-0 ${
              isOverlayVisible
                ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 border-amber-400 shadow-lg shadow-orange-500/30 font-black"
                : "glass-panel text-amber-200 border-amber-500/40 hover:text-white"
            }`}
            title={isOverlayVisible ? "Hide overlay to view full 3D showroom" : "Show Product & Strategy Overlay"}
          >
            {isOverlayVisible ? <EyeOff className="w-3.5 h-3.5 text-amber-300 shrink-0" /> : <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            <span className="hidden xl:inline">{isOverlayVisible ? "Hide Overlay" : "Show Overlay"}</span>
          </button>

          {/* Auto Rotate Button */}
          <button
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all border shrink-0 ${
              autoRotate
                ? "bg-amber-500/25 border-amber-500/70 text-amber-300 shadow-md shadow-amber-500/20"
                : "glass-panel text-slate-300 border-amber-500/30 hover:text-white"
            }`}
            title="Toggle Auto Orbit"
          >
            <RotateCw className={`w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0 ${autoRotate ? "animate-spin text-amber-400" : ""}`} />
          </button>

          {/* Zoom Controls (Hidden on small screens) */}
          <div className="h-9 hidden lg:flex items-center glass-panel rounded-xl border border-amber-500/30 px-1 shadow-sm shrink-0">
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
            className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all shadow-lg cursor-pointer shrink-0 border ${
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
          {renderInspectorCard(handleCloseInspector)}
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
      {/* Mobile Drawer Backdrop (Transparent click-catcher with zero blur and passes touches through for 3D rotation) */}
      {mobileDrawer !== "none" && (
        <div
          onClick={() => {
            setMobileDrawer("none");
            isMouseOverUIRef.current = false;
          }}
          className="lg:hidden fixed inset-0 z-40 pointer-events-none"
        />
      )}

      {/* Mobile Product Search Drawer (Real-Time Search & 3D Scope Pointer - 97vh) */}
      {mobileDrawer === "search" && (
        <div className="lg:hidden fixed right-2 sm:right-3 top-2 bottom-2 z-50 w-[92vw] max-w-[360px] h-[97vh] max-h-[97vh] flex flex-col pointer-events-auto shadow-2xl animate-in slide-in-from-right duration-250">
          {renderMobileSearchDrawer(() => {
            setMobileDrawer("none");
            isMouseOverUIRef.current = false;
          })}
        </div>
      )}

      {/* Mobile Inspector Drawer (Right-docked, 3D showroom visible on left - 97vh) */}
      {mobileDrawer === "inspect" && (
        <div className="lg:hidden fixed right-2 sm:right-3 top-2 bottom-2 z-50 w-[92vw] max-w-[360px] h-[97vh] max-h-[97vh] flex flex-col pointer-events-auto shadow-2xl animate-in slide-in-from-right duration-250">
          {renderInspectorCard(handleCloseInspector)}
        </div>
      )}

      {/* Mobile Planogram Strategy Drawer (Right-docked, 3D showroom visible on left - 97vh) */}
      {mobileDrawer === "strategy" && (
        <div className="lg:hidden fixed right-2 sm:right-3 top-2 bottom-2 z-50 w-[92vw] max-w-[360px] h-[97vh] max-h-[97vh] flex flex-col pointer-events-auto shadow-2xl animate-in slide-in-from-right duration-250">
          {renderStrategyCard(() => setMobileDrawer("none"))}
        </div>
      )}

      {/* Mobile Floor Staff Real-World Swap Tasks Drawer (Right-docked, 3D showroom visible on left - 97vh) */}
      {mobileDrawer === "tasks" && (
        <div className="lg:hidden fixed right-2 sm:right-3 top-2 bottom-2 z-50 w-[92vw] max-w-[360px] h-[97vh] max-h-[97vh] flex flex-col pointer-events-auto shadow-2xl animate-in slide-in-from-right duration-250">
          {renderFloorTasksCard(() => setMobileDrawer("none"))}
        </div>
      )}

      {/* 📱 MOBILE QUICK ACTION BOTTOM DOCK FOR FLOOR STAFF */}
      <div className="lg:hidden absolute bottom-2.5 left-2 sm:left-3 right-2 sm:right-3 z-30 flex items-center justify-between gap-1 p-1 rounded-2xl glass-panel border border-amber-500/40 bg-stone-950/90 shadow-2xl pointer-events-auto">

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

        {/* 📱 Mobile Recenter / Reset Camera View Button */}
        <button
          onClick={() => {
            zoomControlRef.current.resetView();
            setSearchedProduct(null);
            setInspectedProduct(null);
            setHoveredProduct(null);
            setHoveredMannequin(null);
          }}
          className="py-1.5 px-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/25 shrink-0"
          title="Recenter Camera to Center Stage"
        >
          <RotateCcw className="w-3 h-3 text-amber-400" />
          <span>Recenter</span>
        </button>

        {/* 📱 Mobile Landscape 3D View / Rotate Button */}
        <button
          onClick={handleToggleMobileLandscape}
          className={`py-1.5 px-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all border shrink-0 ${
            isMobileLandscape || isForcedRotate90
              ? "bg-rose-600/90 hover:bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30 font-bold"
              : "border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/25"
          }`}
          title={isMobileLandscape || isForcedRotate90 ? "Exit Landscape View" : "Rotate to Landscape 3D View"}
        >
          {isMobileLandscape || isForcedRotate90 ? (
            <>
              <X className="w-3 h-3 text-white" />
              <span>Exit</span>
            </>
          ) : (
            <>
              <Smartphone className="w-3 h-3 text-amber-400 rotate-90" />
              <span>3D Land</span>
            </>
          )}
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
