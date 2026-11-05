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
  const cards = [
    { href: "/receivables", tone: "teal", icon: "💰", label: "Receivables", value: metrics ? money(metrics.receivables) : "Loading…", detail: "Customer outstanding", action: "View outstanding" },
    { href: "/payables", tone: "orange", icon: "💸", label: "Payables", value: metrics ? money(metrics.payables) : "Loading…", detail: "Supplier outstanding", action: "Manage payments" },
    { href: "/customer-ledger", tone: "blue", icon: "📗", label: "Customer Ledger", value: "Open", detail: "Invoices, receipts and balances", action: "Open ledger" },
    { href: "/supplier-ledger", tone: "indigo", icon: "📘", label: "Supplier Ledger", value: "Open", detail: "Purchases, payments and balance", action: "Open ledger" },
    { href: "/commission-ledger", tone: "gold", icon: "📒", label: "Commission Ledger", value: "Open", detail: "Commission balances and entries", action: "Open ledger" },
    { href: "/reports", tone: "slate", icon: "📈", label: "Reports", value: "Open", detail: "Date-wise sales and purchase reports", action: "View reports" },
  ];
  return <main style={s.page}><div style={s.wrap}><header style={s.header}><div><span style={s.kicker}>FINANCIAL OVERVIEW</span><h1 style={s.title}>Accounts</h1><p style={s.sub}>Reconciled business balances, payments aur party ledgers ek jagah manage karein.</p></div><a href="/" style={s.dashboard}>← Dashboard</a></header>{error && <div style={s.error}><div><strong>Accounts load nahi ho sake.</strong><br/><span>{error}</span></div><button style={s.retry} onClick={load}>Retry</button></div>}<section style={s.summary}><div><span style={s.summaryLabel}>Accounts Workspace</span><h2 style={s.summaryTitle}>Cash flow aur party balances par nazar rakhein</h2><p style={s.summaryText}>Receivables, payables, detailed ledgers aur reports ko direct open karein.</p></div><div style={s.summaryStats}><div><span>To Receive</span><strong>{metrics ? money(metrics.receivables) : "…"}</strong></div><div><span>To Pay</span><strong>{metrics ? money(metrics.payables) : "…"}</strong></div></div></section><section><div style={s.sectionHead}><div><h2 style={s.sectionTitle}>Accounts & Ledgers</h2><p style={s.sectionSub}>Har card se related detail aur actions directly open honge.</p></div></div><div style={s.grid}>{cards.map((card) => <a key={card.href} href={card.href} style={{ ...s.card, ...s[`card${card.tone}`] }}><div style={s.cardTop}><span style={s.icon}>{card.icon}</span><span style={s.open}>Open →</span></div><span style={s.cardLabel}>{card.label}</span><strong style={s.value}>{card.value}</strong><small style={s.detail}>{card.detail}</small><span style={s.action}>{card.action} <b>→</b></span></a>)}</div></section></div></main>;
}

const s={page:{minHeight:"100vh",background:"linear-gradient(135deg,#f2f6fc 0%,#f8fafc 50%,#eef7f4 100%)",padding:"34px 18px",fontFamily:"Arial,Helvetica,sans-serif",color:"#14213d"},wrap:{maxWidth:1280,margin:"0 auto"},header:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:20,flexWrap:"wrap",marginBottom:24},kicker:{display:"inline-block",color:"#0f766e",fontSize:11,fontWeight:800,letterSpacing:1.2,marginBottom:8},title:{margin:0,fontSize:34,letterSpacing:"-.7px"},sub:{margin:"8px 0 0",color:"#64748b",fontSize:16,lineHeight:1.55,maxWidth:660},dashboard:{background:"#173b68",boxShadow:"0 6px 14px rgba(23,59,104,.18)",color:"#fff",textDecoration:"none",padding:"11px 18px",borderRadius:9,fontWeight:700},summary:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:22,flexWrap:"wrap",marginBottom:24,padding:"24px 26px",borderRadius:18,background:"linear-gradient(105deg,#102f54,#0f766e)",boxShadow:"0 14px 30px rgba(15,54,83,.18)",color:"#fff"},summaryLabel:{fontSize:11,fontWeight:800,letterSpacing:1.1,color:"#bfe8dd"},summaryTitle:{margin:"7px 0 5px",fontSize:22},summaryText:{margin:0,color:"#d7ede9",lineHeight:1.5},summaryStats:{display:"flex",gap:12,flexWrap:"wrap"},sectionTitle:{margin:0,fontSize:21},sectionSub:{margin:"5px 0 0",color:"#667085",fontSize:14},sectionHead:{marginBottom:15},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:18},card:{position:"relative",overflow:"hidden",background:"#fff",border:"1px solid #dfe8f0",borderTop:"4px solid #64748b",borderRadius:16,padding:20,textDecoration:"none",color:"#172033",display:"grid",gap:8,boxShadow:"0 6px 18px rgba(28,50,80,.05)",transition:"transform .15s ease, box-shadow .15s ease"},cardTop:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4},icon:{width:43,height:43,display:"grid",placeItems:"center",borderRadius:12,background:"#eef2f7",fontSize:22},open:{fontSize:12,fontWeight:700,color:"#64748b"},cardLabel:{fontSize:15,fontWeight:700,color:"#344054"},value:{fontSize:24,letterSpacing:"-.35px"},detail:{fontSize:13,color:"#667085",minHeight:18},action:{marginTop:5,fontSize:13,fontWeight:700,color:"#1d4ed8"},cardteal:{borderTopColor:"#0f9d8a"},cardorange:{borderTopColor:"#ea580c"},cardblue:{borderTopColor:"#2563eb"},cardindigo:{borderTopColor:"#4f46e5"},cardgold:{borderTopColor:"#d97706"},cardslate:{borderTopColor:"#475569"},error:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,background:"#fff1f2",border:"1px solid #fecdd3",color:"#9f1239",padding:15,borderRadius:12,marginBottom:20,lineHeight:1.45},retry:{border:0,borderRadius:8,padding:"9px 14px",background:"#9f1239",color:"#fff",fontWeight:700,cursor:"pointer"}};
