"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const types = [["paid_to_holder", "Paid to Holder (+)"], ["expense_for_holder", "Expense for Holder (+)"], ["received_from_holder", "Received from Holder (-)"], ["adjustment", "Adjustment (+)"]];

export default function CommissionLedgerPage() {
  const [holders, setHolders] = useState([]);
  const [entries, setEntries] = useState([]);
  const [holderId, setHolderId] = useState("");
  const [newHolder, setNewHolder] = useState("");
  const [entry, setEntry] = useState({ entry_type: "paid_to_holder", amount: "", entry_date: new Date().toISOString().slice(0, 10), reference_no: "", notes: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const [h, e] = await Promise.all([
      supabase.from("commission_holders").select("id,name,holder_type,is_active").order("name"),
      supabase.from("commission_ledger_entries").select("*,commission_holders(name)").order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    if (h.error || e.error) setMessage("Ledger load nahi ho saka: " + (h.error || e.error).message);
    else { setHolders(h.data || []); setEntries(e.data || []); }
  }
  async function addHolder(e) {
    e.preventDefault(); if (!newHolder.trim()) return; setSaving(true);
    const { error } = await supabase.from("commission_holders").insert({ name: newHolder.trim(), holder_type: "person" });
    if (error) setMessage(error.message); else { setNewHolder(""); await load(); }
    setSaving(false);
  }
  async function addEntry(e) {
    e.preventDefault(); if (!holderId || Number(entry.amount) <= 0) return setMessage("Holder aur valid amount zaroori hai.");
    setSaving(true); const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("commission_ledger_entries").insert({ ...entry, commission_holder_id: holderId, amount: Number(entry.amount), reference_no: entry.reference_no || null, notes: entry.notes || null, created_by: auth.user?.id });
    if (error) setMessage(error.message); else { setEntry({ entry_type: "paid_to_holder", amount: "", entry_date: new Date().toISOString().slice(0, 10), reference_no: "", notes: "" }); await load(); }
    setSaving(false);
  }
  const sign = (x) => x.entry_type === "received_from_holder" ? -Number(x.amount) : Number(x.amount);
  const balances = useMemo(() => holders.map((h) => ({ ...h, balance: entries.filter((x) => x.commission_holder_id === h.id).reduce((s, x) => s + sign(x), 0) })), [holders, entries]);
  const shown = holderId ? entries.filter((x) => x.commission_holder_id === holderId) : entries;
  return <main style={s.page}><div style={s.wrap}><header style={s.head}><div><h1 style={{margin:0}}>Commission & Party Ledger</h1><p>Commission TP basis par, payments aur expenses holder-wise.</p></div><a href="/" style={s.back}>← Dashboard</a></header>{message && <p style={s.msg}>{message}</p>}
    <section style={s.card}><h2>Commission Holders</h2><form onSubmit={addHolder} style={s.row}><input value={newHolder} onChange={(e) => setNewHolder(e.target.value)} placeholder="Person or company name" style={s.input}/><button disabled={saving} style={s.button}>Add Holder</button></form><div style={s.cards}>{balances.map((h) => <button key={h.id} onClick={() => setHolderId(h.id)} style={s.holder}><b>{h.name}</b><span>Rs. {Math.abs(h.balance).toLocaleString()} {h.balance >= 0 ? "lena hai" : "dena hai"}</span></button>)}</div></section>
    <section style={s.card}><h2>Add Payment / Expense</h2><form onSubmit={addEntry} style={s.grid}><select value={holderId} onChange={(e) => setHolderId(e.target.value)} style={s.input}><option value="">Select holder</option>{holders.filter((h) => h.is_active).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select><select value={entry.entry_type} onChange={(e) => setEntry({...entry,entry_type:e.target.value})} style={s.input}>{types.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><input type="number" value={entry.amount} onChange={(e) => setEntry({...entry,amount:e.target.value})} placeholder="Amount" style={s.input}/><input type="date" value={entry.entry_date} onChange={(e) => setEntry({...entry,entry_date:e.target.value})} style={s.input}/><input value={entry.reference_no} onChange={(e) => setEntry({...entry,reference_no:e.target.value})} placeholder="Reference" style={s.input}/><input value={entry.notes} onChange={(e) => setEntry({...entry,notes:e.target.value})} placeholder="Notes" style={s.input}/><button disabled={saving} style={s.button}>Save Entry</button></form></section>
    <section style={s.card}><h2>Ledger Entries</h2>{holderId && <button onClick={() => setHolderId("")}>Show all</button>}<div style={{overflowX:"auto"}}><table style={s.table}><thead><tr><th>Date</th><th>Holder</th><th>Type</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{shown.map((x) => <tr key={x.id}><td>{x.entry_date}</td><td>{x.commission_holders?.name}</td><td>{x.entry_type.replaceAll("_"," ")}</td><td>{x.reference_no || "-"}</td><td style={{color:sign(x)<0?"#15803d":"#b45309"}}>{sign(x)<0?"−":"+"} Rs. {Number(x.amount).toLocaleString()}</td></tr>)}</tbody></table></div></section>
  </div></main>;
}
const s={page:{minHeight:"100vh",background:"#f3f4f6",padding:"28px 16px",fontFamily:"Arial,sans-serif"},wrap:{maxWidth:1200,margin:"auto"},head:{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginBottom:18},back:{background:"white",padding:"10px 14px",borderRadius:8,textDecoration:"none",color:"#111827",fontWeight:"bold"},card:{background:"white",padding:20,borderRadius:12,marginBottom:16,border:"1px solid #e5e7eb"},row:{display:"flex",gap:10,flexWrap:"wrap"},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10},input:{boxSizing:"border-box",width:"100%",padding:10,border:"1px solid #d1d5db",borderRadius:7},button:{background:"#2563eb",color:"white",border:0,borderRadius:7,padding:"10px 15px",fontWeight:"bold",cursor:"pointer"},cards:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginTop:16},holder:{textAlign:"left",display:"grid",gap:7,padding:14,border:"1px solid #e5e7eb",borderRadius:8,background:"#fafafa",cursor:"pointer"},msg:{background:"#fef3c7",padding:12,borderRadius:8},table:{width:"100%",borderCollapse:"collapse",minWidth:650}};
