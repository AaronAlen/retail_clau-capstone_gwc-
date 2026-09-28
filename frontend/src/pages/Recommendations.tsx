import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import { fetchRecommendations } from "../store/slices/recommendationSlice";
import { getProductImage } from "../utils/productImages";
import { QuickSaleModal } from "../components/QuickSaleModal";
import { Product } from "../store/slices/productSlice";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Sparkles, ArrowRight, CheckCircle2, ShoppingCart, MapPin, Store, Eye } from "lucide-react";
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

  useEffect(() => {
    dispatch(fetchRecommendations(useAI));
  }, [dispatch, useAI]);

  const handleApplyIn3D = async (
    rec: any,
    index: number,
    mode: "cupboard" | "hero_showcase" = "cupboard"
  ) => {
    setActivePairIndex(index);
    setSwappingId(rec.sourceProduct._id + mode);
    try {
      const lift = index === 0 ? "+84%" : index === 1 ? "+76%" : index === 2 ? "+72%" : index === 3 ? "+68%" : "+64%";
      const payload = buildPlanogramCoordPayload(
        `sug-${index + 1}`,
        rec.sourceProduct,
        rec.similarProducts[0] || rec.sourceProduct,
        rec.similarProducts,
        lift,
        index,
        mode
      );
      await api.post("/recommendations/apply-planogram", payload);
      showToast(
        mode === "cupboard"
          ? `Planogram Active: ${rec.similarProducts[0]?.name || "Partner"} relocated adjacent to ${rec.sourceProduct.name} in native shelf!`
          : `Planogram Active: Pair promoted to Hero Station ${getPopularSpotByIndex(index).code}!`,
        "success"
      );
    } catch (err) {
      console.error("Failed to apply planogram in 3D:", err);
      showToast("Failed to apply planogram to database.", "error");
    } finally {
      setTimeout(() => setSwappingId(null), 1500);
    }
  };

  return (
    <div className="px-8 pb-12 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-stone-900">Visual Merchandising & Placement Engine</h2>
          <p className="text-xs text-stone-500">
            Attribute-paired adjacency suggestions to maximize cross-sell basket lift across In-Aisle Cupboard Bays & 3 Prominent Hero Runway Stations
          </p>
        </div>

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

      {loading ? (
        <div className="card py-16 text-center space-y-2 bg-white border border-[#E5D7BE]">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-stone-500">Analyzing category velocity & attribute pairings...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card py-16 text-center text-xs text-stone-400 bg-white border border-[#E5D7BE]">
          No fast movers detected yet. Record a few sales in Inventory to trigger recommendations.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between pt-2">
            <h3 className="font-black text-stone-900 text-sm uppercase tracking-wider">
              AI Attribute-Paired Merchandising Suggestions (Cupboard Adjacency & 3 Hero Stations)
            </h3>
            <span className="text-xs text-stone-500 font-semibold">{items.length} High-Synergy Pairs</span>
          </div>

          {items.map((rec, index) => {
            const spot = getPopularSpotByIndex(index);
            const lift = index === 0 ? "+84%" : index === 1 ? "+76%" : index === 2 ? "+72%" : index === 3 ? "+68%" : "+64%";
            const sourceImg = getProductImage(
              rec.sourceProduct.category,
              rec.sourceProduct.color,
              rec.sourceProduct.name,
              rec.sourceProduct.imageUrl
            );
            const isCardActive = activePairIndex === index;

            return (
              <div
                key={rec.sourceProduct._id}
                className={`card border transition-all p-5 space-y-4 ${
                  isCardActive
                    ? "border-orange-500 bg-orange-50/20 shadow-md ring-2 ring-orange-500/20"
                    : "border-[#E5D7BE] bg-white hover:border-orange-400 hover:shadow-sm"
                }`}
              >
                {/* Designated Popular Spot Top Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: spot.neonColorHex }} />
                    <span className="text-xs font-black uppercase tracking-wider text-stone-900">
                      Pair #{index + 1}: {spot.badge}
                    </span>
                    <span className="text-[11px] font-semibold text-stone-500">
                      ({spot.name})
                    </span>
                  </div>

                  <button
                    onClick={() => navigate("/")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-stone-200 hover:border-orange-500 text-stone-700 hover:text-orange-600 transition-colors flex items-center gap-1.5 cursor-pointer bg-white"
                    title="View this arrangement in the 3D Showroom on Dashboard"
                  >
                    <Eye className="w-3.5 h-3.5 text-orange-500" />
                    <span>View in 3D Showroom (Dashboard)</span>
                  </button>
                </div>

                {/* Top Badge & Pair Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Pair Visuals */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Source Fast Mover */}
                    <div className="flex items-center gap-3 bg-[#FAF5EE] border border-[#E5D7BE] p-2.5 rounded-2xl">
                      <img src={sourceImg} alt={rec.sourceProduct.name} className="w-12 h-12 rounded-xl object-cover border border-amber-500/40" />
                      <div>
                        <span className="badge-fast text-[10px] mb-1">🔥 Fast Mover Anchor</span>
                        <h4 className="font-bold text-stone-900 text-xs">{rec.sourceProduct.name}</h4>
                        <span className="text-[11px] font-black text-orange-600">₹{rec.sourceProduct.price}</span>
                      </div>
                    </div>

                    <div className="flex items-center text-stone-400 px-1">
                      <ArrowRight className="w-4 h-4 text-orange-600" />
                    </div>

                    {/* Merchandised Nearbys */}
                    <div className="flex flex-wrap items-center gap-2">
                      {rec.similarProducts.map((p) => {
                        const recImg = getProductImage(p.category, p.color, p.name, p.imageUrl);
                        return (
                          <div
                            key={p._id}
                            className="flex items-center gap-2.5 bg-[#FAF5EE] border border-[#E5D7BE] p-2 rounded-2xl hover:border-orange-400 transition-colors"
                          >
                            <img src={recImg} alt={p.name} className="w-10 h-10 rounded-xl object-cover border border-purple-500/30" />
                            <div>
                              <p className="font-bold text-stone-800 text-[11px] line-clamp-1">{p.name}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
                                <span className="font-semibold text-orange-600">₹{p.price}</span>
                                <span>&middot;</span>
                                <span className="text-emerald-600 font-semibold">{p.stock} in stock</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setSellingProduct(p)}
                              className="p-1 rounded-lg text-stone-400 hover:text-orange-600 hover:bg-white cursor-pointer"
                              title="Quick Sell"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                      {rec.similarProducts.length === 0 && (
                        <span className="text-xs text-stone-400 italic">No in-stock match found.</span>
                      )}
                    </div>
                  </div>

                  {/* Affinity Badge */}
                  <div className="flex items-center gap-1.5 self-start lg:self-auto bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full border border-amber-300 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>{lift} Adjacency Synergy</span>
                  </div>
                </div>

                {/* Groq AI Merchandising Explanation Box */}
                <div className="bg-[#FAF5EE] text-stone-800 p-4 rounded-2xl border border-[#E5D7BE] shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                      Merchandising Strategy & Business Rationale
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-stone-700">{rec.reason}</p>
                </div>

                {/* 🌟 Planogram 3D Relocation Action Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5D7BE]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-amber-600" />
                      Home Bay:
                    </span>
                    <span className="text-[11px] font-bold text-stone-800 bg-[#FAF5EE] px-2 py-0.5 rounded-lg border border-[#E5D7BE]">
                      {rec.sourceProduct.category} Cupboard
                    </span>
                    <span className="text-stone-300">|</span>
                    <span className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-purple-600" />
                      Hero Plinth:
                    </span>
                    <span className="text-[11px] font-black text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-300">
                      {spot.code}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApplyIn3D(rec, index, "cupboard")}
                      disabled={swappingId === rec.sourceProduct._id + "cupboard"}
                      className="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md bg-stone-900 hover:bg-stone-800 text-amber-300 border border-amber-500/40 disabled:opacity-50"
                      title="Merchandise partner directly into adjacent bay in the fast mover's cupboard"
                    >
                      <Store className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {swappingId === rec.sourceProduct._id + "cupboard"
                          ? "Relocating to Cupboard..."
                          : "🏬 Cupboard Swap"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleApplyIn3D(rec, index, "hero_showcase")}
                      disabled={swappingId === rec.sourceProduct._id + "hero_showcase"}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-110 text-stone-950 shadow-orange-500/25 disabled:opacity-50"
                      title="Promote pair together to one of 3 prominent promotional stations"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {swappingId === rec.sourceProduct._id + "hero_showcase"
                          ? "Relocating to Hero..."
                          : `✨ Hero Spot (${spot.code})`}
                      </span>
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
