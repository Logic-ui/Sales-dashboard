import axios from "axios";

const getBaseURL = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (typeof window !== "undefined") {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isLocal) {
      return window.location.origin;
    }
    const apiPort = process.env.REACT_APP_API_PORT || "8000";
    return `http://127.0.0.1:${apiPort}`;
  }
  return "https://sales-dashboard-six-delta.vercel.app";
};

const api = axios.create({
  baseURL: getBaseURL(),
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
