"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;

export default function EditPurchase({ params }) {
  const [form, setForm] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState({});
  const [batchStock, setBatchStock] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from("purchases").select("id,invoice_no,invoice_date,total_amount,paid_amount,notes").eq("id", params.id).single();
    if (error) { setMessage(error.message); return; }
    const { data: itemData, error: itemError } = await supabase.from("purchase_items").select("id,product_id,batch_id,quantity,purchase_rate,discount,tax,amount").eq("purchase_id", params.id);
    if (itemError) { setMessage(itemError.message); return; }
    const rows = itemData || [];
    const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))];
    const batchIds = [...new Set(rows.map((row) => row.batch_id).filter(Boolean))];
    const [productResult, batchResult] = await Promise.all([
      productIds.length ? supabase.from("products").select("id,product_name,pack_size").in("id", productIds) : Promise.resolve({ data: [] }),
      batchIds.length ? supabase.from("product_batches").select("id,quantity,batch_no").in("id", batchIds) : Promise.resolve({ data: [] }),
    ]);
    setForm(data); setItems(rows.map((row) => ({ ...row, original_quantity: Number(row.quantity || 0) })));
    setProducts(Object.fromEntries((productResult.data || []).map((row) => [row.id, row])));
    setBatchStock(Object.fromEntries((batchResult.data || []).map((row) => [row.id, row])));
  }

  const canEditItems = items.length > 0 && items.every((item) => Number(batchStock[item.batch_id]?.quantity || 0) >= item.original_quantity);
  const total = useMemo(() => items.reduce((sum, item) => sum + Math.max(Number(item.quantity || 0) * Number(item.purchase_rate || 0) - Number(item.discount || 0) + Number(item.tax || 0), 0), 0), [items]);
  function updateItem(id, field, value) { setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item)); }

  async function save(event) {
    event.preventDefault(); setMessage("");
    if (Number(form.paid_amount || 0) > total) { setMessage("Paid amount new total invoice se zyada nahi ho sakta."); return; }
    if (!canEditItems) { setMessage("Stock already use/sale ho chuka hai; item quantity aur rates edit nahi ho sakte."); return; }
    setSaving(true);
    const payload = items.map((item) => ({ id: item.id, batch_id: item.batch_id, quantity: Number(item.quantity || 0), purchase_rate: Number(item.purchase_rate || 0), discount: Number(item.discount || 0), tax: Number(item.tax || 0) }));
    const { error } = await supabase.rpc("update_purchase_with_stock", { p_purchase_id: params.id, p_invoice_no: form.invoice_no, p_invoice_date: form.invoice_date, p_paid_amount: Number(form.paid_amount || 0), p_notes: form.notes || null, p_items: payload });
    setSaving(false); setMessage(error ? `Save nahi ho saka: ${error.message}` : "Purchase aur stock safely update ho gaya.");
    if (!error) await load();
  }

  if (!form) return <main style={s.page}>Loading...</main>;
  return <main style={s.page}><div style={s.card}><a href={`/purchases/invoices/${params.id}`} style={s.back}>← Invoice</a><h1>Edit Purchase</h1><p style={s.sub}>{canEditItems ? "Stock abhi available hai - quantity, purchase rate, discount aur tax edit kar sakte hain." : "Is purchase ka stock sale/use ho chuka hai - item fields safety ke liye lock hain."}</p>{message && <div style={s.message}>{message}</div>}<form onSubmit={save} style={s.form}><section style={s.grid}><label>Invoice No.<input value={form.invoice_no || ""} onChange={(event) => setForm({ ...form, invoice_no: event.target.value })}/></label><label>Invoice Date<input type="date" value={form.invoice_date || ""} onChange={(event) => setForm({ ...form, invoice_date: event.target.value })}/></label><label>Paid Amount<input type="number" min="0" step="0.01" value={form.paid_amount || ""} onChange={(event) => setForm({ ...form, paid_amount: event.target.value })}/></label></section><label>Notes<textarea rows="3" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></label><h2>Purchase Items</h2><div style={s.scroll}><table style={s.table}><thead><tr><th>Product / Batch</th><th>Available</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Tax</th><th>Amount</th></tr></thead><tbody>{items.map((item) => { const amount = Math.max(Number(item.quantity || 0) * Number(item.purchase_rate || 0) - Number(item.discount || 0) + Number(item.tax || 0), 0); const product = products[item.product_id]; return <tr key={item.id}><td>{product?.product_name || "Product"}{product?.pack_size ? ` (${product.pack_size})` : ""}<br/><small>Batch: {batchStock[item.batch_id]?.batch_no || "-"}</small></td><td>{batchStock[item.batch_id]?.quantity ?? "-"}</td>{["quantity", "purchase_rate", "discount", "tax"].map((field) => <td key={field}><input disabled={!canEditItems} type="number" min="0" step="0.01" value={item[field] || ""} onChange={(event) => updateItem(item.id, field, event.target.value)} style={s.itemInput}/></td>)}<td>{money(amount)}</td></tr>; })}</tbody><tfoot><tr><td colSpan="6"><b>New Total</b></td><td><b>{money(total)}</b></td></tr></tfoot></table></div><button disabled={saving || !canEditItems}>{saving ? "Saving..." : "Save Purchase Changes"}</button></form></div></main>;
}
const s={page:{minHeight:"100vh",background:"#f3f4f6",padding:32,fontFamily:"Arial,sans-serif",color:"#111827"},card:{background:"#fff",maxWidth:1150,margin:"0 auto",padding:24,borderRadius:12,border:"1px solid #e5e7eb"},back:{color:"#2563eb",textDecoration:"none",fontWeight:700},sub:{color:"#667085",lineHeight:1.5},form:{display:"grid",gap:16},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14},message:{padding:12,borderRadius:8,background:"#ecfdf3",color:"#067647"},scroll:{overflowX:"auto"},table:{width:"100%",minWidth:850,borderCollapse:"collapse"},itemInput:{width:90,padding:8,border:"1px solid #d0d5dd",borderRadius:6}};
