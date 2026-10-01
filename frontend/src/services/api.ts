import axios from "axios";
import { store } from "../store/store";
import { logout } from "../store/slices/authSlice";

const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
export const API_BASE_URL = rawApiUrl
  ? rawApiUrl.endsWith("/api")
    ? rawApiUrl
    : `${rawApiUrl}/api`
  : "/api";

// withCredentials: true ensures HttpOnly cookies (accessToken, refreshToken) are sent with every request
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Attach Bearer token from localStorage for mobile browsers where third-party/cross-origin cookies are restricted
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("velocity_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isRefreshing &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retry = true;
      isRefreshing = true;
      try {
        const storedRefreshToken = localStorage.getItem("velocity_refresh_token");
        // Calls /auth/refresh with HttpOnly cookie automatically attached, plus body fallback
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true }
        );
        if (data?.accessToken) {
          localStorage.setItem("velocity_token", data.accessToken);
        }
        isRefreshing = false;
        return api(original);
      } catch {
        isRefreshing = false;
        store.dispatch(logout());
      }
    }
    return Promise.reject(error);
  }
);

export default api;
