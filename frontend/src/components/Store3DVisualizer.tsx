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
  const [currentTime, setCurrentTime] = useState("");
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const hasUserSelectedRef = useRef(false);

  // Active AI Planogram Selection (Pair 1 to Pair 5)
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(selectedPairIndex ?? 0);

  // Hovered / Inspected Product State for Rich Side Overlay
  const [hoveredProduct, setHoveredProduct] = useState<Product | null>(null);
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(null);
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
  const triggerFlightAnimationRef = useRef<((forward?: boolean) => void) | null>(null);

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

  // Zoom / Pan Ref for toolbar buttons
  const zoomControlRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
  }>({
    zoomIn: () => {},
    zoomOut: () => {},
    resetView: () => {},
  });

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

  // Group products by 5 categories (12 items each = 60 products total)
  const jackets = catalogProducts.filter((p) => p.category === "Jackets");
  const jeans = catalogProducts.filter((p) => p.category === "Jeans");
  const shirts = catalogProducts.filter((p) => p.category === "Shirts");
  const tshirts = catalogProducts.filter((p) => p.category === "T-Shirts");
  const shoes = catalogProducts.filter((p) => p.category === "Shoes");

  // Dynamic AI Planogram Suggestions (Cross-Cupboard Complementary Pairings)
  const suggestions = React.useMemo(() => {
    const curatedDefaultPairs = [
      {
        id: "sug-1",
        title: "Executive Outerwear + Contrast Denim Ensemble",
        dept: "Executive Outerwear",
        lift: "+84%",
        anchor: jackets.find((j) => j.color === "Beige" || j.name.includes("Cashmere")) || jackets[0],
        partner: jeans.find((j) => j.color === "Black" || j.name.includes("Tailored Slim")) || jeans[0],
        similarProducts: [
          jeans.find((j) => j.color === "Black") || jeans[0],
          shirts.find((s) => s.color === "White") || shirts[0],
          tshirts.find((t) => t.color === "Black") || tshirts[0],
          shoes.find((s) => s.color === "Black") || shoes[0],
        ].filter(Boolean),
        rationale: "High-contrast full-outfit pairing (Outerwear + Denim + Oxford Shirt + Oxford Shoe) lifts basket size by 84%.",
      },
      {
        id: "sug-2",
        title: "Streetwear Duo: Organic Tee + Layered Overshirt",
        dept: "Denim & Streetwear",
        lift: "+76%",
        anchor: tshirts.find((t) => t.color === "Black" || t.name.includes("Mercerized")) || tshirts[0],
        partner: shirts.find((s) => s.color === "White" || s.name.includes("Oxford")) || shirts[0],
        similarProducts: [
          shirts.find((s) => s.color === "White") || shirts[0],
          jeans.find((j) => j.color === "Blue" || j.color === "Navy") || jeans[1] || jeans[0],
          jackets.find((j) => j.color === "Navy") || jackets[1] || jackets[0],
          shoes.find((s) => s.color === "White") || shoes[1] || shoes[0],
        ].filter(Boolean),
        rationale: "Customers buying basic black tees readily add open-collar overshirts, denim, and sneakers.",
      },
      {
        id: "sug-3",
        title: "Formal Suiting + Handcrafted Italian Footwear",
        dept: "Executive Suits",
        lift: "+72%",
        anchor: jackets.find((j) => j.color === "Navy" || j.name.includes("Blazer")) || jackets[1] || jackets[0],
        partner: shoes.find((s) => s.color === "Black" || s.name.includes("Oxford")) || shoes[0],
        similarProducts: [
          shoes.find((s) => s.color === "Black") || shoes[0],
          shirts.find((s) => s.color === "Light Blue" || s.color === "Blue") || shirts[1] || shirts[0],
          jeans.find((j) => j.color === "Grey" || j.color === "Charcoal") || jeans[2] || jeans[0],
          tshirts.find((t) => t.color === "White") || tshirts[1] || tshirts[0],
        ].filter(Boolean),
        rationale: "Positioning handcrafted leather footwear directly with navy suits drives complete formal outfit conversion.",
      },
      {
        id: "sug-4",
        title: "Contemporary Casual: Earthy Tee + Tailored Chino",
        dept: "Contemporary Casual",
        lift: "+68%",
        anchor: tshirts.find((t) => t.color === "Olive" || t.color === "Beige") || tshirts[1] || tshirts[0],
        partner: jeans.find((j) => j.color === "Beige" || j.color === "Olive") || jeans[1] || jeans[0],
        similarProducts: [
          jeans.find((j) => j.color === "Beige" || j.color === "Olive") || jeans[1] || jeans[0],
          shirts.find((s) => s.color === "Beige" || s.color === "Brown") || shirts[2] || shirts[0],
          shoes.find((s) => s.color === "Brown" || s.color === "Tan") || shoes[2] || shoes[0],
          jackets.find((j) => j.color === "Olive" || j.color === "Brown") || jackets[2] || jackets[0],
        ].filter(Boolean),
        rationale: "Matching earth-tone organic studio tees with neutral trousers and loafers lifts impulse multi-item checkout by 68%.",
      },
      {
        id: "sug-5",
        title: "Evening Monochromatic: Overcoat + Chelsea Boot",
        dept: "Luxury Showcase",
        lift: "+64%",
        anchor: jackets.find((j) => j.color === "Black" || j.name.includes("Trench")) || jackets[2] || jackets[0],
        partner: shoes.find((s) => s.color === "Maroon" || s.name.includes("Chelsea")) || shoes[1] || shoes[0],
        similarProducts: [
          shoes.find((s) => s.color === "Maroon" || s.name.includes("Chelsea")) || shoes[1] || shoes[0],
          jeans.find((j) => j.color === "Black") || jeans[0],
          shirts.find((s) => s.color === "Black") || shirts[3] || shirts[0],
          tshirts.find((t) => t.color === "Charcoal") || tshirts[2] || tshirts[0],
        ].filter(Boolean),
        rationale: "Co-locating sleek all-black luxury evening coats with Chelsea boots and dark denim creates a full evening package.",
      },
    ];

    const dynamicPairs = (recommendations && recommendations.length > 0)
      ? recommendations.map((rec, idx) => ({
          id: `sug-${idx + 1}`,
          title: `${rec.sourceProduct.name} + ${rec.similarProducts[0]?.name || "Cross-Sell Partner"}`,
          dept: rec.sourceProduct.category,
          lift: idx === 0 ? "+84%" : idx === 1 ? "+76%" : idx === 2 ? "+72%" : idx === 3 ? "+68%" : "+64%",
          anchor: rec.sourceProduct,
          partner: rec.similarProducts[0] || jeans[idx % (jeans.length || 1)] || jackets[0],
          similarProducts: rec.similarProducts,
          rationale: rec.reason || "Cross-department attribute pairing recommended by velocity engine.",
        }))
      : [];

    const result = [...dynamicPairs];
    for (let i = result.length; i < 5; i++) {
      result.push(curatedDefaultPairs[i]);
    }
    return result.slice(0, 5);
  }, [recommendations, jackets, jeans, shirts, tshirts, shoes]);

  const activeSuggestion = suggestions[selectedSuggestionIdx] || suggestions[0];
  const targetSpot = getPopularSpotByIndex(selectedSuggestionIdx);
  const fastMoverProduct = activeSuggestion.anchor;
  const pairedProduct = activeSuggestion.partner;

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
  // Each suggested partner S_i swaps with a distinct neighbor D_i in the fast mover's cupboard!
  const swapPairs = React.useMemo(() => {
    if (!fastMoverProduct || !allSuggestingPartners.length || !cupboardProducts.length) return [];
    const suggestedIds = new Set(allSuggestingPartners.map((p) => p._id));
    const availableNeighbors = cupboardProducts.filter(
      (p) => p._id !== fastMoverProduct._id && !suggestedIds.has(p._id)
    );

    // Sort neighbors by slot proximity to F
    const fSkuNum = parseInt((fastMoverProduct.sku || "").replace(/\D/g, ""), 10) || 0;
    availableNeighbors.sort((a, b) => {
      const aSku = parseInt((a.sku || "").replace(/\D/g, ""), 10) || 0;
      const bSku = parseInt((b.sku || "").replace(/\D/g, ""), 10) || 0;
      return Math.abs(aSku - fSkuNum) - Math.abs(bSku - fSkuNum);
    });

    const colors = [0xc084fc, 0x38bdf8, 0xf43f5e, 0x10b981, 0xfbbf24];

    return allSuggestingPartners.map((suggested, idx) => {
      const neighbor =
        availableNeighbors[idx % (availableNeighbors.length || 1)] ||
        cupboardProducts[(idx + 1) % cupboardProducts.length];
      return {
        suggested,
        neighbor,
        index: idx,
        colorHex: colors[idx % colors.length],
        colorCss:
          idx === 0
            ? "#c084fc"
            : idx === 1
            ? "#38bdf8"
            : idx === 2
            ? "#f43f5e"
            : idx === 3
            ? "#10b981"
            : "#fbbf24",
      };
    });
  }, [fastMoverProduct, allSuggestingPartners, cupboardProducts]);

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

  // Load Persisted Planogram State from MongoDB
  useEffect(() => {
    const loadPlanogram = async () => {
      try {
        const { data } = await api.get("/recommendations/planogram");
        if (data) {
          setPlanogramApplied(Boolean(data.applied));
          if (data.swapMode) setSwapMode(data.swapMode);
          if (!hasUserSelectedRef.current && data.activePairId) {
            const idx = suggestions.findIndex((s) => s.id === data.activePairId);
            if (idx !== -1) setSelectedSuggestionIdx(idx);
          }
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
        if (data.applied && !planogramApplied) {
          triggerFlightAnimationRef.current?.(true);
        }
        setPlanogramApplied(Boolean(data.applied));
        if (data.applied && data.activePairId) {
          const idx = suggestions.findIndex((s) => s.id === data.activePairId);
          if (idx !== -1) setSelectedSuggestionIdx(idx);
        }
      }
    }
    if (event === "product:updated") {
      dispatch(fetchProducts());
    }
  });

  // Digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
      const mutualSwapList = swapPairs.map((pair) => {
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
      await api.post("/recommendations/apply-planogram", payload);
      triggerFlightAnimationRef.current?.(true);
      setPlanogramApplied(true);
      showToast(
        swapMode === "cupboard"
          ? `Planogram Active: ${swapPairs.length} product pairs mutually swapped cleanly across cupboards!`
          : `Planogram Active: Pair promoted to Hero Runway ${targetSpot.code}!`,
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
      triggerFlightAnimationRef.current?.(false);
      await api.post("/recommendations/reset-planogram");
      setPlanogramApplied(false);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Capped at 1.5x to eliminate lag
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

    // Helper: Create an individual 3D Product Display Item on a shelf
    const createProductMesh = (product: Product, x: number, y: number, z: number): THREE.Group => {
      const prodGroup = new THREE.Group();
      prodGroup.position.set(x, y, z);

      const colorHex = getColorHex(product.color);
      const cat = (product.category || "").toLowerCase();

      let itemMesh: THREE.Mesh;

      if (cat.includes("jacket")) {
        // Luxury tailored hanger + blazer torso
        const hanger = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 16, Math.PI), chromeMat);
        hanger.position.y = 0.55;
        prodGroup.add(hanger);
        itemMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.85, 0.22),
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, metalness: 0.1 })
        );
        itemMesh.position.y = 0.25;
      } else if (cat.includes("shirt")) {
        // Folded luxury shirt package
        itemMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.2, 0.55),
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.15 })
        );
        itemMesh.position.y = 0.1;
      } else if (cat.includes("jean")) {
        // Folded denim stack
        itemMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.28, 0.55),
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7, metalness: 0.1 })
        );
        itemMesh.position.y = 0.14;
      } else if (cat.includes("t-shirt")) {
        // Crisp folded streetwear tee
        itemMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.16, 0.52),
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 })
        );
        itemMesh.position.y = 0.08;
      } else {
        // Handcrafted footwear pedestal pair
        itemMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.22, 0.45),
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.4 })
        );
        itemMesh.position.y = 0.11;
      }

      prodGroup.add(itemMesh);

      // Gold base plinth
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.46, 0.04, 24),
        goldBrassMat
      );
      plinth.position.y = 0.02;
      prodGroup.add(plinth);

      // Price Tag Badge
      const canvas = document.createElement("canvas");
      canvas.width = 192;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "rgba(10, 15, 29, 0.9)";
      ctx.fillRect(0, 0, 192, 64);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 188, 60);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`₹${product.price}`, 96, 42);

      const tagTex = new THREE.CanvasTexture(canvas);
      const tagMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.45, 0.16),
        new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })
      );
      tagMesh.position.set(0, 0.04, 0.32);
      tagMesh.rotation.x = -Math.PI / 8;
      prodGroup.add(tagMesh);

      // Invisible interactive hitBox for seamless hovering & clicking
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshBasicMaterial({ visible: false })
      );
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

      // 1. Back panel (Dark walnut)
      const back = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, HEIGHT, 0.08), darkWalnutMat);
      back.position.set(0, HEIGHT / 2, -DEPTH / 2);
      group.add(back);

      // 2. Left and Right vertical side pillars
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x182030, roughness: 0.4, metalness: 0.4 });
      const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, HEIGHT, DEPTH), sideMat);
      leftSide.position.set(-WIDTH / 2, HEIGHT / 2, 0);
      group.add(leftSide);

      const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, HEIGHT, DEPTH), sideMat);
      rightSide.position.set(WIDTH / 2, HEIGHT / 2, 0);
      group.add(rightSide);

      // 3. Top canopy & Bottom plinth
      const topCanopy = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 0.2, 0.16, DEPTH + 0.1), sideMat);
      topCanopy.position.set(0, HEIGHT, 0);
      group.add(topCanopy);

      const bottomPlinth = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 0.2, 0.24, DEPTH + 0.1), sideMat);
      bottomPlinth.position.set(0, 0.12, 0);
      group.add(bottomPlinth);

      // 4. Sleek Neon Accent strip on top cornice
      const neonStrip = new THREE.Mesh(
        new THREE.BoxGeometry(WIDTH + 0.18, 0.04, 0.04),
        new THREE.MeshBasicMaterial({ color: fixture.accentColor })
      );
      neonStrip.position.set(0, HEIGHT + 0.08, DEPTH / 2 + 0.04);
      group.add(neonStrip);

      // 5. Overhead illuminated signboard
      const signboard = createSignboard(fixture.name, fixture.department, fixture.accentColor);
      signboard.position.set(0, HEIGHT + 0.55, DEPTH / 2);
      group.add(signboard);

      // 6. 3 Glass / Walnut shelves (Top, Middle, Lower)
      const shelfY = [3.4, 2.2, 1.0];
      shelfY.forEach((y) => {
        const shelfMesh = new THREE.Mesh(new THREE.BoxGeometry(WIDTH - 0.2, 0.08, DEPTH - 0.1), glassShelfMat);
        shelfMesh.position.set(0, y, 0);
        group.add(shelfMesh);

        // Gold shelf lip
        const lip = new THREE.Mesh(new THREE.BoxGeometry(WIDTH - 0.18, 0.03, 0.03), goldBrassMat);
        lip.position.set(0, y + 0.04, DEPTH / 2 - 0.06);
        group.add(lip);
      });

      // 7. Place Products into the Cupboard Slots (12 products = 4 per shelf x 3 shelves)
      fixture.products.forEach((prod, pIdx) => {
        const shelfIdx = Math.floor(pIdx / 4);
        const colIdx = pIdx % 4; // 0, 1, 2, 3
        const localX = -1.5 + colIdx * 1.0;
        const localY = shelfY[shelfIdx];
        const localZ = 0.1;

        const worldX = fixture.x + localX;
        const worldY = localY;
        const worldZ = fixture.z + localZ;

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

    // Two Tier Pedestals for 12 shoes (6 upper tier, 6 lower tier)
    const upperPedestal = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.4, 1.2), darkWalnutMat);
    upperPedestal.position.set(0, 1.6, -1.0);
    footwearGalleryGroup.add(upperPedestal);

    const lowerPedestal = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.4, 1.2), darkWalnutMat);
    lowerPedestal.position.set(0, 0.7, 1.0);
    footwearGalleryGroup.add(lowerPedestal);

    shoes.forEach((shoe, idx) => {
      const isUpper = idx < 6;
      const colIdx = isUpper ? idx : idx - 6;
      const localX = -5.0 + colIdx * 2.0;
      const localY = isUpper ? 1.8 : 0.9;
      const localZ = isUpper ? -1.0 : 1.0;

      const worldX = localX;
      const worldY = localY;
      const worldZ = -11.0 + localZ;

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
    // 🌟 HERO PROMENADE RUNWAY & PLANOGRAM STAGE (CENTER STAGE AT z = 1.8)
    // =========================================================================
    const runwayGroup = new THREE.Group();
    runwayGroup.position.set(0, 0, 1.8);

    // Prominent circular runway podium
    const runwayPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.2, 0.28, 36),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3, metalness: 0.4 })
    );
    runwayPlinth.position.y = 0.14;
    runwayGroup.add(runwayPlinth);

    // Gold brass rim
    const brassRim = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.2, 36), goldBrassMat);
    brassRim.rotation.x = -Math.PI / 2;
    brassRim.position.y = 0.29;
    runwayGroup.add(brassRim);

    // Glowing Amber Neon Halo
    const neonHalo = new THREE.Mesh(
      new THREE.RingGeometry(3.24, 3.32, 36),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
    );
    neonHalo.rotation.x = -Math.PI / 2;
    neonHalo.position.y = 0.295;
    runwayGroup.add(neonHalo);

    // Hero Anchor Podium (Left) & Swapped Partner Podium (Right)
    const anchorPodium = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.7, 24), darkWalnutMat);
    anchorPodium.position.set(-1.2, 0.64, 0);
    runwayGroup.add(anchorPodium);

    const partnerPodium = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.7, 24), darkWalnutMat);
    partnerPodium.position.set(1.2, 0.64, 0);
    runwayGroup.add(partnerPodium);

    scene.add(runwayGroup);

    // Save product groups reference for search targeting
    productGroupsMapRef.current = productGroupsMap;

    // Camera target focus helper
    focusCameraOnPosRef.current = (pos: THREE.Vector3) => {
      targetLookAt.set(pos.x, pos.y + 0.35, pos.z);
      targetRadius = 11;
      sphericalPhi = Math.PI / 3.4;
      sphericalTheta = Math.atan2(pos.x, pos.z) + 0.35;
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

    swapPairs.forEach((pair, sIdx) => {
      const pShelfLoc = getProductShelfLocation(pair.suggested);
      const nShelfLoc = getProductShelfLocation(pair.neighbor);

      const originShelfPt = new THREE.Vector3(pShelfLoc.x, pShelfLoc.y + 0.3, pShelfLoc.z);
      const targetShelfPt = new THREE.Vector3(nShelfLoc.x, nShelfLoc.y + 0.3, nShelfLoc.z);

      const arcApexY = Math.max(originShelfPt.y, targetShelfPt.y) + 2.6 + sIdx * 0.35;
      const arcMidPt = new THREE.Vector3(
        (originShelfPt.x + targetShelfPt.x) / 2,
        arcApexY,
        (originShelfPt.z + targetShelfPt.z) / 2
      );

      const neonCurve = new THREE.QuadraticBezierCurve3(originShelfPt, arcMidPt, targetShelfPt);
      const neonColor = pair.colorHex;

      // Glowing Tube line connecting suggested item to neighbor slot
      const tubeGeo = new THREE.TubeGeometry(neonCurve, 36, 0.022, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color: neonColor });
      scene.add(new THREE.Mesh(tubeGeo, tubeMat));

      // Arrow cone pointing into target slot beside fast mover
      const arrowCone = new THREE.Mesh(arrowConeGeo, new THREE.MeshBasicMaterial({ color: neonColor }));
      const ptBefore = neonCurve.getPoint(0.93);
      const ptEnd = neonCurve.getPoint(0.98);
      arrowCone.position.copy(ptEnd);
      arrowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ptEnd.clone().sub(ptBefore).normalize());
      scene.add(arrowCone);

      // Return arrow cone pointing into the other cupboard (mutual exchange route)
      const returnArrowCone = new THREE.Mesh(arrowConeGeo, new THREE.MeshBasicMaterial({ color: neonColor }));
      const rPtBefore = neonCurve.getPoint(0.07);
      const rPtEnd = neonCurve.getPoint(0.02);
      returnArrowCone.position.copy(rPtEnd);
      returnArrowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rPtEnd.clone().sub(rPtBefore).normalize());
      scene.add(returnArrowCone);

      // Flowing animated pulse along line
      const pulseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      scene.add(pulseMesh);
      animatedGuidePulses.push({ mesh: pulseMesh, curve: neonCurve, offset: sIdx * 0.22 });

      // Floating Swapped Beacon at target slot
      const bGroup = new THREE.Group();
      bGroup.position.set(nShelfLoc.x, nShelfLoc.y + 0.85, nShelfLoc.z);
      const bCanvas = document.createElement("canvas");
      bCanvas.width = 256;
      bCanvas.height = 64;
      const bCtx = bCanvas.getContext("2d")!;
      bCtx.fillStyle = "rgba(16, 185, 129, 0.95)";
      bCtx.fillRect(0, 0, 256, 64);
      bCtx.strokeStyle = "#ffffff";
      bCtx.lineWidth = 3;
      bCtx.strokeRect(2, 2, 252, 60);
      bCtx.fillStyle = "#ffffff";
      bCtx.font = "bold 20px sans-serif";
      bCtx.textAlign = "center";
      bCtx.fillText(`★ SWAPPED #${sIdx + 1}`, 128, 40);
      const bTex = new THREE.CanvasTexture(bCanvas);
      const bMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshBasicMaterial({ map: bTex, transparent: true }));
      bGroup.add(bMesh);
      bGroup.visible = Boolean(planogramAppliedRef.current);
      scene.add(bGroup);
      swapBeaconGroups.push(bGroup);
    });

    // 🚀 Flight Animation Controller for Dramatic 3D Swap
    const flightAnim = {
      active: false,
      startTime: 0,
      duration: 2000,
      forward: true,
    };

    triggerFlightAnimationRef.current = (forward = true) => {
      flightAnim.active = true;
      flightAnim.startTime = performance.now();
      flightAnim.duration = 2000;
      flightAnim.forward = forward;
    };

    // =========================================================================
    // 🕹️ INTERACTION: MOUSE ORBIT, PAN, ZOOM, AND HOVER OVER 60 PRODUCTS
    // =========================================================================
    let sphericalTheta = Math.PI / 4.2;
    let sphericalPhi = Math.PI / 3.4;
    let currentRadius = 32;
    let targetRadius = 32;
    const currentLookAt = new THREE.Vector3(0, 1.5, 0);
    const targetLookAt = new THREE.Vector3(0, 1.5, 0);

    const updateCameraPosition = () => {
      camera.position.x = currentLookAt.x + currentRadius * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
      camera.position.y = currentLookAt.y + currentRadius * Math.cos(sphericalPhi);
      camera.position.z = currentLookAt.z + currentRadius * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
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
        sphericalTheta = Math.PI / 4.2;
        sphericalPhi = Math.PI / 3.4;
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

        sphericalTheta -= deltaX * 0.006;
        sphericalPhi = Math.max(0.12, Math.min(Math.PI / 2.1, sphericalPhi - deltaY * 0.006));
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
          if (hit.userData?.isProduct && hit.userData.product) {
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

            // Update React state for Side Overlay!
            setHoveredProduct(prod);
            setInspectedProduct(prod);
            return;
          }
        } else {
          if (lastHoveredMesh) {
            lastHoveredMesh.scale.set(1, 1, 1);
            lastHoveredMesh = null;
          }
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
        if (hit.userData?.isProduct && hit.userData.product) {
          const prod = hit.userData.product as Product;
          setInspectedProduct(prod);
          onSelectProduct?.(prod);
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    domElement.addEventListener("wheel", onWheel, { passive: false });
    domElement.addEventListener("click", onClick);

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

      // Auto rotation
      if (autoRotateRef.current && !isDragging) {
        sphericalTheta += delta * 0.04;
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

      // 🌟 DRAMATIC 3D FLIGHT ARCS & MUTUAL SWAP ANIMATION
      if (flightAnim.active) {
        const elapsedMs = performance.now() - flightAnim.startTime;
        const progress = Math.min(1.0, elapsedMs / flightAnim.duration);
        const t = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        const arcY = Math.sin(progress * Math.PI) * 3.5;

        swapPairs.forEach((pair) => {
          const itemS = productGroupsMap.get(pair.suggested._id);
          const itemN = productGroupsMap.get(pair.neighbor._id);
          if (!itemS || !itemN) return;

          const pStartS = flightAnim.forward ? itemS.originalPos : itemN.originalPos;
          const pEndS = flightAnim.forward ? itemN.originalPos : itemS.originalPos;

          const pStartN = flightAnim.forward ? itemN.originalPos : itemS.originalPos;
          const pEndN = flightAnim.forward ? itemS.originalPos : itemN.originalPos;

          itemS.group.position.x = pStartS.x + (pEndS.x - pStartS.x) * t;
          itemS.group.position.y = pStartS.y + (pEndS.y - pStartS.y) * t + arcY;
          itemS.group.position.z = pStartS.z + (pEndS.z - pStartS.z) * t;
          itemS.group.rotation.y = t * Math.PI * 2;

          itemN.group.position.x = pStartN.x + (pEndN.x - pStartN.x) * t;
          itemN.group.position.y = pStartN.y + (pEndN.y - pStartN.y) * t + arcY;
          itemN.group.position.z = pStartN.z + (pEndN.z - pStartN.z) * t;
          itemN.group.rotation.y = -t * Math.PI * 2;
        });

        if (progress >= 1.0) {
          flightAnim.active = false;
          swapPairs.forEach((pair) => {
            const itemS = productGroupsMap.get(pair.suggested._id);
            const itemN = productGroupsMap.get(pair.neighbor._id);
            if (itemS) itemS.group.rotation.y = 0;
            if (itemN) itemN.group.rotation.y = 0;
          });
        }
      } else {
        // Resting Lerp Position
        swapPairs.forEach((pair) => {
          const itemS = productGroupsMap.get(pair.suggested._id);
          const itemN = productGroupsMap.get(pair.neighbor._id);
          if (!itemS || !itemN) return;

          if (planogramAppliedRef.current) {
            itemS.group.position.lerp(itemN.originalPos, 0.1);
            itemN.group.position.lerp(itemS.originalPos, 0.1);
          } else {
            itemS.group.position.lerp(itemS.originalPos, 0.1);
            itemN.group.position.lerp(itemN.originalPos, 0.1);
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      width = isFullScreen ? window.innerWidth : container.clientWidth;
      height = isFullScreen ? window.innerHeight : container.clientHeight || 740;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      visibilityObserver.disconnect();
      domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("wheel", onWheel);
      domElement.removeEventListener("click", onClick);
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
    allSuggestingPartners.length,
    swapPairs,
  ]);

  // Fallback product display if none hovered yet
  const activeDisplayProduct = inspectedProduct || hoveredProduct || fastMoverProduct;
  const activeProductCoords = React.useMemo(() => {
    if (!activeDisplayProduct) {
      return getProductShelfLocation(undefined);
    }

    if (planogramApplied && swapPairs.length > 0) {
      // Check if activeDisplayProduct is part of any mutual swap pair
      const matchingPair = swapPairs.find(
        (p) => p.suggested._id === activeDisplayProduct._id || p.neighbor._id === activeDisplayProduct._id
      );

      if (matchingPair) {
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

    return getProductShelfLocation(activeDisplayProduct);
  }, [planogramApplied, activeDisplayProduct, swapPairs]);

  const activeProductImg = activeDisplayProduct
    ? getProductImage(activeDisplayProduct.category, activeDisplayProduct.color, activeDisplayProduct.name, activeDisplayProduct.imageUrl)
    : "";

  return (
    <div
      ref={visualizerRootRef}
      className={`relative w-full rounded-3xl overflow-hidden bg-slate-100 border border-[#E5D7BE] shadow-2xl transition-all duration-300 ${
        isFullScreen ? "fixed inset-0 z-50 rounded-none border-none" : "h-[740px]"
      }`}
    >
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 🌟 1. TOP HEADER BAR: STORE BRANDING, 3D SCOPE SEARCH & CONTROLS */}
      <div className="absolute top-3 left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-none">
        {/* Left: Department Store Badge */}
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="glass-panel px-3.5 py-2 rounded-2xl flex items-center gap-3 pointer-events-auto border border-amber-500/35 shadow-2xl shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-stone-950 font-black text-sm shadow-md shadow-amber-500/25">
            VR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-white drop-shadow-sm">
                VELOCITY FLAGSHIP SHOWROOM
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            </div>
            <p className="text-[10px] text-amber-300 font-semibold drop-shadow-sm">
              5 Optimized Cupboards • All 60 Store SKUs Live with 3D DB Coordinates
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
          className="relative pointer-events-auto flex-1 max-w-md z-30"
        >
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-amber-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search 60 products (e.g. Cashmere, Oxford, SKU 1024)..."
              className="w-full bg-stone-950/85 backdrop-blur-md text-white placeholder-stone-400 pl-9 pr-8 py-2 rounded-2xl border border-amber-500/35 text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 shadow-xl transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2.5 p-1 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Clear Search & Scope Pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 max-h-72 overflow-y-auto rounded-2xl bg-stone-950/95 backdrop-blur-xl border border-amber-500/35 shadow-2xl p-1.5 space-y-1 custom-scrollbar">
              <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between border-b border-stone-800">
                <span>Matching Products ({searchResults.length})</span>
                <span className="text-stone-400">Click to lock 3D Scope</span>
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
                    className="w-9 h-9 rounded-lg object-cover border border-amber-500/30 shrink-0 shadow"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate">{prod.name}</p>
                      <span className="text-[10px] font-bold text-amber-400 font-mono ml-2 shrink-0">₹{prod.price}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400">
                      <span className="font-mono text-stone-300">{prod.sku}</span>
                      <span>•</span>
                      <span className="text-amber-400/90 font-semibold">{prod.category}</span>
                      <span>•</span>
                      <span className="text-emerald-400">{prod.stock} in stock</span>
                    </div>
                  </div>
                  <Crosshair className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Controls */}
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="flex items-center gap-2 pointer-events-auto shrink-0"
        >
          {currentTime && (
            <div className="glass-panel px-3 py-1.5 rounded-xl hidden sm:flex items-center gap-1.5 text-xs text-amber-300 border border-amber-500/30">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-[11px] font-bold">{currentTime}</span>
            </div>
          )}

          {/* Toggle Sidebar Overlay Button */}
          <button
            onClick={() => setIsOverlayVisible((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isOverlayVisible
                ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 border-amber-400 shadow-lg shadow-orange-500/30 font-black"
                : "glass-panel text-amber-200 border-amber-500/40 hover:text-white"
            }`}
            title={isOverlayVisible ? "Hide overlay to view full 3D showroom" : "Show Product & Strategy Overlay"}
          >
            {isOverlayVisible ? <EyeOff className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isOverlayVisible ? "Hide Overlay" : "Show Overlay"}</span>
          </button>

          <button
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`p-2 rounded-xl transition-all border ${
              autoRotate
                ? "bg-amber-500/25 border-amber-500/70 text-amber-300 shadow-md shadow-amber-500/20"
                : "glass-panel text-slate-300 border-amber-500/30 hover:text-white"
            }`}
            title="Toggle Auto Orbit"
          >
            <RotateCw className={`w-4 h-4 ${autoRotate ? "animate-spin text-amber-400" : ""}`} />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center glass-panel rounded-xl border border-amber-500/30 p-0.5 shadow-sm">
            <button
              onClick={() => zoomControlRef.current.zoomIn()}
              className="p-1.5 rounded-lg text-slate-200 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-stone-700/60" />
            <button
              onClick={() => zoomControlRef.current.zoomOut()}
              className="p-1.5 rounded-lg text-slate-200 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-stone-700/60" />
            <button
              onClick={() => zoomControlRef.current.resetView()}
              className="p-1.5 rounded-lg text-slate-200 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Reset View (⟲)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={toggleFullScreen}
            className="glass-panel p-2 rounded-xl text-slate-200 hover:text-white border border-amber-500/30 transition-all shadow-md cursor-pointer"
            title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 🌟 2. LEFT SIDE OVERLAY: PRODUCT DETAIL & EXACT 3D COORDINATES ON HOVER */}
      {isOverlayVisible && activeDisplayProduct && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute top-16 left-4 bottom-14 z-20 w-80 max-w-[340px] pointer-events-auto flex flex-col animate-in fade-in slide-in-from-left duration-200"
        >
          {/* Product Inspector Card */}
          <div className="glass-panel rounded-3xl p-3.5 flex flex-col h-full shadow-2xl border border-amber-500/35 overflow-hidden">
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
          </div>
        </div>
      )}

      {/* 🌟 3. RIGHT SIDE OVERLAY: AI MERCHANDISING STRATEGY & NEON LINES */}
      {isOverlayVisible && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute top-16 right-4 bottom-14 z-20 w-84 max-w-[345px] pointer-events-auto hidden lg:flex flex-col animate-in fade-in slide-in-from-right duration-200"
        >
          <div className="glass-panel rounded-3xl p-3.5 flex flex-col h-full shadow-2xl border border-amber-500/35 overflow-hidden">
            {/* Pinned Header */}
            <div className="shrink-0 flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Planogram Strategy</h4>
              </div>
              <span className="text-[10px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                {swapPairs.length} Mutual Pairs
              </span>
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

              {/* 5 Recommendation Pair Selector Tabs */}
              <div className="space-y-1.5">
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

                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-stone-900/90 border border-amber-500/30 text-[10px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <span className="font-extrabold text-amber-300 block truncate">
                      {swapMode === "cupboard"
                        ? `Anchor: ${anchorShelfLoc.zone}`
                        : `Hero Runway Stage: ${targetSpot.badge}`}
                    </span>
                    <span className="text-[9px] text-stone-400 block truncate">
                      {swapPairs.length} mutual 1-to-1 swap pairs active
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Pair Details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-white">
                  <span className="truncate font-black">{activeSuggestion.title}</span>
                  <span className="text-amber-400 font-black shrink-0 text-xs">{activeSuggestion.lift} Lift</span>
                </div>

                {/* 🔄 MUTUAL SWAP PRODUCT PAIRS LIST */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-bold text-stone-400 flex items-center justify-between">
                    <span>Mutual Multi-Product Swaps (1-to-1):</span>
                    <span className="text-amber-400 font-mono text-[8px]">NO OVERLAPS</span>
                  </span>

                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {swapPairs.map((pair) => (
                      <div
                        key={`${pair.suggested._id}-${pair.neighbor._id}`}
                        onClick={() => setInspectedProduct(pair.suggested)}
                        className="p-1.5 rounded-xl bg-stone-950/70 border border-stone-800 hover:border-amber-400/80 transition-colors cursor-pointer text-[10px] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pair.colorCss }} />
                            <span className="font-bold text-white truncate max-w-[170px]">{pair.suggested.name}</span>
                          </div>
                          <span className="font-mono text-amber-300 shrink-0 font-bold">₹{pair.suggested.price}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-stone-400 pl-3">
                          <ArrowRightLeft className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span className="truncate text-stone-300">
                            Swaps with <strong className="text-amber-200">{pair.neighbor.name}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-200 leading-relaxed bg-stone-950/70 p-2 rounded-xl border border-stone-800 font-medium">
                  {activeSuggestion.rationale}
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
        </div>
      )}

      {/* 🌟 4. BOTTOM STATUS TICKER */}
      <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none text-[10px] text-stone-400">
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
