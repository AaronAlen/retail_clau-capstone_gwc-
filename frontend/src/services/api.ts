import axios from "axios";
import { store } from "../store/store";
import { logout, setAccessToken } from "../store/slices/authSlice";

const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
export const API_BASE_URL = rawApiUrl
  ? rawApiUrl.endsWith("/api")
    ? rawApiUrl
    : `${rawApiUrl}/api`
  : "/api";

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !isRefreshing) {
      original._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = store.getState().auth.refreshToken;
        if (!refreshToken) throw new Error("no refresh token");
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        store.dispatch(setAccessToken(data.accessToken));
        original.headers.Authorization = `Bearer ${data.accessToken}`;
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
