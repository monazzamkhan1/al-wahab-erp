"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export default function SalesPage() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [applyCommission, setApplyCommission] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [receivedAmount, setReceivedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saleRate, setSaleRate] = useState("");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    const [customerResult, productResult] = await Promise.all([
      supabase.from("customers").select("id, name, commission_holder_id, commission_percent, commission_enabled_default, commission_holders(name)").order("name"),
      supabase
        .from("products")
        .select("id, product_code, product_name, pack_size, mrp, tp_discount_percent, is_milk_formula")
        .eq("is_active", true)
        .order("product_name"),
    ]);

    if (customerResult.error || productResult.error) {
      setMessage(
        "Sales data load nahi ho saka: " +
          (customerResult.error || productResult.error).message
      );
    } else {
      setCustomers(customerResult.data || []);
      setProducts(productResult.data || []);
    }
    setLoading(false);
  }

  async function selectProduct(value) {
    setProductId(value);
    setBatchId("");
    setSaleRate("");
    setBatches([]);
    if (!value) return;

    const { data, error } = await supabase
      .from("product_batches")
      .select("id, batch_no, expiry_date, sale_rate, quantity")
      .eq("product_id", value)
      .gt("quantity", 0)
      .order("expiry_date");

    if (error) {
      setMessage("Batches load nahi ho sake: " + error.message);
      return;
    }
    setBatches(data || []);
  }

  function selectCustomer(value) {
    setCustomerId(value);
    const customer = customers.find((item) => item.id === value);
    setApplyCommission(Boolean(customer?.commission_enabled_default && customer?.commission_holder_id && Number(customer?.commission_percent) > 0));
  }

  async function selectBatch(value) {
    setBatchId(value);
    const batch = batches.find((item) => item.id === value);
    setSaleRate(batch?.sale_rate ?? "");
    if (customerId && productId) {
      const { data } = await supabase.from("customer_product_prices").select("sale_rate").eq("customer_id", customerId).eq("product_id", productId).maybeSingle();
      if (data?.sale_rate !== undefined && data?.sale_rate !== null) setSaleRate(data.sale_rate);
    }
  }

  const lineAmount = useMemo(() => {
    const gross = Number(quantity || 0) * Number(saleRate || 0);
    return Math.max(gross - Number(discount || 0) + Number(tax || 0), 0);
  }, [quantity, saleRate, discount, tax]);

  function addItem() {
    const batch = batches.find((item) => item.id === batchId);
    const product = products.find((item) => item.id === productId);
    if (!productId || !batchId || !batch) {
      setMessage("Product aur available batch select karein.");
      return;
    }
    if (!quantity || Number(quantity) <= 0 || Number(quantity) > Number(batch.quantity)) {
      setMessage("Available stock ke andar valid quantity enter karein.");
      return;
    }
    if (saleRate === "" || Number(saleRate) < 0) {
      setMessage("Valid sale rate enter karein.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        tempId: crypto.randomUUID(),
        product_id: productId,
        batch_id: batchId,
        product_name: product?.product_name || "",
        product_code: product?.product_code || "",
        batch_no: batch.batch_no,
        available: Number(batch.quantity),
        quantity: Number(quantity),
        sale_rate: Number(saleRate),
        discount: Number(discount || 0),
        tax: Number(tax || 0),
        amount: lineAmount,
        mrp: Number(product?.mrp || 0),
        tp_discount_percent: Number(product?.tp_discount_percent ?? 15),
        tp_rate: Number(product?.mrp || 0) * (1 - Number(product?.tp_discount_percent ?? 15) / 100),
      },
    ]);
    setProductId("");
    setBatchId("");
    setQuantity("");
    setSaleRate("");
    setDiscount("");
    setTax("");
    setBatches([]);
    setMessage("");
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const received = Number(receivedAmount || 0);
  const receivable = Math.max(total - received, 0);
  const selectedCustomer = customers.find((item) => item.id === customerId);
  const commissionPercent = applyCommission ? Number(selectedCustomer?.commission_percent || 0) : 0;
  const commissionTotal = items.reduce((sum, item) => sum + item.tp_rate * item.quantity * commissionPercent / 100, 0);

  async function saveSale() {
    setMessage("");
    if (!customerId || !invoiceNo.trim() || items.length === 0) {
      setMessage("Customer, invoice number aur kam az kam ek item zaroori hai.");
      return;
    }
    if (received < 0 || received > total) {
      setMessage("Received amount total sale se zyada nahi ho sakta.");
      return;
    }
    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("User login nahi hai.");

      const { data: saleId, error } = await supabase.rpc("save_sale_with_stock", {
        p_customer_id: customerId,
        p_invoice_no: invoiceNo.trim(),
        p_invoice_date: saleDate,
        p_total_amount: total,
        p_received_amount: received,
        p_notes: notes || null,
        p_created_by: authData.user.id,
        p_apply_commission: applyCommission,
        p_items: items.map(({ product_id, batch_id, quantity, sale_rate, discount, tax, amount }) => ({
          product_id,
          batch_id,
          quantity,
          sale_rate,
          discount,
          tax,
          amount,
        })),
      });
      if (error) throw error;

      setMessage("Sale saved, stock updated. Sale ID: " + saleId);
      setCustomerId("");
      setApplyCommission(false);
      setInvoiceNo("");
      setSaleDate(new Date().toISOString().slice(0, 10));
      setReceivedAmount("");
      setNotes("");
      setItems([]);
    } catch (error) {
      console.error(error);
      setMessage("Sale save nahi ho saki: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Sales Management</h1>
            <p style={styles.subtitle}>Customer sales, stock OUT aur receivables manage karein.</p>
          </div>
          <a href="/" style={styles.back}>← Dashboard</a>
        </header>

        {message && <div style={styles.message}>{message}</div>}

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Sale Invoice</h2>
          <div style={styles.grid}>
            <label style={styles.label}>Customer *
              <select value={customerId} onChange={(e) => selectCustomer(e.target.value)} style={styles.input} disabled={loading}>
                <option value="">Select Customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label style={{ ...styles.label, display: "flex", alignItems: "center", gap: "8px", paddingTop: "28px" }}>
              <input type="checkbox" checked={applyCommission} disabled={!selectedCustomer?.commission_holder_id || !Number(selectedCustomer?.commission_percent)} onChange={(e) => setApplyCommission(e.target.checked)} />
              Apply commission{selectedCustomer?.commission_holders?.name ? ` for ${selectedCustomer.commission_holders.name} (${Number(selectedCustomer.commission_percent || 0)}% on TP)` : " (set it in Customer first)"}
            </label>
            <label style={styles.label}>Invoice No. *
              <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} style={styles.input} placeholder="Sale invoice number" />
            </label>
            <label style={styles.label}>Sale Date
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} style={styles.input} />
            </label>
            <label style={styles.label}>Received Amount
              <input type="number" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} style={styles.input} placeholder="0" min="0" />
            </label>
          </div>
          <label style={styles.label}>Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.textarea} rows={3} placeholder="Optional sale notes" />
          </label>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Add Sale Item</h2>
          <div style={styles.grid}>
            <label style={styles.label}>Product *
              <select value={productId} onChange={(e) => selectProduct(e.target.value)} style={styles.input} disabled={loading}>
                <option value="">Select Product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.product_code ? product.product_code + " - " : ""}{product.product_name}</option>)}
              </select>
            </label>
            <label style={styles.label}>Batch *
              <select value={batchId} onChange={(e) => selectBatch(e.target.value)} style={styles.input} disabled={!productId}>
                <option value="">Select Available Batch</option>
                {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_no} · Available: {Number(batch.quantity).toLocaleString()}</option>)}
              </select>
            </label>
            <label style={styles.label}>Quantity *
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={styles.input} min="1" />
            </label>
            <label style={styles.label}>Sale Rate *
              <input type="number" value={saleRate} onChange={(e) => setSaleRate(e.target.value)} style={styles.input} min="0" />
            </label>
            <label style={styles.label}>Discount
              <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} style={styles.input} min="0" />
            </label>
            <label style={styles.label}>Tax
              <input type="number" value={tax} onChange={(e) => setTax(e.target.value)} style={styles.input} min="0" />
            </label>
          </div>
          <div style={styles.lineTotal}><span>Current Line Amount</span><strong>Rs. {lineAmount.toLocaleString()}</strong></div>
          <button type="button" onClick={addItem} style={styles.addButton}>+ Add Item</button>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Sale Items</h2>
          {items.length === 0 ? <div style={styles.empty}>Abhi koi item add nahi kiya gaya.</div> : (
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Product</th><th style={styles.th}>Batch</th><th style={styles.th}>Qty</th><th style={styles.th}>Rate</th><th style={styles.th}>Amount</th><th style={styles.th}></th></tr></thead><tbody>
              {items.map((item) => <tr key={item.tempId}><td style={styles.td}>{item.product_name}</td><td style={styles.td}>{item.batch_no}</td><td style={styles.td}>{item.quantity}</td><td style={styles.td}>Rs. {item.sale_rate.toLocaleString()}</td><td style={styles.td}>Rs. {item.amount.toLocaleString()}</td><td style={styles.td}><button type="button" onClick={() => setItems((current) => current.filter((row) => row.tempId !== item.tempId))} style={styles.remove}>Remove</button></td></tr>)}
            </tbody></table></div>
          )}
        </section>

        <section style={styles.totalCard}>
          <div style={styles.totalRow}><span>Grand Total</span><strong>Rs. {total.toLocaleString()}</strong></div>
          <div style={styles.totalRow}><span>Received Amount</span><strong>Rs. {received.toLocaleString()}</strong></div>
          <div style={styles.balanceRow}><span>Customer Receivable</span><strong>Rs. {receivable.toLocaleString()}</strong></div>
          {applyCommission && <div style={styles.commissionRow}><span>Commission (TP basis)</span><strong>Rs. {commissionTotal.toLocaleString()}</strong></div>}
          <button type="button" onClick={saveSale} disabled={saving || loading} style={styles.saveButton}>{saving ? "Saving Sale..." : "Save Sale & Update Stock"}</button>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f5f7fb", padding: "30px 16px", fontFamily: "Arial, Helvetica, sans-serif", color: "#172033" },
  container: { maxWidth: "1250px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "20px", flexWrap: "wrap" },
  title: { margin: "0 0 6px", fontSize: "30px" }, subtitle: { margin: 0, color: "#667085" },
  back: { background: "#e8edf5", color: "#344054", textDecoration: "none", padding: "10px 15px", borderRadius: "8px", fontWeight: "600" },
  card: { background: "#fff", border: "1px solid #e4e7ec", borderRadius: "14px", padding: "22px", marginBottom: "18px", boxShadow: "0 2px 8px rgba(16,24,40,0.04)" },
  sectionTitle: { marginTop: 0, marginBottom: "18px", fontSize: "20px" }, grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px" },
  label: { display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "14px" },
  input: { width: "100%", boxSizing: "border-box", marginTop: "7px", padding: "11px", border: "1px solid #d0d5dd", borderRadius: "8px", background: "#fff", fontSize: "14px" },
  textarea: { width: "100%", boxSizing: "border-box", marginTop: "7px", padding: "11px", border: "1px solid #d0d5dd", borderRadius: "8px", resize: "vertical", fontFamily: "inherit" },
  addButton: { border: "none", background: "#2563eb", color: "#fff", padding: "11px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" },
  lineTotal: { display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: "13px", borderRadius: "8px", marginBottom: "15px" },
  empty: { padding: "20px", textAlign: "center", color: "#667085", background: "#f8fafc", borderRadius: "8px" }, tableWrap: { overflowX: "auto" }, table: { width: "100%", borderCollapse: "collapse", minWidth: "700px" },
  th: { textAlign: "left", padding: "11px", background: "#f8fafc", borderBottom: "1px solid #e4e7ec", fontSize: "12px" }, td: { padding: "11px", borderBottom: "1px solid #eaecf0", fontSize: "13px" },
  remove: { border: "none", background: "#dc2626", color: "#fff", padding: "7px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  totalCard: { background: "#fff", border: "1px solid #e4e7ec", borderRadius: "14px", padding: "22px", marginBottom: "30px" }, totalRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #eaecf0" }, balanceRow: { display: "flex", justifyContent: "space-between", padding: "15px 0", fontSize: "19px" },
  commissionRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", color: "#7c3aed", borderTop: "1px solid #eaecf0" },
  saveButton: { width: "100%", border: "none", background: "#16a34a", color: "#fff", padding: "14px", borderRadius: "9px", cursor: "pointer", fontWeight: "700", fontSize: "16px", marginTop: "18px" },
  message: { background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", padding: "12px 15px", borderRadius: "8px", marginBottom: "18px" },
};
