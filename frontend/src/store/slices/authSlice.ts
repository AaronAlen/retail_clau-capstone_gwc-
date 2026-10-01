import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
}

interface AuthState {
  user: AuthUser | null;
}

const persistedUser = localStorage.getItem("velocity_user");
const initialState: AuthState = {
  user: persistedUser ? JSON.parse(persistedUser) : null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload;
      if (action.payload) {
        localStorage.setItem("velocity_user", JSON.stringify(action.payload));
      } else {
        localStorage.removeItem("velocity_user");
      }
    },
    setCredentials: (state, action: PayloadAction<{ user: AuthUser; accessToken?: string; refreshToken?: string }>) => {
      state.user = action.payload.user;
      localStorage.setItem("velocity_user", JSON.stringify(action.payload.user));
      if (action.payload.accessToken) {
        localStorage.setItem("velocity_token", action.payload.accessToken);
      }
      if (action.payload.refreshToken) {
        localStorage.setItem("velocity_refresh_token", action.payload.refreshToken);
      }
    },
    logout: (state) => {
      state.user = null;
      localStorage.removeItem("velocity_user");
      localStorage.removeItem("velocity_token");
      localStorage.removeItem("velocity_refresh_token");
    },
  },
});

export const { setUser, setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
