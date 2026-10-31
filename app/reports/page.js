"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState({});
  const [suppliers, setSuppliers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { loadReport(); }, []);

  async function loadReport() {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError("Please valid date range select karein.");
      return;
    }
    setLoading(true); setError("");
    const [saleResult, purchaseResult] = await Promise.all([
      supabase.from("sales").select("id,customer_id,invoice_no,invoice_date,total_amount,received_amount").gte("invoice_date", fromDate).lte("invoice_date", toDate).order("invoice_date", { ascending: false }),
      supabase.from("purchases").select("id,supplier_id,invoice_no,invoice_date,total_amount,paid_amount").gte("invoice_date", fromDate).lte("invoice_date", toDate).order("invoice_date", { ascending: false }),
    ]);
    if (saleResult.error || purchaseResult.error) {
      setError(saleResult.error?.message || purchaseResult.error?.message || "Report load nahi ho saka.");
      setLoading(false);
      return;
    }
    const saleRows = saleResult.data || [];
    const purchaseRows = purchaseResult.data || [];
    setSales(saleRows); setPurchases(purchaseRows);
    const customerIds = [...new Set(saleRows.map((row) => row.customer_id).filter(Boolean))];
    const supplierIds = [...new Set(purchaseRows.map((row) => row.supplier_id).filter(Boolean))];
    const [customerResult, supplierResult] = await Promise.all([
      customerIds.length ? supabase.from("customers").select("id,name").in("id", customerIds) : Promise.resolve({ data: [] }),
      supplierIds.length ? supabase.from("companies").select("id,name").in("id", supplierIds) : Promise.resolve({ data: [] }),
    ]);
    setCustomers(Object.fromEntries((customerResult.data || []).map((row) => [row.id, row.name])));
    setSuppliers(Object.fromEntries((supplierResult.data || []).map((row) => [row.id, row.name])));
    setLoading(false);
  }

  const salesTotal = sales.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const receivedTotal = sales.reduce((sum, row) => sum + Number(row.received_amount || 0), 0);
  const purchasesTotal = purchases.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const paidTotal = purchases.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  const cards = [["Sales", salesTotal, "Total invoices in selected period"], ["Received", receivedTotal, "Payments recorded with these sales"], ["Period Receivable", salesTotal - receivedTotal, "Sale amount still outstanding"], ["Purchases", purchasesTotal, "Total purchases in selected period"], ["Paid", paidTotal, "Payments recorded with these purchases"], ["Period Payable", purchasesTotal - paidTotal, "Purchase amount still outstanding"]];

  return <main style={s.page}><div style={s.wrap}>
    <header style={s.header}><div><a href="/" style={s.back}>← Dashboard</a><h1 style={s.title}>Reports</h1><p style={s.sub}>Date-wise sales aur purchase summary. Har invoice ka record neeche available hai.</p></div><div style={s.links}><a href="/customer-ledger" style={s.link}>Customer Ledger</a><a href="/supplier-ledger" style={s.link}>Supplier Ledger</a></div></header>
    <section style={s.filters}><label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label><button onClick={loadReport} style={s.button}>Apply Report</button></section>
    {error && <div style={s.error}>{error}<button onClick={loadReport} style={s.retry}>Retry</button></div>}
    <section style={s.grid}>{cards.map(([label, value, note]) => <article style={s.metric} key={label}><span>{label}</span><strong>{loading ? "..." : money(value)}</strong><small>{note}</small></article>)}</section>
    <section style={s.section}><h2>Sales Invoices</h2>{loading ? <p>Loading sales...</p> : <InvoiceTable rows={sales} parties={customers} type="sale" />}</section>
    <section style={s.section}><h2>Purchase Invoices</h2>{loading ? <p>Loading purchases...</p> : <InvoiceTable rows={purchases} parties={suppliers} type="purchase" />}</section>
  </div></main>;
}

function InvoiceTable({ rows, parties, type }) {
  if (!rows.length) return <p style={s.muted}>Selected dates mein koi {type} invoice nahi mili.</p>;
  const isSale = type === "sale";
  return <div style={s.scroll}><table style={s.table}><thead><tr><th>Date</th><th>Invoice No.</th><th>{isSale ? "Customer" : "Supplier"}</th><th>Total</th><th>{isSale ? "Received" : "Paid"}</th><th>Balance</th><th></th></tr></thead><tbody>{rows.map((row) => { const total = Number(row.total_amount || 0); const paid = Number((isSale ? row.received_amount : row.paid_amount) || 0); return <tr key={row.id}><td>{row.invoice_date}</td><td><strong>{row.invoice_no}</strong></td><td>{parties[isSale ? row.customer_id : row.supplier_id] || (isSale ? "Customer" : "Supplier")}</td><td>{money(total)}</td><td>{money(paid)}</td><td>{money(total - paid)}</td><td><a href={isSale ? `/sales/invoices/${row.id}` : `/purchases/invoices/${row.id}`} style={s.open}>Open</a></td></tr>; })}</tbody></table></div>;
}

const s = {page:{minHeight:"100vh",background:"#f3f4f6",padding:"30px 16px",fontFamily:"Arial, sans-serif",color:"#111827"},wrap:{maxWidth:1240,margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap",marginBottom:22},back:{color:"#2563eb",textDecoration:"none",fontWeight:700},title:{margin:"16px 0 4px"},sub:{margin:0,color:"#6b7280"},links:{display:"flex",gap:10,flexWrap:"wrap"},link:{background:"#e8edf5",color:"#344054",textDecoration:"none",padding:"10px 14px",borderRadius:8,fontWeight:700},filters:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:16,display:"flex",gap:14,alignItems:"end",flexWrap:"wrap",marginBottom:18},button:{border:0,borderRadius:8,padding:"10px 16px",background:"#111827",color:"#fff",fontWeight:700,cursor:"pointer"},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,marginBottom:20},metric:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:18,display:"grid",gap:8},section:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:20,marginTop:18},scroll:{overflowX:"auto"},table:{width:"100%",minWidth:800,borderCollapse:"collapse"},muted:{color:"#6b7280"},error:{background:"#fee2e2",color:"#991b1b",padding:14,borderRadius:8,marginBottom:18},retry:{marginLeft:12,border:0,borderRadius:6,padding:"6px 10px",background:"#991b1b",color:"#fff"},open:{color:"#2563eb",fontWeight:700,textDecoration:"none"}};
