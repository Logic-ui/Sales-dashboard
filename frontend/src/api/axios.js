import axios from "axios";

const getBaseURL = () => {
  if (process.env.REACT_APP_API_URL) {
    const custom = process.env.REACT_APP_API_URL.trim().replace(/\/+$/, "");
    return custom.endsWith("/api") ? custom : `${custom}/api`;
  }
  if (typeof window !== "undefined") {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) {
      const apiPort = process.env.REACT_APP_API_PORT || "8000";
      return `http://127.0.0.1:${apiPort}/api`;
    }
    // On Vercel / production, route through /api
    return "/api";
  }
  return "/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Helpful debug log in non-production
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.log("[api] configured baseURL:", api.defaults.baseURL);
}

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("[api] 401 Unauthorized received - clearing stale session");
      localStorage.removeItem("token");
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/" &&
        window.location.pathname !== "/register"
      ) {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

