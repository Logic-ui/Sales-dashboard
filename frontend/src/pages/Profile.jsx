import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");

    const fetchUser = async () => {
      try {
        const res = await api.get("/users/me");
        setUser(res.data);
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>👤 Profile</h1>
        <div className="nav-buttons">
          <button className="nav-btn" onClick={() => handleNavigation("/dashboard")}>
            📊 Dashboard
          </button>
          <button className="nav-btn" onClick={() => handleNavigation("/sales")}>
            📈 Sales
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="dashboard-main">
        <h2>User Profile</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="loading"></div>
          </div>
        ) : user ? (
          <div className="stats-grid">
            <div className="stat-card primary">
              <h3>Email</h3>
              <div style={{ color: "#667eea", fontSize: "18px", marginTop: "10px" }}>
                {user.email}
              </div>
            </div>
            <div className="stat-card success">
              <h3>User ID</h3>
              <div style={{ color: "#51cf66", fontSize: "18px", marginTop: "10px" }}>
                #{user.id}
              </div>
            </div>
            <div className="stat-card warning">
              <h3>Account Status</h3>
              <div style={{ color: "#ffd43b", fontSize: "18px", marginTop: "10px" }}>
                Active
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Profile Not Found</h3>
            <p>Unable to load your profile information</p>
          </div>
        )}
      </div>
    </div>
  );
}
