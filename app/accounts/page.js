"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;

export default function AccountsPage() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  async function load() {
    setError("");
    const [dashboard, purchases, supplierPayments, sales, customerPayments] = await Promise.all([
      supabase.rpc("get_dashboard_metrics").single(),
      supabase.from("purchases").select("supplier_id,total_amount,paid_amount"),
      supabase.from("supplier_payments").select("supplier_id,amount"),
      supabase.from("sales").select("customer_id,total_amount,received_amount"),
      supabase.from("customer_payments").select("customer_id,amount"),
    ]);
    const loadError = dashboard.error || purchases.error || supplierPayments.error || sales.error || customerPayments.error;
    if (loadError) { setError(loadError.message); return; }
    const netOutstanding = (invoices, payments, partyKey, settledKey) => {
      const balances = new Map();
      invoices.forEach((row) => balances.set(row[partyKey], (balances.get(row[partyKey]) || 0) + Number(row.total_amount || 0) - Number(row[settledKey] || 0)));
      payments.forEach((row) => balances.set(row[partyKey], (balances.get(row[partyKey]) || 0) - Number(row.amount || 0)));
      return [...balances.values()].reduce((sum, balance) => sum + Math.max(balance, 0), 0);
    };
    setMetrics({ ...dashboard.data, payables: netOutstanding(purchases.data || [], supplierPayments.data || [], "supplier_id", "paid_amount"), receivables: netOutstanding(sales.data || [], customerPayments.data || [], "customer_id", "received_amount") });
  }
  useEffect(() => { load(); }, []);
  return <main style={s.page}><a href="/" style={s.back}>← Dashboard</a><h1 style={s.title}>Accounts</h1><p style={s.sub}>Reconciled business balances aur party ledgers.</p>{error && <div style={s.error}>Accounts load nahi ho sake: {error}<button style={s.retry} onClick={load}>Retry</button></div>}<div style={s.grid}><a href="/receivables" style={s.card}><span>💰 Receivables</span><strong>{money(metrics?.receivables)}</strong><small>Customer outstanding →</small></a><a href="/payables" style={s.card}><span>💸 Payables</span><strong>{money(metrics?.payables)}</strong><small>Supplier outstanding →</small></a><a href="/customer-ledger" style={s.card}><span>📗 Customer Ledger</span><strong>Open</strong><small>Invoices, receipts and balance →</small></a><a href="/supplier-ledger" style={s.card}><span>📘 Supplier Ledger</span><strong>Open</strong><small>Purchases, payments and balance →</small></a><a href="/commission-ledger" style={s.card}><span>📒 Commission Ledger</span><strong>Open</strong><small>Commission balances →</small></a><a href="/reports" style={s.card}><span>📈 Reports</span><strong>Open</strong><small>Date-wise sales & purchase →</small></a></div></main>;
}

const s={page:{minHeight:"100vh",background:"#f3f4f6",padding:32,fontFamily:"Arial, sans-serif",color:"#111827"},back:{color:"#2563eb",textDecoration:"none",fontWeight:700},title:{margin:"18px 0 4px"},sub:{margin:"0 0 22px",color:"#6b7280"},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:18},card:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:22,textDecoration:"none",color:"#111827",display:"grid",gap:10},error:{background:"#fee2e2",color:"#991b1b",padding:14,borderRadius:8,marginBottom:18},retry:{marginLeft:12,border:0,borderRadius:6,padding:"6px 10px",background:"#991b1b",color:"#fff"}};
