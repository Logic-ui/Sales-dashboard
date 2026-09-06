import { Link, useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import api from "../api/axios";

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [email, setEmail] = useState("");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    api
      .get("/users/me")
      .then((res) => mounted && setEmail(res.data.email))
      .catch(() => {});
    return () => (mounted = false);
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <nav className="site-navbar">
      <div className="nav-left">
        <Link to={token ? "/dashboard" : "/"} className="brand">
          <span className="brand-badge">⚡</span>
          <span>Sales Hub</span>
        </Link>

        {token && (
          <div className="nav-links">
            <Link to="/pos" className="nav-link nav-pos-highlight" title="Point of Sale Checkout Terminal">
              🛒 POS Terminal
            </Link>
            <Link to="/inventory" className="nav-link" title="Product catalog & stock tracking">
              📦 Inventory
            </Link>
            <Link to="/customers" className="nav-link" title="Customer directory, loyalty points & store tabs">
              👥 Customers
            </Link>
            <Link to="/dashboard" className="nav-link" title="Executive metrics and charts">
              📊 Dashboard
            </Link>
            <Link to="/sales" className="nav-link" title="Sales history and log">
              📈 Sales
            </Link>
            <Link to="/profile" className="nav-link" title="User account settings">
              👤 Profile
            </Link>
          </div>
        )}
      </div>

      <div className="nav-right">
        <button
          className="theme-toggle"
          onClick={() => setDarkMode((current) => !current)}
          aria-label={darkMode ? "Use light theme" : "Use dark theme"}
          title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
        {token ? (
          <>
            {email && (
              <div className="nav-user-badge">
                <span className="nav-avatar">{email.charAt(0).toUpperCase()}</span>
                <span>{email}</span>
              </div>
            )}
            <button className="logout-sm" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/" className="nav-link">
              Login
            </Link>
            <Link to="/register" className="nav-link nav-register">
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
} 
