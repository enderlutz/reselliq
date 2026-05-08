import axios from "axios";
import { mockAdapter } from "./mockApi";

const TOKEN_KEY = "reselliq_token";

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

// In dev: Vite proxy maps /api → http://127.0.0.1:8000
// In prod: VITE_API_URL points at the Railway backend.
//   Example: VITE_API_URL=https://reselliq.up.railway.app
// In demo mode: every request is intercepted by mockAdapter — no backend.
function resolveApiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (!raw) return "/api";
  let url = raw.trim().replace(/\/$/, "");
  // Forgiving: if the user set the env var without a protocol, assume https
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return `${url}/api`;
}
const API_BASE = resolveApiBase();

export const api = axios.create({
  baseURL: API_BASE,
  ...(DEMO_MODE ? { adapter: mockAdapter } : {}),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const getToken = () => localStorage.getItem(TOKEN_KEY);
