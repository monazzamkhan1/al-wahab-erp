"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState([]);

  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadProducts();
  }, []);

  async function loadSuppliers() {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, company_type")
      .in("company_type", ["supplier", "both"])
      .eq("is_active", true)
      .order("name");

    if (error) {
      setMessage("Suppliers load nahi ho sake: " + error.message);
      return;
    }

    setSuppliers(data || []);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, product_code, product_name, pack_size")
      .eq("is_active", true)
      .order("product_name");

    if (error) {
      setMessage("Products load nahi ho sake: " + error.message);
      return;
    }

    setProducts(data || []);
  }

  async function loadBatches(productIdValue) {
    if (!productIdValue) {
      setBatches([]);
      return;
    }

    const { data, error } = await supabase
      .from("product_batches")
      .select(
        "id, batch_no, manufacturing_date, expiry_date, purchase_rate, sale_rate, quantity"
      )
      .eq("product_id", productIdValue)
      .order("expiry_date");

    if (error) {
      setMessage("Batches load nahi ho sake: " + error.message);
      return;
    }

    setBatches(data || []);
  }

  function handleProductChange(value) {
    setProductId(value);
    setBatchId("");
    setBatchNo("");
    setManufacturingDate("");
    setExpiryDate("");
    setPurchaseRate("");
    loadBatches(value);
  }

  function handleBatchChange(value) {
    setBatchId(value);

    const selectedBatch = batches.find((batch) => batch.id === value);

    if (!selectedBatch) {
      return;
    }

    setBatchNo(selectedBatch.batch_no || "");
    setManufacturingDate(selectedBatch.manufacturing_date || "");
    setExpiryDate(selectedBatch.expiry_date || "");

    if (selectedBatch.purchase_rate !== null) {
      setPurchaseRate(selectedBatch.purchase_rate);
    }
  }

  function calculateLineAmount() {
    const qty = Number(quantity || 0);
    const rate = Number(purchaseRate || 0);
    const disc = Number(discount || 0);
    const taxAmount = Number(tax || 0);

    const gross = qty * rate;
    const net = gross - disc + taxAmount;

    return Math.max(net, 0);
  }

  function addItem() {
    if (!productId) {
      setMessage("Product select karein.");
      return;
    }

    if (!batchNo.trim()) {
      setMessage("Batch No. enter karein.");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setMessage("Quantity enter karein.");
      return;
    }

    if (purchaseRate === "" || Number(purchaseRate) < 0) {
      setMessage("Purchase rate enter karein.");
      return;
    }

    const product = products.find((p) => p.id === productId);

    const qty = Number(quantity);
    const rate = Number(purchaseRate);
    const disc = Number(discount || 0);
    const taxAmount = Number(tax || 0);

    const gross = qty * rate;
    const amount = Math.max(gross - disc + taxAmount, 0);

    const newItem = {
      tempId: crypto.randomUUID(),
      product_id: productId,
      product_name: product?.product_name || "",
      product_code: product?.product_code || "",
      pack_size: product?.pack_size || "",
      batch_id: batchId || null,
      batch_no: batchNo.trim(),
      manufacturing_date: manufacturingDate || null,
      expiry_date: expiryDate || null,
      quantity: qty,
      purchase_rate: rate,
      discount: disc,
      tax: taxAmount,
      amount,
    };

    setItems((prev) => [...prev, newItem]);

    setProductId("");
    setBatchId("");
    setBatchNo("");
    setManufacturingDate("");
    setExpiryDate("");
    setQuantity("");
    setPurchaseRate("");
    setDiscount("");
    setTax("");
    setBatches([]);
    setMessage("");
  }

  function removeItem(tempId) {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  }

  const grandTotal = items.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const paid = Number(paidAmount || 0);
  const balance = Math.max(grandTotal - paid, 0);

  async function savePurchase() {
    setMessage("");

    if (!supplierId) {
      setMessage("Supplier select karein.");
      return;
    }

    if (!invoiceNo.trim()) {
      setMessage("Invoice No. enter karein.");
      return;
    }

    if (items.length === 0) {
      setMessage("Kam az kam 1 product add karein.");
      return;
    }

    if (paid < 0 || paid > grandTotal) {
      setMessage("Paid Amount total se zyada nahi ho sakta.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          supplier_id: supplierId,
          invoice_no: invoiceNo.trim(),
          invoice_date: invoiceDate,
          total_amount: grandTotal,
          paid_amount: paid,
          notes: notes || null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (purchaseError) {
        throw purchaseError;
      }

      const purchaseItems = items.map((item) => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        purchase_rate: item.purchase_rate,
        discount: item.discount,
        tax: item.tax,
        amount: item.amount,
        notes: null,
      }));

      const { error: itemsError } = await supabase
        .from("purchase_items")
        .insert(purchaseItems);

      if (itemsError) {
        throw itemsError;
      }

      setMessage("Purchase successfully saved.");

      setSupplierId("");
      setInvoiceNo("");
      setInvoiceDate(new Date().toISOString().split("T")[0]);
      setPaidAmount("");
      setNotes("");
      setItems([]);
    } catch (error) {
      console.error(error);
      setMessage("Purchase save nahi ho saki: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Purchase Management</h1>
            <p style={styles.subtitle}>
              Supplier purchases, products, batches and payable amounts
              manage karein.
            </p>
          </div>

          <a href="/" style={styles.backButton}>
            ← Dashboard
          </a>
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Purchase Invoice</h2>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Supplier *
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                style={styles.input}
              >
                <option value="">Select Supplier</option>

                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Invoice No. *
              <input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="Supplier invoice number"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Invoice Date
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Paid Amount
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.label}>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Purchase notes"
              style={styles.textarea}
            />
          </label>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Add Product</h2>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Product *
              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                style={styles.input}
              >
                <option value="">Select Product</option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_code
                      ? `${product.product_code} - `
                      : ""}
                    {product.product_name}
                    {product.pack_size ? ` (${product.pack_size})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Existing Batch
              <select
                value={batchId}
                onChange={(e) => handleBatchChange(e.target.value)}
                style={styles.input}
                disabled={!productId}
              >
                <option value="">New Batch / Select Existing</option>

                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_no}
                    {batch.expiry_date
                      ? ` - Exp: ${batch.expiry_date}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Batch No. *
              <input
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                placeholder="Batch number"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Manufacturing Date
              <input
                type="date"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Expiry Date
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Quantity *
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Purchase Rate *
              <input
                type="number"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Discount
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Tax
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>
          </div>

          <div style={styles.lineTotal}>
            <span>Current Line Amount:</span>
            <strong>Rs. {calculateLineAmount().toLocaleString()}</strong>
          </div>

          <button
            type="button"
            onClick={addItem}
            style={styles.addButton}
          >
            + Add Product
          </button>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Purchase Items</h2>

          {items.length === 0 ? (
            <div style={styles.empty}>
              Abhi koi product add nahi kiya gaya.
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Batch</th>
                    <th style={styles.th}>Expiry</th>
                    <th style={styles.th}>Qty</th>
                    <th style={styles.th}>Rate</th>
                    <th style={styles.th}>Discount</th>
                    <th style={styles.th}>Tax</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.tempId}>
                      <td style={styles.td}>
                        <strong>{item.product_name}</strong>
                        <br />
                        <small>{item.product_code || "-"}</small>
                      </td>

                      <td style={styles.td}>{item.batch_no}</td>

                      <td style={styles.td}>
                        {item.expiry_date || "-"}
                      </td>

                      <td style={styles.td}>{item.quantity}</td>

                      <td style={styles.td}>
                        Rs.{" "}
                        {Number(item.purchase_rate).toLocaleString()}
                      </td>

                      <td style={styles.td}>
                        Rs. {Number(item.discount).toLocaleString()}
                      </td>

                      <td style={styles.td}>
                        Rs. {Number(item.tax).toLocaleString()}
                      </td>

                      <td style={styles.td}>
                        <strong>
                          Rs. {Number(item.amount).toLocaleString()}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() => removeItem(item.tempId)}
                          style={styles.deleteButton}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={styles.totalCard}>
          <div style={styles.totalRow}>
            <span>Grand Total</span>
            <strong>Rs. {grandTotal.toLocaleString()}</strong>
          </div>

          <div style={styles.totalRow}>
            <span>Paid Amount</span>
            <strong>Rs. {paid.toLocaleString()}</strong>
          </div>

          <div style={styles.balanceRow}>
            <span>Supplier Payable</span>
            <strong>Rs. {balance.toLocaleString()}</strong>
          </div>

          <button
            type="button"
            onClick={savePurchase}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? "Saving Purchase..." : "Save Purchase"}
          </button>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "30px 16px",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#172033",
  },

  container: {
    maxWidth: "1250px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },

  title: {
    margin: "0 0 6px",
    fontSize: "30px",
  },

  subtitle: {
    margin: 0,
    color: "#667085",
  },

  backButton: {
    display: "inline-block",
    background: "#e8edf5",
    color: "#344054",
    textDecoration: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "600",
  },

  card: {
    background: "#fff",
    border: "1px solid #e4e7ec",
    borderRadius: "14px",
    padding: "22px",
    marginBottom: "18px",
    boxShadow: "0 2px 8px rgba(16,24,40,0.04)",
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "20px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "14px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "7px",
    padding: "11px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "14px",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "7px",
    padding: "11px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    resize: "vertical",
    fontFamily: "inherit",
  },

  addButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "11px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  saveButton: {
    width: "100%",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "14px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "16px",
    marginTop: "18px",
  },

  deleteButton: {
    border: "none",
    background: "#dc2626",
    color: "#fff",
    padding: "7px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
  },

  message: {
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#067647",
    padding: "12px 15px",
    borderRadius: "8px",
    marginBottom: "18px",
  },

  lineTotal: {
    display: "flex",
    justifyContent: "space-between",
    background: "#f8fafc",
    padding: "13px",
    borderRadius: "8px",
    marginBottom: "15px",
  },

  empty: {
    padding: "20px",
    textAlign: "center",
    color: "#667085",
    background: "#f8fafc",
    borderRadius: "8px",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1050px",
  },

  th: {
    textAlign: "left",
    padding: "11px",
    background: "#f8fafc",
    borderBottom: "1px solid #e4e7ec",
    fontSize: "12px",
  },

  td: {
    padding: "11px",
    borderBottom: "1px solid #eaecf0",
    fontSize: "13px",
  },

  totalCard: {
    background: "#fff",
    border: "1px solid #e4e7ec",
    borderRadius: "14px",
    padding: "22px",
    marginBottom: "30px",
  },

  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid #eaecf0",
  },

  balanceRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "15px 0",
    fontSize: "19px",
  },
};
