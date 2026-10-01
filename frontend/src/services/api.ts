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
        // Calls /auth/refresh with HttpOnly cookie automatically attached
        await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
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
