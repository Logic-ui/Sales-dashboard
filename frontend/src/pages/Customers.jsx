import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [metrics, setMetrics] = useState({
    total_customers: 0,
    total_loyalty_points: 0,
    total_tabs_debt: 0,
    vip_customers_count: 0,
  });
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter states
  const [search, setSearch] = useState("");
  const [hasTabOnly, setHasTabOnly] = useState(false);

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  // Pay Tab Modal
  const [showPayTabModal, setShowPayTabModal] = useState(false);
  const [tabCustomer, setTabCustomer] = useState(null);
  const [tabPaymentAmount, setTabPaymentAmount] = useState("");
  const [tabPaymentNotes, setTabPaymentNotes] = useState("Cash settlement at counter");

  // Coupon Manager Modal
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState("percent");
  const [couponVal, setCouponVal] = useState("10");
  const [couponMinPurchase, setCouponMinPurchase] = useState("0");

  const navigate = useNavigate();

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = { limit: 100, sort: "name", order: "asc" };
      if (search) params.q = search;
      if (hasTabOnly) params.has_tab = true;

      const [custRes, metRes, coupRes] = await Promise.all([
        api.get("/customers", { params }),
        api.get("/customers/summary/metrics"),
        api.get("/coupons"),
      ]);

      setCustomers(custRes.data.items || []);
      setMetrics(metRes.data || {});
      setCoupons(coupRes.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load customer directory.");
    } finally {
      setLoading(false);
    }
  }, [search, hasTabOnly]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchCustomers();
  }, [navigate, fetchCustomers]);

  // Open Add / Edit Customer Modal
  const handleOpenCustomerModal = (cust = null) => {
    if (cust) {
      setEditingCustomer(cust);
      setCustomerForm({
        name: cust.name,
        phone: cust.phone || "",
        email: cust.email || "",
        address: cust.address || "",
        notes: cust.notes || "",
      });
    } else {
      setEditingCustomer(null);
      setCustomerForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
    }
    setShowCustomerModal(true);
  };

  // Save Customer
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name.trim()) return;

    try {
      const payload = {
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim() || undefined,
        email: customerForm.email.trim() || undefined,
        address: customerForm.address.trim() || undefined,
        notes: customerForm.notes.trim() || undefined,
      };

      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer.id}`, payload);
        setSuccess(`Updated "${payload.name}" profile!`);
      } else {
        await api.post("/customers", payload);
        setSuccess(`Registered new customer "${payload.name}"! Bonus 10 loyalty points awarded.`);
      }

      setShowCustomerModal(false);
      fetchCustomers();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save customer");
    }
  };

  // Open Settle Tab Modal
  const handleOpenPayTab = (customer) => {
    setTabCustomer(customer);
    setTabPaymentAmount((customer.store_credit_balance || 0).toFixed(2));
    setTabPaymentNotes("Cash counter payment");
    setShowPayTabModal(true);
  };

  // Submit Tab Payment
  const handlePayTabSubmit = async (e) => {
    e.preventDefault();
    if (!tabCustomer) return;

    const amt = parseFloat(tabPaymentAmount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    try {
      await api.post(`/customers/${tabCustomer.id}/pay-tab`, {
        amount: amt,
        notes: tabPaymentNotes,
      });
      setSuccess(`Recorded $${amt.toFixed(2)} tab payment for ${tabCustomer.name}!`);
      setShowPayTabModal(false);
      fetchCustomers();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to record payment");
    }
  };

  // WhatsApp Tab Reminder
  const handleSendWhatsAppReminder = (customer) => {
    const debt = Number(customer.store_credit_balance || 0).toFixed(2);
    const text = `Hi ${customer.name}! 👋%0A` +
      `This is a gentle reminder from *Sales Hub Store* that your pending store tab balance is *$${debt}*.%0A` +
      `You can settle it anytime at our store counter. Thank you!`;

    const cleanPhone = customer.phone ? customer.phone.replace(/[^0-9]/g, "") : "";
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  // Add Promo Coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    try {
      await api.post("/coupons", {
        code: couponCode.trim().toUpperCase(),
        discount_type: couponType,
        discount_value: parseFloat(couponVal) || 10,
        min_purchase: parseFloat(couponMinPurchase) || 0,
      });
      setSuccess(`Created coupon "${couponCode.trim().toUpperCase()}"!`);
      setCouponCode("");
      setCouponVal("10");
      fetchCustomers();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create coupon");
    }
  };

  // Delete Coupon
  const handleDeleteCoupon = async (couponId) => {
    try {
      await api.delete(`/coupons/${couponId}`);
      setSuccess("Coupon deactivated.");
      fetchCustomers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to deactivate coupon");
    }
  };

  const getTierClass = (tier) => {
    if (tier?.includes("VIP")) return "tier-vip";
    if (tier === "Gold") return "tier-gold";
    if (tier === "Silver") return "tier-silver";
    return "tier-bronze";
  };

  return (
    <div className="dashboard-container">
      {/* Hero Header */}
      <div className="dashboard-hero customer-hero">
        <div className="hero-text">
          <div className="hero-badge">
            <span className="live-dot"></span> Customer Relationship & Loyalty
          </div>
          <h1>Customers & Store Tabs</h1>
          <p className="hero-subtitle">
            Manage customer profiles, reward loyalty points, track store credit tabs (*Udhaar*), and manage discount coupons.
          </p>
        </div>

        <div className="hero-actions">
          <button className="primary-btn-hero" onClick={() => handleOpenCustomerModal(null)}>
            ➕ Add Customer
          </button>
          <button className="secondary-btn-hero" onClick={() => setShowCouponsModal(true)}>
            🏷️ Promo Coupons ({coupons.length})
          </button>
          <button className="filter-btn" onClick={() => navigate("/pos")}>
            🛒 POS Checkout
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="inventory-stats-grid">
        <div className="inv-stat-card">
          <div className="inv-stat-icon purple">👥</div>
          <div className="inv-stat-info">
            <div className="inv-stat-label">Total Customers</div>
            <div className="inv-stat-val">{metrics.total_customers || 0}</div>
            <div className="inv-stat-sub">{metrics.vip_customers_count || 0} Gold / VIP Members</div>
          </div>
        </div>

        <div className={`inv-stat-card ${metrics.total_tabs_debt > 0 ? "warning-card" : ""}`}>
          <div className="inv-stat-icon yellow">💳</div>
          <div className="inv-stat-info">
            <div className="inv-stat-label">Outstanding Store Tabs</div>
            <div className="inv-stat-val" style={{ color: metrics.total_tabs_debt > 0 ? "#d97706" : "inherit" }}>
              ${Number(metrics.total_tabs_debt || 0).toFixed(2)}
            </div>
            <div className="inv-stat-sub">Pending customer debt to collect</div>
          </div>
        </div>

        <div className="inv-stat-card">
          <div className="inv-stat-icon green">🎁</div>
          <div className="inv-stat-info">
            <div className="inv-stat-label">Loyalty Points Issued</div>
            <div className="inv-stat-val">{metrics.total_loyalty_points || 0}</div>
            <div className="inv-stat-sub">Redeemable in POS (20 pts = $1)</div>
          </div>
        </div>

        <div className="inv-stat-card">
          <div className="inv-stat-icon red">🏷️</div>
          <div className="inv-stat-info">
            <div className="inv-stat-label">Active Promo Codes</div>
            <div className="inv-stat-val">{coupons.length}</div>
            <div className="inv-stat-sub">Discount coupons for promotions</div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Controls Bar */}
      <div className="inv-controls-bar">
        <div className="inv-search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="inv-search-input"
            placeholder="Search customers by name, phone number, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <div className="inv-filter-group">
          <button
            className={`inv-filter-toggle ${hasTabOnly ? "active" : ""}`}
            onClick={() => setHasTabOnly(!hasTabOnly)}
          >
            💳 Pending Tabs Only
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="inv-table-card">
        {loading ? (
          <div className="table-loading">Loading customer directory...</div>
        ) : customers.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">👥</div>
            <h3>No customers found</h3>
            <p>Add your frequent customers to track loyalty points and store credit.</p>
            <button className="primary-btn-hero" onClick={() => handleOpenCustomerModal(null)}>
              ➕ Add First Customer
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Member Tier</th>
                  <th>Loyalty Points</th>
                  <th>Store Tab / Debt</th>
                  <th>Total Spend</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const hasDebt = (c.store_credit_balance || 0) > 0;
                  return (
                    <tr key={c.id} className={hasDebt ? "row-has-debt" : ""}>
                      <td>
                        <div className="cust-avatar-cell">
                          <div className="cust-avatar">{c.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div className="product-title-main">{c.name}</div>
                            {c.notes && <div className="product-desc-sub">{c.notes}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="contact-cell">
                          {c.phone ? <span>📞 {c.phone}</span> : <span className="text-muted">No phone</span>}
                          {c.email && <small className="text-muted">{c.email}</small>}
                        </div>
                      </td>
                      <td>
                        <span className={`tier-badge ${getTierClass(c.tier)}`}>
                          {c.tier || "Bronze"}
                        </span>
                      </td>
                      <td>
                        <div className="points-cell">
                          <span className="points-coin">🪙</span>
                          <span className="bold">{c.loyalty_points || 0} pts</span>
                        </div>
                      </td>
                      <td>
                        {hasDebt ? (
                          <div className="debt-cell">
                            <span className="debt-amt bold">${Number(c.store_credit_balance).toFixed(2)}</span>
                            <span className="debt-badge">Pending</span>
                          </div>
                        ) : (
                          <span className="text-success bold">Paid / No Debt</span>
                        )}
                      </td>
                      <td>
                        <span className="bold">${Number(c.total_spent || 0).toFixed(2)}</span>
                      </td>
                      <td className="text-right">
                        <div className="inv-action-buttons">
                          {hasDebt && (
                            <>
                              <button
                                className="inv-btn restock"
                                onClick={() => handleOpenPayTab(c)}
                                title="Record payment for store tab"
                              >
                                💵 Settle Tab
                              </button>
                              <button
                                className="inv-btn whatsapp-reminder-btn"
                                onClick={() => handleSendWhatsAppReminder(c)}
                                title="Send WhatsApp payment reminder"
                              >
                                💬 WhatsApp
                              </button>
                            </>
                          )}
                          <button
                            className="inv-btn edit"
                            onClick={() => handleOpenCustomerModal(c)}
                            title="Edit customer details"
                          >
                            ✏️ Edit
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

      {/* --- ADD / EDIT CUSTOMER MODAL --- */}
      {showCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowCustomerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCustomer ? `Edit Customer: ${editingCustomer.name}` : "Register New Customer"}</h2>
              <button className="modal-close" onClick={() => setShowCustomerModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveCustomer} className="inv-form">
              <div className="form-control">
                <label>Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-control">
                  <label>Phone Number (for receipts & reminders)</label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 555 234 5678"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  />
                </div>

                <div className="form-control">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. sarah@example.com"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-control">
                <label>Address (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Apt 4B, 120 Market St"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                />
              </div>

              <div className="form-control">
                <label>Preferences / Customer Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Prefers cold brews, neighbor, store tab allowed..."
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCustomerModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCustomer ? "Save Changes" : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SETTLE TAB / DEBT MODAL --- */}
      {showPayTabModal && tabCustomer && (
        <div className="modal-overlay" onClick={() => setShowPayTabModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💵 Settle Store Tab: {tabCustomer.name}</h2>
              <button className="modal-close" onClick={() => setShowPayTabModal(false)}>✕</button>
            </div>

            <form onSubmit={handlePayTabSubmit} className="inv-form">
              <div className="restock-current-box">
                <div>
                  <span className="text-muted">Total Outstanding Debt:</span>
                  <span className="restock-val text-danger bold"> ${Number(tabCustomer.store_credit_balance || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted">Remaining Balance Will Be:</span>
                  <span className="restock-val text-success bold">
                    {" "}${Math.max(0, (tabCustomer.store_credit_balance || 0) - (parseFloat(tabPaymentAmount) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="form-control">
                <label>Payment Amount Received ($) *</label>
                <div className="restock-quick-pills">
                  <button
                    type="button"
                    className="pill-btn active"
                    onClick={() => setTabPaymentAmount((tabCustomer.store_credit_balance || 0).toFixed(2))}
                  >
                    Pay in Full (${Number(tabCustomer.store_credit_balance).toFixed(2)})
                  </button>
                  {[5, 10, 20, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className="pill-btn"
                      onClick={() => setTabPaymentAmount(val.toString())}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={tabPaymentAmount}
                  onChange={(e) => setTabPaymentAmount(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label>Payment Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Cash payment at register"
                  value={tabPaymentNotes}
                  onChange={(e) => setTabPaymentNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowPayTabModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- COUPONS MANAGER MODAL --- */}
      {showCouponsModal && (
        <div className="modal-overlay" onClick={() => setShowCouponsModal(false)}>
          <div className="modal-content coupons-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏷️ Promo Coupons & Discounts</h2>
              <button className="modal-close" onClick={() => setShowCouponsModal(false)}>✕</button>
            </div>

            <div className="coupons-modal-body">
              {/* Create new coupon */}
              <form onSubmit={handleCreateCoupon} className="coupon-create-form">
                <h3>Create New Promo Code</h3>
                <div className="form-row">
                  <div className="form-control flex-1">
                    <label>Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SPRING15"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                  </div>
                  <div className="form-control flex-1">
                    <label>Type</label>
                    <select value={couponType} onChange={(e) => setCouponType(e.target.value)}>
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed Dollar ($)</option>
                    </select>
                  </div>
                  <div className="form-control flex-1">
                    <label>Discount Value</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={couponVal}
                      onChange={(e) => setCouponVal(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-control flex-1">
                    <label>Min Order Amount ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={couponMinPurchase}
                      onChange={(e) => setCouponMinPurchase(e.target.value)}
                    />
                  </div>
                  <div className="form-control flex-1" style={{ alignSelf: "flex-end" }}>
                    <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                      + Add Coupon
                    </button>
                  </div>
                </div>
              </form>

              {/* Active coupons list */}
              <div className="active-coupons-section">
                <h3>Active Coupons</h3>
                {coupons.length === 0 ? (
                  <p className="text-muted">No coupons created yet.</p>
                ) : (
                  <div className="coupons-list">
                    {coupons.map((coup) => (
                      <div key={coup.id} className="coupon-card-row">
                        <div className="coupon-code-badge">{coup.code}</div>
                        <div className="coupon-details">
                          <span className="bold">
                            {coup.discount_type === "percent" ? `${coup.discount_value}% OFF` : `$${coup.discount_value} OFF`}
                          </span>
                          {coup.min_purchase > 0 && <small className="text-muted"> &bull; Min: ${coup.min_purchase}</small>}
                          <small className="text-muted"> &bull; Used: {coup.used_count || 0} times</small>
                        </div>
                        <button
                          className="inv-btn delete"
                          onClick={() => handleDeleteCoupon(coup.id)}
                          title="Deactivate coupon"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
