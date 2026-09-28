import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import productReducer from "./slices/productSlice";
import recommendationReducer from "./slices/recommendationSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    products: productReducer,
    recommendations: recommendationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
