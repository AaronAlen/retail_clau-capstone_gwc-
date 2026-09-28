import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ShoppingBag, CreditCard, Banknote, QrCode, CheckCircle2 } from "lucide-react";
import { Product } from "../store/slices/productSlice";
import { getProductImage } from "../utils/productImages";
import { useToast } from "../context/ToastContext";
import api from "../services/api";

interface QuickSaleModalProps {
  product: Product | null;
  onClose: () => void;
  onSaleCompleted: () => void;
}

export const QuickSaleModal: React.FC<QuickSaleModalProps> = ({ product, onClose, onSaleCompleted }) => {
  const { showToast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card">("upi");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<{ id: string; total: number; qty: number } | null>(null);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (product) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [product]);

  if (!product) return null;

  const totalAmount = product.price * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity > product.stock) return;
    setLoading(true);

    try {
      const { data } = await api.post(`/products/${product._id}/sale`, { quantity });
      setSuccessReceipt({
        id: data.sale?._id || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        total: totalAmount,
        qty: quantity,
      });
      showToast(`Sale recorded successfully! ${quantity} unit(s) of ${product.name}`, "success", "Sale Confirmed");
      onSaleCompleted();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to record sale", "error", "Sale Error");
    } finally {
      setLoading(false);
    }
  };

  const imgUrl = product.imageUrl || getProductImage(product.category, product.color, product.name);

  return createPortal(
    <div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      {/* 100% Full Viewport Backdrop with Deep Blur and Dimming */}
      <div
        className="fixed inset-0 w-full h-full bg-stone-950/60 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white border border-[#E5D7BE] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-stone-900 animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5D7BE] flex items-center justify-between bg-[#F8F2E6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Quick Store POS Checkout</h3>
              <p className="text-[11px] text-stone-500">Record retail sale instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successReceipt ? (
          /* Receipt Success State */
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-base">Sale Recorded Successfully!</h4>
              <p className="text-xs text-stone-500 mt-1">Transaction Ref: {successReceipt.id.slice(-8).toUpperCase()}</p>
            </div>

            <div className="bg-[#FAF5EE] border border-[#E5D7BE] rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>Item:</span>
                <span className="font-bold text-stone-900">{product.name}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Quantity:</span>
                <span className="font-bold text-stone-900">{successReceipt.qty} units</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Payment Mode:</span>
                <span className="font-bold text-stone-900 uppercase">{paymentMethod}</span>
              </div>
              <div className="border-t border-[#E5D7BE] pt-2 flex justify-between text-sm font-bold text-stone-900">
                <span>Total Paid:</span>
                <span className="text-orange-600 font-black">₹{successReceipt.total}</span>
              </div>
            </div>

            <button onClick={onClose} className="btn-primary w-full py-2.5 cursor-pointer">
              Done & Return
            </button>
          </div>
        ) : (
          /* Checkout Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Product Summary Card */}
            <div className="flex items-center gap-3.5 bg-[#FAF5EE] p-3 rounded-2xl border border-[#E5D7BE]">
              <img src={imgUrl} alt={product.name} className="w-14 h-14 rounded-xl object-cover border border-[#E5D7BE]" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-stone-500 font-mono">{product.sku}</p>
                <h4 className="font-bold text-stone-900 text-sm truncate">{product.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-black text-orange-600">₹{product.price}</span>
                  <span className="text-[11px] text-stone-500">Stock: {product.stock} units</span>
                </div>
              </div>
            </div>

            {/* Quantity Stepper */}
            <div>
              <label className="text-xs font-bold text-stone-600 block mb-1.5">Quantity to Sell</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-[#FAF5EE] hover:bg-[#F2E8D5] border border-[#E5D7BE] text-stone-800 font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={product.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(product.stock, Math.max(1, Number(e.target.value))))}
                  className="flex-1 text-center bg-[#FAF5EE] border border-[#E5D7BE] rounded-xl py-2 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="w-10 h-10 rounded-xl bg-[#FAF5EE] hover:bg-[#F2E8D5] border border-[#E5D7BE] text-stone-800 font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-bold text-stone-600 block mb-1.5">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "upi", label: "UPI / QR", icon: QrCode },
                  { id: "card", label: "Card", icon: CreditCard },
                  { id: "cash", label: "Cash", icon: Banknote },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-orange-50 border-orange-500 text-orange-700 shadow-sm"
                          : "bg-[#FAF5EE] border-[#E5D7BE] text-stone-600 hover:bg-[#F2E8D5]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Customer info */}
            <div>
              <label className="text-xs font-bold text-stone-600 block mb-1">Customer Name (Optional)</label>
              <input
                type="text"
                placeholder="Walk-in customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-[#FAF5EE] border border-[#E5D7BE] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            {/* Order Total & Submit */}
            <div className="border-t border-[#E5D7BE] pt-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-stone-500">Total Receivable</p>
                <p className="text-lg font-black text-orange-600">₹{totalAmount}</p>
              </div>
              <button
                type="submit"
                disabled={loading || product.stock === 0}
                className="btn-primary px-6 py-2.5 text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                {loading ? "Recording..." : `Charge ₹${totalAmount}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export default QuickSaleModal;
