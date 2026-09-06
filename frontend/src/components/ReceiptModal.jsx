import React from "react";

export default function ReceiptModal({ receipt, onClose, onNewSale }) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const itemsText = (receipt.items || [])
      .map((it) => `• ${it.product_name} x${it.quantity} = $${(it.subtotal || 0).toFixed(2)}`)
      .join("%0A");

    const message = `*Receipt from Sales Hub Store*%0A` +
      `Invoice: *${receipt.invoice_no}*%0A` +
      `Date: ${new Date(receipt.created_at).toLocaleString()}%0A` +
      `Customer: ${receipt.customer_name}%0A` +
      `----------------------------%0A` +
      `${itemsText}%0A` +
      `----------------------------%0A` +
      (receipt.discount > 0 ? `Discount: -$${receipt.discount.toFixed(2)}%0A` : "") +
      (receipt.tax > 0 ? `Tax: +$${receipt.tax.toFixed(2)}%0A` : "") +
      `*Total: $${(receipt.amount || 0).toFixed(2)}*%0A` +
      `Payment: ${receipt.payment_method?.toUpperCase() || "CASH"}%0A` +
      `Thank you for shopping with us! 🎉`;

    const phone = receipt.customer_phone ? receipt.customer_phone.replace(/[^0-9]/g, "") : "";
    const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(url, "_blank");
  };

  const items = receipt.items || [];
  const subtotal = receipt.subtotal || receipt.amount || 0;
  const discount = receipt.discount || 0;
  const tax = receipt.tax || 0;
  const total = receipt.amount || 0;
  const tendered = receipt.amount_tendered;
  const changeDue = receipt.change_due;

  return (
    <div className="receipt-overlay" onClick={onClose}>
      <div className="receipt-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-actions-bar no-print">
          <button className="receipt-action-btn primary" onClick={handlePrint} title="Print thermal receipt">
            🖨️ Print Receipt
          </button>
          <button className="receipt-action-btn whatsapp" onClick={handleWhatsAppShare} title="Share via WhatsApp">
            💬 WhatsApp
          </button>
          {onNewSale && (
            <button className="receipt-action-btn accent" onClick={onNewSale} title="Start next transaction">
              ➕ Next Sale
            </button>
          )}
          <button className="receipt-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* --- PRINTABLE THERMAL RECEIPT SHEET --- */}
        <div className="thermal-receipt-sheet" id="printable-receipt">
          <div className="receipt-header">
            <div className="receipt-logo">⚡ SALES HUB STORE</div>
            <div className="receipt-meta">Retail & General Store</div>
            <div className="receipt-meta">Tel: +1 (555) 019-2831</div>
            <div className="receipt-divider-dashed"></div>
            <div className="receipt-row bold">
              <span>INVOICE:</span>
              <span>{receipt.invoice_no}</span>
            </div>
            <div className="receipt-row">
              <span>Date:</span>
              <span>{new Date(receipt.created_at).toLocaleDateString()} {new Date(receipt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="receipt-row">
              <span>Customer:</span>
              <span>{receipt.customer_name || "Walk-in Customer"}</span>
            </div>
            {receipt.customer_phone && (
              <div className="receipt-row">
                <span>Phone:</span>
                <span>{receipt.customer_phone}</span>
              </div>
            )}
            <div className="receipt-row">
              <span>Payment:</span>
              <span className="badge-payment">{receipt.payment_method?.toUpperCase() || "CASH"}</span>
            </div>
          </div>

          <div className="receipt-divider-dashed"></div>

          {/* Items Table */}
          <div className="receipt-items-table">
            <div className="receipt-item-header">
              <span className="col-item">Item</span>
              <span className="col-qty">Qty</span>
              <span className="col-price">Price</span>
              <span className="col-total">Total</span>
            </div>
            <div className="receipt-divider-solid"></div>

            {items.length > 0 ? (
              items.map((item, idx) => (
                <div key={idx} className="receipt-item-row">
                  <span className="col-item">
                    {item.product_name}
                    {item.product_sku && <small className="receipt-sku"> ({item.product_sku})</small>}
                  </span>
                  <span className="col-qty">{item.quantity}</span>
                  <span className="col-price">${Number(item.unit_price).toFixed(2)}</span>
                  <span className="col-total">${Number(item.subtotal).toFixed(2)}</span>
                </div>
              ))
            ) : (
              <div className="receipt-item-row">
                <span className="col-item">{receipt.product || "General Sale"}</span>
                <span className="col-qty">1</span>
                <span className="col-price">${Number(total).toFixed(2)}</span>
                <span className="col-total">${Number(total).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="receipt-divider-solid"></div>

          {/* Totals Summary */}
          <div className="receipt-summary">
            <div className="receipt-row">
              <span>Subtotal:</span>
              <span>${Number(subtotal).toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="receipt-row text-success">
                <span>Discount:</span>
                <span>-${Number(discount).toFixed(2)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="receipt-row">
                <span>Tax / VAT:</span>
                <span>+${Number(tax).toFixed(2)}</span>
              </div>
            )}
            <div className="receipt-divider-dashed"></div>
            <div className="receipt-row receipt-total-row">
              <span>TOTAL DUE:</span>
              <span>${Number(total).toFixed(2)}</span>
            </div>
            {tendered !== null && tendered !== undefined && (
              <>
                <div className="receipt-row">
                  <span>Amount Tendered:</span>
                  <span>${Number(tendered).toFixed(2)}</span>
                </div>
                <div className="receipt-row bold">
                  <span>Change Given:</span>
                  <span>${Number(changeDue || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          <div className="receipt-divider-dashed"></div>

          {/* Footer & Barcode Simulation */}
          <div className="receipt-footer">
            <p>Thank you for your patronage!</p>
            <p>Goods once sold can be exchanged within 7 days with this receipt.</p>
            <div className="receipt-barcode-box">
              <div className="barcode-bars"></div>
              <div className="barcode-num">*{receipt.invoice_no}*</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
