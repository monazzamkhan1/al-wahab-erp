"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const niceMethod = (value) => ({ cash: "Cash", bank_transfer: "Bank Transfer", online_transfer: "Online Transfer", cheque: "Cheque", other: "Other" }[value] || value || "-");
const today = new Date().toISOString().slice(0, 10);
const yearStart = `${today.slice(0, 4)}-01-01`;

export default function PartyLedger({ kind }) {
  const supplier = kind === "supplier";
  const labels = supplier
    ? { singular: "Supplier", plural: "Suppliers", invoice: "Purchase Invoice", payment: "Supplier Payment", direction: "Pay to Supplier", title: "Supplier Detail Ledger", href: "/payables" }
    : { singular: "Customer", plural: "Customers", invoice: "Sale Invoice", payment: "Customer Receipt", direction: "Receive from Customer", title: "Customer Detail Ledger", href: "/receivables" };
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState({});
  const [batches, setBatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showProducts, setShowProducts] = useState(true);
  const [form, setForm] = useState({ amount: "", date: today, method: "cash", reference: "", notes: "", invoiceId: "" });

  useEffect(() => { loadParties(); }, []);
  useEffect(() => { if (partyId) loadLedger(); else { setInvoices([]); setPayments([]); setItems([]); } }, [partyId]);

  const partyName = parties.find((party) => party.id === partyId)?.name || "";

  function chooseParty(value) {
    setPartySearch(value);
    const matched = parties.find((party) => party.name.toLowerCase() === value.trim().toLowerCase());
    if (matched) setPartyId(matched.id);
  }

  async function loadParties() {
    setLoading(true); setError("");
    const query = supplier ? supabase.from("companies").select("id,name,company_type").in("company_type", ["supplier", "both"]).order("name") : supabase.from("customers").select("id,name").order("name");
    const { data, error: loadError } = await query;
    if (loadError) setError(`${labels.plural} load nahi ho sake: ${loadError.message}`);
    else setParties(data || []);
    setLoading(false);
  }

  async function loadLedger() {
    if (!partyId) return;
    if (!fromDate || !toDate || fromDate > toDate) { setError("Valid starting aur ending date select karein."); return; }
    setLoading(true); setError(""); setMessage("");
    const invoiceTable = supplier ? "purchases" : "sales";
    const invoiceDate = supplier ? "invoice_date" : "sale_date";
    const invoicePartyKey = supplier ? "supplier_id" : "customer_id";
    const paymentTable = supplier ? "supplier_payments" : "customer_payments";
    const paymentPartyKey = supplier ? "supplier_id" : "customer_id";
    const itemTable = supplier ? "purchase_items" : "sale_items";
    const itemLink = supplier ? "purchase_id" : "sale_id";
    const [invoiceResult, paymentResult] = await Promise.all([
      supabase.from(invoiceTable).select(`id,invoice_no,${invoiceDate},total_amount,${supplier ? "paid_amount" : "received_amount"},notes,created_at`).eq(invoicePartyKey, partyId).gte(invoiceDate, fromDate).lte(invoiceDate, toDate).order(invoiceDate),
      supabase.from(paymentTable).select(`id,${supplier ? "purchase_id" : "sale_id"},payment_date,amount,payment_method,reference_no,notes,created_at`).eq(paymentPartyKey, partyId).gte("payment_date", fromDate).lte("payment_date", toDate).order("payment_date"),
    ]);
    if (invoiceResult.error || paymentResult.error) { setError("Ledger load nahi ho saka: " + (invoiceResult.error || paymentResult.error).message); setLoading(false); return; }
    const loadedInvoices = invoiceResult.data || [];
    setInvoices(loadedInvoices); setPayments(paymentResult.data || []);
    if (!loadedInvoices.length) { setItems([]); setProducts({}); setBatches({}); setLoading(false); return; }
    const invoiceIds = loadedInvoices.map((row) => row.id);
    const { data: itemData, error: itemError } = await supabase.from(itemTable).select(`id,${itemLink},product_id,batch_id,quantity,${supplier ? "purchase_rate" : "sale_rate"},discount,amount`).in(itemLink, invoiceIds);
    if (itemError) { setError("Ledger product detail load nahi ho saka: " + itemError.message); setLoading(false); return; }
    setItems(itemData || []);
    const productIds = [...new Set((itemData || []).map((row) => row.product_id).filter(Boolean))];
    const batchIds = [...new Set((itemData || []).map((row) => row.batch_id).filter(Boolean))];
    const [productResult, batchResult] = await Promise.all([
      productIds.length ? supabase.from("products").select("id,product_name,strength,pack_size").in("id", productIds) : Promise.resolve({ data: [] }),
      batchIds.length ? supabase.from("product_batches").select("id,batch_no").in("id", batchIds) : Promise.resolve({ data: [] }),
    ]);
    setProducts(Object.fromEntries((productResult.data || []).map((row) => [row.id, row])));
    setBatches(Object.fromEntries((batchResult.data || []).map((row) => [row.id, row])));
    setLoading(false);
  }

  const entries = useMemo(() => {
    const invoiceEntries = invoices.flatMap((invoice) => {
      const initial = Number(invoice[supplier ? "paid_amount" : "received_amount"] || 0);
      const date = invoice[supplier ? "invoice_date" : "sale_date"];
      return [{ id: `invoice-${invoice.id}`, date, type: "invoice", reference: invoice.invoice_no, narration: invoice.notes || labels.invoice, debit: Number(invoice.total_amount || 0), credit: 0, invoiceId: invoice.id }, ...(initial ? [{ id: `initial-${invoice.id}`, date, type: "payment", reference: invoice.invoice_no, narration: `${supplier ? "Payment sent to supplier" : "Payment received from customer"} at invoice - Cash`, debit: 0, credit: initial, invoiceId: invoice.id }] : [])];
    });
    const paymentEntries = payments.map((payment) => ({ id: `payment-${payment.id}`, date: payment.payment_date, type: "payment", reference: payment.reference_no || "Payment", narration: `${supplier ? "Payment sent to supplier" : "Payment received from customer"} - ${niceMethod(payment.payment_method)}${payment.notes ? ` - ${payment.notes}` : ""}`, debit: 0, credit: Number(payment.amount || 0), invoiceId: payment[supplier ? "purchase_id" : "sale_id"] }));
    let balance = 0;
    return [...invoiceEntries, ...paymentEntries].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id)).map((entry) => ({ ...entry, balance: (balance += entry.debit - entry.credit) }));
  }, [invoices, payments, supplier, labels.invoice, labels.payment, labels.direction]);
  const totals = entries.reduce((sum, entry) => ({ debit: sum.debit + entry.debit, credit: sum.credit + entry.credit }), { debit: 0, credit: 0 });
  const totalBalance = entries.length ? entries[entries.length - 1].balance : 0;
  const itemByInvoice = useMemo(() => items.reduce((map, item) => { const key = item[supplier ? "purchase_id" : "sale_id"]; (map[key] ||= []).push(item); return map; }, {}), [items, supplier]);

  async function addPayment(event) {
    event.preventDefault(); setMessage(""); setError("");
    if (!partyId || !Number(form.amount) || Number(form.amount) <= 0) { setError("Valid amount enter karein."); return; }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("User login nahi hai.");
      const row = { [supplier ? "supplier_id" : "customer_id"]: partyId, [supplier ? "purchase_id" : "sale_id"]: form.invoiceId || null, payment_date: form.date, amount: Number(form.amount), payment_method: form.method, reference_no: form.reference || null, notes: form.notes || null, created_by: auth.user.id };
      const { error: saveError } = await supabase.from(supplier ? "supplier_payments" : "customer_payments").insert(row);
      if (saveError) throw saveError;
      setMessage(`${labels.payment} saved: ${labels.direction}.`);
      setForm({ amount: "", date: today, method: "cash", reference: "", notes: "", invoiceId: "" });
      await loadLedger();
    } catch (saveError) { setError(`${labels.payment} save nahi ho saki: ${saveError.message}`); }
    finally { setSaving(false); }
  }

  return <main style={s.page}><style>{`.ledgerTable th{background:#0f9f8c;color:#fff;text-align:left;padding:9px 7px;font-size:12px;line-height:1.1}.ledgerTable td{padding:7px;vertical-align:top;overflow-wrap:anywhere;line-height:1.2}.ledgerTable th:nth-child(n+4),.ledgerTable td:nth-child(n+4){text-align:right}.ledgerTable th:nth-child(3),.ledgerTable td:nth-child(3){text-align:left}@page{size:A4 landscape;margin:8mm}@media print { .noPrint{display:none!important} .ledgerSheet{box-shadow:none!important;border:none!important;padding:0!important;margin:0!important;max-width:none!important;width:100%!important} .ledgerTable{min-width:0!important;width:100%!important;font-size:8px!important;table-layout:fixed!important}.ledgerTable th{padding:4px 3px!important;font-size:8px!important}.ledgerTable td{padding:3px!important;font-size:8px!important} body{background:#fff!important} }`}</style><div style={s.wrap} className="ledgerSheet">
    <header style={s.header} className="noPrint"><div><h1 style={s.title}>{labels.title}</h1><p style={s.sub}>Invoice-wise aur product-wise running balance.</p></div><div style={s.actions}><a href={labels.href} style={s.back}>Outstanding List</a><a href="/accounts" style={s.back}>Accounts</a></div></header>
    {error && <div style={s.error}>{error}<button onClick={partyId ? loadLedger : loadParties} style={s.retry}>Retry</button></div>}
    {message && <div style={s.success}>{message}</div>}
    <section style={s.card} className="noPrint"><div style={s.filterGrid}><label style={s.label}>Select {labels.singular}<input list="party-search" value={partySearch} onChange={(event) => chooseParty(event.target.value)} style={s.input} placeholder={`Type ${labels.singular} name, then select from list...`} disabled={loading}/><datalist id="party-search">{parties.map((party) => <option key={party.id} value={party.name} />)}</datalist></label><label style={s.label}>Starting Date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} style={s.input}/></label><label style={s.label}>Ending Date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} style={s.input}/></label><button type="button" onClick={loadLedger} style={s.load}>Load Ledger</button></div></section>
    {partyId && <>
      <section style={s.ledgerHeader}><div style={s.brand}><img src="/images/al-wahab-logo-transparent.png" alt="Al Wahab Enterprises" style={s.logo}/><div><h2 style={s.partyName}>{partyName}</h2><strong>{labels.title}</strong><p style={s.printSub}>Starting Date: {fromDate} &nbsp; | &nbsp; Ending Date: {toDate}</p></div></div><div style={s.balanceBox}><span>Outstanding Balance</span><strong>{money(totalBalance)}</strong><small>{supplier ? "Payable to supplier" : "Receivable from customer"}</small></div></section>
      <section style={s.card} className="noPrint"><h2 style={s.h2}>Record Payment</h2><p style={s.direction}><b>{labels.direction}</b> - is entry se ledger mein credit aur balance kam hoga.</p><form onSubmit={addPayment} style={s.filterGrid}><label style={s.label}>Amount *<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} style={s.input}/></label><label style={s.label}>Date *<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} style={s.input}/></label><label style={s.label}>Payment Method<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} style={s.input}>{["cash", "bank_transfer", "online_transfer", "cheque", "other"].map((method) => <option key={method} value={method}>{niceMethod(method)}</option>)}</select></label><label style={s.label}>Invoice (optional)<select value={form.invoiceId} onChange={(event) => setForm({ ...form, invoiceId: event.target.value })} style={s.input}><option value="">Whole party ledger</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_no} - {money(invoice.total_amount)}</option>)}</select></label><label style={s.label}>Reference / Cheque No.<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} style={s.input}/></label><label style={s.label}>Narration / Notes<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={s.input}/></label><button disabled={saving} style={s.save}>{saving ? "Saving..." : labels.direction}</button></form></section>
      <section style={s.card}><div style={s.tableHead}><div><h2 style={s.h2}>Detail Ledger</h2><p style={s.printSub}>Debit = invoice amount. Credit = {supplier ? "payment sent to supplier" : "payment received from customer"}.</p></div><div className="noPrint" style={s.actions}><label style={s.toggle}><input type="checkbox" checked={showProducts} onChange={(event) => setShowProducts(event.target.checked)}/> Product detail</label><button onClick={() => window.print()} style={s.print}>Print / Save PDF</button></div></div>
        {loading ? <p>Loading ledger...</p> : !entries.length ? <p style={s.muted}>Selected dates mein is party ki koi invoice ya payment nahi hai.</p> : <div style={s.scroll}><table style={s.table} className="ledgerTable"><colgroup><col style={{width:"9%"}}/><col style={{width:"11%"}}/><col style={{width:"27%"}}/><col style={{width:"8%"}}/><col style={{width:"6%"}}/><col style={{width:"8%"}}/><col style={{width:"10%"}}/><col style={{width:"10%"}}/><col style={{width:"11%"}}/></colgroup><thead><tr><th>Date</th><th>Voucher / Ref</th><th>Narration / Item</th><th>Batch</th><th>Qty</th><th>Rate</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{entries.map((entry) => <Fragment key={entry.id}><tr style={s.entryRow}><td>{entry.date}</td><td><b>{entry.type === "invoice" ? "INV" : "PAY"}</b><br/>{entry.reference || "-"}</td><td>{entry.type === "invoice" ? <><b>{labels.invoice}</b><br/><span style={s.note}>{entry.narration}</span></> : <span style={s.note}>{entry.narration}</span>}</td><td>-</td><td>-</td><td>-</td><td>{entry.debit ? money(entry.debit) : "-"}</td><td>{entry.credit ? money(entry.credit) : "-"}</td><td><b>{money(entry.balance)}</b></td></tr>{showProducts && entry.type === "invoice" && (itemByInvoice[entry.invoiceId] || []).map((item) => { const product = products[item.product_id]; return <tr key={`item-${item.id}`} style={s.itemRow}><td></td><td></td><td>↳ {product?.product_name || "Product"}{product?.strength ? ` ${product.strength}` : ""}{product?.pack_size ? ` (${product.pack_size})` : ""}</td><td>{batches[item.batch_id]?.batch_no || "-"}</td><td>{Number(item.quantity || 0).toLocaleString()}</td><td>{money(item[supplier ? "purchase_rate" : "sale_rate"])}</td><td></td><td></td><td></td></tr>; })}</Fragment>)}</tbody><tfoot><tr style={s.totalRow}><td colSpan="6">Total</td><td>{money(totals.debit)}</td><td>{money(totals.credit)}</td><td>{money(totalBalance)}</td></tr></tfoot></table></div>}
      </section>
    </>}
  </div></main>;
}

const s = {page:{minHeight:"100vh",background:"#f5f7fb",padding:"30px 16px",fontFamily:"Arial,Helvetica,sans-serif",color:"#172033"},wrap:{maxWidth:1320,margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:20,flexWrap:"wrap"},title:{margin:"0 0 6px",fontSize:30},sub:{margin:0,color:"#667085"},actions:{display:"flex",gap:10,flexWrap:"wrap"},back:{background:"#e8edf5",color:"#344054",textDecoration:"none",padding:"10px 15px",borderRadius:8,fontWeight:600},card:{background:"#fff",border:"1px solid #e4e7ec",borderRadius:14,padding:22,marginBottom:18,boxShadow:"0 2px 8px rgba(16,24,40,.04)"},filterGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:15,alignItems:"end"},ledgerHeader:{background:"#fff",border:"1px solid #e4e7ec",borderRadius:14,padding:22,marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",gap:20,flexWrap:"wrap"},brand:{display:"flex",alignItems:"center",gap:16},logo:{width:78,height:78,objectFit:"contain"},partyName:{margin:"0 0 6px",fontSize:26},balanceBox:{textAlign:"right",display:"grid",gap:5},h2:{margin:"0 0 8px",fontSize:20},printSub:{margin:"4px 0",color:"#667085",fontSize:13},direction:{margin:"0 0 16px",padding:10,borderRadius:8,background:"#eff6ff",color:"#1d4ed8"},label:{display:"block",fontSize:13,fontWeight:700},input:{width:"100%",boxSizing:"border-box",marginTop:7,padding:11,border:"1px solid #d0d5dd",borderRadius:8,background:"#fff",fontSize:14},load:{border:0,borderRadius:8,padding:"12px 16px",background:"#172033",color:"#fff",fontWeight:700,cursor:"pointer"},save:{border:0,borderRadius:8,padding:"12px 16px",background:"#16a34a",color:"#fff",fontWeight:700,cursor:"pointer"},print:{border:0,borderRadius:8,padding:"10px 14px",background:"#0f766e",color:"#fff",fontWeight:700,cursor:"pointer"},error:{background:"#fee2e2",color:"#991b1b",padding:14,borderRadius:8,marginBottom:18},success:{background:"#ecfdf3",color:"#067647",padding:14,borderRadius:8,marginBottom:18},retry:{marginLeft:12,border:0,borderRadius:6,padding:"6px 10px",background:"#991b1b",color:"#fff"},tableHead:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:12},toggle:{fontWeight:600,fontSize:13},scroll:{overflowX:"auto"},table:{width:"100%",tableLayout:"fixed",borderCollapse:"collapse",minWidth:1080,fontSize:13},entryRow:{borderTop:"1px solid #d0d5dd",background:"#f8fafc"},itemRow:{borderTop:"1px solid #eaecf0",color:"#475467"},totalRow:{borderTop:"2px solid #98a2b3",fontWeight:800},note:{fontSize:12,color:"#667085"},muted:{color:"#667085"}};
