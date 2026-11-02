"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = new Date().toISOString().slice(0, 10);
const methods = { cash: "Cash", bank_transfer: "Bank Transfer", online_transfer: "Online Transfer", cheque: "Cheque", other: "Other" };

export default function PayablesPage() {
  const [rows, setRows] = useState([]), [advances, setAdvances] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [message, setMessage] = useState(""), [selected, setSelected] = useState(null), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "", date: today, method: "cash", reference: "", notes: "" });
  async function loadPayables() {
    setLoading(true); setError("");
    const [purchases, suppliers, payments] = await Promise.all([
      supabase.from("purchases").select("id,supplier_id,invoice_no,invoice_date,total_amount,paid_amount").order("invoice_date", { ascending: false }),
      supabase.from("companies").select("id,name").in("company_type", ["supplier", "both"]),
      supabase.from("supplier_payments").select("supplier_id,purchase_id,amount"),
    ]);
    const loadError = [purchases, suppliers, payments].find((result) => result.error)?.error;
    if (loadError) setError(`Payables load nahi ho sake: ${loadError.message}`);
    else {
      const supplierById = Object.fromEntries((suppliers.data || []).map((row) => [row.id, row.name]));
      const paidByPurchase = (payments.data || []).reduce((map, row) => { if (row.purchase_id) map[row.purchase_id] = (map[row.purchase_id] || 0) + Number(row.amount || 0); return map; }, {});
      const wholeSupplierPayments = (payments.data || []).reduce((map, row) => { if (!row.purchase_id) map[row.supplier_id] = (map[row.supplier_id] || 0) + Number(row.amount || 0); return map; }, {});
      const allPurchases = (purchases.data || []).map((purchase) => ({ ...purchase, supplier_name: supplierById[purchase.supplier_id] || "Supplier", paid: Number(purchase.paid_amount || 0) + Number(paidByPurchase[purchase.id] || 0) })).sort((a, b) => String(a.invoice_date).localeCompare(String(b.invoice_date)));
      const remainingSupplierPayments = { ...wholeSupplierPayments };
      const reconciled = allPurchases.map((purchase) => { const before = Math.max(Number(purchase.total_amount || 0) - purchase.paid, 0); const available = Number(remainingSupplierPayments[purchase.supplier_id] || 0); const allocated = Math.min(before, available); remainingSupplierPayments[purchase.supplier_id] = available - allocated; return { ...purchase, paid: purchase.paid + allocated, balance: before - allocated }; });
      setRows(reconciled.filter((purchase) => purchase.balance > 0.004));
      setAdvances(Object.entries(remainingSupplierPayments).filter(([, amount]) => amount > 0.004).map(([supplier_id, amount]) => ({ supplier_id, supplier_name: supplierById[supplier_id] || "Supplier", amount })));
    }
    setLoading(false);
  }
  useEffect(() => { loadPayables(); }, []);
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.balance, 0), [rows]);
  const totalAdvance = useMemo(() => advances.reduce((sum, row) => sum + row.amount, 0), [advances]);
  const suppliers = new Set(rows.map((row) => row.supplier_id)).size;
  function openPayment(row) { setSelected(row); setForm({ amount: row.balance.toFixed(2), date: today, method: "cash", reference: "", notes: "" }); setMessage(""); }
  async function sendPayment(event) {
    event.preventDefault(); setError(""); setMessage("");
    const amount = Number(form.amount || 0);
    if (!selected || amount <= 0 || amount > selected.balance + 0.004) { setError("Valid amount enter karein. Amount selected purchase invoice ke remaining balance se zyada nahi ho sakta."); return; }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("User login nahi hai.");
      const { error: paymentError } = await supabase.from("supplier_payments").insert({ supplier_id: selected.supplier_id, purchase_id: selected.id, payment_date: form.date, amount, payment_method: form.method, reference_no: form.reference || null, notes: form.notes || null, created_by: auth.user.id });
      if (paymentError) throw paymentError;
      setMessage(`Payment sent to ${selected.supplier_name}: ${money(amount)}`);
      setSelected(null); await loadPayables();
    } catch (saveError) { setError(`Payment save nahi ho saki: ${saveError.message}`); }
    finally { setSaving(false); }
  }
  return <main style={s.page}><div style={s.wrap}>
    <header style={s.header}><div><a href="/" style={s.back}>← Dashboard</a><p style={s.eyebrow}>ACCOUNTS PAYABLE</p><h1 style={s.title}>Supplier Payables</h1><p style={s.sub}>Outstanding purchase invoices aur supplier payments manage karein.</p></div><div style={s.actions}><a href="/supplier-ledger" style={s.secondary}>Supplier Ledger</a><button onClick={loadPayables} style={s.refresh}>↻ Refresh</button></div></header>
    {error && <div style={s.error}>{error}<button onClick={loadPayables} style={s.retry}>Retry</button></div>}{message && <div style={s.success}>{message}</div>}
    <section style={s.summary}><article style={s.totalCard}><span>💸 Total Payable</span><strong>{money(total)}</strong><small>Outstanding after all supplier payments</small></article><article style={s.advanceCard}><span>✅ Supplier Advance</span><strong>{money(totalAdvance)}</strong><small>Extra whole-supplier payments / credit</small></article><article style={s.infoCard}><span>📄 Outstanding Purchases</span><strong>{rows.length}</strong><small>Invoice-wise payment follow-up</small></article><article style={s.infoCard}><span>🏭 Suppliers Due</span><strong>{suppliers}</strong><small>Parties with pending balance</small></article></section>
    {selected && <section style={s.paymentCard}><div style={s.paymentHeader}><div><p style={s.eyebrow}>SEND PAYMENT</p><h2 style={s.h2}>{selected.supplier_name}</h2><p style={s.sub}>{selected.invoice_no} · Remaining {money(selected.balance)}</p></div><button onClick={() => setSelected(null)} style={s.close}>×</button></div><form onSubmit={sendPayment} style={s.formGrid}><label>Amount *<input required min="0.01" max={selected.balance} step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></label><label>Date *<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label><label>Payment Method<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{Object.entries(methods).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Reference / Cheque No.<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Optional"/></label><label style={s.notes}>Narration / Notes<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional payment detail"/></label><button disabled={saving} style={s.save}>{saving ? "Saving..." : "Send Payment"}</button></form></section>}
    <section style={s.card}><div style={s.tableHead}><div><h2 style={s.h2}>Outstanding Purchase Invoices</h2><p style={s.sub}>Purchase invoice select karke usi ke against payment send karein.</p></div><span style={s.badge}>{rows.length} pending</span></div>{loading ? <p>Loading payables...</p> : !rows.length ? <div style={s.empty}>✓ Koi outstanding purchase invoice nahi hai.</div> : <div style={s.scroll}><table style={s.table}><thead><tr><th>Date</th><th>Purchase Invoice</th><th>Supplier</th><th>Purchase</th><th>Paid</th><th>Balance</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.invoice_date}</td><td><b>{row.invoice_no}</b></td><td>{row.supplier_name}</td><td>{money(row.total_amount)}</td><td>{money(row.paid)}</td><td style={s.balance}>{money(row.balance)}</td><td><button onClick={() => openPayment(row)} style={s.send}>Send Payment</button></td></tr>)}</tbody></table></div>}</section>{advances.length > 0 && <section style={s.advanceList}><h2 style={s.h2}>Supplier Advance / Credit</h2>{advances.map((row) => <div key={row.supplier_id} style={s.advanceRow}><span>{row.supplier_name}</span><b>{money(row.amount)}</b></div>)}</section>}
  </div></main>;
}

const s={page:{minHeight:"100vh",background:"#f5f7fb",padding:"32px 16px",fontFamily:"Arial,Helvetica,sans-serif",color:"#172033"},wrap:{maxWidth:1320,margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,marginBottom:24,flexWrap:"wrap"},back:{display:"inline-block",marginBottom:16,color:"#155eef",textDecoration:"none",fontWeight:700},eyebrow:{margin:"0 0 5px",fontSize:11,fontWeight:800,letterSpacing:".11em",color:"#667085"},title:{margin:0,fontSize:31},sub:{margin:"6px 0 0",color:"#667085",fontSize:14},actions:{display:"flex",gap:10,flexWrap:"wrap"},secondary:{background:"#fff",color:"#344054",border:"1px solid #d0d5dd",textDecoration:"none",padding:"10px 14px",borderRadius:8,fontWeight:700},refresh:{border:0,background:"#155eef",color:"#fff",padding:"10px 14px",borderRadius:8,fontWeight:700,cursor:"pointer"},summary:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:20},totalCard:{display:"grid",gap:7,background:"linear-gradient(135deg,#9a3412,#ea580c)",color:"#fff",padding:22,borderRadius:14,boxShadow:"0 8px 22px rgba(234,88,12,.18)"},advanceCard:{display:"grid",gap:7,background:"linear-gradient(135deg,#047857,#10b981)",color:"#fff",padding:22,borderRadius:14,boxShadow:"0 8px 22px rgba(16,185,129,.18)"},infoCard:{display:"grid",gap:7,background:"#fff",border:"1px solid #eaecf0",padding:22,borderRadius:14},paymentCard:{background:"#fff",border:"2px solid #fdba74",boxShadow:"0 8px 22px rgba(234,88,12,.1)",borderRadius:14,padding:22,marginBottom:20},paymentHeader:{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",marginBottom:18},h2:{margin:0,fontSize:20},close:{border:0,background:"#f2f4f7",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:22},formGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:14,alignItems:"end"},notes:{gridColumn:"span 2"},save:{border:0,background:"#ea580c",color:"#fff",padding:"12px 16px",borderRadius:8,fontWeight:800,cursor:"pointer"},card:{background:"#fff",border:"1px solid #eaecf0",borderRadius:14,padding:22},advanceList:{marginTop:20,background:"#ecfdf3",border:"1px solid #a7f3d0",borderRadius:14,padding:22},advanceRow:{display:"flex",justifyContent:"space-between",padding:"11px 0",borderTop:"1px solid #d1fae5",color:"#065f46"},tableHead:{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",marginBottom:18},badge:{padding:"7px 10px",background:"#fff7ed",color:"#c2410c",fontWeight:700,borderRadius:20,fontSize:13},scroll:{overflowX:"auto"},table:{width:"100%",minWidth:900,borderCollapse:"collapse"},balance:{fontWeight:800,color:"#b54708"},send:{border:0,background:"#c2410c",color:"#fff",padding:"8px 11px",borderRadius:7,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"},error:{background:"#fee4e2",color:"#b42318",padding:14,borderRadius:9,marginBottom:18,fontWeight:600},success:{background:"#ecfdf3",color:"#067647",padding:14,borderRadius:9,marginBottom:18,fontWeight:700},retry:{marginLeft:12,border:0,borderRadius:6,padding:"6px 10px",background:"#b42318",color:"#fff"},empty:{padding:28,borderRadius:10,background:"#f0fdf4",color:"#067647",fontWeight:700}};
