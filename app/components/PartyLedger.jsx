"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
const niceMethod = (value) => ({ cash: "Cash", bank_transfer: "Bank Transfer", online_transfer: "Online Transfer", cheque: "Cheque", other: "Other" }[value] || value || "-");

export default function PartyLedger({ kind }) {
  const supplier = kind === "supplier";
  const labels = supplier
    ? { singular: "Supplier", plural: "Suppliers", invoice: "Purchase Invoice", payment: "Supplier Payment", title: "Supplier Ledger", href: "/payables" }
    : { singular: "Customer", plural: "Customers", invoice: "Sale Invoice", payment: "Customer Receipt", title: "Customer Ledger", href: "/receivables" };
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showProducts, setShowProducts] = useState(true);
  const [form, setForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), method: "cash", reference: "", notes: "", invoiceId: "" });

  useEffect(() => { loadParties(); }, []);
  useEffect(() => { if (partyId) loadLedger(); else { setInvoices([]); setPayments([]); setItems([]); } }, [partyId]);

  async function loadParties() {
    setLoading(true); setError("");
    const query = supplier
      ? supabase.from("companies").select("id,name,company_type").in("company_type", ["supplier", "both"]).order("name")
      : supabase.from("customers").select("id,name").order("name");
    const { data, error: loadError } = await query;
    if (loadError) setError(`${labels.plural} load nahi ho sake: ${loadError.message}`);
    else setParties(data || []);
    setLoading(false);
  }

  async function loadLedger() {
    setLoading(true); setError(""); setMessage("");
    const invoiceTable = supplier ? "purchases" : "sales";
    const invoicePartyKey = supplier ? "supplier_id" : "customer_id";
    const itemTable = supplier ? "purchase_items" : "sale_items";
    const paymentTable = supplier ? "supplier_payments" : "customer_payments";
    const paymentPartyKey = supplier ? "supplier_id" : "customer_id";
    const itemLink = supplier ? "purchase_id" : "sale_id";
    const [invoiceResult, paymentResult] = await Promise.all([
      supabase.from(invoiceTable).select("id,invoice_no," + (supplier ? "invoice_date" : "sale_date") + ",total_amount," + (supplier ? "paid_amount" : "received_amount") + ",notes,created_at").eq(invoicePartyKey, partyId).order(supplier ? "invoice_date" : "sale_date"),
      supabase.from(paymentTable).select("id," + (supplier ? "purchase_id" : "sale_id") + ",payment_date,amount,payment_method,reference_no,notes,created_at").eq(paymentPartyKey, partyId).order("payment_date"),
    ]);
    if (invoiceResult.error || paymentResult.error) {
      setError("Ledger load nahi ho saka: " + (invoiceResult.error || paymentResult.error).message);
      setLoading(false); return;
    }
    const loadedInvoices = invoiceResult.data || [];
    setInvoices(loadedInvoices); setPayments(paymentResult.data || []);
    if (!loadedInvoices.length) { setItems([]); setLoading(false); return; }
    const ids = loadedInvoices.map((row) => row.id);
    const { data: itemData, error: itemError } = await supabase.from(itemTable).select("id," + itemLink + ",product_id,quantity," + (supplier ? "purchase_rate" : "sale_rate") + ",discount,amount").in(itemLink, ids);
    if (itemError) { setError("Ledger product detail load nahi ho saka: " + itemError.message); setLoading(false); return; }
    setItems(itemData || []);
    const productIds = [...new Set((itemData || []).map((row) => row.product_id).filter(Boolean))];
    if (productIds.length) {
      const { data: productData } = await supabase.from("products").select("id,product_name,pack_size").in("id", productIds);
      setProducts(Object.fromEntries((productData || []).map((row) => [row.id, row])));
    } else setProducts({});
    setLoading(false);
  }

  const entries = useMemo(() => {
    const opening = invoices.flatMap((invoice) => {
      const date = invoice[supplier ? "invoice_date" : "sale_date"];
      const initial = Number(invoice[supplier ? "paid_amount" : "received_amount"] || 0);
      const invoiceEntry = { id: `invoice-${invoice.id}`, date, type: labels.invoice, reference: invoice.invoice_no, notes: invoice.notes, debit: Number(invoice.total_amount || 0), credit: 0, invoiceId: invoice.id };
      const initialEntry = initial > 0 ? [{ id: `initial-${invoice.id}`, date, type: supplier ? "Paid at Purchase" : "Received at Sale", reference: invoice.invoice_no, notes: "Initial payment", debit: 0, credit: initial, invoiceId: invoice.id }] : [];
      return [invoiceEntry, ...initialEntry];
    });
    const paymentEntries = payments.map((payment) => ({ id: `payment-${payment.id}`, date: payment.payment_date, type: labels.payment, reference: payment.reference_no || (payment[supplier ? "purchase_id" : "sale_id"] ? "Invoice payment" : "Party payment"), notes: [niceMethod(payment.payment_method), payment.notes].filter(Boolean).join(" · "), debit: 0, credit: Number(payment.amount || 0), invoiceId: payment[supplier ? "purchase_id" : "sale_id"] }));
    let balance = 0;
    return [...opening, ...paymentEntries].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id)).map((entry) => ({ ...entry, balance: (balance += entry.debit - entry.credit) }));
  }, [invoices, payments, supplier]);
  const totalBalance = entries.length ? entries[entries.length - 1].balance : 0;
  const itemByInvoice = useMemo(() => items.reduce((map, item) => { const key = item[supplier ? "purchase_id" : "sale_id"]; (map[key] ||= []).push(item); return map; }, {}), [items, supplier]);

  async function addPayment(event) {
    event.preventDefault(); setMessage(""); setError("");
    if (!partyId || !Number(form.amount) || Number(form.amount) <= 0) { setError("Valid amount enter karein."); return; }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("User login nahi hai.");
      const row = {
        [supplier ? "supplier_id" : "customer_id"]: partyId,
        [supplier ? "purchase_id" : "sale_id"]: form.invoiceId || null,
        payment_date: form.date, amount: Number(form.amount), payment_method: form.method,
        reference_no: form.reference || null, notes: form.notes || null, created_by: auth.user.id,
      };
      const { error: saveError } = await supabase.from(supplier ? "supplier_payments" : "customer_payments").insert(row);
      if (saveError) throw saveError;
      setMessage(`${labels.payment} saved ho gayi.`);
      setForm({ amount: "", date: new Date().toISOString().slice(0, 10), method: "cash", reference: "", notes: "", invoiceId: "" });
      await loadLedger();
    } catch (saveError) { setError(`${labels.payment} save nahi ho saki: ${saveError.message}`); }
    finally { setSaving(false); }
  }

  return <main style={s.page}><div style={s.wrap}>
    <header style={s.header}><div><h1 style={s.title}>{labels.title}</h1><p style={s.sub}>Invoice, payment aur running balance ek jagah.</p></div><a href="/accounts" style={s.back}>← Accounts</a></header>
    {error && <div style={s.error}>{error}<button onClick={partyId ? loadLedger : loadParties} style={s.retry}>Retry</button></div>}
    {message && <div style={s.success}>{message}</div>}
    <section style={s.card}><label style={s.label}>{labels.singular}<select value={partyId} onChange={(e) => setPartyId(e.target.value)} style={s.input} disabled={loading}><option value="">Select {labels.singular}</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label></section>
    {partyId && <>
      <section style={s.summary}><div><span>Outstanding Balance</span><strong>{money(totalBalance)}</strong></div><div><span>Total Invoices</span><strong>{invoices.length}</strong></div><div><span>Payment Entries</span><strong>{payments.length}</strong></div></section>
      <section style={s.card}><h2 style={s.h2}>Add {labels.payment}</h2><form onSubmit={addPayment} style={s.grid}>
        <label style={s.label}>Amount *<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={s.input}/></label>
        <label style={s.label}>Date *<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={s.input}/></label>
        <label style={s.label}>Payment Method<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={s.input}>{["cash","bank_transfer","online_transfer","cheque","other"].map((method) => <option key={method} value={method}>{niceMethod(method)}</option>)}</select></label>
        <label style={s.label}>Invoice (optional)<select value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} style={s.input}><option value="">Party-level payment</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_no} — {money(invoice.total_amount)}</option>)}</select></label>
        <label style={s.label}>Reference / Cheque No.<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} style={s.input}/></label>
        <label style={s.label}>Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={s.input}/></label>
        <button disabled={saving} style={s.save}>{saving ? "Saving..." : `Save ${labels.payment}`}</button>
      </form></section>
      <section style={s.card}><div style={s.tableHead}><h2 style={s.h2}>Ledger Entries</h2><label style={s.toggle}><input type="checkbox" checked={showProducts} onChange={(e) => setShowProducts(e.target.checked)}/> Show product detail</label></div>
        {loading ? <p>Loading ledger...</p> : !entries.length ? <p style={s.muted}>Abhi is party ki koi invoice ya payment nahi hai.</p> : <div style={s.scroll}><table style={s.table}><thead><tr><th>Date</th><th>Type</th><th>Invoice / Ref</th><th>Details</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{entries.map((entry) => <><tr key={entry.id}><td>{entry.date}</td><td>{entry.type}</td><td>{entry.reference || "-"}</td><td>{entry.notes || "-"}</td><td>{entry.debit ? money(entry.debit) : "-"}</td><td>{entry.credit ? money(entry.credit) : "-"}</td><td><strong>{money(entry.balance)}</strong></td></tr>{showProducts && entry.type === labels.invoice && (itemByInvoice[entry.invoiceId] || []).map((item) => <tr key={`item-${item.id}`} style={s.itemRow}><td></td><td>↳ Product</td><td colSpan="2">{products[item.product_id]?.product_name || "Product"}{products[item.product_id]?.pack_size ? ` (${products[item.product_id].pack_size})` : ""} — Qty {Number(item.quantity || 0).toLocaleString()} × {money(item[supplier ? "purchase_rate" : "sale_rate"])}{item.discount ? `, Discount ${money(item.discount)}` : ""}</td><td colSpan="3">{money(item.amount)}</td></tr>)}</>)}</tbody></table></div>}
      </section>
    </>}
  </div></main>;
}

const s = { page:{minHeight:"100vh",background:"#f5f7fb",padding:"30px 16px",fontFamily:"Arial,Helvetica,sans-serif",color:"#172033"},wrap:{maxWidth:1250,margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:20,flexWrap:"wrap"},title:{margin:"0 0 6px",fontSize:30},sub:{margin:0,color:"#667085"},back:{background:"#e8edf5",color:"#344054",textDecoration:"none",padding:"10px 15px",borderRadius:8,fontWeight:600},card:{background:"#fff",border:"1px solid #e4e7ec",borderRadius:14,padding:22,marginBottom:18,boxShadow:"0 2px 8px rgba(16,24,40,.04)"},summary:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:18},h2:{margin:"0 0 18px",fontSize:20},label:{display:"block",fontSize:13,fontWeight:600},input:{width:"100%",boxSizing:"border-box",marginTop:7,padding:11,border:"1px solid #d0d5dd",borderRadius:8,background:"#fff",fontSize:14},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:15,alignItems:"end"},save:{border:0,borderRadius:8,padding:"12px 16px",background:"#16a34a",color:"#fff",fontWeight:700,cursor:"pointer"},error:{background:"#fee2e2",color:"#991b1b",padding:14,borderRadius:8,marginBottom:18},success:{background:"#ecfdf3",color:"#067647",padding:14,borderRadius:8,marginBottom:18},retry:{marginLeft:12,border:0,borderRadius:6,padding:"6px 10px",background:"#991b1b",color:"#fff"},tableHead:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"},toggle:{fontWeight:500,fontSize:13},scroll:{overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse",minWidth:850},muted:{color:"#667085"} };
