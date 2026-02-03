import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sales, setSales] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");

    const fetchAll = async () => {
      try {
        setLoading(true);
        const [uRes, sRes] = await Promise.all([
          api.get("/users/me"),
          api.get("/sales?mine=true"),
        ]);
        setUser(uRes.data);
        setEmail(uRes.data.email);
        setSales(sRes.data || []);
      } catch (err) {
        console.error("Failed to load profile or sales:", err);
        setError("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const payload = {};
      if (email && email !== user.email) payload.email = email;
      if (password) payload.password = password;
      if (Object.keys(payload).length === 0) {
        setMsg("No changes to save");
        setEditing(false);
        return;
      }
      const res = await api.put("/users/me", payload);
      setUser(res.data);
      setEmail(res.data.email);
      setPassword("");
      setMsg("Profile updated successfully");
      setEditing(false);
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to update profile");
    }
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
          <>
            {error && <div className="error-message">{error}</div>}
            {msg && <div className="success-message">{msg}</div>}

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

            <div style={{ marginTop: 30 }}>
              <h3>Edit Profile</h3>
              <form onSubmit={saveProfile} className="auth-form" style={{ maxWidth: 480 }}>
                <div className="form-group">
                  <label>Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div className="form-group">
                  <label>New Password (leave blank to keep)</label>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="submit" className="btn btn-success">Save</button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setEmail(user.email); setPassword(""); }}>Cancel</button>
                </div>
              </form>
            </div>

            <div style={{ marginTop: 40 }}>
              <h3>Your Recent Sales</h3>
              {sales.length === 0 ? (
                <div className="empty-state">
                  <h4>No sales yet</h4>
                  <p>Once you add sales they will appear here</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="sales-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Product</th>
                        <th>Amount</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id}>
                          <td>#{s.id}</td>
                          <td><strong>{s.product}</strong></td>
                          <td><strong>${parseFloat(s.amount).toFixed(2)}</strong></td>
                          <td>{new Date(s.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
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
