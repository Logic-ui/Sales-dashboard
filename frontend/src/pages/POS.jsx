import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { sound } from "../utils/audio";
import ReceiptModal from "../components/ReceiptModal";

export default function POS() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Cart State: array of { product, quantity, unit_price }
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash"); // 'cash', 'card', 'mobile_pay', 'store_credit'
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [amountTendered, setAmountTendered] = useState("");

  // Coupon & Loyalty points
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [redeemPoints, setRedeemPoints] = useState(0);

  // Completed Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState(null);

  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  // Keep sound instance synced with toggle
  useEffect(() => {
    sound.muted = !soundEnabled;
  }, [soundEnabled]);

  // Fetch product catalog & customers
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, custRes] = await Promise.all([
        api.get("/products", { params: { limit: 150, sort: "name", order: "asc" } }),
        api.get("/products/categories"),
        api.get("/customers", { params: { limit: 100 } }),
      ]);
      setProducts(prodRes.data.items || []);
      setCategories(["All", ...(catRes.data || [])]);
      setCustomers(custRes.data.items || []);
    } catch (err) {
      console.error("Failed to load catalog:", err);
      setError("Unable to connect to inventory server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchProducts();
  }, [navigate, fetchProducts]);

  // Keyboard shortcut listener: F9 or Ctrl+Enter for quick checkout
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F9" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  // Add product to cart
  const addToCart = (product) => {
    if (product.stock_quantity <= 0) {
      sound.playError();
      setError(`"${product.name}" is currently out of stock!`);
      setTimeout(() => setError(""), 3000);
      return;
    }

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        const currentQty = prevCart[existingIdx].quantity;
        if (currentQty >= product.stock_quantity) {
          sound.playError();
          setError(`Cannot add more. Only ${product.stock_quantity} units available.`);
          setTimeout(() => setError(""), 3000);
          return prevCart;
        }
        sound.playBeep();
        const updated = [...prevCart];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: currentQty + 1,
        };
        return updated;
      } else {
        sound.playBeep();
        return [...prevCart, { product, quantity: 1, unit_price: product.selling_price }];
      }
    });
  };

  // Update quantity in cart
  const updateQuantity = (productId, delta) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock_quantity) {
              sound.playError();
              setError(`Max available stock is ${item.product.stock_quantity}`);
              setTimeout(() => setError(""), 2500);
              return item;
            }
            sound.playBeep();
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  // Remove single line item
  const removeItem = (productId) => {
    sound.playBeep();
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Clear entire cart
  const clearCart = () => {
    if (cart.length && window.confirm("Clear all items from current cart?")) {
      setCart([]);
      setAmountTendered("");
      setDiscount(0);
    }
  };

  // Active selected customer object
  const activeCustomer = customers.find((c) => c.id === parseInt(selectedCustomerId, 10)) || null;

  // Handle Customer Selection
  const handleCustomerChange = (e) => {
    const val = e.target.value;
    setSelectedCustomerId(val);
    setRedeemPoints(0);
    if (!val) {
      setCustomerName("Walk-in Customer");
      setCustomerPhone("");
    } else {
      const cust = customers.find((c) => c.id === parseInt(val, 10));
      if (cust) {
        setCustomerName(cust.name);
        setCustomerPhone(cust.phone || "");
      }
    }
  };

  // Coupon validation
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      setCouponError("");
      const res = await api.post("/coupons/validate", {
        code: couponCode.trim(),
        subtotal,
      });
      if (res.data.valid) {
        sound.playBeep();
        setAppliedCoupon(res.data);
        setCouponError("");
      } else {
        sound.playError();
        setCouponError(res.data.message);
      }
    } catch {
      setCouponError("Failed to validate coupon");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const couponDiscount = appliedCoupon ? appliedCoupon.calculated_discount : 0;
  const pointsDiscount = Math.round((redeemPoints / 20.0) * 100) / 100;
  const manualDiscount = Math.max(0, parseFloat(discount) || 0);
  const totalDiscount = Math.min(subtotal, manualDiscount + couponDiscount + pointsDiscount);
  const taxNum = Math.max(0, parseFloat(tax) || 0);
  const grandTotal = Math.max(0, subtotal - totalDiscount + taxNum);

  const tenderedNum = parseFloat(amountTendered) || 0;
  const changeDue = Math.max(0, tenderedNum - grandTotal);
  const remainingDue = Math.max(0, grandTotal - tenderedNum);

  // Submit checkout to backend
  const handleCheckout = async () => {
    if (!cart.length) {
      setError("Please add at least one item to the cart.");
      sound.playError();
      return;
    }

    if (paymentMethod === "cash" && amountTendered !== "" && tenderedNum < grandTotal) {
      if (!window.confirm(`Amount tendered ($${tenderedNum.toFixed(2)}) is less than total ($${grandTotal.toFixed(2)}). Proceed anyway?`)) {
        return;
      }
    }

    try {
      setCheckoutLoading(true);
      setError("");

      const payload = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        customer_id: activeCustomer ? activeCustomer.id : undefined,
        customer_name: activeCustomer ? activeCustomer.name : (customerName.trim() || "Walk-in Customer"),
        customer_phone: activeCustomer ? activeCustomer.phone : (customerPhone.trim() || undefined),
        payment_method: paymentMethod,
        discount: manualDiscount,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        redeem_points: redeemPoints,
        tax: taxNum,
        amount_tendered: amountTendered !== "" ? tenderedNum : undefined,
        notes: `POS Terminal Sale`,
      };

      const res = await api.post("/pos/checkout", payload);

      sound.playSuccessChime();
      setActiveReceipt(res.data);

      // Reset cart and tender
      setCart([]);
      setAmountTendered("");
      setDiscount(0);
      setAppliedCoupon(null);
      setCouponCode("");
      setRedeemPoints(0);

      // Refresh inventory and customers in background
      fetchProducts();
    } catch (err) {
      sound.playError();
      setError(err.response?.data?.detail || "Checkout transaction failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="pos-app-wrapper">
      {/* --- TOP POS BANNER --- */}
      <div className="pos-topbar">
        <div className="pos-brand">
          <span className="pos-badge">⚡ POS</span>
          <span className="pos-title">Point of Sale Terminal</span>
        </div>

        <div className="pos-top-actions">
          <button
            className="pos-sound-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Tactile sound ON (Click to mute)" : "Tactile sound MUTED (Click to unmute)"}
          >
            {soundEnabled ? "🔊 Sound ON" : "🔇 Muted"}
          </button>
          <button className="pos-nav-btn" onClick={() => navigate("/inventory")}>
            📦 Manage Inventory
          </button>
          <button className="pos-nav-btn" onClick={() => navigate("/dashboard")}>
            📊 Dashboard
          </button>
        </div>
      </div>

      {error && <div className="pos-alert-banner">{error}</div>}

      {/* --- MAIN POS SPLIT LAYOUT --- */}
      <div className="pos-workspace">
        {/* LEFT PANE: PRODUCT CATALOG */}
        <div className="pos-catalog-pane">
          {/* Search & Category Filter Bar */}
          <div className="pos-search-bar-row">
            <div className="pos-search-wrap">
              <span className="pos-search-icon">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                className="pos-search-input"
                placeholder="Scan barcode or type product name / SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button className="pos-clear-search" onClick={() => setSearch("")}>✕</button>
              )}
            </div>

            <div className="pos-cat-scroll">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`pos-cat-pill ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="pos-grid-container">
            {loading ? (
              <div className="pos-empty-state">Loading product catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="pos-empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No items match your search</h3>
                <p>Try a different keyword or category.</p>
              </div>
            ) : (
              <div className="pos-products-grid">
                {filteredProducts.map((p) => {
                  const isOut = p.stock_quantity <= 0;
                  const isLow = p.is_low_stock && !isOut;
                  const inCartItem = cart.find((it) => it.product.id === p.id);

                  return (
                    <div
                      key={p.id}
                      className={`pos-product-card ${isOut ? "out-of-stock" : ""} ${inCartItem ? "in-cart" : ""}`}
                      onClick={() => !isOut && addToCart(p)}
                      role="button"
                      tabIndex={0}
                    >
                      {inCartItem && (
                        <div className="pos-item-cart-qty">
                          x{inCartItem.quantity}
                        </div>
                      )}
                      <div className="pos-card-header">
                        <span className="pos-card-cat">{p.category || "General"}</span>
                        <span className="pos-card-sku">{p.sku}</span>
                      </div>

                      <div className="pos-card-name" title={p.name}>
                        {p.name}
                      </div>

                      <div className="pos-card-footer">
                        <div className="pos-card-price">
                          ${Number(p.selling_price).toFixed(2)}
                          <span className="pos-unit">/{p.unit || "pcs"}</span>
                        </div>

                        <div className="pos-stock-tag">
                          {isOut ? (
                            <span className="tag-out">Out of stock</span>
                          ) : isLow ? (
                            <span className="tag-low">{p.stock_quantity} left</span>
                          ) : (
                            <span className="tag-ok">{p.stock_quantity} in stock</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: ORDER CART & CHECKOUT TERMINAL */}
        <div className="pos-cart-pane">
          {/* Cart Header */}
          <div className="pos-cart-header">
            <div className="cart-title-row">
              <h2>🛒 Current Order</h2>
              <span className="cart-count-badge">
                {cart.reduce((s, it) => s + it.quantity, 0)} items
              </span>
            </div>
            {cart.length > 0 && (
              <button className="cart-clear-btn" onClick={clearCart} title="Clear cart">
                🗑️ Clear
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty-state">
                <div className="empty-cart-icon">🛍️</div>
                <p className="empty-cart-main">Cart is empty</p>
                <p className="empty-cart-sub">Tap any product on the left or scan a barcode to begin order.</p>
              </div>
            ) : (
              cart.map((item) => {
                const lineTotal = item.unit_price * item.quantity;
                return (
                  <div key={item.product.id} className="pos-cart-item">
                    <div className="cart-item-details">
                      <div className="cart-item-name">{item.product.name}</div>
                      <div className="cart-item-meta">
                        ${Number(item.unit_price).toFixed(2)} each &bull; {item.product.sku}
                      </div>
                    </div>

                    {/* Stepper */}
                    <div className="cart-item-stepper">
                      <button
                        className="stepper-btn"
                        onClick={() => updateQuantity(item.product.id, -1)}
                      >
                        -
                      </button>
                      <span className="stepper-qty">{item.quantity}</span>
                      <button
                        className="stepper-btn"
                        onClick={() => updateQuantity(item.product.id, 1)}
                      >
                        +
                      </button>
                    </div>

                    <div className="cart-item-total">
                      ${lineTotal.toFixed(2)}
                    </div>

                    <button
                      className="cart-item-remove"
                      onClick={() => removeItem(item.product.id)}
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Footer & Checkout Controls */}
          <div className="pos-cart-footer">
            {/* Customer Selector & Loyalty Card */}
            <div className="pos-customer-section">
              <div className="pos-customer-select-row">
                <select
                  className="pos-cust-select"
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                >
                  <option value="">👤 Walk-in Customer (Guest)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.tier || "Bronze"} &bull; {c.loyalty_points || 0} pts)
                    </option>
                  ))}
                </select>
              </div>

              {activeCustomer ? (
                <div className="active-cust-card">
                  <div className="cust-card-top">
                    <span className={`tier-badge ${activeCustomer.tier?.includes("VIP") ? "tier-vip" : activeCustomer.tier === "Gold" ? "tier-gold" : "tier-silver"}`}>
                      ⭐ {activeCustomer.tier || "Bronze"}
                    </span>
                    <span className="cust-pts">🪙 {activeCustomer.loyalty_points || 0} pts</span>
                  </div>

                  {activeCustomer.store_credit_balance > 0 && (
                    <div className="cust-tab-warning">
                      ⚠️ Pending Tab Balance: <b>${Number(activeCustomer.store_credit_balance).toFixed(2)}</b>
                    </div>
                  )}

                  {/* Loyalty Points Redemption Button */}
                  {activeCustomer.loyalty_points >= 20 && (
                    <div className="cust-points-redeem-row">
                      {redeemPoints === 0 ? (
                        <button
                          type="button"
                          className="redeem-btn"
                          onClick={() => {
                            const maxPts = Math.min(activeCustomer.loyalty_points, Math.floor(subtotal * 20));
                            setRedeemPoints(maxPts >= 20 ? maxPts : 20);
                            sound.playBeep();
                          }}
                        >
                          🎁 Redeem Points for Discount
                        </button>
                      ) : (
                        <div className="redeem-active-box">
                          <span>🎁 Using {redeemPoints} pts (-${pointsDiscount.toFixed(2)})</span>
                          <button
                            type="button"
                            className="cancel-redeem-btn"
                            onClick={() => setRedeemPoints(0)}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pos-customer-row">
                  <input
                    type="text"
                    className="pos-cust-input"
                    placeholder="Guest Name (e.g. Sarah)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <input
                    type="text"
                    className="pos-cust-input"
                    placeholder="Phone (for WhatsApp receipt)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Coupon Code Row */}
            <div className="pos-coupon-row">
              {appliedCoupon ? (
                <div className="applied-coupon-tag">
                  <span>🏷️ Coupon <b>{appliedCoupon.code}</b> (-${appliedCoupon.calculated_discount.toFixed(2)})</span>
                  <button type="button" className="remove-coupon-btn" onClick={handleRemoveCoupon}>✕</button>
                </div>
              ) : (
                <div className="coupon-input-group">
                  <input
                    type="text"
                    className="pos-coupon-input"
                    placeholder="Promo Code (e.g. WELCOME10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  />
                  <button
                    type="button"
                    className="apply-coupon-btn"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim()}
                  >
                    Apply
                  </button>
                </div>
              )}
              {couponError && <div className="coupon-error-hint">{couponError}</div>}
            </div>

            {/* Manual Discount & Tax Row */}
            <div className="pos-adjustment-row">
              <div className="adjust-control">
                <label>Manual Discount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.00"
                  value={discount === 0 ? "" : discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="adjust-control">
                <label>Tax / VAT ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.00"
                  value={tax === 0 ? "" : tax}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Payment Method Pills */}
            <div className="pos-payment-selector">
              <label className="pos-section-label">Payment Method</label>
              <div className="payment-pills">
                {[
                  { id: "cash", label: "💵 Cash" },
                  { id: "card", label: "💳 Card" },
                  { id: "mobile_pay", label: "📱 Mobile Pay" },
                  { id: "store_credit", label: "🏷️ Store Tab" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pay-pill ${paymentMethod === m.id ? "active" : ""}`}
                    onClick={() => {
                      setPaymentMethod(m.id);
                      sound.playBeep();
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Calculator (if cash selected) */}
            {paymentMethod === "cash" && (
              <div className="pos-cash-calc-box">
                <div className="cash-quick-presets">
                  <button
                    className="preset-btn"
                    onClick={() => setAmountTendered(grandTotal.toFixed(2))}
                  >
                    Exact (${grandTotal.toFixed(2)})
                  </button>
                  {[10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      className="preset-btn"
                      onClick={() => setAmountTendered(amt.toString())}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <div className="cash-tender-row">
                  <div className="cash-input-wrap">
                    <span className="curr-sym">$</span>
                    <input
                      type="number"
                      step="0.01"
                      className="cash-input"
                      placeholder="Cash Tendered"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                    />
                  </div>

                  {amountTendered !== "" && (
                    <div className={`change-display ${tenderedNum >= grandTotal ? "change-ok" : "change-short"}`}>
                      {tenderedNum >= grandTotal ? (
                        <>Change: <b>${changeDue.toFixed(2)}</b></>
                      ) : (
                        <>Remaining: <b>${remainingDue.toFixed(2)}</b></>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grand Total Summary Box */}
            <div className="pos-totals-box">
              <div className="tot-row">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="tot-row discount">
                  <span>Coupon ({appliedCoupon?.code}):</span>
                  <span>-${couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="tot-row discount">
                  <span>Loyalty Points ({redeemPoints} pts):</span>
                  <span>-${pointsDiscount.toFixed(2)}</span>
                </div>
              )}
              {manualDiscount > 0 && (
                <div className="tot-row discount">
                  <span>Manual Discount:</span>
                  <span>-${manualDiscount.toFixed(2)}</span>
                </div>
              )}
              {taxNum > 0 && (
                <div className="tot-row">
                  <span>Tax:</span>
                  <span>+${taxNum.toFixed(2)}</span>
                </div>
              )}
              <div className="tot-row grand-total">
                <span>Total Due:</span>
                <span className="total-amount">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <button
              className="pos-checkout-btn"
              disabled={checkoutLoading || cart.length === 0}
              onClick={handleCheckout}
            >
              {checkoutLoading ? (
                "Processing Order..."
              ) : (
                <>
                  ⚡ Complete Checkout &bull; ${grandTotal.toFixed(2)}
                  <span className="shortcut-hint">[F9]</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- THERMAL RECEIPT MODAL --- */}
      {activeReceipt && (
        <ReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
          onNewSale={() => {
            setActiveReceipt(null);
            searchInputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
