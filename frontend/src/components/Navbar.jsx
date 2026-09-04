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
          Sales Dashboard
        </Link>

        {token && (
          <div className="nav-links">
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
            <Link to="/sales" className="nav-link">
              Sales
            </Link>
            <Link to="/profile" className="nav-link">
              Profile
            </Link>
          </div>
        )}
      </div>

      <div className="nav-right">
        <button
          className="theme-toggle"
          onClick={() => setDarkMode((current) => !current)}
          aria-label={darkMode ? "Use light theme" : "Use dark theme"}
          title={darkMode ? "Light theme" : "Dark theme"}
        >
          {darkMode ? "☀" : "◐"}
        </button>
        {token ? (
          <>
            {email && <div className="nav-user">{email}</div>}
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
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
} 
