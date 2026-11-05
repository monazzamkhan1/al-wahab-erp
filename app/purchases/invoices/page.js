"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const displayDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB") : "-";

export default function PurchaseInvoices() {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError("");
    const { data, error: purchaseError } = await supabase.from("purchases")
      .select("id,supplier_id,invoice_no,invoice_date,total_amount,paid_amount,created_at")
      .order("invoice_date", { ascending: false }).order("created_at", { ascending: false });
    if (purchaseError) { setError(purchaseError.message); setLoading(false); return; }
    setRows(data || []);
    const ids = [...new Set((data || []).map((row) => row.supplier_id).filter(Boolean))];
    if (ids.length) {
      const { data: companies } = await supabase.from("companies").select("id,name").in("id", ids);
      setSuppliers(Object.fromEntries((companies || []).map((company) => [company.id, company.name])));
    }
    setLoading(false);
  }

  const totals = useMemo(() => rows.reduce((summary, row) => {
    const total = Number(row.total_amount || 0), paid = Number(row.paid_amount || 0);
    return { total: summary.total + total, paid: summary.paid + paid, due: summary.due + total - paid };
  }, { total: 0, paid: 0, due: 0 }), [rows]);

  return <main className="purchaseInvoices" style={s.page}>
    <style>{`
      .purchaseInvoices *{box-sizing:border-box}.purchaseInvoices .summaryGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:0 0 18px}.purchaseInvoices .purchaseTable th{background:#eaf0f8;color:#1e3a5f;padding:13px 12px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:13px;white-space:nowrap}.purchaseInvoices .purchaseTable td{padding:14px 12px;border-bottom:1px solid #e2e8f0;vertical-align:middle;font-size:14px}.purchaseInvoices .purchaseTable tbody tr:nth-child(even){background:#f8fafc}.purchaseInvoices .purchaseTable tbody tr:hover{background:#eff6ff}.purchaseInvoices .purchaseTable td:nth-child(1),.purchaseInvoices .purchaseTable td:nth-child(4),.purchaseInvoices .purchaseTable td:nth-child(5),.purchaseInvoices .purchaseTable td:nth-child(6){white-space:nowrap}@media(max-width:800px){.purchaseInvoices .summaryGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){.purchaseInvoices{padding:18px 12px!important}.purchaseInvoices .summaryGrid{grid-template-columns:1fr}}
    `}</style>
    <div style={s.wrap}>
      <header style={s.header}><div><span style={s.kicker}>PURCHASING</span><h1 style={s.title}>Purchase Invoices</h1><p style={s.sub}>Purchase history, paid amount aur payable balance yahan manage karein.</p></div><div style={s.actions}><a href="/purchases" style={s.primary}>+ New Purchase</a><a href="/" style={s.back}>← Dashboard</a></div></header>
      {error && <div style={s.error}>Invoices load nahi ho sakin: {error}<button onClick={load} style={s.retry}>Retry</button></div>}
      {!loading && rows.length > 0 && <section className="summaryGrid">
        <Summary title="Purchase Invoices" value={rows.length} note="Saved purchase entries" color="#2563eb" />
        <Summary title="Total Purchase" value={money(totals.total)} note="All listed invoices" color="#0f766e" />
        <Summary title="Paid Amount" value={money(totals.paid)} note="Payment recorded" color="#16a34a" />
        <Summary title="Outstanding Payable" value={money(totals.due)} note={totals.due > 0 ? "Payment follow-up required" : "All invoices settled"} color={totals.due > 0 ? "#ea580c" : "#16a34a"} />
      </section>}
      <section style={s.card}>
        <div style={s.cardHeader}><div><h2 style={s.heading}>Purchase Register</h2><p style={s.sub}>Invoice-wise supplier aur payment position.</p></div>{!loading && <span style={s.count}>{rows.length} {rows.length === 1 ? "invoice" : "invoices"}</span>}</div>
        {loading ? <p style={s.empty}>Loading invoices...</p> : !rows.length ? <p style={s.empty}>Abhi koi saved purchase invoice nahi hai.</p> : <div style={s.scroll}><table className="purchaseTable" style={s.table}><thead><tr><th>Date</th><th>Invoice No.</th><th>Supplier</th><th>Total Purchase</th><th>Paid</th><th>Payable</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => { const balance = Number(row.total_amount || 0) - Number(row.paid_amount || 0); return <tr key={row.id}><td>{displayDate(row.invoice_date)}</td><td><strong style={s.invoice}>{row.invoice_no}</strong></td><td><strong>{suppliers[row.supplier_id] || "Supplier"}</strong></td><td style={s.amount}>{money(row.total_amount)}</td><td style={{ ...s.amount, color: "#15803d" }}>{money(row.paid_amount)}</td><td><span style={{ ...s.balance, background: balance > 0 ? "#fff7ed" : "#ecfdf3", color: balance > 0 ? "#c2410c" : "#15803d" }}>{money(balance)}</span></td><td><div style={s.rowActions}><a href={`/purchases/invoices/${row.id}`} style={s.open}>Open / Print</a><a href={`/purchases/invoices/${row.id}/edit`} style={s.edit}>Edit</a></div></td></tr>; })}</tbody></table></div>}
      </section>
    </div>
  </main>;
}

function Summary({ title, value, note, color }) { return <div style={{ ...s.summaryCard, borderTop: `4px solid ${color}` }}><span style={s.cardLabel}>{title}</span><strong style={{ ...s.cardValue, color }}>{value}</strong><span style={s.cardNote}>{note}</span></div>; }

const s = {
  page: { minHeight: "100vh", background: "#f4f7fb", padding: "32px 20px", fontFamily: "Arial,Helvetica,sans-serif", color: "#172033" }, wrap: { maxWidth: 1280, margin: "0 auto" }, header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 22, flexWrap: "wrap" }, kicker: { color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: 1.1 }, title: { margin: "5px 0 7px", fontSize: 32, lineHeight: 1.12 }, sub: { margin: 0, color: "#667085", lineHeight: 1.45 }, actions: { display: "flex", gap: 10, flexWrap: "wrap" }, primary: { background: "#2563eb", color: "#fff", textDecoration: "none", padding: "11px 16px", borderRadius: 8, fontWeight: 700, boxShadow: "0 4px 10px rgba(37,99,235,.18)" }, back: { background: "#e8edf5", color: "#344054", textDecoration: "none", padding: "11px 16px", borderRadius: 8, fontWeight: 700 }, summaryCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", boxShadow: "0 2px 8px rgba(15,23,42,.04)", display: "flex", flexDirection: "column", gap: 7 }, cardLabel: { color: "#475569", fontSize: 13, fontWeight: 700 }, cardValue: { fontSize: 23 }, cardNote: { color: "#64748b", fontSize: 12 }, card: { background: "#fff", border: "1px solid #e0e7ef", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,23,42,.04)" }, cardHeader: { padding: "19px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }, heading: { margin: "0 0 5px", fontSize: 19 }, count: { background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontSize: 13, fontWeight: 700 }, empty: { padding: "20px", margin: 0, color: "#667085" }, scroll: { overflowX: "auto" }, table: { width: "100%", minWidth: 950, borderCollapse: "collapse" }, invoice: { color: "#1e3a5f" }, amount: { fontWeight: 700 }, balance: { display: "inline-block", borderRadius: 999, padding: "5px 9px", fontWeight: 800, whiteSpace: "nowrap" }, rowActions: { display: "flex", gap: 8, whiteSpace: "nowrap" }, open: { background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, textDecoration: "none", borderRadius: 6, padding: "7px 9px", fontSize: 13 }, edit: { background: "#f1f5f9", color: "#334155", fontWeight: 700, textDecoration: "none", borderRadius: 6, padding: "7px 9px", fontSize: 13 }, error: { background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 8, marginBottom: 18 }, retry: { marginLeft: 12, border: 0, borderRadius: 6, padding: "6px 10px", background: "#991b1b", color: "#fff", cursor: "pointer" },
};
