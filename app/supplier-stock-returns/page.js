"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const optionStyle = { display: "block", width: "100%", border: 0, borderRadius: 5, background: "#fff", textAlign: "left", padding: "9px 10px", cursor: "pointer", fontSize: 14, color: "#172033" };

function SearchDropdown({ label, value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const matches = options.filter((option) => option.label.toLowerCase().includes(value.toLowerCase())).slice(0, 12);
  return <label style={s.label}>{label}<div style={{ position: "relative", marginTop: 7 }}><input value={value} disabled={disabled} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} placeholder={placeholder} style={{ ...s.input, marginTop: 0, paddingRight: 42 }}/><button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((shown) => !shown)} style={{ position: "absolute", right: 1, top: 1, width: 40, height: 40, border: 0, background: "transparent", fontSize: 18, cursor: "pointer" }}>⌄</button>{open && !disabled && <div style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "calc(100% + 4px)", maxHeight: 230, overflow: "auto", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 4, boxShadow: "0 10px 22px rgba(15,23,42,.15)" }}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); setOpen(false); }} style={optionStyle}>Clear selection</button>{matches.length ? matches.map((option) => <button type="button" key={option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.label); setOpen(false); }} style={optionStyle}>{option.label}</button>) : <p style={{ margin: 8, color: "#667085", fontSize: 13 }}>No matching option.</p>}</div>}</div></label>;
}

export default function SupplierStockReturnsPage() {
  const [suppliers, setSuppliers] = useState([]); const [products, setProducts] = useState([]); const [batches, setBatches] = useState([]); const [returns, setReturns] = useState([]); const [supplierBatchIds, setSupplierBatchIds] = useState([]); const [supplierProductIds, setSupplierProductIds] = useState([]);
  const [form, setForm] = useState({ supplierId: "", productId: "", batchId: "", quantity: "", date: new Date().toISOString().slice(0, 10), reference: "", notes: "" });
  const [supplierSearch, setSupplierSearch] = useState(""); const [productSearch, setProductSearch] = useState(""); const [batchSearch, setBatchSearch] = useState("");
  const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true); setMessage("");
    const [supplierResult, productResult, returnResult] = await Promise.all([
      supabase.from("companies").select("id,name").in("company_type", ["supplier", "both"]).order("name"),
      supabase.from("products").select("id,product_name,product_code,pack_size").eq("is_active", true).order("product_name"),
      supabase.from("supplier_stock_returns").select("id,supplier_id,product_id,batch_id,quantity,return_date,reference_no,notes").order("return_date", { ascending: false }).limit(50),
    ]);
    if (supplierResult.error || productResult.error || returnResult.error) setMessage("Supplier returns load nahi ho sake: " + (supplierResult.error || productResult.error || returnResult.error).message);
    else { setSuppliers(supplierResult.data || []); setProducts(productResult.data || []); setReturns(returnResult.data || []); }
    setLoading(false);
  }

  async function selectProduct(productId) {
    setForm({ ...form, productId, batchId: "" }); setBatchSearch("");
    if (!productId) { setBatches([]); return; }
    const { data, error } = await supabase.from("product_batches").select("id,batch_no,expiry_date,quantity").eq("product_id", productId).order("expiry_date");
    if (error) setMessage(error.message); else setBatches((data || []).filter((batch) => supplierBatchIds.includes(batch.id) && Number(batch.quantity || 0) > 0));
  }

  async function chooseSupplier(value) {
    const selectedSupplier = suppliers.find((supplier) => supplier.name === value);
    setSupplierSearch(value); setProductSearch(""); setBatchSearch(""); setBatches([]); setSupplierBatchIds([]); setSupplierProductIds([]);
    setForm((current) => ({ ...current, supplierId: selectedSupplier?.id || "", productId: "", batchId: "" }));
    if (!selectedSupplier) return;
    const { data: purchases, error: purchaseError } = await supabase.from("purchases").select("id").eq("supplier_id", selectedSupplier.id);
    if (purchaseError) { setMessage(purchaseError.message); return; }
    const purchaseIds = (purchases || []).map((purchase) => purchase.id);
    if (!purchaseIds.length) return;
    const { data: items, error: itemError } = await supabase.from("purchase_items").select("product_id,batch_id").in("purchase_id", purchaseIds);
    if (itemError) { setMessage(itemError.message); return; }
    setSupplierBatchIds([...new Set((items || []).map((item) => item.batch_id).filter(Boolean))]);
    setSupplierProductIds([...new Set((items || []).map((item) => item.product_id).filter(Boolean))]);
  }

  async function save(event) {
    event.preventDefault(); setMessage("");
    if (!form.supplierId || !form.productId || !form.batchId || !Number(form.quantity)) { setMessage("Supplier, product, batch aur quantity zaroori hain."); return; }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("User login nahi hai.");
      const { error } = await supabase.rpc("save_supplier_stock_return", { p_supplier_id: form.supplierId, p_product_id: form.productId, p_batch_id: form.batchId, p_quantity: Number(form.quantity), p_return_date: form.date, p_reference_no: form.reference, p_notes: form.notes, p_created_by: auth.user.id });
      if (error) throw error;
      setMessage("Supplier return save ho gaya aur stock selected batch se minus ho gaya.");
      setForm({ supplierId: "", productId: "", batchId: "", quantity: "", date: new Date().toISOString().slice(0, 10), reference: "", notes: "" }); setSupplierSearch(""); setProductSearch(""); setBatchSearch(""); setBatches([]);
      await loadData();
    } catch (saveError) { setMessage("Supplier return save nahi ho saka: " + saveError.message); }
    finally { setSaving(false); }
  }

  const productName = (id) => products.find((product) => product.id === id)?.product_name || "Product";
  const supplierName = (id) => suppliers.find((supplier) => supplier.id === id)?.name || "Supplier";
  const eligibleProducts = products.filter((product) => supplierProductIds.includes(product.id));

  return <main className="returnPage" style={s.page}><style>{returnPageCss}</style><div style={s.wrap}><header style={s.header}><div><span style={s.kicker}>INVENTORY CONTROL</span><h1 style={s.title}>Supplier Stock Returns</h1><p style={s.sub}>Supplier ko wapas bheja gaya stock selected batch se minus karein.</p></div><div style={s.actions}><a href="/stock-returns" style={s.back}>Customer Returns</a><a href="/stock" style={s.back}>← Stock</a><a href="/" style={s.dashboard}>Dashboard</a></div></header>{message && <div style={s.message}>{message}</div>}
    <section style={s.card}><div style={s.cardHead}><div><h2 style={s.h2}>New Supplier Return</h2><p style={s.cardSub}>Supplier se related available batch select karein; selected quantity stock se minus hogi.</p></div></div><p style={s.notice}>Yeh entry stock ko selected batch se kam karegi. Supplier select karna zaroori hai.</p><form onSubmit={save} style={s.grid}>
      <SearchDropdown label="Supplier *" value={supplierSearch} onChange={chooseSupplier} options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))} placeholder="Type supplier name" />
      <SearchDropdown label="Product *" value={productSearch} onChange={(value) => { setProductSearch(value); const product = eligibleProducts.find((row) => (row.product_name + (row.pack_size ? " (" + row.pack_size + ")" : "")) === value); selectProduct(product?.id || ""); }} options={eligibleProducts.map((product) => ({ value: product.id, label: product.product_name + (product.pack_size ? " (" + product.pack_size + ")" : "") }))} placeholder={form.supplierId ? "Type product name or pack" : "Select supplier first"} disabled={!form.supplierId} />
      <SearchDropdown label="Batch *" value={batchSearch} onChange={(value) => { setBatchSearch(value); setForm({ ...form, batchId: batches.find((batch) => (batch.batch_no + " · Available " + Number(batch.quantity).toLocaleString()) === value)?.id || "" }); }} options={batches.map((batch) => ({ value: batch.id, label: batch.batch_no + " · Available " + Number(batch.quantity).toLocaleString() }))} placeholder="Type or select batch" disabled={!form.productId} />
      <label style={s.label}>Return Quantity *<input required min="1" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} style={s.input}/></label>
      <label style={s.label}>Return Date *<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} style={s.input}/></label>
      <label style={s.label}>Supplier Credit / Reference<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} style={s.input} placeholder="Optional"/></label>
      <label style={s.label}>Reason / Notes<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={s.input} placeholder="Expiry, damage, wrong item etc."/></label>
      <button disabled={saving} style={s.save}>{saving ? "Saving..." : "Save Return & Reduce Stock"}</button>
    </form></section>
    <section style={s.card}><div style={s.cardHead}><div><h2 style={s.h2}>Recent Supplier Returns</h2><p style={s.cardSub}>Latest stock sent back to suppliers.</p></div></div>{loading ? <p>Loading...</p> : !returns.length ? <p style={s.sub}>Abhi koi supplier return record nahi hai.</p> : <div style={s.scroll}><table className="returnTable" style={s.table}><thead><tr><th>Date</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Reference</th><th>Notes</th></tr></thead><tbody>{returns.map((row) => <tr key={row.id}><td>{row.return_date}</td><td>{supplierName(row.supplier_id)}</td><td>{productName(row.product_id)}</td><td><strong>{row.quantity}</strong></td><td>{row.reference_no || "-"}</td><td>{row.notes || "-"}</td></tr>)}</tbody></table></div>}</section>
  </div></main>;
}

const returnPageCss = `.returnPage .returnTable th{background:#e9f0f8;color:#183b63;padding:12px 10px;text-align:left;border-bottom:2px solid #bfd1e5;font-size:13px;white-space:nowrap}.returnPage .returnTable td{padding:12px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:14px;line-height:1.4}.returnPage .returnTable tbody tr:nth-child(even){background:#f8fafc}.returnPage .returnTable tbody tr:hover{background:#fff4ed}`;
const s = { page:{minHeight:"100vh",background:"linear-gradient(135deg,#f3f7fc 0%,#f8fafc 55%,#fff5ee 100%)",padding:"34px 16px",fontFamily:"Arial,Helvetica,sans-serif",color:"#172033"},wrap:{maxWidth:1200,margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,marginBottom:22,flexWrap:"wrap"},actions:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},kicker:{display:"inline-block",marginBottom:8,color:"#c2410c",fontSize:11,fontWeight:800,letterSpacing:1.1},title:{margin:"0 0 7px",fontSize:32,letterSpacing:"-.5px"},sub:{margin:0,color:"#667085",lineHeight:1.55},back:{background:"#fff",border:"1px solid #dbe5f0",boxShadow:"0 1px 2px rgba(16,24,40,.04)",color:"#344054",textDecoration:"none",padding:"10px 15px",borderRadius:9,fontWeight:700},dashboard:{background:"#173b68",boxShadow:"0 6px 14px rgba(23,59,104,.18)",color:"#fff",textDecoration:"none",padding:"10px 17px",borderRadius:9,fontWeight:700},card:{background:"rgba(255,255,255,.96)",border:"1px solid #dce6f0",boxShadow:"0 8px 24px rgba(30,55,90,.05)",borderRadius:16,padding:24,marginBottom:20},cardHead:{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",paddingBottom:15,marginBottom:14,borderBottom:"1px solid #edf1f5"},h2:{margin:0,fontSize:20},cardSub:{margin:"5px 0 0",color:"#667085",fontSize:14},notice:{margin:"0 0 18px",padding:"11px 12px",borderRadius:9,background:"#fff7ed",color:"#9a3412",fontSize:13},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:16,alignItems:"end"},label:{display:"block",fontSize:13,fontWeight:700,color:"#344054"},input:{width:"100%",boxSizing:"border-box",marginTop:7,padding:11,border:"1px solid #cbd5e1",borderRadius:9,background:"#fff",fontSize:14},save:{border:0,borderRadius:9,padding:"12px 17px",background:"#dc2626",boxShadow:"0 5px 12px rgba(220,38,38,.18)",color:"#fff",fontWeight:800,cursor:"pointer"},message:{background:"#fff8df",border:"1px solid #f5d66c",color:"#92400e",padding:14,borderRadius:10,marginBottom:18},scroll:{overflowX:"auto"},table:{width:"100%",minWidth:760,borderCollapse:"separate",borderSpacing:0} };
