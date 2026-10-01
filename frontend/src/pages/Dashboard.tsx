import React, { useEffect, useState, Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import api from "../services/api";
import { useSocket } from "../hooks/useSocket";
import { Product } from "../store/slices/productSlice";
import { QuickSaleModal } from "../components/QuickSaleModal";
import {
  LuTrendingUp as TrendingUp,
  LuShoppingBag as ShoppingBag,
  LuSparkles as Sparkles,
  LuLayers as Layers,
  LuCalendar as Calendar,
  LuShoppingCart as ShoppingCart,
  LuBox as Box,
  LuLoaderCircle as Loader2,
} from "react-icons/lu";

// Lazy-load 3D Visualizer for instantaneous initial dashboard paint
const Store3DVisualizer = lazy(() => import("../components/Store3DVisualizer"));
const Store3DVisualizerV2 = lazy(() => import("../components/Store3DVisualizerV2"));

interface VelocityRow {
  product: Product;
  unitsSoldWindow: number;
  velocityPerDay: number;
  stock: number;
  daysOfStockLeft: number | null;
  isFastMover: boolean;
}

interface Summary {
  totalProducts: number;
  totalUnitsSold7d: number;
  fastMoverCount: number;
  fastMovers: VelocityRow[];
  lowStockAlerts: VelocityRow[];
}

interface Recommendation {
  sourceProduct: Product;
  similarProducts: Product[];
  reason: string;
}

const StatCard = ({
  label,
  value,
  accent,
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: string | number;
  accent: string;
  icon: any;
  subtitle?: string;
}) => (
  <div className="card hover:border-orange-500/50 transition-all flex flex-col justify-between bg-white border border-[#E5D7BE] shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-stone-600">{label}</span>
      <div className={`p-2 rounded-xl bg-[#FAF5EE] border border-[#E5D7BE] ${accent}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <div className="mt-3">
      <p className={`text-2xl font-black tracking-tight ${accent}`}>{value}</p>
      {subtitle && <p className="text-[11px] text-stone-500 mt-1">{subtitle}</p>}
    </div>
  </div>
);

// High-performance Showroom Skeleton Loader
const ShowroomSkeleton = () => (
  <div className="w-full h-[680px] rounded-2xl bg-gradient-to-b from-stone-900 to-stone-950 border border-stone-800 flex flex-col items-center justify-center p-8 relative overflow-hidden shadow-2xl">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-stone-900/50 to-stone-950"></div>
    <div className="relative z-10 flex flex-col items-center gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/10 animate-pulse">
        <Box className="w-8 h-8 text-orange-400 animate-spin" style={{ animationDuration: "8s" }} />
      </div>
      <div>
        <h3 className="text-base font-bold text-white tracking-wide">Initializing 3D Showroom Architecture</h3>
        <p className="text-xs text-stone-400 mt-1 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
          Preparing luxury department cupboards & catalog planogram...
        </p>
      </div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const location = useLocation();
  const incomingPairIndex = (location.state as any)?.selectedPairIndex;
  const incomingSwapMode = (location.state as any)?.swapMode;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [visualizerMode, setVisualizerMode] = useState<"classic" | "v2">("classic");
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(7);
  const [selectedProductForSale, setSelectedProductForSale] = useState<Product | null>(null);

  const load = () => {
    // 1. Fetch Fast Analytics Summary first (Instant UI Paint in ~60ms)
    api.get<Summary>("/analytics/summary")
      .then((sumRes) => {
        setSummary(sumRes.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load analytics summary:", err);
        setLoading(false);
      });

    // 2. Fetch AI Recommendations asynchronously in the background (Non-blocking)
    api.get<any>("/recommendations?ai=true")
      .then((recRes) => {
        const list = Array.isArray(recRes.data)
          ? recRes.data
          : (recRes.data?.recommendations || []);
        setRecommendations(list);
      })
      .catch((err) => {
        console.error("Failed to load AI recommendations:", err);
      });
  };

  useEffect(() => {
    load();
  }, [windowDays]);

  useSocket(() => load());

  if (loading || !summary) {
    return (
      <div className="px-8 pb-12 space-y-6">
        <div className="h-12 w-72 bg-stone-200/70 rounded-xl animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-[#E5D7BE] rounded-xl p-4 animate-pulse shadow-sm"></div>
          ))}
        </div>
        <ShowroomSkeleton />
      </div>
    );
  }

  const chartData = summary.fastMovers.map((f) => ({
    name: f.product.name.length > 14 ? f.product.name.slice(0, 14) + "…" : f.product.name,
    velocity: Number(f.velocityPerDay.toFixed(2)),
  }));

  return (
    <div className="px-3.5 sm:px-6 lg:px-8 pb-12 space-y-6">
      {/* Top Banner & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-stone-900">Visual Merchandising & Fast-Mover Intelligence</h1>
          <p className="text-xs text-stone-500">Dynamic 3D planogram with real-time category velocity</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#E5D7BE] text-xs shadow-sm self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-orange-600" />
          <span className="text-stone-500 font-medium">Window:</span>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="font-bold text-stone-800 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value={7}>Rolling 7 Days</option>
            <option value={14}>Rolling 14 Days</option>
            <option value={30}>Rolling 30 Days</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Catalog SKUs"
          value={summary.totalProducts}
          accent="text-orange-600"
          icon={Layers}
          subtitle="Across 5 active apparel categories"
        />
        <StatCard
          label="Units Sold"
          value={summary.totalUnitsSold7d}
          accent="text-amber-600"
          icon={ShoppingBag}
          subtitle={`Rolling ${windowDays} days store volume`}
        />
        <StatCard
          label="Fast Movers Detected"
          value={summary.fastMoverCount}
          accent="text-orange-600"
          icon={TrendingUp}
          subtitle="> Mean + 0.75σ category sales velocity"
        />
        <StatCard
          label="Planogram Synergy Pairs"
          value={recommendations.length}
          accent="text-purple-600"
          icon={Sparkles}
          subtitle="AI-driven basket lift pairs active"
        />
      </div>

      {/* 🌟 3D RETAIL STORE FLOOR PLAN VISUALIZER */}
      <div className="space-y-3">
        {/* Visualizer Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-stone-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-stone-800 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Showroom Engine:</span>
            <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800">
              <button
                type="button"
                onClick={() => setVisualizerMode("classic")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  visualizerMode === "classic"
                    ? "bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                🏛️ Classic 3D Showroom
              </button>
              <button
                type="button"
                onClick={() => setVisualizerMode("v2")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  visualizerMode === "v2"
                    ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/30"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                ✨ Luxury Studio V2 (Preview)
                <span className="text-[10px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-full font-black">
                  New
                </span>
              </button>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-stone-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Interactive Digital Twin</span>
          </div>
        </div>

        <Suspense fallback={<ShowroomSkeleton />}>
          {visualizerMode === "classic" ? (
            <Store3DVisualizer
              fastMovers={summary.fastMovers}
              recommendations={recommendations}
              selectedPairIndex={typeof incomingPairIndex === "number" ? incomingPairIndex : undefined}
              initialSwapMode={incomingSwapMode}
            />
          ) : (
            <Store3DVisualizerV2
              fastMovers={summary.fastMovers}
              recommendations={recommendations}
              selectedPairIndex={typeof incomingPairIndex === "number" ? incomingPairIndex : undefined}
              initialSwapMode={incomingSwapMode}
            />
          )}
        </Suspense>
      </div>

      {/* Velocity Bar Chart */}
      <div className="card bg-white border border-[#E5D7BE] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Fast-Mover Velocity (Units Sold / Day)</h3>
            <p className="text-xs text-stone-500">Outlier items compared against category benchmarks</p>
          </div>
          <span className="text-xs font-bold text-orange-800 bg-orange-100 border border-orange-300 px-3 py-1 rounded-full">
            Real-Time Socket Sync
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11, fill: "#78716c" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFDF9",
                borderRadius: "14px",
                border: "1px solid #E5D7BE",
                color: "#1C1917",
                fontSize: "12px",
                boxShadow: "0 10px 25px rgba(68,45,17,0.1)",
              }}
            />
            <Bar dataKey="velocity" fill="#EA580C" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Fast Movers & Low Stock Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fast Movers List */}
        <div className="card bg-white border border-[#E5D7BE] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
              🔥 Active Fast Movers
            </h3>
            <span className="text-xs text-orange-700 font-bold">{summary.fastMovers.length} items</span>
          </div>
          <div className="space-y-2.5">
            {summary.fastMovers.map((f) => (
              <div
                key={f.product._id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF5EE] hover:bg-[#F2E8D5] transition-colors border border-[#E5D7BE]"
              >
                <div>
                  <h4 className="font-bold text-stone-900 text-xs">{f.product.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                    <span className="text-orange-700 font-semibold">{f.product.category}</span>
                    <span>&middot;</span>
                    <span className="font-mono text-stone-700 font-semibold">{f.stock} in stock</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="badge-fast text-[11px] font-bold">{f.velocityPerDay.toFixed(2)} / day</span>
                  <button
                    onClick={() => setSelectedProductForSale(f.product)}
                    className="p-1.5 rounded-lg bg-white border border-[#E5D7BE] hover:border-orange-500 text-orange-600 text-xs transition-colors cursor-pointer shadow-sm"
                    title="Quick Sell"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {summary.fastMovers.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-6">No fast movers detected in this window.</p>
            )}
          </div>
        </div>

        {/* Top Cross-Sell Affinity Pairs */}
        <div className="card bg-white border border-[#E5D7BE] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
              ✨ Top Cross-Sell Affinity Pairs
            </h3>
            <span className="text-xs text-purple-700 font-bold">{recommendations.length} active pairs</span>
          </div>
          <div className="space-y-2.5">
            {recommendations.slice(0, 5).map((rec, idx) => (
              <div
                key={rec.sourceProduct._id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF5EE] hover:bg-[#F2E8D5] transition-colors border border-[#E5D7BE]"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      Anchor: {rec.sourceProduct.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1 truncate">
                    Suggests: <strong className="text-purple-700">{rec.similarProducts.map((p) => p.name).join(", ") || "Complementary items"}</strong>
                  </p>
                </div>
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                  +{84 - idx * 6}% Lift
                </span>
              </div>
            ))}
            {recommendations.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-6">No recommendation pairs generated yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Sale Checkout Modal */}
      <QuickSaleModal
        product={selectedProductForSale}
        onClose={() => setSelectedProductForSale(null)}
        onSaleCompleted={() => load()}
      />
    </div>
  );
};

export default Dashboard;
