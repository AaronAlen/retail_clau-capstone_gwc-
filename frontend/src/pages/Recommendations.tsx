import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import { fetchRecommendations } from "../store/slices/recommendationSlice";
import { getProductImage } from "../utils/productImages";
import { QuickSaleModal } from "../components/QuickSaleModal";
import { Product } from "../store/slices/productSlice";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShoppingCart,
  MapPin,
  Store,
  Eye,
  Crown,
  Layers,
  Flame,
  Zap,
  Filter,
} from "lucide-react";
import { buildPlanogramCoordPayload, getPopularSpotByIndex } from "../utils/showroomCoordinates";
import { useToast } from "../context/ToastContext";

const Recommendations: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { items, loading } = useSelector((state: RootState) => state.recommendations);
  const [useAI, setUseAI] = useState(true);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [activePairIndex, setActivePairIndex] = useState(0);
  const [filterMode, setFilterMode] = useState<"all" | "hero" | "cupboard">("all");

  useEffect(() => {
    dispatch(fetchRecommendations(useAI));
  }, [dispatch, useAI]);

  // Filter recommendations based on tab selection
  const filteredItems = useMemo(() => {
    if (filterMode === "hero") {
      return items.filter((_, idx) => idx < 3);
    }
    if (filterMode === "cupboard") {
      return items.filter((_, idx) => idx >= 3);
    }
    return items;
  }, [items, filterMode]);

  const handleApplyIn3D = async (rec: any, index: number) => {
    const isHero = index < 3;
    const mode = isHero ? "hero_showcase" : "cupboard";
    setActivePairIndex(index);
    setSwappingId(rec.sourceProduct._id + mode);
    try {
      const lift = rec.lift || (index === 0 ? "+84%" : index === 1 ? "+76%" : index === 2 ? "+72%" : index === 3 ? "+68%" : "+64%");
      const payload = buildPlanogramCoordPayload(
        `sug-${index + 1}`,
        rec.sourceProduct,
        rec.similarProducts[0] || rec.sourceProduct,
        rec.similarProducts,
        lift,
        index,
        mode
      );
      showToast(
        isHero
          ? `✨ Visual Simulation: 4-piece ensemble previewed on Hero Runway Station #${index + 1} (${getPopularSpotByIndex(index).badge})!`
          : `🏬 Visual Simulation: 4 cross-cupboard partners paired adjacent to ${rec.sourceProduct.name} in ${rec.sourceProduct.category} Cupboard!`,
        "success"
      );
    } catch (err) {
      console.error("Failed to preview planogram:", err);
      showToast("Failed to preview planogram.", "error");
    } finally {
      setTimeout(() => setSwappingId(null), 1200);
    }
  };

  const handleOpen3DShowroom = (index: number) => {
    const isHero = index < 3;
    const targetIdx = isHero ? index : index - 3;
    const mode = isHero ? "hero_showcase" : "cupboard";
    navigate("/", {
      state: {
        selectedPairIndex: targetIdx,
        swapMode: mode,
      },
    });
  };

  return (
    <div className="px-6 pb-12 space-y-6 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-stone-900 tracking-tight">Visual Merchandising & Placement Engine</h2>
            <span className="text-[11px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200 px-2.5 py-0.5 rounded-full">
              8 Showroom Pairs
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Curated 8 store merchandising stations: 3 Premier Hero Runway Outfits + 5 In-Aisle Cupboard Bays (4 products per station)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-2xl border border-[#E5D7BE] text-xs font-bold text-stone-700 shadow-sm cursor-pointer hover:border-orange-500 transition-colors">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
            />
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Groq AI Explanations</span>
            <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">
              Live LLM
            </span>
          </label>
        </div>
      </div>

      {/* Filter Tabs for Easy Station Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterMode === "all"
                ? "bg-stone-900 text-white shadow-sm"
                : "bg-white text-stone-600 border border-stone-200 hover:border-stone-400"
            }`}
          >
            All 8 Showroom Pairs ({items.length})
          </button>

          <button
            onClick={() => setFilterMode("hero")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              filterMode === "hero"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-900 border border-amber-200 hover:border-amber-400"
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span>🌟 Hero Runway Stations (Pairs 1–3)</span>
          </button>

          <button
            onClick={() => setFilterMode("cupboard")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              filterMode === "cupboard"
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-sky-50 text-sky-900 border border-sky-200 hover:border-sky-400"
            }`}
          >
            <Store className="w-3.5 h-3.5 text-sky-600" />
            <span>🏬 In-Aisle Cupboards (Pairs 4–8)</span>
          </button>
        </div>

        <span className="text-xs text-stone-500 font-semibold">
          Showing {filteredItems.length} of 8 pairs
        </span>
      </div>

      {loading ? (
        <div className="card py-16 text-center space-y-3 bg-white border border-[#E5D7BE] rounded-2xl">
          <div className="w-9 h-9 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-700">Synthesizing 8 Showroom Stations via Groq AI...</p>
          <p className="text-[11px] text-stone-400">Balancing Top 3 Hero Runway Outfits & 5 Department Cupboard Bays</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card py-16 text-center text-xs text-stone-400 bg-white border border-[#E5D7BE] rounded-2xl">
          No fast movers detected yet. Record a few sales in Inventory to trigger recommendations.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredItems.map((rec) => {
            // Find real index (0 to 7) in the full items array
            const realIndex = items.findIndex((it) => it.sourceProduct._id === rec.sourceProduct._id);
            const spotIndex = realIndex !== -1 ? realIndex : 0;
            const spot = getPopularSpotByIndex(spotIndex);
            const isHero = spotIndex < 3;
            const lift = rec.lift || (spotIndex === 0 ? "+84%" : spotIndex === 1 ? "+76%" : spotIndex === 2 ? "+72%" : spotIndex === 3 ? "+68%" : "+64%");
            const sourceImg = getProductImage(
              rec.sourceProduct.category,
              rec.sourceProduct.color,
              rec.sourceProduct.name,
              rec.sourceProduct.imageUrl
            );
            const isCardActive = activePairIndex === spotIndex;

            return (
              <div
                key={rec.sourceProduct._id}
                className={`rounded-2xl border transition-all p-5 space-y-4 shadow-sm ${
                  isHero
                    ? "bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20 border-amber-200/80 hover:border-amber-400"
                    : "bg-gradient-to-br from-sky-50/40 via-white to-stone-50/30 border-sky-200/80 hover:border-sky-400"
                } ${
                  isCardActive ? "ring-2 ring-orange-500/40 shadow-md" : ""
                }`}
              >
                {/* 1. Header Bar: Pair Number, Category Pill, Station Tag, and 3D Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200/60">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Pair Number Pill */}
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-stone-900 text-white shadow-xs">
                      PAIR #{spotIndex + 1} OF 8
                    </span>

                    {/* Distinct Station Category Badge */}
                    {isHero ? (
                      <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-900 border border-amber-300">
                        <Crown className="w-3.5 h-3.5 text-amber-600" />
                        <span>🌟 HERO RUNWAY SHOWCASE</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg bg-gradient-to-r from-sky-500/15 to-emerald-500/15 text-sky-900 border border-sky-300">
                        <Store className="w-3.5 h-3.5 text-sky-600" />
                        <span>🏬 IN-AISLE CUPBOARD BAY</span>
                      </span>
                    )}

                    {/* Station Name & Department Tag */}
                    <span className="text-xs font-bold text-stone-700 bg-white/80 px-2.5 py-1 rounded-lg border border-stone-200">
                      {rec.stationBadge || spot.badge}: <strong className="text-stone-900">{spot.name}</strong>
                    </span>

                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 border border-stone-200">
                      Category: {rec.department || rec.sourceProduct.category}
                    </span>
                  </div>

                  {/* Top Right: Synergy Lift & Quick 3D Showroom View */}
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lift} Basket Lift</span>
                    </span>

                    <button
                      onClick={() => handleOpen3DShowroom(spotIndex)}
                      className="px-3 py-1 rounded-xl text-xs font-bold border border-stone-300 hover:border-orange-500 text-stone-700 hover:text-orange-600 transition-colors flex items-center gap-1.5 cursor-pointer bg-white shadow-xs"
                      title="Open and inspect this exact pair in the 3D Showroom"
                    >
                      <Eye className="w-3.5 h-3.5 text-orange-500" />
                      <span>View in 3D Showroom</span>
                    </button>
                  </div>
                </div>

                {/* 2. Middle Row: Fast-Mover Anchor + 4 Recommended Products */}
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
                  {/* Left: Source Anchor Fast-Mover */}
                  <div className="xl:w-72 shrink-0 bg-white p-3 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3.5">
                    <img
                      src={sourceImg}
                      alt={rec.sourceProduct.name}
                      className="w-16 h-16 rounded-xl object-cover border border-amber-500/40 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="badge-fast text-[10px] font-black">🔥 Fast Mover Anchor</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-stone-100 text-stone-600">
                          {rec.sourceProduct.category}
                        </span>
                      </div>
                      <h4 className="font-black text-stone-900 text-xs truncate" title={rec.sourceProduct.name}>
                        {rec.sourceProduct.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-black text-orange-600">₹{rec.sourceProduct.price}</span>
                        <span className="text-[11px] text-stone-400">&middot;</span>
                        <span className="text-[11px] font-semibold text-emerald-600">{rec.sourceProduct.stock} in stock</span>
                      </div>
                    </div>
                  </div>

                  {/* Flow Indicator Arrow */}
                  <div className="hidden xl:flex flex-col items-center justify-center px-1 text-stone-400">
                    <ArrowRight className="w-5 h-5 text-orange-500" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-orange-600 text-center mt-1">
                      {isHero ? "Completes Outfit" : "Cross-Cupboard"}
                    </span>
                  </div>

                  {/* Right: Exactly 4 Suggested Products */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {rec.similarProducts.map((p, pIdx) => {
                      const recImg = getProductImage(p.category, p.color, p.name, p.imageUrl);
                      return (
                        <div
                          key={p._id}
                          className="bg-white p-2.5 rounded-2xl border border-stone-200 hover:border-orange-400 transition-all flex flex-col justify-between shadow-xs group"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <img
                              src={recImg}
                              alt={p.name}
                              className="w-11 h-11 rounded-xl object-cover border border-stone-200 shrink-0 group-hover:scale-105 transition-transform"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 block truncate w-fit">
                                {isHero ? `Item #${pIdx + 1} (${p.category})` : p.category}
                              </span>
                              <p className="font-bold text-stone-800 text-[11px] truncate mt-0.5" title={p.name}>
                                {p.name}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="font-black text-orange-600">₹{p.price}</span>
                              <span className="text-stone-300">&middot;</span>
                              <span className="text-stone-500">{p.stock} left</span>
                            </div>

                            <button
                              onClick={() => setSellingProduct(p)}
                              className="p-1 rounded-lg text-stone-400 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
                              title="Quick Sell"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {rec.similarProducts.length === 0 && (
                      <div className="col-span-4 py-4 text-center text-xs text-stone-400 italic bg-white rounded-xl border border-stone-200">
                        No in-stock match found.
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Groq AI Strategic Business Rationale */}
                <div className="bg-[#FAF5EE] text-stone-800 p-4 rounded-2xl border border-[#E5D7BE] shadow-xs">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-orange-800">
                      Groq AI Strategic Merchandising Rationale ({isHero ? "Runway Ensemble" : "Cupboard Adjacency"})
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-stone-700 font-medium">{rec.reason}</p>
                </div>

                {/* 4. Action Row at Bottom */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200/60">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-600">
                    <MapPin className="w-3.5 h-3.5 text-orange-600" />
                    <span>
                      {isHero
                        ? `3D Showroom Stage: Runway Mannequin Station #${spotIndex + 1} (${spot.name})`
                        : `3D Showroom Fixture: ${spot.name} (${rec.sourceProduct.category} Cupboard)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleApplyIn3D(rec, spotIndex)}
                      disabled={swappingId === rec.sourceProduct._id + (isHero ? "hero_showcase" : "cupboard")}
                      className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                        isHero
                          ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 text-stone-950 border border-amber-400/50"
                          : "bg-stone-900 hover:bg-stone-800 text-sky-300 border border-sky-500/30"
                      } disabled:opacity-50`}
                      title={
                        isHero
                          ? "Preview full 4-piece fashion ensemble on this Hero Runway Mannequin"
                          : "Preview 4 complementary items adjacent in this cupboard bay"
                      }
                    >
                      {isHero ? <Crown className="w-3.5 h-3.5 text-stone-950" /> : <Store className="w-3.5 h-3.5 text-sky-400" />}
                      <span>
                        {swappingId === rec.sourceProduct._id + (isHero ? "hero_showcase" : "cupboard")
                          ? "Simulating in 3D..."
                          : isHero
                          ? `✨ Preview Runway Mannequin (${spot.code})`
                          : `🏬 Preview Cupboard Adjacency (${spot.code})`}
                      </span>
                    </button>

                    <button
                      onClick={() => handleOpen3DShowroom(spotIndex)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 hover:border-orange-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Inspect this station in the 3D Showroom"
                    >
                      <Eye className="w-3.5 h-3.5 text-orange-600" />
                      <span>Inspect in 3D</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Sale Checkout Modal */}
      <QuickSaleModal
        product={sellingProduct}
        onClose={() => setSellingProduct(null)}
        onSaleCompleted={() => dispatch(fetchRecommendations(useAI))}
      />
    </div>
  );
};

export default Recommendations;
