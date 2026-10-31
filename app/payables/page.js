"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;

export default function PayablesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPayables() {
    setLoading(true); setError("");
    const [purchasesResult, suppliersResult, paymentsResult] = await Promise.all([
      supabase.from("purchases").select("id,supplier_id,invoice_no,invoice_date,total_amount,paid_amount").order("invoice_date", { ascending: false }),
      supabase.from("companies").select("id,name").in("company_type", ["supplier", "both"]),
      supabase.from("supplier_payments").select("supplier_id,amount"),
    ]);
    if (purchasesResult.error || suppliersResult.error || paymentsResult.error) {
      setError(`Payables load nahi ho sake: ${(purchasesResult.error || suppliersResult.error || paymentsResult.error).message}`);
      setLoading(false); return;
    }
    const supplierNames = new Map((suppliersResult.data || []).map((supplier) => [supplier.id, supplier.name]));
    const laterPayments = (paymentsResult.data || []).reduce((map, payment) => {
      map.set(payment.supplier_id, (map.get(payment.supplier_id) || 0) + Number(payment.amount || 0));
      return map;
    }, new Map());
    const perSupplier = new Map();
    (purchasesResult.data || []).forEach((purchase) => {
      const row = perSupplier.get(purchase.supplier_id) || { supplier_id: purchase.supplier_id, invoices: [], invoiceBalance: 0 };
      const invoiceBalance = Number(purchase.total_amount || 0) - Number(purchase.paid_amount || 0);
      row.invoices.push({ ...purchase, invoiceBalance });
      row.invoiceBalance += invoiceBalance;
      perSupplier.set(purchase.supplier_id, row);
    });
    const result = [...perSupplier.values()].map((row) => {
      const laterPayment = laterPayments.get(row.supplier_id) || 0;
      return { ...row, supplier_name: supplierNames.get(row.supplier_id) || "Supplier", laterPayment, netBalance: row.invoiceBalance - laterPayment };
    }).filter((row) => row.netBalance !== 0 || row.invoiceBalance !== 0).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
    setRows(result); setLoading(false);
  }

  useEffect(() => { loadPayables(); }, []);
  const totalPayable = rows.reduce((sum, row) => sum + Math.max(row.netBalance, 0), 0);
  const totalAdvance = rows.reduce((sum, row) => sum + Math.abs(Math.min(row.netBalance, 0)), 0);

  return <main style={s.page}><a href="/" style={s.back}>← Dashboard</a><h1 style={s.title}>Payables</h1><p style={s.sub}>Supplier payment entries ke saath reconciled outstanding amount.</p><a href="/supplier-ledger" style={s.ledger}>Open Supplier Ledger / Record Payment</a>
    <section style={s.summary}><article style={s.card}><span>Total Payable</span><strong>{money(totalPayable)}</strong></article><article style={s.card}><span>Supplier Advance</span><strong style={s.advance}>{money(totalAdvance)}</strong><small>Extra payment supplier ke paas credit/advance hai.</small></article></section>
    {error && <div style={s.error}>{error}<button onClick={loadPayables} style={s.retry}>Retry</button></div>}
    <section style={s.card}><h2 style={s.heading}>Supplier Reconciliation</h2>{loading ? <p>Loading...</p> : rows.length === 0 ? <p style={s.muted}>Koi supplier payable ya advance nahi hai.</p> : <div style={s.tableWrap}><table style={s.table}><thead><tr><th>Supplier</th><th>Open Invoice Balance</th><th>Later Payments</th><th>Net Position</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.supplier_id}><td>{row.supplier_name}</td><td>{money(row.invoiceBalance)}</td><td>{money(row.laterPayment)}</td><td style={row.netBalance < 0 ? s.advance : s.payable}>{money(Math.abs(row.netBalance))}</td><td><span style={row.netBalance < 0 ? s.advanceBadge : s.payableBadge}>{row.netBalance < 0 ? "Advance with Supplier" : "Payable"}</span></td></tr>)}</tbody></table></div>}</section>
  </main>;
}

const s = {page:{minHeight:"100vh",background:"#f3f4f6",padding:"32px",fontFamily:"Arial, sans-serif",color:"#111827"},back:{color:"#2563eb",textDecoration:"none",fontWeight:700},ledger:{display:"inline-block",margin:"0 0 18px",background:"#0f766e",color:"#fff",textDecoration:"none",padding:"10px 14px",borderRadius:8,fontWeight:700},title:{margin:"18px 0 4px"},sub:{margin:"0 0 12px",color:"#6b7280"},summary:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16},card:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:22,marginBottom:20,display:"grid",gap:8},cardStrong:{fontSize:28},heading:{margin:"0 0 18px",fontSize:18},tableWrap:{overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse",minWidth:720},payable:{fontWeight:700,color:"#b45309"},advance:{fontWeight:700,color:"#047857"},payableBadge:{background:"#fef3c7",color:"#92400e",padding:"5px 9px",borderRadius:999,fontSize:12,fontWeight:700},advanceBadge:{background:"#d1fae5",color:"#047857",padding:"5px 9px",borderRadius:999,fontSize:12,fontWeight:700},muted:{color:"#6b7280"},error:{background:"#fee2e2",padding:14,borderRadius:8,color:"#991b1b",marginBottom:18},retry:{marginLeft:14,border:0,borderRadius:6,padding:"7px 10px",background:"#991b1b",color:"#fff",cursor:"pointer"}};
