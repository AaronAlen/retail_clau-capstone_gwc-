import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import api from "../../services/api";

export interface Product {
  _id: string;
  name: string;
  sku: string;
  category: string;
  color: string;
  tags: string[];
  price: number;
  stock: number;
  imageUrl?: string;
  coordinates3D?: {
    x: number;
    y: number;
    z: number;
    zone?: string;
    shelf?: string;
    slot?: number;
    isRelocated?: boolean;
  };
}

interface ProductState {
  items: Product[];
  loading: boolean;
  error: string | null;
}

const initialState: ProductState = { items: [], loading: false, error: null };

export const fetchProducts = createAsyncThunk("products/fetch", async () => {
  const { data } = await api.get<Product[]>("/products");
  return data;
});

const productSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    upsertProduct: (state, action: PayloadAction<Product>) => {
      const idx = state.items.findIndex((p) => p._id === action.payload._id);
      if (idx >= 0) state.items[idx] = action.payload;
      else state.items.unshift(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to load products";
      });
  },
});

export const { upsertProduct } = productSlice.actions;
export default productSlice.reducer;
