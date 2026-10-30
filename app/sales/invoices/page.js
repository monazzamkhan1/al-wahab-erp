"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { loadInvoices(); }, []);
  async function loadInvoices() {
    setLoading(true); setError("");
    const { data, error: loadError } = await supabase.from("sales").select("id,customer_id,invoice_no,sale_date,total_amount,received_amount,booker_name,supplier_name,notes,created_at").order("sale_date", { ascending: false }).order("created_at", { ascending: false });
    if (loadError) { setError(loadError.message); setLoading(false); return; }
    setInvoices(data || []);
    const ids = [...new Set((data || []).map((row) => row.customer_id).filter(Boolean))];
    if (ids.length) {
      const { data: partyData } = await supabase.from("customers").select("id,name").in("id", ids);
      setCustomers(Object.fromEntries((partyData || []).map((row) => [row.id, row.name])));
    }
    setLoading(false);
  }

  return <main style={s.page}><div style={s.wrap}>
    <header style={s.header}><div><h1 style={s.title}>Sales Invoices</h1><p style={s.sub}>Purani invoices open, print ya PDF save karein.</p></div><div style={s.actions}><a href="/sales" style={s.primary}>+ New Sale</a><a href="/" style={s.back}>← Dashboard</a></div></header>
    {error && <div style={s.error}>Invoices load nahi ho sakin: {error}<button onClick={loadInvoices} style={s.retry}>Retry</button></div>}
    <section style={s.card}>{loading ? <p>Loading invoices...</p> : !invoices.length ? <p style={s.muted}>Abhi koi saved sale invoice nahi hai.</p> : <div style={s.scroll}><table style={s.table}><thead><tr><th>Date</th><th>Invoice No.</th><th>Customer</th><th>Booker / Supplier</th><th>Total</th><th>Received</th><th>Balance</th><th></th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.sale_date}</td><td><strong>{invoice.invoice_no}</strong></td><td>{customers[invoice.customer_id] || "Customer"}</td><td>{[invoice.booker_name, invoice.supplier_name].filter(Boolean).join(" · ") || "-"}</td><td>{money(invoice.total_amount)}</td><td>{money(invoice.received_amount)}</td><td>{money(Number(invoice.total_amount || 0) - Number(invoice.received_amount || 0))}</td><td><a href={`/sales/invoices/${invoice.id}`} style={s.open}>Open / Print</a></td></tr>)}</tbody></table></div>}</section>
  </div></main>;
}
const s={page:{minHeight:"100vh",background:"#f5f7fb",padding:"30px 16px",fontFamily:"Arial,Helvetica,sans-serif",color:"#172033"},wrap:{maxWidth:1250,margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:20,flexWrap:"wrap"},title:{margin:"0 0 6px",fontSize:30},sub:{margin:0,color:"#667085"},actions:{display:"flex",gap:10,flexWrap:"wrap"},primary:{background:"#2563eb",color:"#fff",textDecoration:"none",padding:"10px 15px",borderRadius:8,fontWeight:700},back:{background:"#e8edf5",color:"#344054",textDecoration:"none",padding:"10px 15px",borderRadius:8,fontWeight:600},card:{background:"#fff",border:"1px solid #e4e7ec",borderRadius:14,padding:22},scroll:{overflowX:"auto"},table:{width:"100%",minWidth:980,borderCollapse:"collapse"},error:{background:"#fee2e2",color:"#991b1b",padding:14,borderRadius:8,marginBottom:18},retry:{marginLeft:12,border:0,borderRadius:6,padding:"6px 10px",background:"#991b1b",color:"#fff"},muted:{color:"#667085"},open:{color:"#2563eb",fontWeight:700,textDecoration:"none"}};
