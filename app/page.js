"use client";

import { useEffect, useState } from "react";
import Login from "./login";
import { supabase } from "./supabase";
import { reconcileInvoices } from "./lib/reconciliation";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
const number = (value) => Number(value || 0).toLocaleString("en-PK");

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  async function loadMetrics() {
    setDataLoading(true); setError("");
    try {
      const { data, error: metricError } = await supabase.rpc("get_dashboard_metrics").single();
      if (metricError) throw metricError;
      const [purchaseRows, supplierPayments, supplierReturns, saleRows, customerPayments, returnRows] = await Promise.all([
        supabase.from("purchases").select("id,supplier_id,total_amount,paid_amount"),
        supabase.from("supplier_payments").select("supplier_id,purchase_id,amount"),
        supabase.from("supplier_stock_returns").select("supplier_id,purchase_id,return_amount"),
        supabase.from("sales").select("id,customer_id,total_amount,received_amount"),
        supabase.from("customer_payments").select("customer_id,sale_id,amount"),
        supabase.from("stock_returns").select("customer_id,sale_id,return_amount"),
      ]);
      const queryError = [purchaseRows, supplierPayments, supplierReturns, saleRows, customerPayments, returnRows].find((row) => row.error)?.error;
      if (queryError) throw queryError;
      const salesReturns = (returnRows.data || []).reduce((map, row) => { map[row.sale_id] = Number(map[row.sale_id] || 0) + Number(row.return_amount || 0); return map; }, {});
      const purchaseReturns = (supplierReturns.data || []).reduce((map, row) => { if (row.purchase_id) map[row.purchase_id] = Number(map[row.purchase_id] || 0) + Number(row.return_amount || 0); return map; }, {});
      const { rows: reconciledSales } = reconcileInvoices((saleRows.data || []).map((row) => ({ ...row, adjustment: salesReturns[row.id] || 0 })), { partyKey: "customer_id", initialKey: "received_amount", directCredits: (customerPayments.data || []).map((row) => ({ partyId: row.customer_id, invoiceId: row.sale_id, amount: row.amount })) });
      const { rows: reconciledPurchases } = reconcileInvoices((purchaseRows.data || []).map((row) => ({ ...row, adjustment: purchaseReturns[row.id] || 0 })), { partyKey: "supplier_id", initialKey: "paid_amount", directCredits: [...(supplierPayments.data || []).map((row) => ({ partyId: row.supplier_id, invoiceId: row.purchase_id, amount: row.amount })), ...(supplierReturns.data || []).filter((row) => !row.purchase_id).map((row) => ({ partyId: row.supplier_id, invoiceId: null, amount: row.return_amount }))] });
      const returned = Object.values(salesReturns).reduce((sum, value) => sum + Number(value || 0), 0);
      setMetrics({ products:Number(data?.products||0), stock:Number(data?.stock||0), customers:Number(data?.customers||0), suppliers:Number(data?.suppliers||0), sales:Math.max(0,Number(data?.sales||0)-returned), purchases:Number(data?.purchases||0), receivables:reconciledSales.reduce((sum, row) => sum + Number(row.balance || 0), 0), payables:reconciledPurchases.reduce((sum, row) => sum + Number(row.balance || 0), 0) });
    } catch (loadError) { console.error(loadError); setError("Dashboard data load nahi ho saka. Please try again."); }
    finally { setDataLoading(false); }
  }
  useEffect(() => { if (session) loadMetrics(); else { setMetrics(null); setError(""); } }, [session]);
  if (loading) return <main style={s.loading}>Loading Al Wahab ERP...</main>;
  if (!session) return <Login />;

  const cards = [
    ["Products", number(metrics?.products), "💊", "/products", "Product master", "#2563eb"],
    ["Available Stock", number(metrics?.stock), "📦", "/stock", "Current sellable qty", "#7c3aed"],
    ["Customers", number(metrics?.customers), "🏥", "/customers", "Active parties", "#0f766e"],
    ["Suppliers", number(metrics?.suppliers), "🏭", "/companies", "Purchase sources", "#ea580c"],
    ["Net Sales", money(metrics?.sales), "🧾", "/sales/invoices", "After stock returns", "#16a34a"],
    ["Purchases", money(metrics?.purchases), "🛒", "/purchases/invoices", "Purchase register", "#9333ea"],
    ["Receivables", money(metrics?.receivables), "💰", "/receivables", "Customer outstanding", "#d97706"],
    ["Payables", money(metrics?.payables), "💸", "/payables", "Supplier outstanding", "#e11d48"],
  ];
  const groups = [
    ["OPERATIONS", [["💊","Products","/products"],["📦","Stock","/stock"],["↩️","Customer Returns","/stock-returns"],["↪️","Supplier Returns","/supplier-stock-returns"]]],
    ["SALES & PURCHASE", [["🧾","New Sale","/sales"],["📋","Sales Register","/sales/invoices"],["📊","Sales Summary","/sales/summary"],["🛒","Purchases","/purchases"],["🏥","Customers","/customers"],["🏭","Suppliers","/companies"]]],
    ["ACCOUNTS", [["💼","Accounts Centre","/accounts"],["📗","Customer Ledger","/customer-ledger"],["📘","Supplier Ledger","/supplier-ledger"],["💰","Receivables","/receivables"],["💸","Payables","/payables"],["📒","Commission Ledger","/commission-ledger"]]],
    ["SYSTEM", [["📈","Reports","/reports"],["👥","Users","/users"],["⚙️","Settings","/settings"]]],
  ];
  const actions = [["+ New Sale","/sales","primary"],["+ New Purchase","/purchases","primary"],["+ Add Customer","/customers","plain"],["+ Add Product","/products","plain"],["Customer Ledger","/customer-ledger","plain"],["Supplier Ledger","/supplier-ledger","plain"]];

  return <main style={s.page}>
    <header style={s.topbar}><a href="/" style={s.brand}><span style={s.logoShell}><img src="/images/al-wahab-logo-transparent.png" alt="Al Wahab Enterprises" style={s.logo}/></span><span style={s.brandText}><b style={s.brandTitle}>Al Wahab Enterprises</b><small style={s.brandSub}>Pharmaceutical Distribution ERP</small></span></a><div style={s.topActions}><span style={s.status}><i style={s.statusDot}/>System online</span><button onClick={() => supabase.auth.signOut()} style={s.logout}>Logout</button></div></header>
    <div style={s.shell}><aside style={s.sidebar}><a href="/" style={s.dashboardLink}>▦ <span>Dashboard</span></a>{groups.map(([title, items]) => <section key={title} style={s.navGroup}><p style={s.navTitle}>{title}</p>{items.map(([icon,label,href]) => <a key={href} href={href} style={s.navItem}><span>{icon}</span>{label}</a>)}</section>)}</aside>
      <section style={s.content}><header style={s.pageHeader}><div><p style={s.eyebrow}>OVERVIEW</p><h1 style={s.title}>Business Dashboard</h1><p style={s.subtitle}>Sales, stock aur accounts ka live overview.</p></div><button onClick={loadMetrics} disabled={dataLoading} style={s.refresh}>{dataLoading ? "Refreshing..." : "↻ Refresh data"}</button></header>
      {error && <div style={s.error}>{error}<button onClick={loadMetrics} style={s.retry}>Retry</button></div>}
      <section style={s.metrics}>{cards.map(([label,value,icon,href,note,color]) => <a key={label} href={href} style={{...s.metric,borderTop:`4px solid ${color}`}}><span style={s.metricIcon}>{icon}</span><div style={s.metricBody}><p style={s.metricLabel}>{label}</p><strong style={s.metricValue}>{dataLoading ? "..." : value}</strong><small style={s.metricNote}>{note} →</small></div></a>)}</section>
      <section style={s.quickCard}><div><p style={s.eyebrow}>QUICK ACTIONS</p><h2 style={s.sectionTitle}>Daily work shortcuts</h2></div><div style={s.actionGrid}>{actions.map(([label,href,kind]) => <a key={label} href={href} style={kind==="primary"?s.actionPrimary:s.actionPlain}>{label}</a>)}</div></section>
      <section style={s.lowerGrid}><article style={s.accountsCard}><div style={s.cardHeading}><div><p style={s.eyebrow}>ACCOUNTS CENTRE</p><h2 style={s.sectionTitle}>Ledgers & balances</h2></div><a href="/accounts" style={s.viewLink}>Open accounts →</a></div><p style={s.cardText}>Customer aur supplier ledgers alag rakhay gaye hain, jab ke Accounts Centre un dono ko ek central jagah se access deta hai.</p><div style={s.ledgerGrid}><a href="/customer-ledger" style={s.ledgerLink}>📗 <span><b>Customer Ledger</b><small>Invoices, returns & receipts</small></span></a><a href="/supplier-ledger" style={s.ledgerLink}>📘 <span><b>Supplier Ledger</b><small>Purchases & payments</small></span></a><a href="/receivables" style={s.ledgerLink}>💰 <span><b>Receivables</b><small>{money(metrics?.receivables)} outstanding</small></span></a><a href="/payables" style={s.ledgerLink}>💸 <span><b>Payables</b><small>{money(metrics?.payables)} outstanding</small></span></a></div></article>
      <article style={s.reportCard}><p style={s.eyebrow}>REPORTING</p><h2 style={s.sectionTitle}>Analysis & reports</h2><p style={s.cardText}>Supplier-wise cost, product-wise sales aur party balances analyse karein.</p><div style={s.reportLinks}><a href="/sales/summary">Sales Summary <span>→</span></a><a href="/reports">Business Reports <span>→</span></a><a href="/stock">Stock Management <span>→</span></a><a href="/commission-ledger">Commission Ledger <span>→</span></a></div></article></section>
      </section></div>
  </main>;
}

const s={page:{minHeight:"100vh",background:"#f5f7fb",fontFamily:"Arial,Helvetica,sans-serif",color:"#172033"},loading:{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"Arial,Helvetica,sans-serif",color:"#344054"},topbar:{minHeight:80,boxSizing:"border-box",padding:"10px 28px",background:"linear-gradient(110deg,#fffaf0 0%,#ffffff 55%,#eef8f5 100%)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,borderBottom:"1px solid #e5e7eb",boxShadow:"0 2px 10px rgba(16,24,40,.06)"},brand:{display:"flex",alignItems:"center",gap:13,color:"#14213d",textDecoration:"none"},logoShell:{display:"grid",placeItems:"center",width:58,height:48,background:"transparent",flexShrink:0},logo:{width:58,height:48,objectFit:"contain",filter:"drop-shadow(0 2px 2px rgba(91,57,5,.18))"},brandText:{display:"flex",flexDirection:"column",gap:4,minWidth:0},brandTitle:{fontFamily:"Georgia,Times New Roman,serif",fontSize:22,letterSpacing:".01em",lineHeight:1.05,color:"#14213d"},brandSub:{fontSize:12,fontWeight:700,letterSpacing:".035em",color:"#667085"},topActions:{display:"flex",alignItems:"center",gap:14},status:{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:700,color:"#067647",whiteSpace:"nowrap"},statusDot:{display:"block",width:8,height:8,borderRadius:99,background:"#12b76a",boxShadow:"0 0 0 3px #d1fadf"},logout:{border:"1px solid #cbd5e1",background:"#14213d",color:"#fff",fontWeight:700,borderRadius:9,padding:"11px 17px",cursor:"pointer"},shell:{display:"flex",minHeight:"calc(100vh - 80px)"},sidebar:{width:245,boxSizing:"border-box",padding:"18px 14px",background:"#1d2939",color:"#fff",flexShrink:0},dashboardLink:{display:"flex",gap:10,alignItems:"center",padding:"12px 14px",borderRadius:9,background:"#344054",color:"#fff",textDecoration:"none",fontWeight:800,marginBottom:16},navGroup:{borderTop:"1px solid #344054",paddingTop:14,marginTop:14},navTitle:{margin:"0 0 6px",padding:"0 10px",fontSize:10,letterSpacing:".12em",fontWeight:800,color:"#98a2b3"},navItem:{display:"flex",gap:10,alignItems:"center",padding:"9px 10px",borderRadius:7,textDecoration:"none",color:"#d0d5dd",fontSize:14},content:{flex:1,minWidth:0,padding:"30px",boxSizing:"border-box"},pageHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:24,flexWrap:"wrap"},eyebrow:{margin:"0 0 5px",fontSize:11,fontWeight:800,letterSpacing:".11em",color:"#667085"},title:{margin:0,fontSize:30,lineHeight:1.15},subtitle:{margin:"7px 0 0",color:"#667085"},refresh:{border:"1px solid #d0d5dd",background:"#fff",borderRadius:8,padding:"10px 13px",fontWeight:700,cursor:"pointer",color:"#344054"},error:{marginBottom:18,padding:14,borderRadius:10,background:"#fee4e2",color:"#b42318",fontWeight:600},retry:{marginLeft:12,border:0,borderRadius:6,padding:"6px 10px",background:"#b42318",color:"#fff",fontWeight:700},metrics:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(205px,1fr))",gap:15},metric:{display:"flex",gap:14,alignItems:"flex-start",minHeight:118,boxSizing:"border-box",padding:18,background:"#fff",border:"1px solid #eaecf0",borderRadius:13,boxShadow:"0 2px 8px rgba(16,24,40,.04)",textDecoration:"none",color:"#172033"},metricIcon:{display:"grid",placeItems:"center",width:40,height:40,borderRadius:10,background:"#f2f4f7",fontSize:22,flexShrink:0},metricBody:{display:"flex",flexDirection:"column",gap:6,minWidth:0},metricLabel:{margin:0,fontSize:14,color:"#475467"},metricValue:{fontSize:19,lineHeight:1.15,color:"#101828"},metricNote:{fontSize:12,color:"#475467",lineHeight:1.25},quickCard:{marginTop:22,background:"#fff",border:"1px solid #eaecf0",borderRadius:14,padding:22,display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap"},sectionTitle:{margin:0,fontSize:19},actionGrid:{display:"flex",gap:9,flexWrap:"wrap"},actionPrimary:{background:"#155eef",color:"#fff",padding:"11px 14px",borderRadius:8,textDecoration:"none",fontWeight:700,fontSize:14},actionPlain:{background:"#f2f4f7",color:"#344054",padding:"11px 14px",borderRadius:8,textDecoration:"none",fontWeight:700,fontSize:14},lowerGrid:{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(280px,.8fr)",gap:20,marginTop:22},accountsCard:{background:"#fff",border:"1px solid #eaecf0",borderRadius:14,padding:22},reportCard:{background:"linear-gradient(135deg,#eff8ff,#f5f3ff)",border:"1px solid #dbeafe",borderRadius:14,padding:22},cardHeading:{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"},viewLink:{color:"#155eef",fontSize:13,fontWeight:700,textDecoration:"none"},cardText:{margin:"12px 0 18px",color:"#667085",fontSize:14,lineHeight:1.5},ledgerGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10},ledgerLink:{display:"flex",gap:11,alignItems:"center",padding:13,background:"#f8fafc",border:"1px solid #eaecf0",borderRadius:10,textDecoration:"none",color:"#172033"},reportLinks:{display:"grid",gap:8}};
