import axios from "axios";

// Use the deployed API in production and the local backend during development.
const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
const apiPort = process.env.REACT_APP_API_PORT || "8000";
const localBase = `${protocol}//${host}:${apiPort}`;
const productionBase = "https://sales-dashboard-six-delta.vercel.app";
const defaultBase = process.env.NODE_ENV === "production" ? productionBase : localBase;

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
