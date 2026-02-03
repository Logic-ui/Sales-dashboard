import { Link, useNavigate } from "react-router-dom";
import React from "react";

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

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
        {token ? (
          <button className="logout-sm" onClick={handleLogout}>
            Logout
          </button>
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
