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
  lastCalculatedAt: string | null;
  calculatedBy: { name: string; role: string; userId?: string } | null;
  loading: boolean;
  recalculating: boolean;
  error: string | null;
}

const initialState: RecommendationState = {
  items: [],
  lastCalculatedAt: null,
  calculatedBy: null,
  loading: false,
  recalculating: false,
  error: null,
};

export const fetchRecommendations = createAsyncThunk(
  "recommendations/fetch",
  async (useAI: boolean = true) => {
    const { data } = await api.get<any>(`/recommendations${useAI ? "?ai=true" : ""}`);
    return data;
  }
);

export const recalculateRecommendations = createAsyncThunk(
  "recommendations/recalculate",
  async (useAI: boolean = true) => {
    const { data } = await api.post<any>(`/recommendations/recalculate${useAI ? "?ai=true" : ""}`, { ai: useAI });
    return data;
  }
);

const recommendationSlice = createSlice({
  name: "recommendations",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch (Reads existing snapshot from DB)
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.loading = false;
        if (Array.isArray(action.payload)) {
          state.items = action.payload;
        } else if (action.payload && action.payload.recommendations) {
          state.items = action.payload.recommendations;
          state.lastCalculatedAt = action.payload.lastCalculatedAt || null;
          state.calculatedBy = action.payload.calculatedBy || null;
        }
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to load recommendations";
      })
      // Manual Recalculation (Manager & Admin Exclusive)
      .addCase(recalculateRecommendations.pending, (state) => {
        state.recalculating = true;
        state.error = null;
      })
      .addCase(recalculateRecommendations.fulfilled, (state, action) => {
        state.recalculating = false;
        if (Array.isArray(action.payload)) {
          state.items = action.payload;
        } else if (action.payload && action.payload.recommendations) {
          state.items = action.payload.recommendations;
          state.lastCalculatedAt = action.payload.lastCalculatedAt || null;
          state.calculatedBy = action.payload.calculatedBy || null;
        }
      })
      .addCase(recalculateRecommendations.rejected, (state, action) => {
        state.recalculating = false;
        state.error = action.error.message || "Failed to recalculate recommendations";
      });
  },
});

export default recommendationSlice.reducer;
