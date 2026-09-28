import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const persisted = localStorage.getItem("velocity_auth");
const initialState: AuthState = persisted
  ? JSON.parse(persisted)
  : {
      user: { id: "admin-1", name: "Admin", email: "admin@velocity.com", role: "admin" },
      accessToken: "demo-token",
      refreshToken: "demo-refresh",
    };

const persist = (state: AuthState) => {
  localStorage.setItem("velocity_auth", JSON.stringify(state));
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthState>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      persist(state);
    },
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      persist(state);
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      localStorage.removeItem("velocity_auth");
    },
  },
});

export const { setCredentials, setAccessToken, logout } = authSlice.actions;
export default authSlice.reducer;
