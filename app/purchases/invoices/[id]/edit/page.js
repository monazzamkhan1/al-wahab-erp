"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../supabase";

export default function EditPurchase({ params }) {
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data, error } = await supabase.from("purchases").select("id,invoice_no,invoice_date,total_amount,paid_amount,notes").eq("id", params.id).single();
    if (error) setMessage(error.message); else setForm(data);
  }
  async function save(event) {
    event.preventDefault(); if (Number(form.paid_amount || 0) > Number(form.total_amount || 0)) { setMessage("Paid amount total invoice se zyada nahi ho sakta."); return; } setSaving(true); setMessage("");
    const { error } = await supabase.from("purchases").update({ invoice_no: form.invoice_no, invoice_date: form.invoice_date, paid_amount: Number(form.paid_amount || 0), notes: form.notes || null }).eq("id", params.id);
    setSaving(false); setMessage(error ? `Save nahi ho saka: ${error.message}` : "Purchase details update ho gayi hain.");
  }
  if (!form) return <main style={s.page}>Loading...</main>;
  return <main style={s.page}><div style={s.card}><a href={`/purchases/invoices/${params.id}`} style={s.back}>← Invoice</a><h1>Edit Purchase Details</h1><p style={s.sub}>Invoice number, date, paid amount aur notes edit kar sakte hain. Product, quantity aur rate stock history ko safe rakhne ke liye lock hain.</p>{message && <div style={s.message}>{message}</div>}<form onSubmit={save} style={s.form}><label>Invoice No.<input value={form.invoice_no || ""} onChange={(event) => setForm({ ...form, invoice_no: event.target.value })}/></label><label>Invoice Date<input type="date" value={form.invoice_date || ""} onChange={(event) => setForm({ ...form, invoice_date: event.target.value })}/></label><label>Paid Amount<input type="number" min="0" step="0.01" value={form.paid_amount || ""} onChange={(event) => setForm({ ...form, paid_amount: event.target.value })}/></label><label>Notes<textarea rows="5" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></label><button disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button></form></div></main>;
}
const s={page:{minHeight:"100vh",background:"#f3f4f6",padding:32,fontFamily:"Arial,sans-serif",color:"#111827"},card:{background:"#fff",maxWidth:700,margin:"0 auto",padding:24,borderRadius:12,border:"1px solid #e5e7eb"},back:{color:"#2563eb",textDecoration:"none",fontWeight:700},sub:{color:"#667085",lineHeight:1.5},form:{display:"grid",gap:16},message:{padding:12,borderRadius:8,background:"#ecfdf3",color:"#067647"}};
