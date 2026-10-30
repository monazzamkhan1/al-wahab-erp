"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;

export default function ReceivablesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReceivables() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("sales")
      .select("id, invoice_no, invoice_date, total_amount, received_amount, customers(name)")
      .order("invoice_date", { ascending: false });

    if (loadError) setError(`Receivables load nahi ho sake: ${loadError.message}`);
    else setRows((data || []).filter((sale) => Number(sale.total_amount || 0) > Number(sale.received_amount || 0)));
    setLoading(false);
  }

  useEffect(() => { loadReceivables(); }, []);
  const total = rows.reduce((sum, row) => sum + Number(row.total_amount || 0) - Number(row.received_amount || 0), 0);

  return <main style={styles.page}><a href="/" style={styles.back}>← Dashboard</a><h1 style={styles.title}>Receivables</h1><p style={styles.sub}>Customers se receive hone wali outstanding amount.</p>
    <section style={styles.card}><div style={styles.totalLabel}>Total Receivable</div><strong style={styles.total}>{money(total)}</strong></section>
    {error && <div style={styles.error}>{error}<button onClick={loadReceivables} style={styles.retry}>Retry</button></div>}
    <section style={styles.card}><h2 style={styles.heading}>Outstanding Sales Invoices</h2>{loading ? <p>Loading...</p> : rows.length === 0 ? <p style={styles.muted}>Koi outstanding sale invoice nahi hai.</p> : <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Date</th><th style={styles.th}>Invoice</th><th style={styles.th}>Customer</th><th style={styles.th}>Sale</th><th style={styles.th}>Received</th><th style={styles.th}>Balance</th></tr></thead><tbody>{rows.map((row) => { const balance = Number(row.total_amount || 0) - Number(row.received_amount || 0); return <tr key={row.id}><td style={styles.td}>{row.invoice_date}</td><td style={styles.td}>{row.invoice_no}</td><td style={styles.td}>{row.customers?.name || "—"}</td><td style={styles.td}>{money(row.total_amount)}</td><td style={styles.td}>{money(row.received_amount)}</td><td style={{...styles.td, fontWeight: 700, color: "#b45309"}}>{money(balance)}</td></tr>; })}</tbody></table></div>}</section>
  </main>;
}

const styles = { page:{minHeight:"100vh",background:"#f3f4f6",padding:"32px",fontFamily:"Arial, sans-serif",color:"#111827"},back:{color:"#2563eb",textDecoration:"none",fontWeight:700},title:{margin:"18px 0 4px"},sub:{margin:"0 0 22px",color:"#6b7280"},card:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:22,marginBottom:20},totalLabel:{color:"#6b7280",fontSize:14},total:{fontSize:28,display:"block",marginTop:6},heading:{margin:"0 0 18px",fontSize:18},tableWrap:{overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse",minWidth:680},th:{textAlign:"left",padding:12,background:"#f8fafc",fontSize:13},td:{padding:12,borderTop:"1px solid #e5e7eb",fontSize:14},muted:{color:"#6b7280"},error:{background:"#fee2e2",padding:14,borderRadius:8,color:"#991b1b",marginBottom:18},retry:{marginLeft:14,border:0,borderRadius:6,padding:"7px 10px",background:"#991b1b",color:"#fff",cursor:"pointer"} };
