import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/login", { 
        email: email.trim(), 
        password 
      });
      
      if (res.data && res.data.access_token) {
        localStorage.setItem("token", res.data.access_token);
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
      
      if (err.response?.status === 401) {
        setError("Invalid email or password. Please try again.");
      } else if (err.response?.status === 404) {
        setError("User not found. Please register first.");
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.message === "Network Error") {
        // Show the base URL to make debugging easier (dev only)
        // eslint-disable-next-line no-console
        console.error("API baseURL:", api.defaults.baseURL);
        setError(
          `Cannot connect to server (base: ${api.defaults.baseURL}). Make sure backend is running on :8000`
        );
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>💼 Sales Hub</h1>
        <p className="subtitle">Manage your sales with ease</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={submit} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-link">
          Don't have an account? <a href="/register">Sign Up</a>
        </div>
      </div>
    </div>
  );
}
