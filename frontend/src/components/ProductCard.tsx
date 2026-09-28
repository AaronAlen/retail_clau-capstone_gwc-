import React from "react";
import { Product } from "../store/slices/productSlice";
import { getProductImage, getFallbackProductSVG } from "../utils/productImages";
import { ShoppingCart, Edit2 } from "lucide-react";

interface ProductCardProps {
  product: Product;
  badge?: string;
  onQuickSell?: (product: Product) => void;
  onEdit?: (product: Product) => void;
  canManage?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  badge,
  onQuickSell,
  onEdit,
  canManage,
}) => {
  const imageUrl = product.imageUrl || getProductImage(product.category, product.color, product.name);

  return (
    <div className="card group relative flex flex-col justify-between overflow-hidden p-0 border border-[#E5D7BE] bg-white hover:border-orange-500/60 hover:shadow-xl hover:shadow-orange-950/10 transition-all duration-300">
      {/* Product Image Container */}
      <div className="relative h-52 w-full overflow-hidden bg-[#FAF5EE]">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            target.onerror = null;
            target.src = getFallbackProductSVG(product.category, product.color, product.name);
          }}
        />
        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {badge && <span className="badge-fast shadow-md">{badge}</span>}
        </div>

        {/* Hover Quick Action Buttons */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
          {canManage && onEdit && (
            <button
              onClick={() => onEdit(product)}
              className="p-2 rounded-xl bg-white/95 hover:bg-white text-stone-700 shadow-md backdrop-blur border border-[#E5D7BE] transition-transform hover:scale-105 cursor-pointer"
              title="Edit product"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onQuickSell && (
            <button
              onClick={() => onQuickSell(product)}
              className="p-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/25 transition-transform hover:scale-105 flex items-center gap-1.5 text-xs font-bold px-3 border border-orange-400/40 cursor-pointer"
              title="Quick Sell"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-white" />
              <span>Sell</span>
            </button>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] text-stone-500 font-mono tracking-wider">{product.sku}</p>
            <h3 className="font-bold text-stone-900 group-hover:text-orange-600 text-sm leading-snug line-clamp-1 transition-colors">
              {product.name}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="px-2.5 py-0.5 rounded-full bg-[#FAF5EE] text-stone-700 border border-[#E5D7BE] font-semibold text-[11px]">
            {product.category}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#FAF5EE] text-stone-700 border border-[#E5D7BE] font-semibold text-[11px]">
            {product.color}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#EFE5D3] text-sm">
          <span className="font-black text-orange-600 text-lg">₹{product.price}</span>
          <span
            className={`text-xs font-semibold ${
              product.stock <= 5 ? "text-rose-600 font-bold" : "text-stone-500"
            }`}
          >
            {product.stock} in stock
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
