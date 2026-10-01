import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LuX as X,
  LuFilePen as Edit3,
  LuTrash2 as Trash2,
  LuTriangleAlert as AlertTriangle,
  LuImage as ImageIcon,
  LuUpload as Upload,
  LuLoaderCircle as Loader2,
  LuCloud as Cloud,
} from "react-icons/lu";
import { Product } from "../store/slices/productSlice";
import { getProductImage } from "../utils/productImages";
import { useToast } from "../context/ToastContext";
import api from "../services/api";

interface EditProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  isAdmin: boolean;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  onClose,
  onSaved,
  onDeleted,
  isAdmin,
}) => {
  if (!product) return null;

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: product.name,
    sku: product.sku,
    category: product.category,
    color: product.color,
    price: product.price,
    stock: product.stock,
    imageUrl: product.imageUrl || "",
  });
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 8MB)
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
        setForm((prev) => ({ ...prev, imageUrl: res.data.url }));
        showToast("Image uploaded to Cloudinary CDN successfully", "success", "Cloudinary Uploaded");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to upload image to Cloudinary", "error", "Upload Error");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/products/${product._id}`, {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
      });
      showToast(`${form.name} updated successfully`, "success", "Product Updated");
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to update product", "error", "Update Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.delete(`/products/${product._id}`);
      showToast(`${product.name} deleted from catalog`, "info", "Product Removed");
      onDeleted();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to delete product", "error", "Delete Failed");
    } finally {
      setLoading(false);
    }
  };

  const isCloudinary = form.imageUrl?.includes("cloudinary");

  return createPortal(
    <div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      {/* 100% Full Viewport Backdrop with Deep Blur and Dimming covering top navbar & sidebar */}
      <div
        className="fixed inset-0 w-full h-full bg-stone-950/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white border border-[#E5D7BE] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-stone-900 animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="px-6 py-5 border-b border-[#E5D7BE] flex items-center justify-between bg-[#F8F2E6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Edit Catalog Item</h3>
              <p className="text-[11px] text-stone-500 font-mono">SKU: {product.sku}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showConfirmDelete ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm">Delete {product.name}?</h4>
              <p className="text-xs text-stone-500 mt-1">
                This will remove the product from the active catalog and merchandising engine.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#FAF5EE] hover:bg-[#F2E8D5] text-stone-700 text-xs font-bold border border-[#E5D7BE] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                {loading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-4">
            {/* Visual Apparel Image Preview with Cloudinary Upload Option */}
            <div className="p-3.5 rounded-2xl bg-[#FAF5EE] border border-[#E5D7BE] space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <img
                    src={form.imageUrl || getProductImage(form.category, form.color, form.name)}
                    alt={form.name}
                    className="w-16 h-16 rounded-xl object-cover border border-[#E5D7BE] bg-white shadow-sm"
                  />
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center text-white">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-orange-600 uppercase tracking-wider font-bold">Product Media</span>
                    {isCloudinary && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Cloudinary CDN
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-stone-900 truncate mt-0.5">{form.name}</p>
                  <p className="text-[11px] text-stone-500">{form.category} • {form.color}</p>
                </div>
              </div>

              {/* Upload to Cloudinary button & URL Input */}
              <div className="pt-2 border-t border-[#E5D7BE]/70 flex flex-col gap-2">
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
                    className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-orange-50 text-orange-700 text-[11px] font-bold border border-orange-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                        <span>Uploading to Cloudinary...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-orange-600" />
                        <span>Upload Photo to Cloudinary</span>
                      </>
                    )}
                  </button>
                  {form.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: "" })}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 text-[10px] font-semibold border border-stone-200 transition-colors"
                      title="Reset to category fallback"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="url"
                    placeholder="Or paste Cloudinary / Image URL (https://...)"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full bg-white border border-[#E5D7BE] rounded-xl px-2.5 py-1.5 text-[11px] text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-600 block mb-1">Product Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-[#FAF5EE] border border-[#E5D7BE] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-600 block mb-1">Price (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full bg-[#FAF5EE] border border-[#E5D7BE] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-600 block mb-1">Stock Level</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  className="w-full bg-[#FAF5EE] border border-[#E5D7BE] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-600 block mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-[#FAF5EE] border border-[#E5D7BE] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-600 block mb-1">Color</label>
                <input
                  type="text"
                  required
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full bg-[#FAF5EE] border border-[#E5D7BE] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
            </div>

            <div className="border-t border-[#E5D7BE] pt-4 flex items-center justify-between gap-3">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                  title="Delete product"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#FAF5EE] hover:bg-[#F2E8D5] text-stone-700 text-xs font-bold border border-[#E5D7BE] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
