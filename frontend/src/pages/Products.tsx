import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import { fetchProducts, upsertProduct, Product } from "../store/slices/productSlice";
import ProductCard from "../components/ProductCard";
import { QuickSaleModal } from "../components/QuickSaleModal";
import { EditProductModal } from "../components/EditProductModal";
import { useSocket } from "../hooks/useSocket";
import api from "../services/api";
import {
  LuSearch as Search,
  LuPlus as Plus,
  LuFilter as Filter,
  LuUpload as Upload,
  LuLoaderCircle as Loader2,
  LuImage as ImageIcon,
  LuCheck as Check,
} from "react-icons/lu";
import { useToast } from "../context/ToastContext";
import { getProductImage } from "../utils/productImages";

const CATEGORIES = ["All", "Shirts", "T-Shirts", "Jeans", "Jackets", "Shoes"];

const Products: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading } = useSelector((state: RootState) => state.products);
  const user = useSelector((state: RootState) => state.auth.user);
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showAddForm, setShowAddForm] = useState(false);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    category: "Shirts",
    color: "Black",
    price: "",
    stock: "",
    imageUrl: "",
  });

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  useSocket((event, payload) => {
    if (event === "product:updated") dispatch(upsertProduct(payload as Product));
    if (event === "sale:new") dispatch(fetchProducts());
  });

  const canManage = user?.role === "admin" || user?.role === "manager";
  const isAdmin = user?.role === "admin";

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showToast("File size exceeds 8MB limit", "error", "Upload Failed");
      return;
    }

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.url) {
        setNewProduct((prev) => ({ ...prev, imageUrl: res.data.url }));
        showToast("Image uploaded to Cloudinary CDN successfully", "success", "Cloudinary Uploaded");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to upload image to Cloudinary", "error", "Upload Error");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/products", {
        ...newProduct,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
        imageUrl: newProduct.imageUrl || undefined,
        tags: [newProduct.category.toLowerCase(), newProduct.color.toLowerCase(), "apparel"],
      });
      showToast(`${newProduct.name} added to catalog`, "success", "Product Created");
      setNewProduct({ name: "", sku: "", category: "Shirts", color: "Black", price: "", stock: "", imageUrl: "" });
      setShowAddForm(false);
      dispatch(fetchProducts());
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to add product", "error", "Error");
    }
  };

  const filtered = items.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="px-8 pb-12 space-y-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-orange-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#E5D7BE] focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-white text-xs text-stone-900 placeholder-stone-400 shadow-sm"
            placeholder="Search luxury collection by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Category Pills & Add Button */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 bg-[#F5ECE0] p-1 rounded-2xl border border-[#E5D7BE] shadow-sm">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-md shadow-orange-500/20"
                    : "text-stone-600 hover:text-stone-900 hover:bg-white/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {canManage && (
            <button
              className="btn-primary py-2 px-4 flex items-center gap-1.5 text-xs whitespace-nowrap shadow-md shadow-orange-500/20 cursor-pointer"
              onClick={() => setShowAddForm((s) => !s)}
            >
              <Plus className="w-4 h-4 text-white font-black" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Product Modal Drawer */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4 border border-[#E5D7BE] bg-white shadow-xl animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5D7BE]">
            <h3 className="font-bold text-stone-900 text-sm">Add New Catalog Product</h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {/* Product Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <input
              placeholder="Product Name (e.g. Navy Casual Blazer)"
              required
              className="px-3.5 py-2.5 rounded-xl border border-[#E5D7BE] text-xs bg-[#FAF5EE] focus:bg-white text-stone-900"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            />
            <input
              placeholder="SKU (e.g. SKU-1025)"
              required
              className="px-3.5 py-2.5 rounded-xl border border-[#E5D7BE] text-xs bg-[#FAF5EE] focus:bg-white text-stone-900"
              value={newProduct.sku}
              onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
            />
            <select
              value={newProduct.category}
              onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              className="px-3.5 py-2.5 rounded-xl border border-[#E5D7BE] text-xs bg-[#FAF5EE] focus:bg-white text-stone-900 cursor-pointer"
            >
              {CATEGORIES.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              placeholder="Color (e.g. Navy, Black, Beige)"
              required
              className="px-3.5 py-2.5 rounded-xl border border-[#E5D7BE] text-xs bg-[#FAF5EE] focus:bg-white text-stone-900"
              value={newProduct.color}
              onChange={(e) => setNewProduct({ ...newProduct, color: e.target.value })}
            />
            <input
              type="number"
              placeholder="Price (₹)"
              required
              min={1}
              className="px-3.5 py-2.5 rounded-xl border border-[#E5D7BE] text-xs bg-[#FAF5EE] focus:bg-white text-stone-900"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
            />
            <input
              type="number"
              placeholder="Initial Stock Qty"
              required
              min={1}
              className="px-3.5 py-2.5 rounded-xl border border-[#E5D7BE] text-xs bg-[#FAF5EE] focus:bg-white text-stone-900"
              value={newProduct.stock}
              onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
            />
          </div>

          {/* Cloudinary Image Upload Section */}
          <div className="p-3.5 rounded-2xl bg-[#FAF5EE] border border-[#E5D7BE] flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-14 h-14 rounded-xl border border-[#E5D7BE] bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
              <img
                src={newProduct.imageUrl || getProductImage(newProduct.category, newProduct.color, newProduct.name)}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 w-full space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                  Product Image (Cloudinary CDN)
                </span>
                {newProduct.imageUrl?.includes("cloudinary") && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Uploaded to Cloudinary
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-orange-700 text-xs font-bold border border-orange-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-orange-600" />
                      <span>Upload to Cloudinary</span>
                    </>
                  )}
                </button>
                <input
                  type="url"
                  placeholder="Or paste Cloudinary / Image URL (https://...)"
                  value={newProduct.imageUrl}
                  onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-[#E5D7BE] text-xs bg-white text-stone-900 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                />
                {newProduct.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setNewProduct({ ...newProduct, imageUrl: "" })}
                    className="px-2 py-1.5 rounded-xl text-[11px] text-stone-500 hover:text-stone-700 bg-stone-100 border border-stone-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 bg-[#FAF5EE] hover:bg-[#F2E8D5] border border-[#E5D7BE] cursor-pointer"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary py-2 px-5 text-xs font-bold cursor-pointer">
              Save to Catalog
            </button>
          </div>
        </form>
      )}

      {/* Product Cards Grid */}
      {loading ? (
        <p className="text-slate-400 py-12 text-center text-xs">Loading retail catalog...</p>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center text-slate-400 text-xs">
          No products matched your search or category filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((p) => (
            <ProductCard
              key={p._id}
              product={p}
              canManage={canManage}
              onQuickSell={(prod) => setSellingProduct(prod)}
              onEdit={(prod) => setEditingProduct(prod)}
            />
          ))}
        </div>
      )}

      {/* Quick Sale POS Modal */}
      <QuickSaleModal
        product={sellingProduct}
        onClose={() => setSellingProduct(null)}
        onSaleCompleted={() => dispatch(fetchProducts())}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        isAdmin={isAdmin}
        onClose={() => setEditingProduct(null)}
        onSaved={() => dispatch(fetchProducts())}
        onDeleted={() => dispatch(fetchProducts())}
      />
    </div>
  );
};

export default Products;
