import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { Product } from "./productSlice";

export interface Recommendation {
  id?: string;
  pairIndex?: number;
  pairNumber?: number;
  pairType?: "hero_runway" | "cupboard_bay";
  stationBadge?: string;
  stationName?: string;
  department?: string;
  lift?: string;
  sourceProduct: Product;
  similarProducts: Product[];
  reason: string;
}

interface RecommendationState {
  items: Recommendation[];
  loading: boolean;
  error: string | null;
}

const initialState: RecommendationState = { items: [], loading: false, error: null };

export const fetchRecommendations = createAsyncThunk(
  "recommendations/fetch",
  async (useAI: boolean) => {
    const { data } = await api.get<Recommendation[]>(`/recommendations${useAI ? "?ai=true" : ""}`);
    return data;
  }
);

const recommendationSlice = createSlice({
  name: "recommendations",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to load recommendations";
      });
  },
});

export default recommendationSlice.reducer;
