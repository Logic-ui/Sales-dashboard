import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import Plot from "react-plotly.js";

export default function Dashboard() {
  const [summary, setSummary] = useState({});
  const [chartData, setChartData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30); // 7, 30, 90, or null (all)
  const [chartMetric, setChartMetric] = useState("revenue"); // 'revenue' | 'orders'
  const [chartType, setChartType] = useState("area"); // 'area' | 'bar'
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === "dark");

  // Quick sale modal state
  const [showModal, setShowModal] = useState(false);
  const [productName, setProductName] = useState("");
  const [productAmount, setProductAmount] = useState("");
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg] = useState({ error: "", success: "" });

  const navigate = useNavigate();

  // Watch for theme changes from Navbar toggle
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.dataset.theme === "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const daysParam = timeRange ? `?days=${timeRange}` : "";
      const [sumRes, chartRes, prodRes, recentRes, catProdsRes] = await Promise.all([
        api.get("/dashboard/summary"),
        api.get(`/dashboard/chart-data${daysParam}`),
        api.get("/dashboard/product-breakdown"),
        api.get("/dashboard/recent-activity?limit=6"),
        api.get("/products?limit=50"),
      ]);
      setSummary(sumRes.data || {});
      setChartData(Array.isArray(chartRes.data) ? chartRes.data : []);
      setProductData(Array.isArray(prodRes.data) ? prodRes.data : []);
      setRecentActivity(Array.isArray(recentRes.data) ? recentRes.data : []);
      setCatalogProducts(catProdsRes.data?.items || []);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchDashboardData();
  }, [navigate, fetchDashboardData]);

  // Quick record sale
  const handleQuickSale = async (e) => {
    e.preventDefault();
    setModalMsg({ error: "", success: "" });
    if (!productName || !productAmount) {
      setModalMsg({ error: "Please enter product name and amount", success: "" });
      return;
    }
    try {
      setModalLoading(true);
      await api.post("/sales", {
        product: productName.trim(),
        amount: parseFloat(productAmount),
      });
      setModalMsg({ error: "", success: "Sale recorded successfully!" });
      setProductName("");
      setProductAmount("");
      fetchDashboardData();
      setTimeout(() => {
        setShowModal(false);
        setModalMsg({ error: "", success: "" });
      }, 1200);
    } catch (err) {
      setModalMsg({
        error: err.response?.data?.detail || "Failed to record sale",
        success: "",
      });
    } finally {
      setModalLoading(false);
    }
  };

  // Color palette for charts
  const colors = {
    primary: "#6366f1",
    primaryLight: "rgba(99, 102, 241, 0.15)",
    secondary: "#10b981",
    secondaryLight: "rgba(16, 185, 129, 0.15)",
    accent: "#f59e0b",
    rose: "#f43f5e",
    violet: "#a855f7",
    cyan: "#06b6d4",
    palette: ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#3b82f6", "#14b8a6"],
    bg: isDark ? "#1e293b" : "#ffffff",
    cardBg: isDark ? "#0f172a" : "#ffffff",
    textColor: isDark ? "#e2e8f0" : "#1e293b",
    gridColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
    font: "'Plus Jakarta Sans', -apple-system, sans-serif",
  };

  // Primary Timeline Chart config
  const isRevenue = chartMetric === "revenue";
  const mainChartData = [
    {
      x: chartData.map((d) => d.date),
      y: chartData.map((d) => (isRevenue ? d.total : d.count)),
      type: chartType === "area" ? "scatter" : "bar",
      mode: chartType === "area" ? "lines+markers" : undefined,
      fill: chartType === "area" ? "tozeroy" : undefined,
      fillcolor: isRevenue ? colors.primaryLight : colors.secondaryLight,
      line: {
        shape: "spline",
        smoothing: 1.3,
        color: isRevenue ? colors.primary : colors.secondary,
        width: 3.5,
      },
      marker: {
        size: 7,
        color: isRevenue ? colors.primary : colors.secondary,
        line: { color: isDark ? "#0f172a" : "#ffffff", width: 2 },
      },
      hovertemplate: isRevenue
        ? "<b>%{x}</b><br>Revenue: <b>$%{y:,.2f}</b><extra></extra>"
        : "<b>%{x}</b><br>Orders: <b>%{y}</b><extra></extra>",
    },
  ];

  const mainChartLayout = {
    autosize: true,
    height: 380,
    margin: { l: 55, r: 25, t: 25, b: 50 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { family: colors.font, color: colors.textColor, size: 12 },
    xaxis: {
      gridcolor: colors.gridColor,
      linecolor: colors.gridColor,
      zeroline: false,
      tickfont: { size: 11, color: isDark ? "#94a3b8" : "#64748b" },
    },
    yaxis: {
      gridcolor: colors.gridColor,
      zeroline: false,
      tickprefix: isRevenue ? "$" : "",
      tickfont: { size: 11, color: isDark ? "#94a3b8" : "#64748b" },
    },
    hovermode: "x unified",
    hoverlabel: {
      bgcolor: isDark ? "#1e293b" : "#ffffff",
      bordercolor: isDark ? "#334155" : "#e2e8f0",
      font: { family: colors.font, color: isDark ? "#ffffff" : "#0f172a" },
    },
  };

  // Donut Chart config
  const donutData = [
    {
      values: productData.map((p) => p.total),
      labels: productData.map((p) => p.product),
      type: "pie",
      hole: 0.65,
      marker: {
        colors: colors.palette,
        line: { color: isDark ? "#1e293b" : "#ffffff", width: 2 },
      },
      textinfo: "percent",
      hoverinfo: "label+value+percent",
      hovertemplate: "<b>%{label}</b><br>Sales: $%{value:,.2f} (%{percent})<extra></extra>",
    },
  ];

  const donutLayout = {
    autosize: true,
    height: 320,
    margin: { l: 20, r: 20, t: 20, b: 20 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    showlegend: true,
    legend: {
      orientation: "h",
      x: 0,
      y: -0.15,
      font: { family: colors.font, size: 11, color: colors.textColor },
    },
    font: { family: colors.font, color: colors.textColor },
    annotations: [
      {
        font: { size: 16, weight: "bold", color: colors.textColor, family: colors.font },
        showarrow: false,
        text: `<b>${productData.length}</b><br><span style="font-size:11px; font-weight:normal; color:#888">Products</span>`,
        x: 0.5,
        y: 0.5,
      },
    ],
  };

  return (
    <div className="dashboard-container">
      {/* Top Hero Banner */}
      <div className="dashboard-hero">
        <div className="hero-text">
          <div className="hero-badge">
            <span className="live-dot"></span> Live Financial Intelligence
          </div>
          <h1>Executive Sales Dashboard</h1>
          <p className="hero-subtitle">
            Real-time business telemetry, sales momentum, and product velocity
          </p>
        </div>

        <div className="hero-actions">
          {/* Time range pills */}
          <div className="time-filter-group">
            <button
              className={`filter-btn ${timeRange === 7 ? "active" : ""}`}
              onClick={() => setTimeRange(7)}
            >
              7D
            </button>

            <button
              className={`filter-btn ${timeRange === 30 ? "active" : ""}`}
              onClick={() => setTimeRange(30)}
            >
              30D
            </button>

            <button
              className={`filter-btn ${timeRange === 90 ? "active" : ""}`}
              onClick={() => setTimeRange(90)}
            >
              90D
            </button>

            <button
              className={`filter-btn ${timeRange === null ? "active" : ""}`}
              onClick={() => setTimeRange(null)}
            >
              All
            </button>
          </div>

          <Link to="/pos" className="btn-primary-gradient pos-hero-cta" title="Open multi-item POS checkout terminal">
            <span className="btn-icon">🛒</span> Open POS Terminal
          </Link>
          <Link to="/inventory" className="filter-btn" title="Manage catalog and inventory">
            <span className="btn-icon">📦</span> Inventory
          </Link>
          <button className="filter-btn" onClick={() => setShowModal(true)} title="Quick single sale">
            <span className="btn-icon">⚡</span> Quick Sale
          </button>
        </div>
      </div>

      {loading ? (
        <div className="dashboard-loading">
          <div className="modern-spinner"></div>
          <p>Synthesizing sales metrics...</p>
        </div>
      ) : (
        <>
          {/* Low Stock Alert Banner */}
          {summary.low_stock_count > 0 && (
            <div className="dashboard-alert-banner warning">
              <div className="alert-content">
                <span className="alert-icon">⚠️</span>
                <div>
                  <strong>Low Stock Warning:</strong> {summary.low_stock_count} {summary.low_stock_count === 1 ? "product has" : "products have"} reached or dropped below reorder thresholds!
                </div>
              </div>
              <Link to="/inventory" className="alert-link-btn">
                Restock Now &rarr;
              </Link>
            </div>
          )}

          {/* Executive KPI Grid */}
          <div className="kpi-grid">
            {/* Card 1: Total Revenue */}
            <div className="kpi-card card-revenue">
              <div className="kpi-header">
                <span className="kpi-title">Total Revenue</span>
                <div className="kpi-icon icon-purple">💰</div>
              </div>
              <div className="kpi-value">${(summary.total_revenue || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="kpi-footer">
                <span className="kpi-pill pill-success">↑ Cumulative</span>
                <span className="kpi-hint">Gross receipts</span>
              </div>
            </div>

            {/* Card 2: Net Profit & Margin */}
            <div className="kpi-card card-profit">
              <div className="kpi-header">
                <span className="kpi-title">Net Profit</span>
                <div className="kpi-icon icon-emerald">💵</div>
              </div>
              <div className="kpi-value text-success">${(summary.total_profit || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="kpi-footer">
                <span className="kpi-pill pill-success">+{summary.profit_margin || 0}% Margin</span>
                <span className="kpi-hint">Revenue &minus; Cost</span>
              </div>
            </div>

            {/* Card 3: This Month */}
            <div className="kpi-card card-month">
              <div className="kpi-header">
                <span className="kpi-title">This Month</span>
                <div className="kpi-icon icon-cyan">📈</div>
              </div>
              <div className="kpi-value">${(summary.month || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="kpi-footer">
                <span className="kpi-pill pill-info">Current Period</span>
                <span className="kpi-hint">${(summary.week || 0).toFixed(2)} this week</span>
              </div>
            </div>

            {/* Card 4: Total Orders */}
            <div className="kpi-card card-orders">
              <div className="kpi-header">
                <span className="kpi-title">Total Transactions</span>
                <div className="kpi-icon icon-amber">🛍️</div>
              </div>
              <div className="kpi-value">{(summary.total_orders || 0).toLocaleString()}</div>
              <div className="kpi-footer">
                <span className="kpi-pill pill-amber">Completed</span>
                <span className="kpi-hint">Processed sales count</span>
              </div>
            </div>

            {/* Card 5: Average Order Value */}
            <div className="kpi-card card-aov">
              <div className="kpi-header">
                <span className="kpi-title">Avg Order Value</span>
                <div className="kpi-icon icon-rose">💎</div>
              </div>
              <div className="kpi-value">${(summary.avg_order_value || 0).toFixed(2)}</div>
              <div className="kpi-footer">
                <span className="kpi-pill pill-cyan">Top Star</span>
                <span className="kpi-hint truncate" title={summary.top_product}>{summary.top_product || "None"}</span>
              </div>
            </div>

            {/* Card 6: Catalog & Stock Status */}
            <div className="kpi-card card-inventory-stat">
              <div className="kpi-header">
                <span className="kpi-title">Catalog & Stock</span>
                <div className="kpi-icon icon-purple">📦</div>
              </div>
              <div className="kpi-value">{summary.total_products || 0} <span style={{ fontSize: "0.85rem", fontWeight: "normal", color: "var(--text-muted)" }}>Products</span></div>
              <div className="kpi-footer">
                {summary.low_stock_count > 0 ? (
                  <span className="kpi-pill pill-amber">{summary.low_stock_count} Low Stock</span>
                ) : (
                  <span className="kpi-pill pill-success">Stock Healthy</span>
                )}
                <Link to="/inventory" className="kpi-hint" style={{ color: "var(--primary)", textDecoration: "underline" }}>View catalog</Link>
              </div>
            </div>
          </div>

          {/* Primary Trend Chart Section */}
          <div className="chart-glass-card">
            <div className="chart-card-header">
              <div>
                <h2 className="chart-title">Revenue Dynamics & Velocity</h2>
                <p className="chart-subtitle">Historical transaction trajectories and sales volume</p>
              </div>

              <div className="chart-controls">
                {/* Metric switch: Revenue vs Volume */}
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${chartMetric === "revenue" ? "active" : ""}`}
                    onClick={() => setChartMetric("revenue")}
                  >
                    Revenue ($)
                  </button>
                  <button
                    className={`toggle-btn ${chartMetric === "orders" ? "active" : ""}`}
                    onClick={() => setChartMetric("orders")}
                  >
                    Orders (#)
                  </button>
                </div>

                {/* Style switch: Spline vs Bar */}
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${chartType === "area" ? "active" : ""}`}
                    onClick={() => setChartType("area")}
                    title="Spline Area Chart"
                  >
                    📈 Area
                  </button>
                  <button
                    className={`toggle-btn ${chartType === "bar" ? "active" : ""}`}
                    onClick={() => setChartType("bar")}
                    title="Bar Chart"
                  >
                    📊 Bar
                  </button>
                </div>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="plot-wrapper">
                <Plot
                  data={mainChartData}
                  layout={mainChartLayout}
                  style={{ width: "100%", height: "380px" }}
                  config={{ responsive: true, displayModeBar: false }}
                />
              </div>
            ) : (
              <div className="empty-chart-state">
                <div className="empty-icon">📊</div>
                <h3>No telemetry recorded for this timeframe</h3>
                <p>Record your first transaction to unlock interactive trend charts.</p>
                <button className="btn-secondary" onClick={() => setShowModal(true)}>
                  Record First Sale
                </button>
              </div>
            )}
          </div>

          {/* Secondary Analytics Grid */}
          <div className="dual-analytics-grid">
            {/* Left Card: Category & Product Breakdown */}
            <div className="chart-glass-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Product Portfolio Share</h3>
                  <p className="chart-subtitle">Revenue distribution across offerings</p>
                </div>
              </div>

              {productData.length > 0 ? (
                <div>
                  <div className="donut-wrapper">
                    <Plot
                      data={donutData}
                      layout={donutLayout}
                      style={{ width: "100%", height: "320px" }}
                      config={{ responsive: true, displayModeBar: false }}
                    />
                  </div>

                  {/* Ranked mini progress bar list */}
                  <div className="product-rankings">
                    {productData.slice(0, 4).map((p, idx) => (
                      <div key={p.product} className="ranking-item">
                        <div className="ranking-info">
                          <span className="ranking-name">
                            <span className="rank-dot" style={{ backgroundColor: colors.palette[idx % colors.palette.length] }}></span>
                            {p.product}
                          </span>
                          <span className="ranking-value">${p.total.toFixed(2)} ({p.percentage}%)</span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${p.percentage}%`,
                              backgroundColor: colors.palette[idx % colors.palette.length],
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-chart-state">
                  <div className="empty-icon">🍩</div>
                  <h4>No product data</h4>
                  <p>Product shares will visualize once sales are added.</p>
                </div>
              )}
            </div>

            {/* Right Card: Live Sales Stream */}
            <div className="chart-glass-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-title">Live Transaction Feed</h3>
                  <p className="chart-subtitle">Real-time incoming business entries</p>
                </div>
                <Link to="/sales" className="view-all-link">
                  View Ledger →
                </Link>
              </div>

              {recentActivity.length > 0 ? (
                <div className="activity-stream">
                  {recentActivity.map((sale) => (
                    <div key={sale.id} className="stream-row">
                      <div className="stream-left">
                        <div className="stream-badge">📦</div>
                        <div>
                          <div className="stream-product">{sale.product}</div>
                          <div className="stream-time">
                            {sale.created_at
                              ? new Date(sale.created_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : "Recent"}
                          </div>
                        </div>
                      </div>
                      <div className="stream-amount">
                        +${parseFloat(sale.amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-chart-state">
                  <div className="empty-icon">🧾</div>
                  <h4>No recent entries</h4>
                  <p>Recent sales activity will stream here in real time.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Quick Sale Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚡ Quick Record Sale</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            {modalMsg.error && <div className="error-message">{modalMsg.error}</div>}
            {modalMsg.success && <div className="success-message">{modalMsg.success}</div>}

            <form onSubmit={handleQuickSale} className="modal-form">
              {catalogProducts.length > 0 && (
                <div className="form-group">
                  <label>Select From Inventory (Auto-fills price)</label>
                  <select
                    className="inv-select"
                    style={{ width: "100%", marginBottom: "4px" }}
                    onChange={(e) => {
                      const prod = catalogProducts.find((p) => p.id === parseInt(e.target.value, 10));
                      if (prod) {
                        setProductName(prod.name);
                        setProductAmount(Number(prod.selling_price).toFixed(2));
                      }
                    }}
                  >
                    <option value="">-- Choose existing product or type below --</option>
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ${Number(p.selling_price).toFixed(2)} ({p.stock_quantity} in stock)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Arabica Roast Coffee"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label>Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 12.99"
                  value={productAmount}
                  onChange={(e) => setProductAmount(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-gradient" disabled={modalLoading}>
                  {modalLoading ? "Recording..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
