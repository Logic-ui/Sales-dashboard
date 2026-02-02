import axios from "axios";

// Build a safe default base URL:
// - Use explicit REACT_APP_API_URL when provided
// - Otherwise target the same host that served the frontend, port 8000
//   This avoids "Cannot connect to server" when accessing the UI via
//   server IP/domain (where "localhost" would point to the client machine).
const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
const apiPort = process.env.REACT_APP_API_PORT || "8000";
const defaultBase = `${protocol}//${host}:${apiPort}`;

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || defaultBase,
});

// Helpful: log configured API base URL to aid debugging (dev only)
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.log("[api] baseURL:", api.defaults.baseURL);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
