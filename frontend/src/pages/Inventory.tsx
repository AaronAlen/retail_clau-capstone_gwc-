import React, { useEffect, useState } from "react";
import api from "../services/api";
import { Product } from "../store/slices/productSlice";
import { useSocket } from "../hooks/useSocket";
import { QuickSaleModal } from "../components/QuickSaleModal";
import {
  LuDownload as Download,
  LuShoppingCart as ShoppingCart,
  LuCalendar as Calendar,
  LuCircleAlert as AlertCircle,
} from "react-icons/lu";

interface VelocityRow {
  product: Product;
  unitsSoldWindow: number;
  velocityPerDay: number;
  stock: number;
  daysOfStockLeft: number | null;
  isFastMover: boolean;
}

const Inventory: React.FC = () => {
  const [rows, setRows] = useState<VelocityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(7);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get<VelocityRow[]>(`/analytics/velocity?windowDays=${windowDays}`);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [windowDays]);

  useSocket(() => load());

  // Export Inventory & Velocity to CSV
  const handleExportCSV = () => {
    const headers = ["Product Name", "SKU", "Category", "Color", "Stock", "Units Sold", "Velocity Per Day", "Stock Runway Days", "Fast Mover Status"];
    const csvRows = rows.map((r) => [
      `"${r.product.name}"`,
      `"${r.product.sku}"`,
      `"${r.product.category}"`,
      `"${r.product.color}"`,
      r.stock,
      r.unitsSoldWindow,
      r.velocityPerDay.toFixed(2),
      r.daysOfStockLeft !== null ? r.daysOfStockLeft : "N/A",
      r.isFastMover ? "FAST MOVER" : "NORMAL",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Velocity_Retail_Inventory_${windowDays}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="px-8 pb-12 space-y-6">
      {/* Top Filter and Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-stone-900">Inventory Health & Stock Runway</h2>
          <p className="text-xs text-stone-500">Live units sold, daily velocity, and estimated depletion dates</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Window Dropdown */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-[#E5D7BE] text-xs shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-orange-600" />
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="font-bold text-stone-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value={7}>Rolling 7 Days</option>
              <option value={14}>Rolling 14 Days</option>
              <option value={30}>Rolling 30 Days</option>
            </select>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-[#E5D7BE] bg-white hover:bg-[#FAF5EE] text-stone-700 text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-orange-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="card overflow-x-auto p-0 border border-[#E5D7BE] bg-white shadow-sm">
        {loading ? (
          <p className="text-stone-400 py-12 text-center text-xs">Loading live inventory metrics...</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F8F2E6] text-stone-600 border-b border-[#E5D7BE] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-5">Product</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Available Stock</th>
                <th className="py-3.5 px-4">{windowDays}d Sold</th>
                <th className="py-3.5 px-4">Velocity / Day</th>
                <th className="py-3.5 px-4">Stock Runway</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE5D3]">
              {rows.map((r) => {
                const isCritical = r.stock <= 5;
                const isWarning = r.stock <= 15 && !isCritical;
                return (
                  <tr key={r.product._id} className="hover:bg-[#FAF5EE] transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{r.product.name}</span>
                        {r.isFastMover && <span className="badge-fast text-[10px]">🔥 fast mover</span>}
                      </div>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5">{r.product.sku}</p>
                    </td>

                    <td className="py-3 px-4 text-stone-600">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FAF5EE] text-stone-700 font-semibold border border-[#E5D7BE]">
                        {r.product.category}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold ${
                            isCritical ? "text-rose-600" : isWarning ? "text-amber-600" : "text-stone-700"
                          }`}
                        >
                          {r.stock}
                        </span>
                        {isCritical && <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-stone-700 font-bold">{r.unitsSoldWindow}</td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-stone-900">{r.velocityPerDay.toFixed(2)}</span>
                      <span className="text-stone-400 text-[10px]"> /day</span>
                    </td>

                    <td className="py-3 px-4">
                      {r.daysOfStockLeft !== null ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              r.daysOfStockLeft <= 5
                                ? "text-rose-600"
                                : r.daysOfStockLeft <= 12
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {r.daysOfStockLeft} days
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => setSellingProduct(r.product)}
                        className="btn-primary py-1 px-3 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ShoppingCart className="w-3 h-3 text-white" />
                        <span>Quick Sell</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Sale Checkout Modal */}
      <QuickSaleModal
        product={sellingProduct}
        onClose={() => setSellingProduct(null)}
        onSaleCompleted={() => load()}
      />
    </div>
  );
};

export default Inventory;
