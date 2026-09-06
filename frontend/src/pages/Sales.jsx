import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import ReceiptModal from "../components/ReceiptModal";

export default function Sales() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sales, setSales] = useState([]);
  const [amount, setAmount] = useState("");
  const [product, setProduct] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const navigate = useNavigate();

  const handleViewReceipt = async (saleId) => {
    try {
      const res = await api.get(`/pos/receipt/${saleId}`);
      setSelectedReceipt(res.data);
    } catch {
      setError("Could not load receipt for this sale.");
    }
  };

  const load = async (params = {}) => {
    try {
      setLoading(true);
      const res = await api.get("/sales/", {
        params: { page, limit, q, sort, order, ...params },
      });
      setSales(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      setError("Failed to load sales data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
    load();
  }, [navigate]);

  const add = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!product || !amount) {
      setError("Please fill in all fields");
      return;
    }

    try {
      await api.post("/sales/", { 
        amount: parseFloat(amount), 
        product 
      });
      setSuccess("Sale added successfully!");
      setAmount("");
      setProduct("");
      load();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add sale");
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>📈 Sales Management</h1>
      </div>

      <div className="dashboard-main">
        <h2>Record New Sale</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={add} className="sales-form">
          <div className="form-row">
            <div className="form-control">
              <label>Product Name</label>
              <input
                type="text"
                placeholder="Enter product name"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label>Amount ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="btn-group">
            <button type="submit" className="btn btn-success">
              ➕ Add Sale
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => {
                setProduct("");
                setAmount("");
              }}
            >
              Clear
            </button>
          </div>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input placeholder="Search product..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn" onClick={() => { setPage(1); load({ page: 1, q }); }}>Search</button>
            <button className="btn btn-secondary" onClick={() => { setQ(""); setPage(1); load({ page: 1, q: "" }); }}>Clear</button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label>Sort:</label>
            <select value={sort} onChange={(e) => { setSort(e.target.value); load({ page: 1, sort: e.target.value }); }}>
              <option value="created_at">Date</option>
              <option value="amount">Amount</option>
              <option value="product">Product</option>
            </select>

            <select value={order} onChange={(e) => { setOrder(e.target.value); load({ page: 1, order: e.target.value }); }}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>

            <label>Per page:</label>
            <select value={limit} onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); load({ page: 1, limit: parseInt(e.target.value) }); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>

        <h2>Recent Sales</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="loading"></div>
          </div>
        ) : sales.length === 0 ? (
          <div className="empty-state">
            <h3>No Sales Yet</h3>
            <p>Start recording sales to see them appear here</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Products Sold</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <span className="sku-badge">
                        {sale.invoice_no || `#${sale.id}`}
                      </span>
                    </td>
                    <td>
                      <strong>{sale.customer_name || "Walk-in Customer"}</strong>
                      {sale.customer_phone && <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{sale.customer_phone}</div>}
                    </td>
                    <td><strong>{sale.product || "General Items"}</strong></td>
                    <td>
                      <span className="badge-payment" style={{ textTransform: "uppercase" }}>
                        {sale.payment_method || "cash"}
                      </span>
                    </td>
                    <td><strong style={{ color: "var(--primary)" }}>${parseFloat(sale.amount).toFixed(2)}</strong></td>
                    <td>{new Date(sale.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn"
                          style={{ padding: "5px 10px", fontSize: "0.82rem", background: "var(--primary)", color: "#fff" }}
                          onClick={() => handleViewReceipt(sale.id)}
                          title="View and print thermal receipt"
                        >
                          🧾 Receipt
                        </button>
                        <button className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.82rem" }} onClick={() => handleEdit(sale)}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: "0.82rem" }} onClick={() => handleDelete(sale.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <div>Showing {sales.length} of {total} results</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => { if (page > 1) { setPage(page - 1); load({ page: page - 1 }); } }} disabled={page === 1}>Prev</button>
                <div style={{ padding: "8px 12px", background: "var(--bg-card)", borderRadius: 6 }}>{page}</div>
                <button className="btn" onClick={() => { if (sales.length === limit) { setPage(page + 1); load({ page: page + 1 }); } }} disabled={sales.length < limit}>Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
