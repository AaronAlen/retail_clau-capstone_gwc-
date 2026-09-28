import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  Sparkles,
  RotateCw,
  Maximize2,
  Minimize2,
  Flame,
  Clock,
  CheckCircle2,
  Plus,
  ShoppingCart,
  X,
  Eye,
  EyeOff,
  ChevronRight,
  TrendingUp,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Zap,
  Store,
  Layers,
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
  HERO_RUNWAY_ANCHOR,
  HERO_RUNWAY_SWAPPED,
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

interface ShelfZone {
  id: string;
  name: string;
  department: string;
  category: string;
  x: number;
  z: number;
  rotationY: number;
  color: number;
  label: string;
  products?: Product[];
  product?: Product;
  velocity?: number;
}

interface DepartmentCameraView {
  id: string;
  name: string;
  code: string;
  icon: string;
  radius: number;
  lookAt: [number, number, number];
  theta: number;
  phi: number;
}

const DEPARTMENT_VIEWS: DepartmentCameraView[] = [
  {
    id: "all",
    name: "Full Showroom",
    code: "OVERVIEW",
    icon: "🏬",
    radius: 38,
    lookAt: [0, 1.4, 0],
    theta: Math.PI / 4.2,
    phi: Math.PI / 3.4,
  },
  {
    id: "front-runway",
    name: "Front Mannequins",
    code: "FRONT",
    icon: "✨",
    radius: 14,
    lookAt: [0, 1.8, 9.2],
    theta: 0,
    phi: Math.PI / 3.8,
  },
  {
    id: "zone-1",
    name: "Executive Suits",
    code: "ZONE 1",
    icon: "👔",
    radius: 20,
    lookAt: [-12.0, 2.2, -3],
    theta: Math.PI / 3.0,
    phi: Math.PI / 3.6,
  },
  {
    id: "zone-2",
    name: "Denim & Streetwear",
    code: "ZONE 2",
    icon: "👖",
    radius: 20,
    lookAt: [12.0, 2.2, -3],
    theta: -Math.PI / 3.0,
    phi: Math.PI / 3.6,
  },
  {
    id: "zone-3",
    name: "Hero Planogram",
    code: "ZONE 3",
    icon: "⚡",
    radius: 14,
    lookAt: [0.1, 2.0, 1.5],
    theta: Math.PI / 2.0,
    phi: Math.PI / 3.5,
  },
  {
    id: "zone-4",
    name: "Footwear Lounge",
    code: "ZONE 4",
    icon: "👞",
    radius: 18,
    lookAt: [0, 1.8, -13],
    theta: 0,
    phi: Math.PI / 3.8,
  },
];

// Procedural Carrara Marble Floor Texture with Luxury Grid & Veining
const createMarbleTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#edf2f7";
  ctx.fillRect(0, 0, 1024, 1024);

  // Soft natural marble veins
  for (let i = 0; i < 35; i++) {
    ctx.strokeStyle = i % 2 === 0 ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.22)";
    ctx.lineWidth = Math.random() * 2 + 1;
    ctx.beginPath();
    let x = Math.random() * 1024;
    let y = Math.random() * 1024;
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (Math.random() - 0.48) * 180;
      y += (Math.random() - 0.35) * 180;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Brass/Charcoal Tile Inlay lines
  ctx.strokeStyle = "rgba(71, 85, 105, 0.35)";
  ctx.lineWidth = 2.5;
  for (let x = 0; x <= 1024; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
};

// Department Overhead Illuminated Sign - High-Resolution Crisp Luxury Signage
const createIlluminatedSign = (
  text: string,
  color = "#f8fafc",
  bgColor = "#080c16",
  accentColor = "#38bdf8",
  subtitle = "VELOCITY RETAIL FLAGSHIP"
): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // Deep matte obsidian luxury background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 1024, 256);

  // Subtle interior inset
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fillRect(16, 16, 992, 224);

  // Crisp thin luxury metallic neon border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 1000, 232);

  // Architectural corner accents
  ctx.fillStyle = accentColor;
  ctx.fillRect(8, 8, 14, 14);
  ctx.fillRect(1002, 8, 14, 14);
  ctx.fillRect(8, 234, 14, 14);
  ctx.fillRect(1002, 234, 14, 14);

  // Subtitle (Small uppercase tracking)
  ctx.fillStyle = accentColor;
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(subtitle.toUpperCase(), 512, 64);

  // Headline - High-contrast bold lettering, fully legible from any distance
  ctx.fillStyle = color;
  ctx.font = "bold 46px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(text, 512, 160);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
};

// 3D Floating Luxury Product Showcase Card with live Image (Optimized 384x480)
const createProductDisplayCard = (
  product: Product | undefined,
  badgeText: string,
  badgeColor = "#f59e0b",
  isSwapped = false
): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;

  const render = (img?: HTMLImageElement) => {
    // Luxury dark glass gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 480);
    bgGrad.addColorStop(0, isSwapped ? "#221330" : "#121826");
    bgGrad.addColorStop(1, "#07090e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 384, 480);

    // Glowing border
    ctx.strokeStyle = isSwapped ? "#c084fc" : badgeColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 376, 472);

    // Top Badge
    ctx.fillStyle = isSwapped ? "#9333ea" : badgeColor;
    ctx.fillRect(16, 16, 352, 42);
    ctx.fillStyle = isSwapped ? "#ffffff" : "#09090b";
    ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(badgeText.toUpperCase(), 192, 43);

    // Product Image Area
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 28, 72, 328, 270);
      ctx.strokeStyle = isSwapped ? "rgba(192, 132, 252, 0.4)" : "rgba(245, 158, 11, 0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(28, 72, 328, 270);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(28, 72, 328, 270);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(product?.category || "APPAREL", 192, 210);
    }

    // Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    const name = product?.name || "Product Name";
    ctx.fillText(name.length > 24 ? name.slice(0, 22) + "..." : name, 192, 372);

    // SKU & Category
    ctx.fillStyle = isSwapped ? "#e9d5ff" : "#cbd5e1";
    ctx.font = "600 14px monospace";
    ctx.fillText(`${product?.sku || "SKU-XXXX"} • ${product?.category || "Apparel"} • ${product?.color || ""}`, 192, 404);

    // Price & Stock
    ctx.fillStyle = isSwapped ? "#a7f3d0" : "#fbbf24";
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`₹${product?.price || 1499}  •  ${product?.stock || 20} In Stock`, 192, 444);
  };

  render();
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  if (product) {
    const imgUrl = getProductImage(product.category, product.color, product.name, product.imageUrl);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      render(img);
      texture.needsUpdate = true;
    };
    img.src = imgUrl;
  }

  return texture;
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
  const [currentTime, setCurrentTime] = useState("");

  // Feature: Allow user to collapse/hide overlay for 100% full unobstructed 3D view (Default false so 3D model is hero)
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  // Track if user explicitly clicked/switched a pair tab so external refetches never override their selection
  const hasUserSelectedRef = useRef(false);

  // Feature: Multiple AI Planogram Suggestions selection (0 to 4 corresponding to 5 Popular Feature Spots)
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(selectedPairIndex ?? 0);

  // Interactive Selected Shelf/Mannequin State
  const [selectedZone, setSelectedZone] = useState<ShelfZone | null>(null);
  const [inspectedZone, setInspectedZone] = useState<ShelfZone | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const isMouseOverUIRef = useRef(false);
  const [hoveredItem, setHoveredItem] = useState<{
    zone: ShelfZone;
    x: number;
    y: number;
  } | null>(null);
  const [selectedMannequin, setSelectedMannequin] = useState<{
    title: string;
    outfit: string;
    price: number;
    department: string;
  } | null>(null);
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
  const [savedCoordinates, setSavedCoordinates] = useState<{
    source: Coordinate3D;
    swapped: Coordinate3D;
    original: Coordinate3D;
  } | null>(null);
  const triggerFlightAnimationRef = useRef<(() => void) | null>(null);

  // Camera state persistence across pair switches so viewpoint and zoom never jump or zoom in
  const cameraStateRef = useRef<{
    theta: number;
    phi: number;
    radius: number;
    lookAt: [number, number, number];
  } | null>(null);

  // Sync external selectedPairIndex prop from parent (e.g. Recommendations page)
  useEffect(() => {
    if (selectedPairIndex !== undefined && selectedPairIndex !== selectedSuggestionIdx) {
      hasUserSelectedRef.current = true;
      setSelectedSuggestionIdx(selectedPairIndex);
      setPlanogramApplied(false);
    }
  }, [selectedPairIndex]);

  // Ensure all catalog products are loaded from Redux
  useEffect(() => {
    if (!catalogProducts || catalogProducts.length === 0) {
      dispatch(fetchProducts());
    }
  }, [dispatch, catalogProducts.length]);

  // Group all products by category for complete showroom placement
  const jackets = catalogProducts.filter((p) => p.category === "Jackets");
  const jeans = catalogProducts.filter((p) => p.category === "Jeans");
  const shirts = catalogProducts.filter((p) => p.category === "Shirts");
  const tshirts = catalogProducts.filter((p) => p.category === "T-Shirts");
  const shoes = catalogProducts.filter((p) => p.category === "Shoes");

  // Dynamic AI Planogram Suggestions: Always guarantees 5 high-synergy pairs matching the 5 Popular Feature Spots
  const suggestions = React.useMemo(() => {
    const curatedDefaultPairs = [
      {
        id: "sug-1",
        title: "Outerwear + Contrast Denim",
        dept: "Executive Outerwear",
        lift: "+84%",
        anchor: jackets.find((j) => j.color === "Beige" || j.name.includes("Cashmere")) || jackets[0],
        partner: jeans.find((j) => j.color === "Black" || j.name.includes("Tailored Slim")) || jeans[0],
        similarProducts: jeans.slice(0, 3),
        rationale: "High-contrast pairing of light neutral outerwear with black denim lifts basket size by 84%.",
      },
      {
        id: "sug-2",
        title: "Streetwear Duo: Black Tee + White Shirt",
        dept: "Denim & Streetwear",
        lift: "+76%",
        anchor: tshirts.find((t) => t.color === "Black" || t.name.includes("Mercerized")) || tshirts[0],
        partner: shirts.find((s) => s.color === "White" || s.name.includes("Oxford")) || shirts[0],
        similarProducts: shirts.slice(0, 3),
        rationale: "Customers buying basic black tees readily add open-collar white overshirts as layers.",
      },
      {
        id: "sug-3",
        title: "Formal Suiting + Italian Leather Shoe",
        dept: "Executive Suits",
        lift: "+72%",
        anchor: jackets.find((j) => j.color === "Navy" || j.name.includes("Blazer")) || jackets[1] || jackets[0],
        partner: shoes.find((s) => s.color === "Black" || s.name.includes("Oxford")) || shoes[0],
        similarProducts: shoes.slice(0, 3),
        rationale: "Positioning handcrafted leather footwear near navy executive suits drives complete outfit conversion.",
      },
      {
        id: "sug-4",
        title: "Casual Studio: Earthy Tee + Chino",
        dept: "Contemporary Casual",
        lift: "+68%",
        anchor: tshirts.find((t) => t.color === "Green" || t.color === "Brown") || tshirts[1] || tshirts[0],
        partner: jeans.find((j) => j.color === "Brown" || j.color === "Grey") || jeans[1] || jeans[0],
        similarProducts: jeans.slice(1, 4),
        rationale: "Matching earth-tone organic studio tees with neutral chinos lifts impulse multi-item checkout by 68%.",
      },
      {
        id: "sug-5",
        title: "Evening Monochromatic: Overcoat + Boot",
        dept: "Luxury Showcase",
        lift: "+64%",
        anchor: jackets.find((j) => j.color === "Black" || j.name.includes("Trench")) || jackets[2] || jackets[0],
        partner: shoes.find((s) => s.color === "Brown" || s.name.includes("Chelsea")) || shoes[1] || shoes[0],
        similarProducts: shoes.slice(1, 4),
        rationale: "Co-locating sleek all-black luxury evening coats with Chelsea footwear creates a full evening package.",
      },
    ];

    const dynamicPairs = (recommendations && recommendations.length > 0)
      ? recommendations.map((rec, idx) => ({
          id: `sug-${idx + 1}`,
          title: `${rec.sourceProduct.name} + ${rec.similarProducts[0]?.name || "Partner"}`,
          dept: rec.sourceProduct.category,
          lift: idx === 0 ? "+84%" : idx === 1 ? "+76%" : idx === 2 ? "+72%" : idx === 3 ? "+68%" : "+64%",
          anchor: rec.sourceProduct,
          partner: rec.similarProducts[0] || jeans[idx % (jeans.length || 1)] || jackets[0],
          similarProducts: rec.similarProducts,
          rationale: rec.reason || "Cross-sell attribute pairing recommended by velocity engine.",
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

  // Collect all suggesting products for this fast mover
  const allSuggestingPartners = React.useMemo(() => {
    const list: Product[] = [];
    if (pairedProduct) list.push(pairedProduct);
    if (activeSuggestion.similarProducts) {
      activeSuggestion.similarProducts.forEach((p) => {
        if (!list.some((existing) => existing._id === p._id)) {
          list.push(p);
        }
      });
    }
    return list;
  }, [pairedProduct, activeSuggestion]);

  const fastMoverName = fastMoverProduct?.name || "Beige Cashmere Overcoat";
  const recItemName = pairedProduct?.name || "Black Tailored Denim";
  const primaryOriginLoc = getProductShelfLocation(pairedProduct);
  const anchorShelfLoc = getProductShelfLocation(fastMoverProduct);
  const adjacentCupboardLoc = getCupboardAdjacentCoords(fastMoverProduct);

  // Load Persisted Planogram State from MongoDB (Runs ONCE on mount so user tab clicks are NEVER overridden)
  useEffect(() => {
    const loadPlanogram = async () => {
      try {
        const { data } = await api.get("/recommendations/planogram");
        if (data) {
          setPlanogramApplied(Boolean(data.applied));
          if (data.swapMode) {
            setSwapMode(data.swapMode);
          }
          if (data.swappedPairedCoordinates) {
            setSavedCoordinates({
              source: data.sourceCoordinates || POPULAR_FEATURE_SPOTS[0].anchorCoords,
              swapped: data.swappedPairedCoordinates || POPULAR_FEATURE_SPOTS[0].swappedCoords,
              original: data.originalPairedCoordinates || getProductShelfLocation(pairedProduct),
            });
          }
          if (!hasUserSelectedRef.current && data.activePairId) {
            const idx = suggestions.findIndex((s) => s.id === data.activePairId);
            if (idx !== -1) setSelectedSuggestionIdx(idx);
          }
        }
      } catch {}
    };
    loadPlanogram();
  }, []); // Run ONCE on mount! Never re-run on suggestions change!

  // Real-time synchronization via WebSockets
  useSocket((event, payload) => {
    if (event === "planogram_updated") {
      const data = payload as any;
      if (data) {
        if (data.swapMode) {
          setSwapMode(data.swapMode);
        }
        if (data.applied && !planogramApplied) {
          triggerFlightAnimationRef.current?.();
        }
        setPlanogramApplied(Boolean(data.applied));
        if (data.swappedPairedCoordinates) {
          setSavedCoordinates({
            source: data.sourceCoordinates || POPULAR_FEATURE_SPOTS[0].anchorCoords,
            swapped: data.swappedPairedCoordinates || POPULAR_FEATURE_SPOTS[0].swappedCoords,
            original: data.originalPairedCoordinates || getProductShelfLocation(pairedProduct),
          });
        }
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

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
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

  // Quick Restock action - supports both single and multi-product bay drawers
  const handleQuickRestock = async (productId: string, currentStock: number) => {
    setActionLoading(true);
    try {
      await api.put(`/products/${productId}`, { stock: currentStock + 10 });
      if (onRefreshData) onRefreshData();
      if (selectedZone) {
        const updatedProducts = selectedZone.products?.map((p) =>
          p._id === productId ? { ...p, stock: currentStock + 10 } : p
        );
        const updatedProduct =
          selectedZone.product?._id === productId
            ? { ...selectedZone.product, stock: currentStock + 10 }
            : selectedZone.product;
        setSelectedZone({
          ...selectedZone,
          product: updatedProduct,
          products: updatedProducts,
        });
      }
      showToast(`Restocked +10 units (New Stock: ${currentStock + 10})`, "success", "Inventory Updated");
    } catch (err: any) {
      showToast("Failed to restock: " + (err.response?.data?.message || err.message), "error", "Restock Error");
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Sell action - supports both single and multi-product bay drawers
  const handleQuickSell = async (productId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/products/${productId}/sale`, { quantity: 1 });
      if (onRefreshData) onRefreshData();
      if (selectedZone) {
        const updatedProducts = selectedZone.products?.map((p) =>
          p._id === productId ? { ...p, stock: Math.max(0, p.stock - 1) } : p
        );
        const updatedProduct =
          selectedZone.product?._id === productId
            ? { ...selectedZone.product, stock: Math.max(0, selectedZone.product.stock - 1) }
            : selectedZone.product;
        setSelectedZone({
          ...selectedZone,
          product: updatedProduct,
          products: updatedProducts,
        });
      }
      showToast("Sale recorded: 1 unit deducted", "success", "Sale Processed");
    } catch (err: any) {
      showToast("Failed to record sale: " + (err.response?.data?.message || err.message), "error", "Sale Error");
    } finally {
      setActionLoading(false);
    }
  };

  const navActionRef = useRef<
    ((lookAtPos: [number, number, number], radius: number, theta?: number, phi?: number) => void) | null
  >(null);

  const zoomControlRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
  }>({
    zoomIn: () => {},
    zoomOut: () => {},
    resetView: () => {},
  });

  // Apply Planogram Adjacency (Triggers 3D swap flight animation and persists 3D coordinates in MongoDB)
  const handleApplyPlanogram = async () => {
    const isCupboardMode = swapMode === "cupboard";
    const anchorShelfLoc = getProductShelfLocation(fastMoverProduct);
    const cupboardAdjLoc = getCupboardAdjacentCoords(fastMoverProduct);

    if (triggerFlightAnimationRef.current) {
      triggerFlightAnimationRef.current();
    } else {
      setPlanogramApplied(true);
    }

    try {
      const payload = buildPlanogramCoordPayload(
        activeSuggestion.id,
        fastMoverProduct!,
        pairedProduct!,
        allSuggestingPartners,
        activeSuggestion.lift,
        selectedSuggestionIdx,
        swapMode
      );
      const { data } = await api.post("/recommendations/apply-planogram", payload);
      if (data) {
        setSavedCoordinates({
          source: data.sourceCoordinates || (isCupboardMode ? anchorShelfLoc : targetSpot.anchorCoords),
          swapped: data.swappedPairedCoordinates || (isCupboardMode ? cupboardAdjLoc : targetSpot.swappedCoords),
          original: data.originalPairedCoordinates || getProductShelfLocation(pairedProduct),
        });
      }
      showToast(
        isCupboardMode
          ? `✓ Relocated ${recItemName} to shelf adjacent to ${fastMoverName} in ${anchorShelfLoc.zone} (${activeSuggestion.lift} Lift)!`
          : `✓ Relocated to ${targetSpot.name} (${activeSuggestion.lift} Lift)!`,
        "success",
        "3D Planogram Deployed"
      );
    } catch (err: any) {
      showToast("Failed to persist planogram: " + (err.response?.data?.message || err.message), "error", "Persistence Error");
    }
  };

  // Replay the 3D Flight Movement Animation
  const handleReplaySwap = () => {
    if (triggerFlightAnimationRef.current) {
      triggerFlightAnimationRef.current();
    }
  };

  // Reset Planogram Layout (Reverts 3D showroom and MongoDB coordinates)
  const handleResetPlanogram = async () => {
    setPlanogramApplied(false);
    setSavedCoordinates(null);
    setIsSwapAnimating(false);
    if (navActionRef.current) {
      navActionRef.current([0, 1.2, 0], 34, Math.PI / 4.2, Math.PI / 3.4);
    }
    try {
      await api.post("/recommendations/reset-planogram");
      showToast("Planogram restored to default catalog positions", "info", "Planogram Reset");
    } catch (err: any) {
      showToast("Failed to reset planogram: " + (err.response?.data?.message || err.message), "error", "Reset Error");
    }
  };

  // Fly camera to focus directly on selected bay
  const handleFocusBay = (zone: ShelfZone) => {
    if (navActionRef.current) {
      navActionRef.current([zone.x, 2.2, zone.z], 11, zone.rotationY + Math.PI / 2, Math.PI / 3.2);
    }
  };

  const handleSelectDepartment = (deptId: string) => {
    setActiveView(deptId);
    setAutoRotate(deptId === "all");
    setSelectedZone(null);
    setSelectedMannequin(null);

    const view = DEPARTMENT_VIEWS.find((v) => v.id === deptId);
    if (view && navActionRef.current) {
      navActionRef.current(view.lookAt, view.radius, view.theta, view.phi);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let width = isFullScreen ? window.innerWidth : container.clientWidth;
    let height = isFullScreen ? window.innerHeight : container.clientHeight || 640;

    // --- THREE.JS SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060814); // Original deep luxury obsidian black background
    scene.fog = new THREE.FogExp2(0x060814, 0.016); // Original atmospheric depth

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 120);
    camera.position.set(0, 22, 28);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      precision: "highp",
      stencil: false,
      depth: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0)); // Crisp high-res 1080p/2K rendering
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08; // Clean, rich, glare-free tone mapping
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // --- POSTPROCESSING COMPOSER & UNREAL BLOOM (Controlled, Crisp, Zero Glare) ---
    let composer: EffectComposer | null = null;
    if (!isPerformanceMode) {
      composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.22, // Crisp, controlled luxury bloom strength
        0.15, // Tight radius so neon lines stay sharp
        0.90  // High threshold: ZERO glare on floor or lights, ONLY genuine neon radiates
      );
      composer.addPass(bloomPass);
    }

    // --- ARCHITECTURAL LIGHTING FOR GRAND SHOWROOM (Balanced, Rich, Zero Glare) ---
    const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0x1e293b, 0.7);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff7ed, 1.5);
    mainLight.position.set(10, 24, 14);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.6);
    fillLight.position.set(-14, 20, -10);
    scene.add(fillLight);

    // List of pulsing auras for direct 0ms animation loop update (no scene.traverse!)
    const pulsingAuras: THREE.Mesh[] = [];

    const leftWingLight = new THREE.PointLight(0x38bdf8, 1.2, 20);
    leftWingLight.position.set(-10, 7, -2);
    scene.add(leftWingLight);

    const rightWingLight = new THREE.PointLight(0xa855f7, 1.2, 20);
    rightWingLight.position.set(10, 7, -2);
    scene.add(rightWingLight);

    const centerStageLight = new THREE.PointLight(0xffedd5, 1.2, 16);
    centerStageLight.position.set(0, 8, 2);
    scene.add(centerStageLight);

    const frontEntranceLight = new THREE.PointLight(0xfffaed, 1.4, 16);
    frontEntranceLight.position.set(0, 8, 9.5);
    scene.add(frontEntranceLight);

    // --- EXPANSIVE 36M X 30M CARRARA MARBLE FLOOR ---
    const SHOWROOM_WIDTH = 36;
    const SHOWROOM_DEPTH = 30;
    const marbleTex = createMarbleTexture();

    const floorGeo = new THREE.BoxGeometry(SHOWROOM_WIDTH, 0.4, SHOWROOM_DEPTH);
    const floorMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      roughness: 0.18,
      metalness: 0.22,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const rimMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });
    const rimMesh = new THREE.Mesh(
      new THREE.BoxGeometry(SHOWROOM_WIDTH + 0.3, 0.25, SHOWROOM_DEPTH + 0.3),
      rimMat
    );
    rimMesh.position.y = -0.4;
    scene.add(rimMesh);

    const grid = new THREE.GridHelper(SHOWROOM_WIDTH, 36, 0x3b82f6, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // --- SLEEK PERIMETER GROUND RUNNERS (ELEGANT SUBTLE ACCENTS) ---
    const perimeterNeonMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.2,
      roughness: 0.3,
      metalness: 0.6,
    });
    // North border
    const northNeon = new THREE.Mesh(new THREE.BoxGeometry(SHOWROOM_WIDTH, 0.025, 0.06), perimeterNeonMat);
    northNeon.position.set(0, 0.02, -SHOWROOM_DEPTH / 2 + 0.05);
    scene.add(northNeon);
    // South border
    const southNeon = new THREE.Mesh(new THREE.BoxGeometry(SHOWROOM_WIDTH, 0.025, 0.06), perimeterNeonMat);
    southNeon.position.set(0, 0.02, SHOWROOM_DEPTH / 2 - 0.05);
    scene.add(southNeon);
    // West border
    const westNeon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, SHOWROOM_DEPTH), perimeterNeonMat);
    westNeon.position.set(-SHOWROOM_WIDTH / 2 + 0.05, 0.02, 0);
    scene.add(westNeon);
    // East border
    const eastNeon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, SHOWROOM_DEPTH), perimeterNeonMat);
    eastNeon.position.set(SHOWROOM_WIDTH / 2 - 0.05, 0.02, 0);
    scene.add(eastNeon);

    // --- GALLERY WHITE WALLS (THREE SIDES: BACK, LEFT, RIGHT) ---
    const whiteWallMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Crisp gallery white requested by user
      roughness: 0.85,
      metalness: 0.05,
    });

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(SHOWROOM_WIDTH, 8.2, 0.5),
      whiteWallMat
    );
    backWall.position.set(0, 4.1, -SHOWROOM_DEPTH / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 8.2, SHOWROOM_DEPTH),
      whiteWallMat
    );
    leftWall.position.set(-SHOWROOM_WIDTH / 2, 4.1, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 8.2, SHOWROOM_DEPTH),
      whiteWallMat
    );
    rightWall.position.set(SHOWROOM_WIDTH / 2, 4.1, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Common Materials
    const darkWalnutMat = new THREE.MeshStandardMaterial({
      color: 0x18120c, // Rich luxury dark walnut / black cupboards
      roughness: 0.45,
      metalness: 0.15,
    });
    const warmOakMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.35 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.1 });
    const goldBrassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });
    const blackMetalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.6 });

    // Shared reusable geometries to drastically reduce vertex buffers & memory
    const sharedHangerGeo = new THREE.TorusGeometry(0.05, 0.008, 8, 16, Math.PI);
    const sharedGarmentGeo = new THREE.BoxGeometry(0.14, 1.45, 0.65);
    const sharedFoldedGeo = new THREE.BoxGeometry(0.5, 0.08, 0.62);

    const interactiveObjects: THREE.Object3D[] = [];

    // Helper: Luxury Wardrobe Bay with Hollow Open Architecture & Warm LED Spotlight
    const createWardrobeBay = (
      x: number,
      z: number,
      rotY: number,
      title: string,
      deptName: string,
      category: string,
      matchedProducts: Product[] = []
    ) => {
      const bay = new THREE.Group();
      bay.position.set(x, 0, z);
      bay.rotation.y = rotY;

      // 1. Back panel (Black / dark walnut)
      const backPanel = new THREE.Mesh(new THREE.BoxGeometry(4.0, 6.0, 0.08), darkWalnutMat);
      backPanel.position.set(0, 3.0, -0.66);
      backPanel.receiveShadow = true;
      bay.add(backPanel);

      // 2. Left & Right side walls (Black / dark walnut)
      const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.0, 1.4), darkWalnutMat);
      leftSide.position.set(-1.96, 3.0, 0);
      leftSide.castShadow = true;
      leftSide.receiveShadow = true;
      bay.add(leftSide);

      const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.0, 1.4), darkWalnutMat);
      rightSide.position.set(1.96, 3.0, 0);
      rightSide.castShadow = true;
      rightSide.receiveShadow = true;
      bay.add(rightSide);

      // 3. Top canopy & bottom base
      const topCanopy = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.14, 1.4), darkWalnutMat);
      topCanopy.position.set(0, 5.93, 0);
      bay.add(topCanopy);

      const bottomPlinth = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 1.4), darkWalnutMat);
      bottomPlinth.position.set(0, 0.11, 0);
      bay.add(bottomPlinth);

      // 4. Gold brass architectural border trims
      const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 6.0, 0.04), goldBrassMat);
      leftTrim.position.set(-1.98, 3.0, 0.7);
      bay.add(leftTrim);

      const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 6.0, 0.04), goldBrassMat);
      rightTrim.position.set(1.98, 3.0, 0.7);
      bay.add(rightTrim);

      const topTrim = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.04, 0.04), goldBrassMat);
      topTrim.position.set(0, 5.98, 0.7);
      bay.add(topTrim);

      // 4b. Sleek Neon Accent Runners along Top Crown Cornice & Bottom Plinth
      const neonAccentColor =
        category === "Jackets"
          ? 0x38bdf8
          : category === "Jeans"
          ? 0xa78bfa
          : category === "T-Shirts"
          ? 0xf43f5e
          : category === "Shirts"
          ? 0xf59e0b
          : 0x10b981;

      const neonMat = new THREE.MeshStandardMaterial({
        color: neonAccentColor,
        emissive: neonAccentColor,
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.85,
      });

      // Top Crown Cornice Neon Runner
      const crownNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 3.96), neonMat);
      crownNeon.rotation.z = Math.PI / 2;
      crownNeon.position.set(0, 6.01, 0.7);
      bay.add(crownNeon);

      // Base Plinth Neon Runner
      const plinthNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 3.96), neonMat);
      plinthNeon.rotation.z = Math.PI / 2;
      plinthNeon.position.set(0, 0.23, 0.7);
      bay.add(plinthNeon);

      // Under-Shelf Ambient Neon Strips
      const underShelfNeon1 = new THREE.Mesh(new THREE.BoxGeometry(3.78, 0.015, 0.03), neonMat);
      underShelfNeon1.position.set(0, 1.30, 0.64);
      bay.add(underShelfNeon1);

      const underShelfNeon2 = new THREE.Mesh(new THREE.BoxGeometry(3.78, 0.015, 0.03), neonMat);
      underShelfNeon2.position.set(0, 3.05, 0.64);
      bay.add(underShelfNeon2);

      // 5. Interior Warm LED Spotlight (illuminates hanging clothes & shelves softly and cleanly!)
      const interiorLight = new THREE.PointLight(0xfffaed, 1.2, 5.5);
      interiorLight.position.set(0, 5.3, 0.2);
      bay.add(interiorLight);

      // 6. Overhead Category Illuminated Sign (High resolution, crisp readable text)
      const signTex = createIlluminatedSign(
        title.toUpperCase(),
        "#f8fafc",
        "#080c16",
        category === "Jackets" ? "#38bdf8" : category === "Jeans" ? "#a78bfa" : "#f59e0b",
        deptName
      );
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.65, 0.06),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      signMesh.position.set(0, 5.55, 0.72);
      bay.add(signMesh);

      // Shelves
      const shelf1 = new THREE.Mesh(new THREE.BoxGeometry(3.78, 0.1, 1.25), warmOakMat);
      shelf1.position.set(0, 1.35, 0.05);
      if (!isPerformanceMode) shelf1.castShadow = true;
      bay.add(shelf1);

      const shelf2 = new THREE.Mesh(new THREE.BoxGeometry(3.78, 0.1, 1.25), warmOakMat);
      shelf2.position.set(0, 3.1, 0.05);
      if (!isPerformanceMode) shelf2.castShadow = true;
      bay.add(shelf2);

      // Chrome Rail
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 3.7), chromeMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 4.95, 0.05);
      bay.add(rail);

      // Palette mapped from real product colors or defaults
      const palette = matchedProducts.length
        ? matchedProducts.map((p) =>
            p.color === "Black"
              ? 0x09090b
              : p.color === "White"
              ? 0xf8fafc
              : p.color === "Navy"
              ? 0x1e3a8a
              : p.color === "Beige"
              ? 0xa16207
              : p.color === "Maroon"
              ? 0x991b1b
              : 0x4d7c0f
          )
        : [0x1e293b, 0x0f172a, 0x334155];

      // Hanging Garments (Deterministic, Stable Color Mapping)
      let garmentIdx = 0;
      for (let h = -1.55; h <= 1.55; h += 0.24) {
        const hangerHook = new THREE.Mesh(sharedHangerGeo, chromeMat);
        hangerHook.position.set(h, 4.92, 0.05);
        hangerHook.rotation.y = Math.PI / 2;
        bay.add(hangerHook);

        const garmentColor = palette[garmentIdx % palette.length];
        garmentIdx++;
        const garment = new THREE.Mesh(
          sharedGarmentGeo,
          new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.65 })
        );
        garment.position.set(h, 4.05, 0.05);
        if (!isPerformanceMode) garment.castShadow = true;
        bay.add(garment);
      }

      // Folded apparel stacks on lower shelf (Deterministic, Stable Color Mapping)
      let stackIdx = 0;
      for (let sx = -1.35; sx <= 1.35; sx += 0.65) {
        const stackColor = palette[stackIdx % palette.length];
        stackIdx++;
        const stackMat = new THREE.MeshStandardMaterial({ color: stackColor, roughness: 0.8 });
        for (let l = 0; l < 4; l++) {
          const folded = new THREE.Mesh(sharedFoldedGeo, stackMat);
          folded.position.set(sx, 1.45 + l * 0.085, 0.05);
          if (!isPerformanceMode) folded.castShadow = true;
          bay.add(folded);
        }
      }

      const mainProd = matchedProducts[0];
      const zoneData: ShelfZone = {
        id: `bay-${title.toLowerCase().replace(/\s+/g, "-")}`,
        name: title,
        department: deptName,
        category,
        x,
        z,
        rotationY: rotY,
        color: palette[0],
        label: `${title} Display Bay`,
        product: mainProd,
        products: matchedProducts,
        velocity: 4.8,
      };

      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(4.0, 6.0, 1.4),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.set(0, 3.0, 0);
      bay.add(hitBox);
      hitBox.userData = { zoneData };
      interactiveObjects.push(hitBox);

      bay.userData = { zoneData };
      scene.add(bay);
    };

    // Helper: Tailored Clothed Masculine Mannequin
    const createTailoredMannequin = (
      x: number,
      z: number,
      rotY: number,
      blazerColor: number,
      trouserColor: number,
      shirtColor = 0xffffff,
      tieColor = 0x991b1b,
      outfitTitle = "Hero Tailored Suit Outfit",
      department = "Executive Suits"
    ) => {
      const manGroup = new THREE.Group();
      manGroup.position.set(x, 0, z);
      manGroup.rotation.y = rotY;

      const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.08, 32), goldBrassMat);
      baseDisc.position.y = 0.04;
      baseDisc.castShadow = true;
      manGroup.add(baseDisc);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4), chromeMat);
      stem.position.y = 0.7;
      manGroup.add(stem);

      const shoeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.25, metalness: 0.2 });
      const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.46), shoeMat);
      leftShoe.position.set(-0.17, 0.08, 0.05);
      leftShoe.castShadow = true;
      manGroup.add(leftShoe);

      const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.46), shoeMat);
      rightShoe.position.set(0.17, 0.08, 0.05);
      rightShoe.castShadow = true;
      manGroup.add(rightShoe);

      const trouserMat = new THREE.MeshStandardMaterial({ color: trouserColor, roughness: 0.65 });
      const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 1.3, 16), trouserMat);
      leftLeg.position.set(-0.17, 0.74, 0);
      leftLeg.castShadow = true;
      manGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 1.3, 16), trouserMat);
      rightLeg.position.set(0.17, 0.74, 0);
      rightLeg.castShadow = true;
      manGroup.add(rightLeg);

      const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.29), trouserMat);
      pelvis.position.y = 1.42;
      manGroup.add(pelvis);

      const suitMat = new THREE.MeshStandardMaterial({ color: blazerColor, roughness: 0.55, metalness: 0.08 });
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.88, 0.38), suitMat);
      chest.position.y = 1.95;
      chest.castShadow = true;
      manGroup.add(chest);

      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.4 });
      const shirtV = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.44, 0.4), shirtMat);
      shirtV.position.set(0, 2.1, 0.01);
      manGroup.add(shirtV);

      const tieMat = new THREE.MeshStandardMaterial({ color: tieColor, roughness: 0.3 });
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.41), tieMat);
      tie.position.set(0, 2.0, 0.015);
      manGroup.add(tie);

      const lapelMat = new THREE.MeshStandardMaterial({ color: blazerColor, roughness: 0.35, metalness: 0.2 });
      const leftLapel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.41), lapelMat);
      leftLapel.position.set(-0.16, 2.05, 0.01);
      leftLapel.rotation.z = -0.22;
      manGroup.add(leftLapel);

      const rightLapel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.41), lapelMat);
      rightLapel.position.set(0.16, 2.05, 0.01);
      rightLapel.rotation.z = 0.22;
      manGroup.add(rightLapel);

      const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 1.1, 16), suitMat);
      leftArm.position.set(-0.46, 1.82, 0);
      leftArm.rotation.z = 0.12;
      leftArm.castShadow = true;
      manGroup.add(leftArm);

      const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 1.1, 16), suitMat);
      rightArm.position.set(0.46, 1.82, 0);
      rightArm.rotation.z = -0.12;
      rightArm.castShadow = true;
      manGroup.add(rightArm);

      const headMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.05 });
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.22, 16), headMat);
      neck.position.y = 2.45;
      manGroup.add(neck);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), headMat);
      head.scale.set(0.85, 1.15, 0.95);
      head.position.y = 2.72;
      head.castShadow = true;
      manGroup.add(head);

      const mannequinData = {
        title: outfitTitle,
        department,
        outfit:
          blazerColor === 0xa16207
            ? "Beige Tailored Coat + Charcoal Chinos Bundle"
            : blazerColor === 0x1e293b
            ? "Savile Row Navy Charcoal Suit + Silk Burgundy Tie"
            : "Casual Denim Chore Coat + Premium White Tee",
        price: blazerColor === 0xa16207 ? 2199 : 2499,
      };

      manGroup.userData = { mannequinData };
      scene.add(manGroup);
      interactiveObjects.push(chest);
      chest.userData = { mannequinData };
    };

    // ==========================================
    // 🏛️ ZONE 1: EXECUTIVE TAILORING & SUITS (WEST WING PERIMETER)
    // All 12 Jackets mapped across executive wardrobe bays
    // ==========================================
    createWardrobeBay(-12.5, -13.5, 0, "Savile Row Blazers", "Executive Suits", "Jackets", jackets.slice(0, 3));
    createWardrobeBay(-17.2, -6.5, Math.PI / 2, "Cashmere Overcoats", "Executive Suits", "Jackets", jackets.slice(3, 6));
    createWardrobeBay(-17.2, 4.5, Math.PI / 2, "Trench & Evening Coats", "Executive Suits", "Jackets", jackets.slice(6, 9));
    createWardrobeBay(-12.5, -5.5, 0, "West Arcade: Tailored Overcoats", "Executive Suits", "Jackets", jackets.slice(9, 12));
    createWardrobeBay(-6.5, 6.0, 0, "Center Aisle: Smart Casual Outerwear", "Executive Suits", "Jackets", [jackets[0], jackets[4], jackets[8]].filter(Boolean) as Product[]);

    // Aisle Greeting Mannequin (West Aisle Entrance)
    createTailoredMannequin(
      -12.0,
      1.0,
      Math.PI / 3,
      0x991b1b,
      0x09090b,
      0xffffff,
      0xd97706,
      "Burgundy Velvet Evening Blazer",
      "Executive Suits"
    );

    // ==========================================
    // 🏛️ ZONE 2: DENIM STUDIO & STREETWEAR (EAST WING PERIMETER)
    // All 12 Jeans and 12 T-Shirts mapped across dedicated bays
    // ==========================================
    createWardrobeBay(12.5, -13.5, 0, "Premium Denim Wall", "Denim & Streetwear", "Jeans", jeans.slice(0, 4));
    createWardrobeBay(17.2, -6.5, -Math.PI / 2, "Urban Chinos & Denim", "Denim & Streetwear", "Jeans", jeans.slice(4, 8));
    createWardrobeBay(6.5, 0.5, 0, "Center Aisle: Distressed & Raw Denim", "Denim & Streetwear", "Jeans", jeans.slice(8, 12));
    createWardrobeBay(17.2, 10.5, -Math.PI / 2, "Southeast Entrance Denim", "Denim & Streetwear", "Jeans", [jeans[1], jeans[5], jeans[9]].filter(Boolean) as Product[]);
    createWardrobeBay(6.5, -5.5, 0, "Center Aisle: Streetwear Chinos", "Denim & Streetwear", "Jeans", [jeans[2], jeans[6], jeans[10]].filter(Boolean) as Product[]);

    createWardrobeBay(17.2, 4.5, -Math.PI / 2, "Streetwear Graphic Tees", "Denim & Streetwear", "T-Shirts", tshirts.slice(0, 4));
    createWardrobeBay(6.5, 6.0, 0, "Center Aisle: Heavyweight Studio Tees", "Denim & Streetwear", "T-Shirts", tshirts.slice(4, 8));
    createWardrobeBay(12.5, -5.5, 0, "East Arcade: Urban Street Tees", "Denim & Streetwear", "T-Shirts", tshirts.slice(8, 12));

    // Aisle Greeting Mannequin (East Aisle Entrance)
    createTailoredMannequin(
      12.0,
      1.0,
      -Math.PI / 3,
      0x4d7c0f,
      0x1e293b,
      0xffffff,
      0xa16207,
      "Olive Safari Jacket Combo",
      "Denim & Streetwear"
    );

    // ==========================================
    // 🏛️ CENTER-WEST AISLES & ENTRANCE (FORMAL SHIRTS NETWORK)
    // ==========================================
    createWardrobeBay(-6.5, 0.5, 0, "Center Aisle: Royal Oxford Shirts", "Executive Suits", "Shirts", shirts.slice(0, 3));
    createWardrobeBay(-6.5, -5.5, 0, "Center Aisle: Luxury Sateen & Poplin", "Executive Suits", "Shirts", shirts.slice(3, 6));
    createWardrobeBay(-17.2, 10.5, Math.PI / 2, "Southwest Entrance Linen Shirts", "Executive Suits", "Shirts", shirts.slice(6, 9));

    // ==========================================
    // 🌟 FRONT ENTRANCE GRAND SHOWCASE & FEATURE MANNEQUINS
    // Brought to the front of the store at z = 9.5 with luminous neon amber halo
    // ==========================================
    const frontPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.5, 0.22, 48),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.35, metalness: 0.5 })
    );
    frontPlinth.position.set(0, 0.11, 9.5);
    frontPlinth.receiveShadow = true;
    scene.add(frontPlinth);

    const frontBrassRim = new THREE.Mesh(
      new THREE.RingGeometry(4.3, 4.5, 48),
      new THREE.MeshBasicMaterial({ color: 0xd97706, side: THREE.DoubleSide })
    );
    frontBrassRim.rotation.x = -Math.PI / 2;
    frontBrassRim.position.set(0, 0.23, 9.5);
    scene.add(frontBrassRim);

    // Sleek Glowing Neon Amber Halo Ring around Front Runway
    const frontNeonHalo = new THREE.Mesh(
      new THREE.RingGeometry(4.54, 4.64, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
    );
    frontNeonHalo.rotation.x = -Math.PI / 2;
    frontNeonHalo.position.set(0, 0.235, 9.5);
    scene.add(frontNeonHalo);

    // Front Feature Mannequins (Facing front towards customer entrance!)
    createTailoredMannequin(
      0,
      9.2,
      Math.PI, // Facing forward
      0x1e293b,
      0x0f172a,
      0xffffff,
      0x991b1b,
      "Front Showcase: Savile Row Navy Tuxedo",
      "Front Entrance Showcase"
    );
    createTailoredMannequin(
      -2.0,
      9.8,
      Math.PI * 0.85, // Angled slightly inward
      0xa16207,
      0x1e293b,
      0xffffff,
      0x1e3a8a,
      "Front Showcase: Camel Wool Overcoat",
      "Front Entrance Showcase"
    );
    createTailoredMannequin(
      2.0,
      9.8,
      -Math.PI * 0.85, // Angled slightly inward
      0x1d4ed8,
      0x334155,
      0xffffff,
      0xd97706,
      "Front Showcase: Urban Denim Chore Outfit",
      "Front Entrance Showcase"
    );

    // ==========================================
    // 🏛️ ZONE 3: CENTERPIECE PROMENADE & HIGH-VELOCITY PLANOGRAM (CENTER)
    // ==========================================
    // Central Display Table with Folded Shirts
    const tableGroup = new THREE.Group();
    tableGroup.position.set(0, 0, -6.5);
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.6), warmOakMat);
    tableTop.position.y = 0.95;
    tableTop.castShadow = true;
    tableGroup.add(tableTop);

    const tableLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95), chromeMat);
    tableLeg1.position.set(-1.6, 0.475, -0.65);
    tableGroup.add(tableLeg1);
    const tableLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95), chromeMat);
    tableLeg2.position.set(1.6, 0.475, -0.65);
    tableGroup.add(tableLeg2);
    const tableLeg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95), chromeMat);
    tableLeg3.position.set(-1.6, 0.475, 0.65);
    tableGroup.add(tableLeg3);
    const tableLeg4 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95), chromeMat);
    tableLeg4.position.set(1.6, 0.475, 0.65);
    tableGroup.add(tableLeg4);

    // Folded shirts on table (remaining luxury shirts in catalog)
    const tableShirts = shirts.slice(9, 12);
    tableShirts.forEach((sh, idx) => {
      const col =
        sh.color === "White"
          ? 0xf8fafc
          : sh.color === "Navy"
          ? 0x1e3a8a
          : sh.color === "Beige"
          ? 0xa16207
          : sh.color === "Black"
          ? 0x09090b
          : 0x991b1b;
      const shMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 });
      const foldedSh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.52), shMat);
      foldedSh.position.set(-1.0 + idx * 1.0, 1.08, 0);
      foldedSh.castShadow = true;
      tableGroup.add(foldedSh);
    });

    const tableZoneData: ShelfZone = {
      id: "table-promenade-shirts",
      name: "Promenade Folded Shirts Display",
      department: "Centerpiece Runway",
      category: "Shirts",
      x: 0,
      z: -6.5,
      rotationY: 0,
      color: 0xa16207,
      label: "Central Promenade Table",
      product: tableShirts[0] || shirts[0],
      products: tableShirts,
      velocity: 6.2,
    };
    tableGroup.userData = { zoneData: tableZoneData };
    tableTop.userData = { zoneData: tableZoneData };
    interactiveObjects.push(tableTop);
    scene.add(tableGroup);

    // =========================================================================
    // 🌟 5 FRONT POPULAR FEATURE DISPLAY STATIONS ACROSS THE RUNWAY
    // Prominent promotional display podiums where fast-selling pairs are showcased
    // =========================================================================
    const animatedGuidePulses: Array<{
      mesh: THREE.Mesh;
      curve: THREE.QuadraticBezierCurve3;
      offset: number;
    }> = [];

    // Build all 5 Front Popular Feature Display Stations
    POPULAR_FEATURE_SPOTS.forEach((spot, sIdx) => {
      const isCurrentSpot = selectedSuggestionIdx === sIdx;
      const spotPair = suggestions[sIdx] || suggestions[0];
      const spotFastMover = spotPair.anchor;
      const spotPartner = spotPair.partner;
      const isSwappedHere = isCurrentSpot && planogramApplied;

      const stationGroup = new THREE.Group();
      stationGroup.position.set(spot.podiumCoords.x, 0, spot.podiumCoords.z);

      // 1. Luxury Circular Pedestal Plinth Base
      const pedestalBase = new THREE.Mesh(
        new THREE.CylinderGeometry(1.65, 1.8, 0.22, 32),
        isCurrentSpot ? darkWalnutMat : blackMetalMat
      );
      pedestalBase.position.y = 0.11;
      pedestalBase.castShadow = true;
      pedestalBase.receiveShadow = true;
      stationGroup.add(pedestalBase);

      // Brass / Metallic Trim Ring
      const trimRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.76, 0.022, 12, 36),
        isCurrentSpot ? goldBrassMat : chromeMat
      );
      trimRing.rotation.x = Math.PI / 2;
      trimRing.position.y = 0.22;
      stationGroup.add(trimRing);

      // Floor Neon Aura Ring around this station
      const stationAura = new THREE.Mesh(
        new THREE.RingGeometry(1.82, 1.98, 40),
        new THREE.MeshBasicMaterial({
          color: spot.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isCurrentSpot ? 0.92 : 0.35,
        })
      );
      stationAura.rotation.x = -Math.PI / 2;
      stationAura.position.y = 0.025;
      stationAura.name = "pulseCyanAura";
      stationGroup.add(stationAura);
      pulsingAuras.push(stationAura);

      // 2. Twin Luxury Chrome Clothing Rack Stand
      const frameW = 2.4;
      const frameH = 2.6;
      const poleR = 0.014;

      const leftPole = new THREE.Mesh(new THREE.CylinderGeometry(poleR, poleR, frameH), chromeMat);
      leftPole.position.set(-frameW / 2, frameH / 2 + 0.22, 0);
      stationGroup.add(leftPole);

      const rightPole = new THREE.Mesh(new THREE.CylinderGeometry(poleR, poleR, frameH), chromeMat);
      rightPole.position.set(frameW / 2, frameH / 2 + 0.22, 0);
      stationGroup.add(rightPole);

      const topBar = new THREE.Mesh(new THREE.CylinderGeometry(poleR, poleR, frameW), chromeMat);
      topBar.rotation.z = Math.PI / 2;
      topBar.position.set(0, frameH + 0.22, 0);
      stationGroup.add(topBar);

      // Top neon accent runner
      const topRunnerMat = new THREE.MeshStandardMaterial({
        color: spot.color,
        emissive: spot.color,
        emissiveIntensity: isCurrentSpot ? 1.6 : 0.6,
        roughness: 0.15,
        metalness: 0.85,
      });
      const topRunner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, frameW + 0.04),
        topRunnerMat
      );
      topRunner.rotation.z = Math.PI / 2;
      topRunner.position.set(0, frameH + 0.24, 0);
      stationGroup.add(topRunner);

      // 3. Overhead Illuminated Sign
      const signText = isSwappedHere
        ? `✓ ${spot.badge}: ${spotFastMover?.name.toUpperCase()} + ${spotPartner?.name.toUpperCase()}`
        : `${spot.badge}`;
      const signSub = isSwappedHere
        ? `DEPLOYED: ${spotPair.lift} LIFT ACTIVE`
        : spot.name.toUpperCase();

      const stationSignTex = createIlluminatedSign(
        signText,
        "#f8fafc",
        isCurrentSpot ? "#080c16" : "#111827",
        spot.neonColorHex,
        signSub
      );
      const stationSignMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.0, 0.58, 0.04),
        new THREE.MeshBasicMaterial({ map: stationSignTex })
      );
      stationSignMesh.position.set(0, frameH + 0.6, 0);
      stationGroup.add(stationSignMesh);

      // 4. Floating Holographic Duo Showcase Cards
      const duoGroup = new THREE.Group();
      duoGroup.position.set(0, frameH + 1.65, 0);

      // Card 1: Fast Mover Anchor Card
      const card1Tex = createProductDisplayCard(
        spotFastMover,
        "🔥 ANCHOR FAST MOVER",
        spot.neonColorHex,
        false
      );
      const card1 = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 1.45, 0.03),
        new THREE.MeshStandardMaterial({ map: card1Tex, roughness: 0.2, metalness: 0.1 })
      );
      card1.position.set(-0.7, 0, 0);
      card1.rotation.y = 0.12;
      duoGroup.add(card1);

      // Card 2: Paired / Swapped Product Card
      const card2Tex = createProductDisplayCard(
        spotPartner,
        isSwappedHere ? `✨ SWAPPED IN (${spotPair.lift})` : "RECOMMENDED PARTNER",
        isSwappedHere ? "#a855f7" : spot.neonColorHex,
        isSwappedHere
      );
      const card2 = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 1.45, 0.03),
        new THREE.MeshStandardMaterial({ map: card2Tex, roughness: 0.2, metalness: 0.1 })
      );
      card2.position.set(0.7, 0, 0);
      card2.rotation.y = -0.12;
      duoGroup.add(card2);

      // Center Synergy Badge
      const centerBadgeTex = createIlluminatedSign(
        isSwappedHere ? `⚡ ${spotPair.lift} LIFT` : `✨ ${spotPair.lift} SYNERGY`,
        "#ffffff",
        isSwappedHere ? "#3b0764" : "#0f172a",
        isSwappedHere ? "#c084fc" : spot.neonColorHex,
        isSwappedHere ? "MERCHANDISE SWAPPED" : "AFFINITY PAIR"
      );
      const centerBadge = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.4, 0.04),
        new THREE.MeshBasicMaterial({ map: centerBadgeTex })
      );
      centerBadge.position.set(0, 0.85, 0.05);
      duoGroup.add(centerBadge);

      stationGroup.add(duoGroup);

      // 5. Hanging items on rack
      for (let c = -0.9; c <= 0.9; c += 0.3) {
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 8, 16, Math.PI), chromeMat);
        hook.position.set(c, frameH - 0.1, 0);
        hook.rotation.y = Math.PI / 2;
        stationGroup.add(hook);

        const isRightSide = c >= 0;
        const activeProd = isSwappedHere && isRightSide ? spotPartner : spotFastMover;
        const itemCol =
          activeProd?.color === "Beige"
            ? 0xa16207
            : activeProd?.color === "Black"
            ? 0x09090b
            : activeProd?.color === "Navy"
            ? 0x1e3a8a
            : activeProd?.color === "Maroon"
            ? 0x991b1b
            : activeProd?.color === "Olive"
            ? 0x4d7c0f
            : 0xf8fafc;

        const garmentMat = new THREE.MeshStandardMaterial({
          color: itemCol,
          roughness: 0.65,
          metalness: 0.1,
        });

        const isJean = activeProd?.category === "Jeans";
        const garment = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, isJean ? 1.15 : 1.35, isJean ? 0.52 : 0.68),
          garmentMat
        );
        garment.position.set(c, frameH - (isJean ? 0.85 : 0.95), 0);
        if (!isPerformanceMode) garment.castShadow = true;
        stationGroup.add(garment);
      }

      // Active spotlight if this is the currently selected spot
      if (isCurrentSpot) {
        const spotLight = new THREE.SpotLight(spot.color, 3.5, 12, Math.PI / 6, 0.4);
        spotLight.position.set(spot.podiumCoords.x, 8.0, spot.podiumCoords.z);
        spotLight.target = pedestalBase;
        scene.add(spotLight);
      }

      const stationZoneData: ShelfZone = {
        id: spot.id,
        name: isSwappedHere
          ? `Co-Located Affinity Station (${spotFastMover?.name} + ${spotPartner?.name})`
          : spot.name,
        department: "Front Feature Runway",
        category: spotFastMover?.category || "Showcase",
        x: spot.podiumCoords.x,
        z: spot.podiumCoords.z,
        rotationY: 0,
        color: spot.color,
        label: isSwappedHere ? "Co-Purchase Affinity Active" : spot.badge,
        product: spotFastMover,
        velocity: 8.5 - sIdx * 0.8,
      };
      stationGroup.userData = { zoneData: stationZoneData, spotIndex: sIdx };
      pedestalBase.userData = { zoneData: stationZoneData, spotIndex: sIdx };
      interactiveObjects.push(pedestalBase);
      scene.add(stationGroup);
    });

    // =========================================================================
    // 🌟 NEON LASER GUIDE LINES & ADJACENCY VISUALIZATION RIG
    // Mode 1: Cupboard Adjacency (Fast seller stays in natural cupboard; partner moves adjacent)
    // Mode 2: Hero Runway Showcase (3 widely-spaced prominent promotional stations)
    // =========================================================================
    const isCupboardMode = swapMode === "cupboard";
    const anchorShelfLoc = getProductShelfLocation(fastMoverProduct);
    const cupboardAdjLoc = getCupboardAdjacentCoords(fastMoverProduct);

    const targetAnchorPt = new THREE.Vector3(targetSpot.anchorCoords.x, 2.7, targetSpot.anchorCoords.z);
    const targetSwappedPt = isCupboardMode
      ? new THREE.Vector3(cupboardAdjLoc.x, cupboardAdjLoc.y + 0.3, cupboardAdjLoc.z)
      : new THREE.Vector3(targetSpot.swappedCoords.x, 2.7, targetSpot.swappedCoords.z);

    const arrowConeGeo = new THREE.ConeGeometry(0.12, 0.32, 16);

    if (isCupboardMode) {
      // 🏬 1. CUPBOARD ADJACENCY MODE: Anchor stays at natural home shelf
      const anchorAura = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 1.45, 36),
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        })
      );
      anchorAura.rotation.x = -Math.PI / 2;
      anchorAura.position.set(anchorShelfLoc.x, 0.038, anchorShelfLoc.z);
      scene.add(anchorAura);
      pulsingAuras.push(anchorAura);

      const anchorLaser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 5.5, 16),
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 2.0,
          transparent: true,
          opacity: 0.85,
        })
      );
      anchorLaser.position.set(anchorShelfLoc.x, 2.75, anchorShelfLoc.z);
      scene.add(anchorLaser);

      const anchorSignTex = createIlluminatedSign(
        `🔥 FAST SELLER: ${fastMoverName.toUpperCase()}`,
        "#ffffff",
        "#78350f",
        "#f59e0b",
        `NATURAL ANCHOR CUPBOARD (${anchorShelfLoc.zone})`
      );
      const anchorSignMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.5, 0.04),
        new THREE.MeshBasicMaterial({ map: anchorSignTex })
      );
      anchorSignMesh.position.set(anchorShelfLoc.x, anchorShelfLoc.y + 1.45, anchorShelfLoc.z);
      anchorSignMesh.lookAt(0, 20, 24);
      scene.add(anchorSignMesh);

      // Adjacent Target Shelf Slot in the same fixture
      const adjAura = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.25, 36),
        new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        })
      );
      adjAura.rotation.x = -Math.PI / 2;
      adjAura.position.set(cupboardAdjLoc.x, 0.038, cupboardAdjLoc.z);
      scene.add(adjAura);
      pulsingAuras.push(adjAura);

      const adjSignTex = createIlluminatedSign(
        `⚡ ADJACENT CROSS-SELL SLOT`,
        "#ffffff",
        "#4a044e",
        "#c084fc",
        `CO-LOCATED BESIDE ${fastMoverName.toUpperCase()}`
      );
      const adjSignMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.48, 0.04),
        new THREE.MeshBasicMaterial({ map: adjSignTex })
      );
      adjSignMesh.position.set(cupboardAdjLoc.x, cupboardAdjLoc.y + 1.45, cupboardAdjLoc.z);
      adjSignMesh.lookAt(0, 20, 24);
      scene.add(adjSignMesh);
    } else {
      // ✨ 2. HERO SHOWCASE MODE: 3 Prominent Display Stations
      const targetAura = new THREE.Mesh(
        new THREE.RingGeometry(2.0, 2.25, 48),
        new THREE.MeshBasicMaterial({
          color: targetSpot.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        })
      );
      targetAura.rotation.x = -Math.PI / 2;
      targetAura.position.set(targetSpot.podiumCoords.x, 0.038, targetSpot.podiumCoords.z);
      targetAura.name = "pulseCyanAura";
      scene.add(targetAura);
      pulsingAuras.push(targetAura);

      // Anchor neon line connecting from anchor cupboard to Hero Runway Station
      const originAnchorPt = new THREE.Vector3(anchorShelfLoc.x, anchorShelfLoc.y + 0.3, anchorShelfLoc.z);
      const arcApexY1 = Math.max(originAnchorPt.y, targetAnchorPt.y) + 3.8;
      const midAnchorPt = new THREE.Vector3(
        (originAnchorPt.x + targetAnchorPt.x) / 2,
        arcApexY1,
        (originAnchorPt.z + targetAnchorPt.z) / 2
      );
      const neonCurveAnchor = new THREE.QuadraticBezierCurve3(originAnchorPt, midAnchorPt, targetAnchorPt);

      const anchorTubeGeo = new THREE.TubeGeometry(neonCurveAnchor, 64, 0.024, 8, false);
      const anchorTubeMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 1.8,
        roughness: 0.1,
      });
      scene.add(new THREE.Mesh(anchorTubeGeo, anchorTubeMat));

      const anchorHaloGeo = new THREE.TubeGeometry(neonCurveAnchor, 48, 0.075, 8, false);
      scene.add(new THREE.Mesh(anchorHaloGeo, new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.3 })));

      const arrowConeAnchor = new THREE.Mesh(arrowConeGeo, new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
      const ptBeforeA = neonCurveAnchor.getPoint(0.92);
      const ptEndA = neonCurveAnchor.getPoint(0.97);
      arrowConeAnchor.position.copy(ptEndA);
      arrowConeAnchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ptEndA.clone().sub(ptBeforeA).normalize());
      scene.add(arrowConeAnchor);

      for (let p = 0; p < 3; p++) {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        scene.add(pulse);
        animatedGuidePulses.push({ mesh: pulse, curve: neonCurveAnchor, offset: p / 3 });
      }

      const anchorLaser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 5.5, 16),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 2.0, transparent: true, opacity: 0.85 })
      );
      anchorLaser.position.set(anchorShelfLoc.x, 2.75, anchorShelfLoc.z);
      scene.add(anchorLaser);

      const anchorSignTex = createIlluminatedSign(
        `🔥 ANCHOR: ${fastMoverName.toUpperCase()} ➔ ${targetSpot.badge}`,
        "#ffffff",
        "#78350f",
        "#f59e0b",
        `POPULAR DISPLAY TARGET`
      );
      const anchorSignMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.04), new THREE.MeshBasicMaterial({ map: anchorSignTex }));
      anchorSignMesh.position.set(anchorShelfLoc.x, anchorShelfLoc.y + 1.45, anchorShelfLoc.z);
      anchorSignMesh.lookAt(0, 20, 24);
      scene.add(anchorSignMesh);
    }

    // 2. NEON LINES: All Suggesting Partner Shelves ➔ targetSwappedPt (Adjacent Cupboard Bay or Hero Station)
    allSuggestingPartners.forEach((suggestedProd, sIdx) => {
      const pShelfLoc = getProductShelfLocation(suggestedProd);
      const originShelfPt = new THREE.Vector3(pShelfLoc.x, pShelfLoc.y + 0.3, pShelfLoc.z);

      const arcApexY = Math.max(originShelfPt.y, targetSwappedPt.y) + 3.6 + sIdx * 0.45;
      const arcMidPt = new THREE.Vector3(
        (originShelfPt.x + targetSwappedPt.x) / 2,
        arcApexY,
        (originShelfPt.z + targetSwappedPt.z) / 2
      );

      const neonCurve = new THREE.QuadraticBezierCurve3(originShelfPt, arcMidPt, targetSwappedPt);
      const neonColor = sIdx === 0 ? (isCupboardMode ? 0xc084fc : targetSpot.color) : sIdx === 1 ? 0xa855f7 : 0x06b6d4;

      const guideTubeGeo = new THREE.TubeGeometry(neonCurve, 64, 0.024, 8, false);
      const guideTubeMat = new THREE.MeshStandardMaterial({
        color: neonColor,
        emissive: neonColor,
        emissiveIntensity: 1.6,
        roughness: 0.1,
      });
      scene.add(new THREE.Mesh(guideTubeGeo, guideTubeMat));

      const haloGeo = new THREE.TubeGeometry(neonCurve, 48, 0.075, 8, false);
      scene.add(new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: neonColor, transparent: true, opacity: 0.32 })));

      const arrowCone = new THREE.Mesh(arrowConeGeo, new THREE.MeshBasicMaterial({ color: neonColor }));
      const ptBefore = neonCurve.getPoint(0.92);
      const ptEnd = neonCurve.getPoint(0.97);
      arrowCone.position.copy(ptEnd);
      arrowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ptEnd.clone().sub(ptBefore).normalize());
      scene.add(arrowCone);

      for (let p = 0; p < 3; p++) {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        scene.add(pulse);
        animatedGuidePulses.push({ mesh: pulse, curve: neonCurve, offset: p / 3 });
      }

      const laserMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 5.5, 16),
        new THREE.MeshStandardMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 2.0, transparent: true, opacity: 0.85 })
      );
      laserMesh.position.set(pShelfLoc.x, 2.75, pShelfLoc.z);
      scene.add(laserMesh);

      const originSignTex = createIlluminatedSign(
        `⚡ CROSS-SELL: ${suggestedProd.name.toUpperCase()} ➔ ${isCupboardMode ? "ADJACENT SHELF" : targetSpot.badge}`,
        "#ffffff",
        "#4a044e",
        isCupboardMode ? "#c084fc" : targetSpot.neonColorHex,
        `PAIR AFFINITY: ${activeSuggestion.lift}`
      );
      const originSignMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.04), new THREE.MeshBasicMaterial({ map: originSignTex }));
      originSignMesh.position.set(pShelfLoc.x, pShelfLoc.y + 1.45, pShelfLoc.z);
      originSignMesh.lookAt(0, 20, 24);
      scene.add(originSignMesh);
    });

    // In-between floating synergy banner or adjacent shelf placement when applied
    const planogramDisplayGroup = new THREE.Group();
    planogramDisplayGroup.visible = planogramAppliedRef.current;

    if (isCupboardMode) {
      // Place relocated cross-sell token directly on adjacent cupboard shelf
      const swappedGroup = new THREE.Group();
      swappedGroup.position.set(cupboardAdjLoc.x, cupboardAdjLoc.y, cupboardAdjLoc.z);

      const tokenMat = new THREE.MeshStandardMaterial({
        color: 0x9333ea,
        roughness: 0.3,
        metalness: 0.2,
        emissive: 0xa855f7,
        emissiveIntensity: 0.45,
      });
      const tokenMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.24), tokenMat);
      tokenMesh.position.y = 0.35;
      tokenMesh.castShadow = true;
      swappedGroup.add(tokenMesh);

      const bannerTex = createIlluminatedSign(
        `✓ CO-PURCHASE ADJACENT: ${recItemName.toUpperCase()}`,
        "#ffffff",
        "#2e1065",
        "#c084fc",
        `${activeSuggestion.lift} CROSS-SELL ACTIVE`
      );
      const bannerMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.55, 0.04), new THREE.MeshBasicMaterial({ map: bannerTex }));
      bannerMesh.position.set(0, 0.95, 0);
      bannerMesh.lookAt(0, 20, 24);
      swappedGroup.add(bannerMesh);
      planogramDisplayGroup.add(swappedGroup);
    } else {
      const midBannerPt = new THREE.Vector3(
        (primaryOriginLoc.x + targetSpot.swappedCoords.x) / 2,
        Math.max(primaryOriginLoc.y, targetSwappedPt.y) + 3.8,
        (primaryOriginLoc.z + targetSpot.swappedCoords.z) / 2
      );
      const arcBannerTex = createIlluminatedSign(
        `⚡ MERCHANDISE RELOCATED: ${recItemName.toUpperCase()} ➔ ${targetSpot.badge}`,
        "#ffffff",
        "#2e1065",
        targetSpot.neonColorHex,
        `✓ ${activeSuggestion.lift} BASKET CROSS-SELL SYNERGY ACTIVE`
      );
      const arcBanner = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.72, 0.05),
        new THREE.MeshBasicMaterial({ map: arcBannerTex })
      );
      arcBanner.position.set(midBannerPt.x, midBannerPt.y + 0.45, midBannerPt.z);
      arcBanner.lookAt(0, 20, 24);
      planogramDisplayGroup.add(arcBanner);
    }
    scene.add(planogramDisplayGroup);

    // =========================================================================
    // 🌟 3D SWAP FLIGHT ANIMATION RIG (Physical Product Trajectory Across Showroom)
    // =========================================================================
    const flyingMeshGroup = new THREE.Group();
    flyingMeshGroup.visible = false;

    // Double-sided product image showcase board (large 1.3m x 1.3m)
    const prodTexture = createProductDisplayCard(
      pairedProduct,
      "RELOCATING PRODUCT",
      isCupboardMode ? "#c084fc" : "#fbbf24",
      true
    );
    const cardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: prodTexture, side: THREE.DoubleSide })
    );
    flyingMeshGroup.add(cardMesh);

    // Glowing holographic neon frame around product image
    const frameMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.05, 32),
      new THREE.MeshBasicMaterial({
        color: isCupboardMode ? 0xc084fc : 0xfbbf24,
        side: THREE.DoubleSide,
      })
    );
    flyingMeshGroup.add(frameMesh);

    // Overhead illuminated status beacon
    const flightBadgeTex = createIlluminatedSign(
      `✈️ RELOCATING: ${recItemName.toUpperCase()}`,
      "#ffffff",
      isCupboardMode ? "#581c87" : "#78350f",
      isCupboardMode ? "#c084fc" : "#fbbf24",
      isCupboardMode ? "IN-AISLE CUPBOARD ADJACENCY" : "HERO RUNWAY PROMOTION"
    );
    const flightBadge = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.45, 0.04),
      new THREE.MeshBasicMaterial({ map: flightBadgeTex })
    );
    flightBadge.position.set(0, 1.05, 0);
    flyingMeshGroup.add(flightBadge);

    // Glowing spotlight illumination during flight
    const flightLight = new THREE.PointLight(isCupboardMode ? 0xc084fc : 0xfbbf24, 6.0, 14.0);
    flyingMeshGroup.add(flightLight);

    // Sparkling particle tail (10 particles)
    const tailSpheres: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 - i * 0.005, 8, 8),
        new THREE.MeshBasicMaterial({
          color: isCupboardMode ? 0xe9d5ff : 0xfef08a,
          transparent: true,
          opacity: 0.95 - i * 0.09,
        })
      );
      flyingMeshGroup.add(s);
      tailSpheres.push(s);
    }
    scene.add(flyingMeshGroup);

    // Floor Landing Shockwave Ring at target swapped position
    const landingShockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.4, 32),
      new THREE.MeshBasicMaterial({
        color: isCupboardMode ? 0xa855f7 : targetSpot.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      })
    );
    landingShockwave.rotation.x = -Math.PI / 2;
    landingShockwave.position.set(targetSwappedPt.x, 0.045, targetSwappedPt.z);
    scene.add(landingShockwave);

    // Primary flight curve from origin shelf to the selected target spot
    const primaryFlightCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(primaryOriginLoc.x, primaryOriginLoc.y + 0.3, primaryOriginLoc.z),
      new THREE.Vector3(
        (primaryOriginLoc.x + targetSwappedPt.x) / 2,
        Math.max(primaryOriginLoc.y, targetSwappedPt.y) + 4.2,
        (primaryOriginLoc.z + targetSwappedPt.z) / 2
      ),
      new THREE.Vector3(targetSwappedPt.x, targetSwappedPt.y, targetSwappedPt.z)
    );

    let isFlightActive = false;
    let flightStartSec = 0;
    let shockwaveExpanding = false;
    let shockwaveScale = 0.2;
    let shockwaveOpacity = 1.0;

    const startFlightAnimation = () => {
      isFlightActive = true;
      flightStartSec = clock.getElapsedTime();
      flyingMeshGroup.visible = true;
      setIsSwapAnimating(true);
      // Camera stays completely stationary and steady at current view (no zoom in)
    };
    triggerFlightAnimationRef.current = startFlightAnimation;

    // ==========================================
    // 🏛️ ZONE 4: FOOTWEAR & LEATHER LOUNGE (NORTH CENTER)
    // All 5 Shoes mapped into individual vitrines along z = -13.5
    // ==========================================
    const createShoeVitrine = (x: number, z: number, title: string, shoeProduct?: Product) => {
      const vGroup = new THREE.Group();
      vGroup.position.set(x, 0, z);

      const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 1.2), darkWalnutMat);
      basePlinth.position.y = 0.375;
      basePlinth.castShadow = true;
      vGroup.add(basePlinth);

      const glassBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.85, 1.2, 1.0),
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          transmission: 0.92,
          transparent: true,
          opacity: 0.45,
          roughness: 0.05,
        })
      );
      glassBox.position.y = 1.35;
      vGroup.add(glassBox);

      const shoeCol =
        shoeProduct?.color === "Black"
          ? 0x09090b
          : shoeProduct?.color === "Navy"
          ? 0x1e3a8a
          : shoeProduct?.color === "Beige"
          ? 0xa16207
          : shoeProduct?.color === "Maroon"
          ? 0x991b1b
          : 0x4d7c0f;

      const shoeMat = new THREE.MeshStandardMaterial({
        color: shoeCol,
        roughness: 0.22,
        metalness: 0.3,
      });
      const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.54), shoeMat);
      leftShoe.position.set(-0.32, 0.88, 0);
      leftShoe.rotation.y = -Math.PI / 12;
      vGroup.add(leftShoe);

      const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.54), shoeMat);
      rightShoe.position.set(0.32, 0.88, 0);
      rightShoe.rotation.y = Math.PI / 12;
      const vitrineNeon = new THREE.Mesh(
        new THREE.BoxGeometry(2.04, 0.025, 1.24),
        new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 1.15,
          roughness: 0.15,
          metalness: 0.85,
        })
      );
      vitrineNeon.position.y = 0.76;
      vGroup.add(vitrineNeon);

      const vZoneData: ShelfZone = {
        id: `vitrine-${(shoeProduct?.name || title).toLowerCase().replace(/\s+/g, "-")}`,
        name: shoeProduct?.name || title,
        department: "Footwear Lounge",
        category: "Shoes",
        x,
        z,
        rotationY: 0,
        color: shoeCol,
        label: "Luxury Footwear Vitrine",
        product: shoeProduct,
        products: shoeProduct ? [shoeProduct] : undefined,
        velocity: 3.2,
      };

      vGroup.userData = { zoneData: vZoneData };
      scene.add(vGroup);
      interactiveObjects.push(basePlinth);
      basePlinth.userData = { zoneData: vZoneData };
    };

    // Vitrines for all 12 luxury footwear models in the catalog
    // Back Row (Row 1 along z = -13.5, 6 illuminated vitrines)
    const shoeRow1X = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
    shoes.slice(0, 6).forEach((sh, i) => {
      createShoeVitrine(shoeRow1X[i], -13.5, sh.name, sh);
    });

    // Front Promenade Row (Row 2 along z = -10.5, 6 illuminated vitrines)
    const shoeRow2X = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
    shoes.slice(6, 12).forEach((sh, i) => {
      createShoeVitrine(shoeRow2X[i], -10.5, sh.name, sh);
    });

    // Footwear Lounge Luxury Ottomans
    const ottomanMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.5 });
    const ottoman1 = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.5, 32), ottomanMat);
    ottoman1.position.set(-2.2, 0.25, -7.8);
    ottoman1.castShadow = true;
    scene.add(ottoman1);

    const ottoman2 = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.5, 32), ottomanMat);
    ottoman2.position.set(2.2, 0.25, -7.8);
    ottoman2.castShadow = true;
    scene.add(ottoman2);

    // ==========================================
    // 🏛️ ZONE 5: CASHIER & VIP CONCIERGE (SOUTH ENTRANCE)
    // ==========================================
    const counterGroup = new THREE.Group();
    counterGroup.position.set(13.0, 0, 11.5);

    const counterDesk = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 1.2, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.25, metalness: 0.4 })
    );
    counterDesk.position.y = 0.6;
    counterDesk.castShadow = true;
    counterGroup.add(counterDesk);

    const posMonitor1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.35, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 })
    );
    posMonitor1.position.set(-0.7, 1.42, 0.1);
    posMonitor1.rotation.y = -Math.PI / 6;
    counterGroup.add(posMonitor1);

    const posMonitor2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.35, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.9 })
    );
    posMonitor2.position.set(0.7, 1.42, 0.1);
    posMonitor2.rotation.y = Math.PI / 8;
    counterGroup.add(posMonitor2);

    scene.add(counterGroup);

    // --- UNIFIED CAMERA ORBIT & ZOOM CONTROLLER ---
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    const initialLookAt = cameraStateRef.current
      ? new THREE.Vector3(cameraStateRef.current.lookAt[0], cameraStateRef.current.lookAt[1], cameraStateRef.current.lookAt[2])
      : new THREE.Vector3(0, 1.2, 0);
    const initialRadius = cameraStateRef.current ? cameraStateRef.current.radius : 34;
    const initialTheta = cameraStateRef.current ? cameraStateRef.current.theta : Math.PI / 4.2;
    const initialPhi = cameraStateRef.current ? cameraStateRef.current.phi : Math.PI / 3.4;

    let sphericalTheta = initialTheta;
    let sphericalPhi = initialPhi;
    let currentRadius = initialRadius;
    let targetRadius = initialRadius;

    const currentLookAt = initialLookAt.clone();
    const targetLookAt = initialLookAt.clone();

    const updateCameraPosition = () => {
      camera.position.x =
        currentLookAt.x + currentRadius * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
      camera.position.y =
        currentLookAt.y + currentRadius * Math.cos(sphericalPhi);
      camera.position.z =
        currentLookAt.z + currentRadius * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
      camera.lookAt(currentLookAt);

      // Persist current camera orientation and zoom across pair switches so angle never changes
      cameraStateRef.current = {
        theta: sphericalTheta,
        phi: sphericalPhi,
        radius: targetRadius,
        lookAt: [targetLookAt.x, targetLookAt.y, targetLookAt.z],
      };
    };

    // Wire up external navigation ref (departments & planogram focus)
    navActionRef.current = (
      lookAtPos: [number, number, number],
      radius: number,
      theta?: number,
      phi?: number
    ) => {
      targetLookAt.set(lookAtPos[0], lookAtPos[1], lookAtPos[2]);
      targetRadius = radius;
      if (theta !== undefined) sphericalTheta = theta;
      if (phi !== undefined) sphericalPhi = phi;
    };

    // Wire up zoom control ref for on-screen buttons
    zoomControlRef.current = {
      zoomIn: () => {
        targetRadius = Math.max(6, targetRadius - 5.0);
      },
      zoomOut: () => {
        targetRadius = Math.min(52, targetRadius + 5.0);
      },
      resetView: () => {
        cameraStateRef.current = null;
        targetRadius = 34;
        sphericalTheta = Math.PI / 4.2;
        sphericalPhi = Math.PI / 3.4;
        targetLookAt.set(0, 1.2, 0);
      },
    };

    let dragStartX = 0;
    let dragStartY = 0;
    let hasDragged = false;
    let dragButton = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      hasDragged = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      dragButton = e.button;
      setHoveredItem(null);
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastRaycastTime = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setHoveredItem(null);
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        // If mouse moved more than 4 pixels, mark as active drag (NOT a click)
        if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 4) {
          hasDragged = true;
        }

        // Smooth orbit for both left-click (0) and right-click (2) / trackpad drag
        const speed = dragButton === 2 ? 0.007 : 0.006;
        sphericalTheta -= deltaX * speed;
        sphericalPhi = Math.max(0.12, Math.min(Math.PI / 2.1, sphericalPhi - deltaY * speed));
      } else {
        // ✨ HOVER DETECTION OVER 3D PRODUCTS & DISPLAY FIXTURES
        if (!renderer?.domElement || isMouseOverUIRef.current || e.target !== renderer.domElement) {
          if (renderer?.domElement) renderer.domElement.style.cursor = "default";
          return;
        }

        // Throttle raycasting to max 25 fps to eliminate lag and CPU overhead
        const now = performance.now();
        if (now - lastRaycastTime < 40) return;
        lastRaycastTime = now;

        const rect = renderer.domElement.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          return;
        }

        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactiveObjects);
        if (intersects.length > 0) {
          const hit = intersects[0].object;
          if (hit.userData?.zoneData) {
            renderer.domElement.style.cursor = "pointer";
            setInspectedZone(hit.userData.zoneData as ShelfZone);
            return;
          } else if (hit.userData?.mannequinData) {
            renderer.domElement.style.cursor = "pointer";
            return;
          }
        }
        renderer.domElement.style.cursor = "grab";
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      // Keep hasDragged true for 120ms to completely prevent the synthetic DOM click event from firing on objects
      setTimeout(() => {
        hasDragged = false;
      }, 120);
    };

    const onContextMenu = (e: MouseEvent) => {
      // Suppress browser context menu so right-click can be used smoothly to orbit/inspect in 3D
      e.preventDefault();
    };

    // Touch support for trackpads and touch devices
    let touchStartX = 0;
    let touchStartY = 0;
    let prevTouchX = 0;
    let prevTouchY = 0;
    let isTouching = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isTouching = true;
        hasDragged = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        prevTouchX = touchStartX;
        prevTouchY = touchStartY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouching || e.touches.length !== 1) return;
      const t = e.touches[0];
      const deltaX = t.clientX - prevTouchX;
      const deltaY = t.clientY - prevTouchY;
      prevTouchX = t.clientX;
      prevTouchY = t.clientY;

      if (Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) > 5) {
        hasDragged = true;
      }

      sphericalTheta -= deltaX * 0.006;
      sphericalPhi = Math.max(0.12, Math.min(Math.PI / 2.1, sphericalPhi - deltaY * 0.006));
    };

    const onTouchEnd = () => {
      isTouching = false;
      setTimeout(() => {
        hasDragged = false;
      }, 120);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setHoveredItem(null);
      // Smooth incremental wheel zoom:
      // deltaY > 0 -> scroll down = zoom out (increase radius)
      // deltaY < 0 -> scroll up = zoom in (decrease radius)
      const zoomDelta = e.deltaY * 0.035;
      targetRadius = Math.max(6, Math.min(52, targetRadius + zoomDelta));
    };

    const onClick = (e: MouseEvent) => {
      // CRITICAL FIX: If the user was dragging/orbiting the camera, IGNORE this click completely!
      // The camera target center point must NEVER change while moving/dragging!
      if (hasDragged || Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 5) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjects);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData?.spotIndex !== undefined) {
          hasUserSelectedRef.current = true;
          const sIdx = hit.userData.spotIndex as number;
          setSelectedSuggestionIdx(sIdx);
          onPairChange?.(sIdx);
          setPlanogramApplied(false);
          return;
        } else if (hit.userData?.zoneData) {
          const zone = hit.userData.zoneData as ShelfZone;
          setSelectedZone(zone);
          setSelectedMannequin(null);
          // Keep viewpoint center stable at showroom center [0, 1.2, 0]
        } else if (hit.userData?.mannequinData) {
          setSelectedMannequin(hit.userData.mannequinData);
          setSelectedZone(null);
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    domElement.addEventListener("contextmenu", onContextMenu);
    domElement.addEventListener("mouseleave", () => setHoveredItem(null));
    domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    domElement.addEventListener("wheel", onWheel, { passive: false });
    domElement.addEventListener("click", onClick);


    // --- ANIMATION LOOP & OFFSCREEN VISIBILITY OBSERVER ---
    let reqId: number;
    const clock = new THREE.Clock();
    let isRenderingActive = true;

    // Pause heavy 3D rendering when showroom is scrolled offscreen to eliminate lag across the entire site
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isRenderingActive = entry.isIntersecting && !document.hidden;
      },
      { threshold: 0.02 }
    );
    if (container) visibilityObserver.observe(container);

    const handleVisibilityChange = () => {
      isRenderingActive = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let lastRenderTimestamp = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      // Skip render calculations completely when showroom is scrolled out of view or tab is hidden!
      if (!isRenderingActive) return;

      const now = performance.now();
      // Strictly lock rendering to smooth 30 FPS (33.3ms interval) as requested by user
      const minInterval = 33;
      if (now - lastRenderTimestamp < minInterval) return;
      lastRenderTimestamp = now;

      const elapsed = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta(), 0.05);

      // Smooth damping for look-at target and zoom radius
      currentLookAt.lerp(targetLookAt, 0.08);
      currentRadius += (targetRadius - currentRadius) * 0.12;

      // Gentle auto-rotation when toggled on: uses autoRotateRef so it STOPS immediately when toggled off!
      // Uses delta time so speed is calm, luxurious, and identical on 60Hz and 144Hz monitors
      if (autoRotateRef.current && activeView === "all" && !inspectedZone && !selectedMannequin && !isDragging) {
        sphericalTheta += delta * 0.04;
      }

      // Position camera via unified spherical coordinates
      updateCameraPosition();

      // Direct, 0ms pulsing update (bypasses slow scene.traverse!)
      const auraScale = 1 + 0.06 * Math.cos(elapsed * 4.0);
      pulsingAuras.forEach((mesh) => mesh.scale.set(auraScale, auraScale, 1));

      // 🌟 Animate flowing neon guide pulses towards the fast seller
      animatedGuidePulses.forEach((p) => {
        const progress = (elapsed * 0.45 + p.offset) % 1;
        p.mesh.position.copy(p.curve.getPoint(progress));
      });

      // Synchronize planogram applied visibility dynamically without re-creating scene
      planogramDisplayGroup.visible = planogramAppliedRef.current && !isFlightActive;

      // 🌟 Animate 3D Product Flight Swap Movement
      if (isFlightActive) {
        const flightDuration = 3.0; // 3 seconds visible movement
        const flightElapsed = elapsed - flightStartSec;
        const t = Math.min(1.0, flightElapsed / flightDuration);

        // Smooth cubic ease-in-out
        const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const currentPos = primaryFlightCurve.getPoint(easedT);
        flyingMeshGroup.position.copy(currentPos);
        cardMesh.rotation.y = elapsed * 3.5;
        frameMesh.rotation.z = elapsed * 2.0;
        flightBadge.lookAt(camera.position);

        // Camera smoothly follows the mid-flight point
        targetLookAt.lerp(currentPos, 0.04);

        // Tail particles trailing along curve
        tailSpheres.forEach((s, idx) => {
          const tailT = Math.max(0, easedT - (idx + 1) * 0.015);
          const tailPt = primaryFlightCurve.getPoint(tailT);
          s.position.copy(tailPt.clone().sub(currentPos));
        });

        if (t >= 1.0) {
          // Touchdown on Hero Runway or Cupboard!
          isFlightActive = false;
          flyingMeshGroup.visible = false;
          shockwaveExpanding = true;
          shockwaveScale = 0.2;
          shockwaveOpacity = 1.0;
          landingShockwave.scale.set(0.2, 0.2, 1);
          (landingShockwave.material as THREE.MeshBasicMaterial).opacity = 1.0;
          setPlanogramApplied(true);
          setIsSwapAnimating(false);
          // Flight landed: keep camera steady where user positioned it (no zoom in)
        }
      }

      if (shockwaveExpanding) {
        shockwaveScale += 0.12;
        shockwaveOpacity -= 0.025;
        landingShockwave.scale.set(shockwaveScale, shockwaveScale, 1);
        (landingShockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(0, shockwaveOpacity);
        if (shockwaveOpacity <= 0) {
          shockwaveExpanding = false;
        }
      }

      if (composer && !isPerformanceMode) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      width = isFullScreen ? window.innerWidth : container.clientWidth;
      height = isFullScreen ? window.innerHeight : container.clientHeight || 640;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (composer) {
        composer.setSize(width, height);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("wheel", onWheel);
      domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", handleResize);

      // Deep GPU Memory & Texture Disposal to completely eliminate memory leaks
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) {
            obj.geometry.dispose();
          }
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              if (m.map) m.map.dispose();
              if (m.lightMap) m.lightMap.dispose();
              if (m.bumpMap) m.bumpMap.dispose();
              if (m.normalMap) m.normalMap.dispose();
              if (m.specularMap) m.specularMap.dispose();
              if (m.envMap) m.envMap.dispose();
              m.dispose();
            });
          }
        }
      });
      sharedHangerGeo.dispose();
      sharedGarmentGeo.dispose();
      sharedFoldedGeo.dispose();

      // Dispose composer & passes if allocated
      if (composer) {
        try {
          if ((composer as any).renderTarget1) (composer as any).renderTarget1.dispose();
          if ((composer as any).renderTarget2) (composer as any).renderTarget2.dispose();
          composer.passes.forEach((pass: any) => {
            if (pass.dispose) pass.dispose();
          });
          composer.dispose();
        } catch {}
      }

      // CRITICAL: Force WebGL Context Loss so Chrome immediately purges all VRAM, textures, and buffers!
      try {
        renderer.dispose();
        renderer.forceContextLoss();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      } catch {}
    };
  }, [isFullScreen, isHeatmapMode, isPerformanceMode, selectedSuggestionIdx, catalogProducts.length, swapMode]);

  const sourceImg = fastMoverProduct
    ? getProductImage(fastMoverProduct.category, fastMoverProduct.color, fastMoverProduct.name)
    : getProductImage("Jackets", "Beige", "Beige Jacket");

  const recImg = pairedProduct
    ? getProductImage(pairedProduct.category, pairedProduct.color, pairedProduct.name)
    : getProductImage("Jeans", "Black", "Black Jean");

  return (
    <div
      ref={visualizerRootRef}
      className={`relative w-full rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl transition-all duration-300 ${
        isFullScreen ? "fixed inset-0 z-50 rounded-none border-none" : "h-[740px]"
      }`}
    >
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 🌟 1. TOP HEADER BAR: STORE BRANDING & CONTROLS */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Department Store Badge */}
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="glass-panel px-4 py-2.5 rounded-2xl flex items-center gap-3 pointer-events-auto border border-amber-500/35 shadow-2xl"
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
              3D Digital Twin • 4 Departments • All {catalogProducts.length || 60} Store SKUs Visible
            </p>
          </div>
        </div>

        {/* Right: Quick Toggles (Fullscreen, Heatmap, Rotate, Clock, Hide Overlay) */}
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="flex items-center gap-2 pointer-events-auto"
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
              !isOverlayVisible
                ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 border-amber-400 shadow-lg shadow-orange-500/30 font-black"
                : "glass-panel text-amber-200 border-amber-500/40 hover:text-white"
            }`}
            title={isOverlayVisible ? "Hide overlay to view full 3D showroom" : "Show AI Strategy overlay"}
          >
            {isOverlayVisible ? <EyeOff className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isOverlayVisible ? "Hide Overlay" : "Show AI Strategy"}</span>
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

          {/* Zoom In, Zoom Out & Reset Controls */}
          <div className="flex items-center glass-panel rounded-xl border border-amber-500/30 p-0.5 shadow-sm">
            <button
              onClick={() => zoomControlRef.current.zoomIn()}
              className="p-1.5 rounded-lg text-slate-200 hover:text-amber-300 hover:bg-stone-800 transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-stone-700/60" />
            <button
              onClick={() => zoomControlRef.current.zoomOut()}
              className="p-1.5 rounded-lg text-slate-200 hover:text-amber-300 hover:bg-stone-800 transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-stone-700/60" />
            <button
              onClick={() => {
                zoomControlRef.current.resetView();
                setActiveView("all");
                setSelectedZone(null);
                setSelectedMannequin(null);
              }}
              className="p-1.5 rounded-lg text-slate-200 hover:text-amber-400 hover:bg-stone-800 transition-colors"
              title="Reset View (⟲)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsHeatmapMode((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isHeatmapMode
                ? "bg-rose-500/25 border-rose-500/60 text-rose-300 shadow-md shadow-rose-500/20"
                : "glass-panel text-slate-200 border-amber-500/30 hover:text-white"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline font-bold">Heatmap</span>
          </button>

          <button
            onClick={() => setIsPerformanceMode((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isPerformanceMode
                ? "bg-emerald-500/25 border-emerald-500/70 text-emerald-300 shadow-md shadow-emerald-500/20"
                : "glass-panel text-slate-200 border-amber-500/30 hover:text-white"
            }`}
            title="Toggle 30 FPS Eco Saver Mode / Visuals (Hardware-optimized for smooth 30 FPS with minimal RAM/CPU)"
          >
            <Zap className={`w-3.5 h-3.5 ${isPerformanceMode ? "text-emerald-400 fill-emerald-400" : "text-amber-400"}`} />
            <span className="hidden sm:inline font-bold">{isPerformanceMode ? "30 FPS Eco" : "Visuals"}</span>
          </button>

          <button
            onClick={toggleFullScreen}
            className="glass-panel p-2 rounded-xl text-slate-200 hover:text-white border border-amber-500/30 transition-all shadow-md"
            title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 🌟 LEFT SIDE OVERLAY: CUPBOARD & SHELF BAY INSPECTOR */}
      {inspectedZone && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute top-24 left-5 z-20 w-80 max-w-[340px] pointer-events-auto space-y-3 hidden sm:block animate-in fade-in slide-in-from-left duration-200"
          style={{ width: "340px", maxWidth: "340px" }}
        >
          <div className="glass-panel rounded-3xl p-4 shadow-2xl border border-amber-500/35 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-amber-400 shrink-0" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">
                    {inspectedZone.name}
                  </h4>
                </div>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block">
                  {inspectedZone.department}
                </span>
              </div>
              <button
                onClick={() => setInspectedZone(null)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white cursor-pointer"
                title="Close inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Products inside this cupboard / bay */}
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {(inspectedZone.products && inspectedZone.products.length > 0
                ? inspectedZone.products
                : inspectedZone.product
                ? [inspectedZone.product]
                : []
              ).map((prod) => (
                <div
                  key={prod._id}
                  onClick={() => setPreviewProduct(prod)}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-950/80 border border-stone-800 hover:border-amber-400/80 hover:bg-stone-900 transition-all cursor-pointer group"
                  title="Click to view product details in center preview"
                >
                  <img
                    src={getProductImage(prod.category, prod.color, prod.name, prod.imageUrl)}
                    alt={prod.name}
                    className="w-11 h-11 rounded-lg object-cover border border-amber-400/40 group-hover:scale-105 transition-transform shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-amber-400 font-mono font-bold">{prod.sku}</span>
                      <span className="text-xs font-black text-amber-300">₹{prod.price}</span>
                    </div>
                    <p className="font-bold text-white text-xs truncate group-hover:text-amber-200">
                      {prod.name}
                    </p>
                    <div className="flex items-center justify-between mt-0.5 text-[10px]">
                      <span className={prod.stock <= 5 ? "text-rose-400 font-bold" : "text-emerald-400 font-semibold"}>
                        {prod.stock} in stock
                      </span>
                      <span className="text-amber-400/80 text-[9px] font-bold group-hover:underline">
                        Preview ➔
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-stone-400 text-center font-medium">
              👆 Click any product to view image & details in center square
            </p>
          </div>
        </div>
      )}

      {/* 🌟 2. DEPARTMENT FLY-TO NAVIGATION TOOLBAR (Top Center) */}
      <div
        onMouseEnter={() => {
          isMouseOverUIRef.current = true;
        }}
        onMouseLeave={() => {
          isMouseOverUIRef.current = false;
        }}
        className="absolute top-18 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl glass-panel border border-amber-500/30 shadow-xl max-w-full overflow-x-auto"
      >
        {DEPARTMENT_VIEWS.map((dept) => {
          const isSelected = activeView === dept.id;
          return (
            <button
              key={dept.id}
              onClick={() => handleSelectDepartment(dept.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 font-black shadow-md shadow-orange-500/25"
                  : "text-slate-200 hover:text-amber-300 hover:bg-white/10"
              }`}
            >
              <span>{dept.icon}</span>
              <span>{dept.name}</span>
            </button>
          );
        })}
      </div>

      {/* 🌟 IN-FLIGHT SWAP MOVEMENT HUD BANNER */}
      {isSwapAnimating && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-950/95 via-purple-950/95 to-slate-950/95 border-2 border-pink-400 text-white shadow-2xl flex items-center gap-3.5 backdrop-blur-xl animate-bounce pointer-events-none">
          <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-pink-300 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest bg-pink-500/30 text-pink-200 px-2.5 py-0.5 rounded-full border border-pink-400">
                ⚡ 3D RELOCATION FLIGHT IN PROGRESS
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-300">
                {activeSuggestion.lift} Basket Lift
              </span>
            </div>
            <p className="text-xs font-bold mt-1 text-slate-100">
              Relocating <span className="text-pink-300 font-extrabold">{recItemName}</span> from{" "}
              <span className="text-amber-300 font-semibold">{primaryOriginLoc.zone}</span> ➔{" "}
              <span className="text-emerald-300 font-black">
                {swapMode === "cupboard"
                  ? `Adjacent Bay in ${anchorShelfLoc.zone} (Beside ${fastMoverName})`
                  : targetSpot.name}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* 🌟 3. RIGHT FLOATING SIDEBAR: MULTIPLE AI SUGGESTIONS (Collapsible) */}
      {isOverlayVisible ? (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute top-24 right-5 z-20 w-80 max-w-[340px] space-y-3 pointer-events-auto hidden lg:block animate-in fade-in slide-in-from-right duration-200"
          style={{ width: "340px", maxWidth: "340px" }}
        >
          {/* Card: Multiple Planogram Recommendations */}
          <div className="glass-panel rounded-3xl p-4 pointer-events-auto space-y-3 shadow-2xl border border-amber-500/35">
            <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider drop-shadow-sm">Visual Merchandising</h4>
              </div>
              <button
                onClick={() => setIsOverlayVisible(false)}
                className="text-[10px] text-amber-300/80 hover:text-amber-200 font-bold flex items-center gap-1 cursor-pointer"
                title="Minimize panel to clear view"
              >
                <span>Hide</span>
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 🌟 TWO DISTINCT MERCHANDISING STRATEGY MODES */}
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
                title="Fast-selling product stays in its natural cupboard, suggested cross-sell placed adjacent"
              >
                <Store className="w-3.5 h-3.5" />
                <span>🏬 Cupboard Swap</span>
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
                title="3 widely-spaced prominent promotional stations across the spacious showroom"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>✨ Hero 3 Spots</span>
              </button>
            </div>

            {/* Mode-specific selection tabs */}
            {swapMode === "cupboard" ? (
              /* In-Aisle Cupboard Fast-Seller Pairs (Keeps anchor at home cupboard) */
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
                      Anchor Cupboard: {anchorShelfLoc.zone}
                    </span>
                    <span className="text-[9px] text-stone-300 block truncate">
                      Fast-selling anchor stays in cupboard • Cross-sell lands adjacent
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* 3 Spacious Hero Promotional Stations (Center, West, East) */
              <div className="space-y-1.5">
                <div className="flex gap-1 p-1 bg-stone-950/80 rounded-xl border border-amber-500/25">
                  {POPULAR_FEATURE_SPOTS.map((spot, idx) => (
                    <button
                      key={spot.id}
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
                      <span>{spot.code}</span>
                      <span className="text-[8px] opacity-80">{suggestions[idx]?.lift || "+80%"}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-stone-900/90 border border-amber-500/30 text-[10px]">
                  <span className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: targetSpot.neonColorHex }} />
                  <div className="min-w-0">
                    <span className="font-extrabold text-amber-300 block truncate">{targetSpot.badge}</span>
                    <span className="text-[9px] text-stone-400 block truncate">{targetSpot.name}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Suggestion Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-white">
                <span className="truncate font-black">{activeSuggestion.title}</span>
                <span className="text-amber-400 font-black shrink-0 text-xs">{activeSuggestion.lift} Lift</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => fastMoverProduct && setPreviewProduct(fastMoverProduct)}
                  className="flex items-center gap-2 p-2 rounded-xl bg-stone-950/80 border border-amber-500/30 hover:border-amber-400 hover:bg-stone-900 transition-all cursor-pointer group"
                  title="Click to preview Anchor product details"
                >
                  <img src={sourceImg} alt="Anchor" className="w-8 h-8 rounded-lg object-cover border border-amber-400/60 group-hover:scale-105 transition-transform shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[8px] uppercase font-bold text-amber-400 block truncate">Anchor Mover</span>
                    <p className="text-[10px] font-black text-white truncate group-hover:text-amber-200">{fastMoverName}</p>
                    <span className="text-[8px] text-amber-400/80 font-bold block">Preview ➔</span>
                  </div>
                </div>

                <div
                  onClick={() => pairedProduct && setPreviewProduct(pairedProduct)}
                  className="flex items-center gap-2 p-2 rounded-xl bg-stone-950/80 border border-purple-500/30 hover:border-purple-400 hover:bg-stone-900 transition-all cursor-pointer group"
                  title="Click to preview Cross-Sell product details"
                >
                  <img src={recImg} alt="Co-Purchase" className="w-8 h-8 rounded-lg object-cover border border-purple-400/60 group-hover:scale-105 transition-transform shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[8px] uppercase font-bold text-purple-400 block truncate">Adjacent Pair</span>
                    <p className="text-[10px] font-black text-white truncate group-hover:text-purple-200">{recItemName}</p>
                    <span className="text-[8px] text-purple-300/80 font-bold block">Preview ➔</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-200 leading-relaxed bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 font-medium">
                {activeSuggestion.rationale}
              </p>
            </div>

            {/* Action Buttons: Execute vs Reset */}
            {planogramApplied ? (
              <div className="space-y-1.5 pt-1">
                <div className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500/20 via-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black flex items-center justify-center gap-1.5 shadow-md">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {swapMode === "cupboard"
                      ? `Adjacent in ${anchorShelfLoc.zone} (${activeSuggestion.lift}) ✓`
                      : `Deployed at ${targetSpot.code} (${activeSuggestion.lift}) ✓`}
                  </span>
                </div>
                <button
                  onClick={handleReplaySwap}
                  disabled={isSwapAnimating}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:brightness-110 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  title="Replay product flight movement across the showroom"
                >
                  <Play className="w-3.5 h-3.5 text-white fill-white" />
                  <span>Replay 3D Swap Movement</span>
                </button>
                <button
                  onClick={handleResetPlanogram}
                  className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm border border-stone-700"
                >
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Layout (Compare Before & After)</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleApplyPlanogram}
                disabled={isSwapAnimating}
                className="w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-stone-950 shadow-orange-500/25 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {swapMode === "cupboard"
                    ? `Execute In-Aisle Cupboard Placement (${activeSuggestion.lift})`
                    : `Execute Relocation to ${targetSpot.code} (${activeSuggestion.lift})`}
                </span>
              </button>
            )}
          </div>

          {/* Department SKU Breakdown */}
          <div className="glass-panel rounded-3xl p-3 pointer-events-auto space-y-1.5 border border-amber-500/25 shadow-lg text-[10px]">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="text-amber-300 font-bold">Showroom Inventory Coverage</span>
              <span className="text-emerald-400 font-extrabold">All 60 SKUs Mapped</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <div className="p-1.5 rounded-lg bg-stone-950/70 border border-stone-800">
                <span className="text-slate-400 block">Zone 1 (Outerwear)</span>
                <span className="font-bold text-white">12 Jackets & Suits</span>
              </div>
              <div className="p-1.5 rounded-lg bg-stone-950/70 border border-stone-800">
                <span className="text-slate-400 block">Zone 2 (Streetwear)</span>
                <span className="font-bold text-white">12 Jeans & 12 T-Shirts</span>
              </div>
              <div className="p-1.5 rounded-lg bg-stone-950/70 border border-stone-800">
                <span className="text-slate-400 block">Zone 3 (Runway/Shirts)</span>
                <span className="font-bold text-white">12 Shirts & Planogram</span>
              </div>
              <div className="p-1.5 rounded-lg bg-stone-950/70 border border-stone-800">
                <span className="text-slate-400 block">Zone 4 (Footwear)</span>
                <span className="font-bold text-white">12 Leather Shoes</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Minimized Floating Button when overlay is hidden */
        <button
          onClick={() => setIsOverlayVisible(true)}
          onMouseEnter={() => setHoveredItem(null)}
          className="absolute top-20 right-5 z-20 pointer-events-auto glass-panel px-3.5 py-2 rounded-2xl border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-2 shadow-2xl hover:bg-slate-900 cursor-pointer animate-in fade-in zoom-in duration-200"
          title="Open AI Planograms"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Show AI Planograms ({activeSuggestion.lift})</span>
          <ChevronRight className="w-3.5 h-3.5 text-amber-400/80" />
        </button>
      )}

      {/* 🌟 5. CENTERED SQUARE PRODUCT SPOTLIGHT MODAL (Matches user's marked preview square) */}
      {previewProduct && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewProduct(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
        >
          <div
            className="relative w-full max-w-[430px] rounded-3xl p-6 glass-panel border-2 border-amber-500/60 shadow-2xl flex flex-col justify-between overflow-hidden bg-stone-950/95 space-y-4"
            style={{ aspectRatio: "1 / 1" }}
          >
            {/* Close Button */}
            <button
              onClick={() => setPreviewProduct(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-stone-900/90 text-stone-300 hover:text-white hover:bg-stone-800 border border-stone-700 transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Top Badges */}
            <div className="flex items-center gap-2 pr-10">
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {previewProduct.sku}
              </span>
              <span className="text-[10px] font-bold bg-stone-800 text-stone-300 px-2.5 py-0.5 rounded-full border border-stone-700 truncate">
                {previewProduct.category} • {previewProduct.color}
              </span>
              <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                Velocity: {(previewProduct as any).velocity || "4.8"}/day
              </span>
            </div>

            {/* Large Square Product Image */}
            <div className="relative w-full flex-1 rounded-2xl overflow-hidden border border-amber-500/30 shadow-inner bg-stone-900/60 flex items-center justify-center group">
              <img
                src={getProductImage(
                  previewProduct.category,
                  previewProduct.color,
                  previewProduct.name,
                  previewProduct.imageUrl
                )}
                alt={previewProduct.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute bottom-2.5 left-2.5 px-3 py-1 rounded-xl bg-black/85 backdrop-blur-sm text-sm font-black text-amber-400 border border-amber-500/30 shadow-md">
                ₹{previewProduct.price}
              </div>
              <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-[10px] font-bold text-stone-300 border border-stone-700">
                3D Spotlight Preview
              </div>
            </div>

            {/* Product Details & Actions */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-black text-white truncate drop-shadow-sm">
                    {previewProduct.name}
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Inventory Status:{" "}
                    <span
                      className={
                        previewProduct.stock <= 5
                          ? "text-rose-400 font-bold"
                          : "text-emerald-400 font-bold"
                      }
                    >
                      {previewProduct.stock} units available
                    </span>
                  </p>
                </div>
              </div>

              {/* Quick Actions (Sell / Restock) */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => {
                    await handleQuickSell(previewProduct._id);
                    setPreviewProduct((prev) =>
                      prev ? { ...prev, stock: Math.max(0, prev.stock - 1) } : null
                    );
                  }}
                  disabled={actionLoading || previewProduct.stock <= 0}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/25 disabled:opacity-40 hover:brightness-110"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Quick Sell 1x</span>
                </button>
                <button
                  onClick={async () => {
                    await handleQuickRestock(previewProduct._id, previewProduct.stock);
                    setPreviewProduct((prev) =>
                      prev ? { ...prev, stock: prev.stock + 10 } : null
                    );
                  }}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs border border-stone-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Restock (+10)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 4. INTERACTIVE 3D SHELF COMMAND DRAWER (MULTI-PRODUCT & RESTOCK/SELL CONTROLS) */}
      {selectedZone && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 pointer-events-auto animate-in slide-in-from-bottom duration-300"
        >
          <div className="glass-panel rounded-3xl p-5 shadow-2xl border border-amber-500/35 space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <h4 className="text-sm font-bold text-white truncate max-w-[220px]">{selectedZone.name}</h4>
                <span className="text-[10px] bg-purple-500/30 text-purple-200 font-semibold px-2 py-0.5 rounded-full border border-purple-500/40">
                  {selectedZone.department}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {(selectedZone.products && selectedZone.products.length) || (selectedZone.product ? 1 : 0)} Products
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleFocusBay(selectedZone)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Smoothly fly camera to focus on this cupboard"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Focus View</span>
                </button>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-stone-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* If multiple products in this cupboard */}
            {selectedZone.products && selectedZone.products.length > 1 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedZone.products.map((prod) => (
                  <div
                    key={prod._id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-stone-950/80 border border-stone-800 hover:border-amber-500/40 transition-all"
                  >
                    <div
                      onClick={() => setPreviewProduct(prod)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                      title="Click to preview product in center modal"
                    >
                      <img
                        src={getProductImage(prod.category, prod.color, prod.name)}
                        alt={prod.name}
                        className="w-12 h-12 rounded-xl object-cover border border-amber-500/40 group-hover:scale-105 transition-transform shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-400 font-mono font-bold">{prod.sku}</span>
                          <span className="text-[9px] bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded">
                            {prod.color}
                          </span>
                        </div>
                        <h5 className="font-bold text-white text-xs truncate group-hover:text-amber-200">{prod.name}</h5>
                        <div className="flex items-center gap-2.5 text-xs mt-0.5">
                          <span className="font-black text-amber-400 text-xs">₹{prod.price}</span>
                          <span className="text-slate-300 text-[11px] font-medium">
                            {prod.stock} in stock
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Individual Product Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleQuickSell(prod._id)}
                        disabled={actionLoading || prod.stock === 0}
                        className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 text-[11px] font-black flex items-center gap-1 shadow-sm cursor-pointer hover:brightness-110 disabled:opacity-50"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>Sell (1x)</span>
                      </button>
                      <button
                        onClick={() => handleQuickRestock(prod._id, prod.stock)}
                        disabled={actionLoading}
                        className="py-1.5 px-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-stone-700"
                      >
                        <Plus className="w-3 h-3 text-amber-400" />
                        <span>+10</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedZone.product ? (
              /* Single product view (e.g. shoe vitrine or hero rack) */
              <div className="space-y-3">
                <div
                  onClick={() => setPreviewProduct(selectedZone.product!)}
                  className="flex items-center gap-3.5 cursor-pointer group"
                  title="Click to preview product in center modal"
                >
                  <img
                    src={getProductImage(
                      selectedZone.product.category,
                      selectedZone.product.color,
                      selectedZone.product.name
                    )}
                    alt={selectedZone.product.name}
                    className="w-16 h-16 rounded-2xl object-cover border border-amber-500/40 shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-amber-300 font-mono font-bold">{selectedZone.product.sku}</p>
                    <h5 className="font-bold text-white text-sm truncate group-hover:text-amber-200">
                      {selectedZone.product.name}
                    </h5>
                    <div className="flex items-center gap-3 text-xs mt-1">
                      <span className="font-black text-amber-400 text-sm">₹{selectedZone.product.price}</span>
                      <span className="font-medium text-slate-200">
                        {selectedZone.product.stock} in stock
                      </span>
                      <span className="text-emerald-400 font-mono text-[11px] font-bold">
                        {selectedZone.velocity || "5.4"}/day
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 border-t border-amber-500/20">
                  <button
                    onClick={() => handleQuickSell(selectedZone.product!._id)}
                    disabled={actionLoading || selectedZone.product.stock === 0}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-stone-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer hover:brightness-110"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Quick Sell (1x)</span>
                  </button>
                  <button
                    onClick={() =>
                      handleQuickRestock(selectedZone.product!._id, selectedZone.product!.stock)
                    }
                    disabled={actionLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-stone-700"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Restock (+10)</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-200">
                Visual display bay showcasing seasonal {selectedZone.category} inventory in {selectedZone.department}.
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedZone(null)}
                className="py-1.5 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-800 text-stone-300 text-xs font-medium cursor-pointer"
              >
                Close Shelf View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 5. HERO OUTFIT DRAWER (When User Clicks Mannequins) */}
      {selectedMannequin && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pointer-events-auto animate-in slide-in-from-bottom duration-300"
        >
          <div className="glass-panel rounded-3xl p-5 shadow-2xl border-2 border-amber-500/60 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-amber-400">
                  {selectedMannequin.department} • HERO OUTFIT
                </span>
              </div>
              <button
                onClick={() => setSelectedMannequin(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">{selectedMannequin.title}</h4>
              <p className="text-xs text-slate-200 mt-1">{selectedMannequin.outfit}</p>
              <p className="text-base font-extrabold text-amber-400 mt-2">
                Bundle Price: ₹{selectedMannequin.price}{" "}
                <span className="text-xs text-emerald-400 font-semibold">
                  (10% Cross-Sell Bundle Discount)
                </span>
              </p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-700/60">
              <button
                onClick={() => {
                  showToast(
                    `Bundle Order Recorded: "${selectedMannequin.outfit}" sold for ₹${selectedMannequin.price}!`,
                    "success"
                  );
                  setSelectedMannequin(null);
                  if (onRefreshData) onRefreshData();
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs shadow-md cursor-pointer hover:brightness-105"
              >
                Sell Mannequin Bundle
              </button>
              <button
                onClick={() => setSelectedMannequin(null)}
                className="py-2.5 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 6. ACTIVE PLANOGRAM SWAP STATUS BAR */}
      {planogramApplied && (
        <div
          onMouseEnter={() => {
            isMouseOverUIRef.current = true;
          }}
          onMouseLeave={() => {
            isMouseOverUIRef.current = false;
          }}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col sm:flex-row items-center gap-3 px-4 py-2.5 rounded-2xl glass-panel border border-purple-500/50 shadow-2xl bg-stone-950/92 animate-in fade-in slide-in-from-bottom duration-300 max-w-[95%]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
            </span>
            <div className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black text-purple-300 uppercase tracking-wide">
                  ⚡ Live Planogram Relocation Active
                </span>
                <span className="text-[10px] bg-purple-500/20 text-purple-200 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold">
                  {swapMode === "cupboard" ? "🏬 Cupboard Adjacency" : `✨ Hero Station ${targetSpot.code}`}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  {activeSuggestion.lift} Basket Synergy
                </span>
                {savedCoordinates && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                    <span>📍 MongoDB Synced:</span>
                    <span>[{savedCoordinates.swapped.x}, {savedCoordinates.swapped.y}, {savedCoordinates.swapped.z}]</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white font-medium truncate max-w-sm sm:max-w-md">
                <strong className="text-amber-400">{fastMoverName}</strong> + <strong className="text-purple-300">{recItemName}</strong> merchandised together {swapMode === "cupboard" ? `in Adjacent Shelf (${anchorShelfLoc.zone})` : `on ${targetSpot.badge}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReplaySwap}
              disabled={isSwapAnimating}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:brightness-110 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              title="Replay 3D product flight movement"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Replay Swap</span>
            </button>

            <button
              onClick={() => {
                if (navActionRef.current) {
                  if (swapMode === "cupboard") {
                    navActionRef.current([anchorShelfLoc.x, 1.8, anchorShelfLoc.z], 7.0, 0.08, 1.3);
                  } else {
                    navActionRef.current([targetSpot.podiumCoords.x, 1.8, targetSpot.podiumCoords.z], 7.5, 0.05, 1.25);
                  }
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-bold border border-purple-500/40 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Zoom camera directly to active feature spot"
            >
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              <span>{swapMode === "cupboard" ? "Focus Cupboard" : `Focus ${targetSpot.code}`}</span>
            </button>

            <button
              onClick={handleResetPlanogram}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Toggle back to default before layout"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Layout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Store3DVisualizer;
