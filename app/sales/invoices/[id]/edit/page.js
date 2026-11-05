"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../supabase";

const number = (value) => Number(value || 0);
const percent = (value) => Math.min(Math.max(number(value), 0), 100);
const netRate = (baseRate, discount) => number(baseRate) * (1 - percent(discount) / 100);
const lineAmount = (item) => Math.max(number(item.quantity) * netRate(item.base_rate, item.discount) + number(item.tax), 0);

function initialBaseRate(item) {
  const rate = number(item.sale_rate);
  const discount = percent(item.discount);
  const savedNetAmount = number(item.quantity) * rate + number(item.tax);
  const isNewPercentRecord = Math.abs(number(item.amount) - savedNetAmount) < 0.02;
  return isNewPercentRecord && discount < 100 ? rate / (1 - discount / 100) : rate;
}

export default function EditSale({ params }) {
  const [form, setForm] = useState(null);
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [saleResult, itemResult] = await Promise.all([
      supabase.from("sales").select("id,invoice_no,invoice_date,received_amount,notes,booker_name,supplier_name,invoice_discount_percent,invoice_discount_amount").eq("id", params.id).single(),
      supabase.from("sale_items").select("id,product_id,batch_id,quantity,bonus_quantity,sale_rate,discount,tax,amount,product_name_snapshot,batch_no_snapshot").eq("sale_id", params.id),
    ]);
    if (saleResult.error || itemResult.error) {
      setMessage((saleResult.error || itemResult.error).message);
      return;
    }
    setForm(saleResult.data);
    const loadedItems = (itemResult.data || []).map((item) => ({ ...item, base_rate: initialBaseRate(item) }));
    setItems(loadedItems);
    const productIds = [...new Set(loadedItems.map((item) => item.product_id).filter(Boolean))];
    if (!productIds.length) return;
    const { data } = await supabase.from("product_batches").select("id,product_id,batch_no,quantity").in("product_id", productIds).order("expiry_date", { ascending: false });
    setBatches((data || []).reduce((map, batch) => {
      (map[batch.product_id] ||= []).push(batch);
      return map;
    }, {}));
  }

  function editItem(id, key, value) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }

  const itemSubtotal = useMemo(() => items.reduce((sum, item) => sum + lineAmount(item), 0), [items]);
  const invoiceDiscountRate = percent(form?.invoice_discount_percent);
  const invoiceDiscountAmount = itemSubtotal * invoiceDiscountRate / 100;
  const total = Math.max(itemSubtotal - invoiceDiscountAmount, 0);

  async function save(event) {
    event.preventDefault();
    if (number(form.received_amount) > total) {
      setMessage("Received amount total se zyada nahi ho sakta.");
      return;
    }
    setSaving(true);
    setMessage("");
    const payloadItems = items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      batch_id: item.batch_id,
      batch_no_snapshot: item.batch_no_snapshot,
      quantity: number(item.quantity),
      bonus_quantity: number(item.bonus_quantity),
      sale_rate: netRate(item.base_rate, item.discount),
      discount: percent(item.discount),
      tax: number(item.tax),
      amount: lineAmount(item),
    }));
    const { error } = await supabase.rpc("update_sale_with_stock", {
      p_sale_id: params.id,
      p_invoice_no: form.invoice_no,
      p_invoice_date: form.invoice_date,
      p_received_amount: number(form.received_amount),
      p_notes: form.notes || null,
      p_booker_name: form.booker_name || null,
      p_supplier_name: form.supplier_name || null,
      p_items: payloadItems,
    });
    if (error) {
      setSaving(false);
      setMessage(`Save nahi ho saka: ${error.message}`);
      return;
    }
    const { error: invoiceDiscountError } = await supabase.from("sales").update({
      total_amount: total,
      invoice_discount_percent: invoiceDiscountRate,
      invoice_discount_amount: invoiceDiscountAmount,
    }).eq("id", params.id);
    setSaving(false);
    if (invoiceDiscountError) {
      setMessage(`Invoice discount save nahi ho saka: ${invoiceDiscountError.message}`);
      return;
    }
    setForm((current) => ({ ...current, invoice_discount_percent: invoiceDiscountRate, invoice_discount_amount: invoiceDiscountAmount }));
    setItems((current) => current.map((item) => ({ ...item, sale_rate: netRate(item.base_rate, item.discount), amount: lineAmount(item) })));
    setMessage("Invoice, stock aur totals update ho gaye hain. Discount ab percentage ke mutabiq calculate hua hai.");
  }

  if (!form) return <main style={s.page}>Loading...</main>;

  return <main style={s.page}><div style={s.card}>
    <a href={`/sales/invoices/${params.id}`} style={s.back}>← Invoice</a>
    <h1 style={s.title}>Sale Invoice Edit</h1>
    <p style={s.sub}>Discount ab percentage mein hai. Base Rate par discount apply hota hai aur invoice mein Net Rate print/save hota hai.</p>
    {message && <div style={s.message}>{message}</div>}
    <form onSubmit={save}>
      <div style={s.grid}>
        <label style={s.label}>Invoice No.<input value={form.invoice_no || ""} onChange={(event) => setForm({ ...form, invoice_no: event.target.value })} /></label>
        <label style={s.label}>Invoice Date<input type="date" value={form.invoice_date || ""} onChange={(event) => setForm({ ...form, invoice_date: event.target.value })} /></label>
        <label style={s.label}>Received Amount<input type="number" min="0" value={form.received_amount || ""} onChange={(event) => setForm({ ...form, received_amount: event.target.value })} /></label>
        <label style={s.label}>Full Invoice Discount %<input type="number" min="0" max="100" step="0.01" value={form.invoice_discount_percent || ""} onChange={(event) => setForm({ ...form, invoice_discount_percent: event.target.value })} placeholder="0" /></label>
        <label style={s.label}>Booker<input value={form.booker_name || ""} onChange={(event) => setForm({ ...form, booker_name: event.target.value })} /></label>
        <label style={s.label}>Supplied By<input value={form.supplier_name || ""} onChange={(event) => setForm({ ...form, supplier_name: event.target.value })} /></label>
      </div>
      <label style={s.notes}>Notes<textarea rows="3" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      <div style={s.notice}>For example: base rate Rs. 446.25, quantity 10 and 5% discount = net rate Rs. 423.9375 and line amount Rs. 4,239.375.</div>
      <div style={s.scroll}><table style={s.table}><thead><tr><th>Product</th><th>Batch</th><th>Qty</th><th>Bonus</th><th>Base Rate</th><th>Discount %</th><th>Net Rate</th><th>Amount</th></tr></thead><tbody>{items.map((item) => {
        const amount = lineAmount(item);
        return <tr key={item.id}><td>{item.product_name_snapshot || "Product"}</td><td><select value={item.batch_id} onChange={(event) => { const batch = (batches[item.product_id] || []).find((row) => row.id === event.target.value); editItem(item.id, "batch_id", event.target.value); editItem(item.id, "batch_no_snapshot", batch?.batch_no || ""); }}>{(batches[item.product_id] || []).map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_no} (Stock: {batch.quantity})</option>)}</select></td><td><input type="number" min="0" value={item.quantity ?? ""} onChange={(event) => editItem(item.id, "quantity", event.target.value)} /></td><td><input type="number" min="0" value={item.bonus_quantity ?? ""} onChange={(event) => editItem(item.id, "bonus_quantity", event.target.value)} /></td><td><input type="number" min="0" step="any" value={item.base_rate ?? ""} onChange={(event) => editItem(item.id, "base_rate", event.target.value)} /></td><td><input type="number" min="0" max="100" step="0.01" value={item.discount ?? ""} onChange={(event) => editItem(item.id, "discount", event.target.value)} /></td><td><strong>Rs. {netRate(item.base_rate, item.discount).toLocaleString("en-PK", { maximumFractionDigits: 4 })}</strong></td><td><strong>Rs. {amount.toLocaleString("en-PK", { maximumFractionDigits: 4 })}</strong></td></tr>;
      })}</tbody></table></div>
      <div style={s.total}><div>Product Line Subtotal: Rs. {itemSubtotal.toLocaleString("en-PK", { maximumFractionDigits: 4 })}</div>{invoiceDiscountRate > 0 && <div style={s.discount}>Full Invoice Discount ({invoiceDiscountRate}%): − Rs. {invoiceDiscountAmount.toLocaleString("en-PK", { maximumFractionDigits: 4 })}</div>}<div>New Total: Rs. {total.toLocaleString("en-PK", { maximumFractionDigits: 4 })}</div></div>
      <button style={s.save} disabled={saving}>{saving ? "Saving..." : "Save Invoice, Stock & Totals"}</button>
    </form>
  </div></main>;
}

const s = {
  page: { minHeight: "100vh", background: "#f5f7fb", padding: 32, fontFamily: "Arial,sans-serif", color: "#172033" },
  card: { maxWidth: 1240, margin: "auto", background: "#fff", border: "1px solid #e4e7ec", borderRadius: 14, padding: 24 },
  back: { color: "#2563eb", fontWeight: 700, textDecoration: "none" }, title: { marginBottom: 6 },
  sub: { color: "#667085", lineHeight: 1.5 }, message: { padding: 12, background: "#ecfdf3", color: "#067647", borderRadius: 8, margin: "12px 0" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }, label: { display: "grid", gap: 6, fontWeight: 700, fontSize: 13 },
  notes: { display: "grid", gap: 6, marginTop: 14, fontWeight: 700 }, notice: { marginTop: 16, padding: 12, borderRadius: 8, background: "#eff6ff", color: "#1d4ed8", fontSize: 13 },
  scroll: { overflowX: "auto", marginTop: 20 }, table: { width: "100%", minWidth: 950, borderCollapse: "collapse" }, total: { textAlign: "right", fontWeight: 700, fontSize: 18, margin: "18px 0", display: "grid", gap: 6 }, discount: { color: "#b45309", fontSize: 15 },
  save: { border: 0, borderRadius: 8, padding: 13, background: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer", width: "100%" },
};
