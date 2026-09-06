import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [metrics, setMetrics] = useState({
    total_products: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    total_stock_units: 0,
    total_cost_value: 0,
    total_retail_value: 0,
    potential_profit: 0,
  });
  const [categories, setCategories] = useState(["General"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Add / Edit Modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "General",
    cost_price: "",
    selling_price: "",
    stock_quantity: "",
    min_stock_level: "5",
    unit: "pcs",
    description: "",
  });

  // Restock Modal state
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQty, setRestockQty] = useState(10);
  const [restockReason, setRestockReason] = useState("Supplier delivery");

  const navigate = useNavigate();

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        limit: 100,
        sort: "name",
        order: "asc",
      };
      if (search) params.q = search;
      if (selectedCategory && selectedCategory !== "All") params.category = selectedCategory;
      if (lowStockOnly) params.low_stock_only = true;

      const [prodRes, metricsRes, catRes] = await Promise.all([
        api.get("/products", { params }),
        api.get("/products/summary/metrics"),
        api.get("/products/categories"),
      ]);

      setProducts(prodRes.data.items || []);
      setMetrics(metricsRes.data || {});
      setCategories(["All", ...(catRes.data || ["General"])]);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, lowStockOnly]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchInventory();
  }, [navigate, fetchInventory]);

  // Open Modal for Create or Edit
  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category || "General",
        cost_price: product.cost_price,
        selling_price: product.selling_price,
        stock_quantity: product.stock_quantity,
        min_stock_level: product.min_stock_level,
        unit: product.unit || "pcs",
        description: product.description || "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        sku: "",
        category: "General",
        cost_price: "",
        selling_price: "",
        stock_quantity: "10",
        min_stock_level: "5",
        unit: "pcs",
        description: "",
      });
    }
    setShowProductModal(true);
  };

  // Submit Product Form
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name || formData.selling_price === "") {
      setError("Please provide at least product name and selling price.");
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        category: formData.category.trim() || "General",
        cost_price: parseFloat(formData.cost_price) || 0.0,
        selling_price: parseFloat(formData.selling_price) || 0.0,
        stock_quantity: parseInt(formData.stock_quantity, 10) || 0,
        min_stock_level: parseInt(formData.min_stock_level, 10) || 5,
        unit: formData.unit.trim() || "pcs",
        description: formData.description.trim() || undefined,
      };

      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, payload);
        setSuccess(`Updated "${payload.name}" successfully!`);
      } else {
        await api.post("/products", payload);
        setSuccess(`Added "${payload.name}" to inventory!`);
      }

      setShowProductModal(false);
      fetchInventory();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save product");
    }
  };

  // Open Restock Modal
  const handleOpenRestock = (product) => {
    setRestockProduct(product);
    setRestockQty(10);
    setRestockReason("Supplier shipment");
    setShowRestockModal(true);
  };

  // Submit Restock
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockProduct) return;
    try {
      await api.post(`/products/${restockProduct.id}/adjust-stock`, {
        quantity_change: parseInt(restockQty, 10) || 0,
        reason: restockReason,
      });
      setSuccess(`Restocked +${restockQty} ${restockProduct.unit || 'units'} of "${restockProduct.name}"!`);
      setShowRestockModal(false);
      fetchInventory();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to adjust stock");
    }
  };

  // Delete Product
  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      setSuccess(`Deleted "${product.name}"`);
      fetchInventory();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete product");
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!products.length) return;
    const headers = ["ID", "SKU", "Name", "Category", "Cost Price", "Selling Price", "Stock", "Min Stock", "Unit"];
    const rows = products.map((p) => [
      p.id,
      `"${p.sku}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category || 'General'}"`,
      p.cost_price,
      p.selling_price,
      p.stock_quantity,
      p.min_stock_level,
      p.unit,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Margin preview calculation for modal
  const costNum = parseFloat(formData.cost_price) || 0;
  const sellNum = parseFloat(formData.selling_price) || 0;
  const profitPerUnit = sellNum - costNum;
  const marginPercent = sellNum > 0 ? ((profitPerUnit / sellNum) * 100).toFixed(1) : "0.0";

  return (
    <div className="dashboard-container">
      {/* Page Header */}
      <div className="dashboard-hero inventory-hero">
        <div className="hero-text">
          <div className="hero-badge">
            <span className="live-dot"></span> Store Catalog & Stock Management
          </div>
          <h1>Inventory & Products</h1>
          <p className="hero-subtitle">
            Manage your store catalog, monitor low stock thresholds, and track cost vs. retail valuation.
          </p>
        </div>

        <div className="hero-actions">
          <button className="primary-btn-hero" onClick={() => handleOpenModal(null)}>
            ➕ Add Product
          </button>
          <button className="secondary-btn-hero" onClick={() => navigate("/pos")}>
            🛒 Open POS Terminal
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="inventory-stats-grid">
        <div className="inv-stat-card">
          <div className="inv-stat-icon purple">📦</div>
          <div className="inv-stat-info">
            <div className="inv-stat-label">Total Catalog Items</div>
            <div className="inv-stat-val">{metrics.total_products || 0}</div>
            <div className="inv-stat-sub">{metrics.total_stock_units || 0} units in warehouse</div>
          </div>
        </div>

        <div className={`inv-stat-card ${metrics.low_stock_count > 0 ? "warning-card" : ""}`} onClick={() => setLowStockOnly(!lowStockOnly)} style={{ cursor: "pointer" }}>
          <div className="inv-stat-icon yellow">⚠️</div>
          <div className="inv-stat-info">
            <div className="inv-stat-label">Low Stock Alerts</div>
            <div className="inv-stat-val">{metrics.low_stock_count || 0}</div>
            <div className="inv-stat-sub">
              {lowStockOnly ? "Showing low stock (Click to clear)" : "Click to view items needing reorder"}
            </div>
          </div>
        </div>

        <div className="inv-stat-card">
          <div className="inv-stat-icon red">🛑</div>
          <div className="inv-stat-info">
            <div className="inv-stat-label">Out of Stock</div>
            <div className="inv-stat-val">{metrics.out_of_stock_count || 0}</div>
            <div className="inv-stat-sub">Items with zero inventory</div>
          </div>
        </div>

        <div className="inv-stat-card">
          <div className="inv-stat-icon green">💰</div>
          <div className="inv-stat-info">
            <div className="inv-stat-label">Inventory Valuation</div>
            <div className="inv-stat-val">${(metrics.total_retail_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="inv-stat-sub">
              Cost: ${(metrics.total_cost_value || 0).toFixed(2)} | Profit: +${(metrics.potential_profit || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Controls / Filter Bar */}
      <div className="inv-controls-bar">
        <div className="inv-search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="inv-search-input"
            placeholder="Search by product name or SKU / barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        <div className="inv-filter-group">
          <select
            className="inv-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>

          <button
            className={`inv-filter-toggle ${lowStockOnly ? "active" : ""}`}
            onClick={() => setLowStockOnly(!lowStockOnly)}
          >
            ⚠️ Low Stock ({metrics.low_stock_count})
          </button>

          <button className="inv-csv-btn" onClick={handleExportCSV} title="Export current list to CSV">
            ⬇️ Export CSV
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="inv-table-card">
        {loading ? (
          <div className="table-loading">Loading store inventory...</div>
        ) : products.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">📦</div>
            <h3>No products found</h3>
            <p>Try clearing your search or category filter, or add a new product to your inventory.</p>
            <button className="primary-btn-hero" onClick={() => handleOpenModal(null)}>
              ➕ Add First Product
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Margin</th>
                  <th>Stock Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isOut = p.stock_quantity === 0;
                  const isLow = p.is_low_stock && !isOut;
                  const profitUnit = p.selling_price - p.cost_price;
                  const marginPct = p.selling_price > 0 ? ((profitUnit / p.selling_price) * 100).toFixed(0) : 0;

                  return (
                    <tr key={p.id} className={isOut ? "row-out-of-stock" : isLow ? "row-low-stock" : ""}>
                      <td>
                        <span className="sku-badge" title="Click to copy SKU" onClick={() => navigator.clipboard?.writeText(p.sku)}>
                          {p.sku}
                        </span>
                      </td>
                      <td>
                        <div className="product-title-main">{p.name}</div>
                        {p.description && <div className="product-desc-sub">{p.description}</div>}
                      </td>
                      <td>
                        <span className="category-pill">{p.category || "General"}</span>
                      </td>
                      <td>
                        <span className="price-cost">${Number(p.cost_price || 0).toFixed(2)}</span>
                      </td>
                      <td>
                        <span className="price-selling bold">${Number(p.selling_price || 0).toFixed(2)}</span>
                      </td>
                      <td>
                        <span className={`margin-badge ${profitUnit > 0 ? "positive" : "neutral"}`}>
                          +{marginPct}%
                        </span>
                      </td>
                      <td>
                        <div className="stock-cell">
                          <div className="stock-count bold">
                            {p.stock_quantity} <span className="unit-label">{p.unit || "pcs"}</span>
                          </div>
                          {isOut ? (
                            <span className="stock-badge out">Out of Stock</span>
                          ) : isLow ? (
                            <span className="stock-badge low">Low Stock (&le;{p.min_stock_level})</span>
                          ) : (
                            <span className="stock-badge in">In Stock</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="inv-action-buttons">
                          <button
                            className="inv-btn restock"
                            onClick={() => handleOpenRestock(p)}
                            title="Restock units"
                          >
                            ⚡ Restock
                          </button>
                          <button
                            className="inv-btn edit"
                            onClick={() => handleOpenModal(p)}
                            title="Edit product"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="inv-btn delete"
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete product"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- ADD / EDIT PRODUCT MODAL --- */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal-content product-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? `Edit "${editingProduct.name}"` : "Add New Product to Inventory"}</h2>
              <button className="modal-close" onClick={() => setShowProductModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveProduct} className="inv-form">
              <div className="form-row">
                <div className="form-control flex-2">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arabica Roast Coffee (500g)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-control flex-1">
                  <label>SKU / Barcode</label>
                  <input
                    type="text"
                    placeholder="Leave empty to auto-generate"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-control flex-1">
                  <label>Category</label>
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="e.g. Beverages, Snacks, Groceries"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                  <datalist id="category-suggestions">
                    {categories.filter(c => c !== "All").map(c => <option key={c} value={c} />)}
                    <option value="Beverages" />
                    <option value="Snacks" />
                    <option value="Groceries" />
                    <option value="Bakery" />
                    <option value="Dairy & Eggs" />
                    <option value="Personal Care" />
                  </datalist>
                </div>

                <div className="form-control flex-1">
                  <label>Measurement Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                    <option value="bottle">Bottle</option>
                    <option value="can">Can</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="carton">Carton</option>
                  </select>
                </div>
              </div>

              <div className="form-row pricing-row">
                <div className="form-control">
                  <label>Cost Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  />
                  <span className="input-hint">What you pay suppliers</span>
                </div>

                <div className="form-control">
                  <label>Selling Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  />
                  <span className="input-hint">Retail price to customers</span>
                </div>

                <div className="form-control margin-preview-box">
                  <label>Projected Margin</label>
                  <div className="margin-result">
                    <span className="margin-pct">+{marginPercent}%</span>
                    <span className="margin-amt">${profitPerUnit.toFixed(2)} profit / unit</span>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-control">
                  <label>Initial Stock Count</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  />
                </div>

                <div className="form-control">
                  <label>Low Stock Warning Level</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="5"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                  />
                  <span className="input-hint">Alerts you when stock &le; this</span>
                </div>
              </div>

              <div className="form-control">
                <label>Description / Notes (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Optional details, supplier info, or shelf location..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingProduct ? "Save Changes" : "Add to Catalog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- QUICK RESTOCK MODAL --- */}
      {showRestockModal && restockProduct && (
        <div className="modal-overlay" onClick={() => setShowRestockModal(false)}>
          <div className="modal-content restock-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚡ Quick Restock: {restockProduct.name}</h2>
              <button className="modal-close" onClick={() => setShowRestockModal(false)}>✕</button>
            </div>

            <form onSubmit={handleRestockSubmit} className="inv-form">
              <div className="restock-current-box">
                <div>
                  <span className="text-muted">Current Stock:</span>
                  <span className="restock-val bold"> {restockProduct.stock_quantity} {restockProduct.unit}</span>
                </div>
                <div>
                  <span className="text-muted">New Stock Will Be:</span>
                  <span className="restock-val text-success bold">
                    {" "}{Math.max(0, restockProduct.stock_quantity + (parseInt(restockQty, 10) || 0))} {restockProduct.unit}
                  </span>
                </div>
              </div>

              <div className="form-control">
                <label>Units to Add</label>
                <div className="restock-quick-pills">
                  {[5, 10, 25, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`pill-btn ${restockQty === num ? "active" : ""}`}
                      onClick={() => setRestockQty(num)}
                    >
                      +{num}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              <div className="form-control">
                <label>Note / Supplier Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly vendor delivery"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowRestockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Restock (+{restockQty})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
