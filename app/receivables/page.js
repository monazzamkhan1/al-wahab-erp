"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = new Date().toISOString().slice(0, 10);
const methods = { cash: "Cash", bank_transfer: "Bank Transfer", online_transfer: "Online Transfer", cheque: "Cheque", other: "Other" };

export default function ReceivablesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "", date: today, method: "cash", reference: "", notes: "" });

  async function loadReceivables() {
    setLoading(true); setError("");
    const [salesResult, customersResult, returnsResult, paymentsResult] = await Promise.all([
      supabase.from("sales").select("id,customer_id,invoice_no,invoice_date,total_amount,received_amount").order("invoice_date", { ascending: false }),
      supabase.from("customers").select("id,name"),
      supabase.from("stock_returns").select("sale_id,return_amount"),
      supabase.from("customer_payments").select("sale_id,amount"),
    ]);
    const loadError = [salesResult, customersResult, returnsResult, paymentsResult].find((result) => result.error)?.error;
    if (loadError) setError(`Receivables load nahi ho sake: ${loadError.message}`);
    else {
      const customerById = Object.fromEntries((customersResult.data || []).map((row) => [row.id, row.name]));
      const returnsBySale = (returnsResult.data || []).reduce((map, row) => { map[row.sale_id] = (map[row.sale_id] || 0) + Number(row.return_amount || 0); return map; }, {});
      const paymentsBySale = (paymentsResult.data || []).reduce((map, row) => { if (row.sale_id) map[row.sale_id] = (map[row.sale_id] || 0) + Number(row.amount || 0); return map; }, {});
      setRows((salesResult.data || []).map((sale) => {
        const returned = Number(returnsBySale[sale.id] || 0);
        const paid = Number(sale.received_amount || 0) + Number(paymentsBySale[sale.id] || 0);
        return { ...sale, customer_name: customerById[sale.customer_id] || "Customer", returned, paid, balance: Math.max(Number(sale.total_amount || 0) - returned - paid, 0) };
      }).filter((sale) => sale.balance > 0.004));
    }
    setLoading(false);
  }
  useEffect(() => { loadReceivables(); }, []);
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.balance, 0), [rows]);
  const customers = new Set(rows.map((row) => row.customer_id)).size;
  function openReceipt(row) { setSelected(row); setForm({ amount: row.balance.toFixed(2), date: today, method: "cash", reference: "", notes: "" }); setMessage(""); }
  async function saveReceipt(event) {
    event.preventDefault(); setError(""); setMessage("");
    const amount = Number(form.amount || 0);
    if (!selected || amount <= 0 || amount > selected.balance + 0.004) { setError("Valid amount enter karein. Amount selected invoice ke remaining balance se zyada nahi ho sakta."); return; }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("User login nahi hai.");
      const { error: paymentError } = await supabase.from("customer_payments").insert({ customer_id: selected.customer_id, sale_id: selected.id, payment_date: form.date, amount, payment_method: form.method, reference_no: form.reference || null, notes: form.notes || null, created_by: auth.user.id });
      if (paymentError) throw paymentError;
      setMessage(`Payment received from ${selected.customer_name}: ${money(amount)}`);
      setSelected(null); await loadReceivables();
    } catch (saveError) { setError(`Payment save nahi ho saki: ${saveError.message}`); }
    finally { setSaving(false); }
  }

  return <main style={s.page}><div style={s.wrap}>
    <header style={s.header}><div><a href="/" style={s.back}>← Dashboard</a><p style={s.eyebrow}>ACCOUNTS RECEIVABLE</p><h1 style={s.title}>Customer Receivables</h1><p style={s.sub}>Outstanding sale invoices aur received payments manage karein.</p></div><div style={s.actions}><a href="/customer-ledger" style={s.secondary}>Customer Ledger</a><button onClick={loadReceivables} style={s.refresh}>↻ Refresh</button></div></header>
    {error && <div style={s.error}>{error}<button onClick={loadReceivables} style={s.retry}>Retry</button></div>}
    {message && <div style={s.success}>{message}</div>}
    <section style={s.summary}><article style={s.totalCard}><span>💰 Total Receivable</span><strong>{money(total)}</strong><small>Outstanding across all invoices</small></article><article style={s.infoCard}><span>📄 Outstanding Invoices</span><strong>{rows.length}</strong><small>Invoice-wise follow-up</small></article><article style={s.infoCard}><span>🏥 Customers Due</span><strong>{customers}</strong><small>Parties with pending balance</small></article></section>
    {selected && <section style={s.paymentCard}><div style={s.paymentHeader}><div><p style={s.eyebrow}>RECEIVE PAYMENT</p><h2 style={s.h2}>{selected.customer_name}</h2><p style={s.sub}>{selected.invoice_no} · Remaining {money(selected.balance)}</p></div><button onClick={() => setSelected(null)} style={s.close}>×</button></div><form onSubmit={saveReceipt} style={s.formGrid}><label>Amount *<input required min="0.01" max={selected.balance} step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></label><label>Date *<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label><label>Payment Method<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{Object.entries(methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Reference / Cheque No.<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Optional"/></label><label style={s.notes}>Narration / Notes<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional payment detail"/></label><button disabled={saving} style={s.save}>{saving ? "Saving..." : "Receive Payment"}</button></form></section>}
    <section style={s.card}><div style={s.tableHead}><div><h2 style={s.h2}>Outstanding Sales Invoices</h2><p style={s.sub}>Invoice ko select karke usi ke against payment receive karein.</p></div><span style={s.badge}>{rows.length} pending</span></div>{loading ? <p>Loading receivables...</p> : !rows.length ? <div style={s.empty}>✓ Koi outstanding sale invoice nahi hai.</div> : <div style={s.scroll}><table style={s.table}><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Sale</th><th>Return</th><th>Received</th><th>Balance</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.invoice_date}</td><td><b>{row.invoice_no}</b></td><td>{row.customer_name}</td><td>{money(row.total_amount)}</td><td>{money(row.returned)}</td><td>{money(row.paid)}</td><td style={s.balance}>{money(row.balance)}</td><td><button onClick={() => openReceipt(row)} style={s.receive}>Receive Payment</button></td></tr>)}</tbody></table></div>}</section>
  </div></main>;
}

const s={page:{minHeight:"100vh",background:"#f5f7fb",padding:"32px 16px",fontFamily:"Arial,Helvetica,sans-serif",color:"#172033"},wrap:{maxWidth:1320,margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,marginBottom:24,flexWrap:"wrap"},back:{display:"inline-block",marginBottom:16,color:"#155eef",textDecoration:"none",fontWeight:700},eyebrow:{margin:"0 0 5px",fontSize:11,fontWeight:800,letterSpacing:".11em",color:"#667085"},title:{margin:0,fontSize:31},sub:{margin:"6px 0 0",color:"#667085",fontSize:14},actions:{display:"flex",gap:10,flexWrap:"wrap"},secondary:{background:"#fff",color:"#344054",border:"1px solid #d0d5dd",textDecoration:"none",padding:"10px 14px",borderRadius:8,fontWeight:700},refresh:{border:0,background:"#155eef",color:"#fff",padding:"10px 14px",borderRadius:8,fontWeight:700,cursor:"pointer"},summary:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:20},totalCard:{display:"grid",gap:7,background:"linear-gradient(135deg,#0f766e,#0d9488)",color:"#fff",padding:22,borderRadius:14,boxShadow:"0 8px 22px rgba(15,118,110,.18)"},infoCard:{display:"grid",gap:7,background:"#fff",border:"1px solid #eaecf0",padding:22,borderRadius:14},paymentCard:{background:"#fff",border:"2px solid #86efac",boxShadow:"0 8px 22px rgba(16,185,129,.1)",borderRadius:14,padding:22,marginBottom:20},paymentHeader:{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",marginBottom:18},h2:{margin:0,fontSize:20},close:{border:0,background:"#f2f4f7",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:22},formGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:14,alignItems:"end"},notes:{gridColumn:"span 2"},save:{border:0,background:"#16a34a",color:"#fff",padding:"12px 16px",borderRadius:8,fontWeight:800,cursor:"pointer"},card:{background:"#fff",border:"1px solid #eaecf0",borderRadius:14,padding:22},tableHead:{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",marginBottom:18},badge:{padding:"7px 10px",background:"#eff8ff",color:"#175cd3",fontWeight:700,borderRadius:20,fontSize:13},scroll:{overflowX:"auto"},table:{width:"100%",minWidth:970,borderCollapse:"collapse"},balance:{fontWeight:800,color:"#b54708"},receive:{border:0,background:"#0f766e",color:"#fff",padding:"8px 11px",borderRadius:7,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"},error:{background:"#fee4e2",color:"#b42318",padding:14,borderRadius:9,marginBottom:18,fontWeight:600},success:{background:"#ecfdf3",color:"#067647",padding:14,borderRadius:9,marginBottom:18,fontWeight:700},retry:{marginLeft:12,border:0,borderRadius:6,padding:"6px 10px",background:"#b42318",color:"#fff"},empty:{padding:28,borderRadius:10,background:"#f0fdf4",color:"#067647",fontWeight:700}};
