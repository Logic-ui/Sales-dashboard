import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Plot from "react-plotly.js";

export default function Dashboard() {
  const [summary, setSummary] = useState({});
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");

    const fetchData = async () => {
      try {
        const [summaryRes, chartRes] = await Promise.all([
          api.get("/dashboard/summary"),
          api.get("/dashboard/chart-data"),
        ]);
        setSummary(summaryRes.data);
        setChart(chartRes.data);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
        <h1>📊 Dashboard</h1>
        <div className="nav-buttons">
          <button className="nav-btn" onClick={() => handleNavigation("/sales")}>
            📈 Sales
          </button>
          <button className="nav-btn" onClick={() => handleNavigation("/profile")}>
            👤 Profile
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="dashboard-main">
        <h2>Welcome to Your Sales Dashboard</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="loading"></div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card primary">
                <h3>Today's Sales</h3>
                <div className="value">${summary.today || "0"}</div>
              </div>
              <div className="stat-card success">
                <h3>This Week</h3>
                <div className="value">${summary.week || "0"}</div>
              </div>
              <div className="stat-card warning">
                <h3>This Month</h3>
                <div className="value">${summary.month || "0"}</div>
              </div>
              <div className="stat-card danger">
                <h3>This Year</h3>
                <div className="value">${summary.year || "0"}</div>
              </div>
            </div>

            {/* Chart */}
            {chart && chart.length > 0 && (
              <div className="chart-container">
                <h3>Sales Trend</h3>
                <Plot
                  data={[
                    {
                      x: chart.map((c) => c.date),
                      y: chart.map((c) => c.total),
                      type: "bar",
                      marker: { color: "#667eea" },
                      hovertemplate: "<b>%{x}</b><br>Sales: $%{y}<extra></extra>",
                    },
                  ]}
                  layout={{
                    title: "",
                    xaxis: { title: "Date" },
                    yaxis: { title: "Sales ($)" },
                    plot_bgcolor: "#f9f9f9",
                    paper_bgcolor: "white",
                    margin: { l: 60, r: 40, t: 40, b: 60 },
                    hovermode: "x unified",
                  }}
                  style={{ width: "100%", height: "400px" }}
                  config={{ responsive: true }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
