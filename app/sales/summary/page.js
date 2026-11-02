"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

const money = (value) => "Rs. " + Number(value || 0).toLocaleString("en-PK");
const dateText = (value) => {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return day && month && year ? day + "-" + month + "-" + year : value;
};

export default function SalesSummaryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    const [salesResult, itemsResult, productsResult, customersResult, batchesResult, suppliersResult, purchaseItemsResult, purchasesResult] = await Promise.all([
      supabase.from("sales").select("id,invoice_no,invoice_date,customer_id").order("invoice_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("sale_items").select("id,sale_id,product_id,batch_id,product_name_snapshot,batch_no_snapshot,quantity,bonus_quantity,sale_rate,discount,amount"),
      supabase.from("products").select("id,product_name,pack_size"),
      supabase.from("customers").select("id,name"),
      supabase.from("product_batches").select("id,batch_no"),
      supabase.from("companies").select("id,name").in("company_type", ["supplier", "both"]).order("name"),
      supabase.from("purchase_items").select("product_id,purchase_id"),
      supabase.from("purchases").select("id,supplier_id"),
    ]);
    const firstError = [salesResult, itemsResult, productsResult, customersResult, batchesResult, suppliersResult, purchaseItemsResult, purchasesResult].find((result) => result.error)?.error;
    if (firstError) { setError(firstError.message); setLoading(false); return; }

    const salesById = Object.fromEntries((salesResult.data || []).map((sale) => [sale.id, sale]));
    const productsById = Object.fromEntries((productsResult.data || []).map((product) => [product.id, product]));
    const customersById = Object.fromEntries((customersResult.data || []).map((customer) => [customer.id, customer.name]));
    const batchesById = Object.fromEntries((batchesResult.data || []).map((batch) => [batch.id, batch.batch_no]));
    const suppliersById = Object.fromEntries((suppliersResult.data || []).map((supplier) => [supplier.id, supplier.name]));
    const purchaseSupplierById = Object.fromEntries((purchasesResult.data || []).map((purchase) => [purchase.id, purchase.supplier_id]));
    const suppliersByProduct = (purchaseItemsResult.data || []).reduce((map, item) => {
      const supplierId = purchaseSupplierById[item.purchase_id];
      if (supplierId) (map[item.product_id] ||= new Set()).add(supplierId);
      return map;
    }, {});

    setRows((itemsResult.data || []).map((item) => {
      const sale = salesById[item.sale_id] || {};
      const product = productsById[item.product_id] || {};
      const supplierNames = [...(suppliersByProduct[item.product_id] || [])].map((id) => suppliersById[id]).filter(Boolean);
      return {
        id: item.id, date: sale.invoice_date, invoiceNo: sale.invoice_no || "-",
        customer: customersById[sale.customer_id] || "Customer",
        product: item.product_name_snapshot || product.product_name || "Product",
        pack: product.pack_size || "", batch: item.batch_no_snapshot || batchesById[item.batch_id] || "-",
        supplier: supplierNames.join(", ") || "-", quantity: Number(item.quantity || 0),
        bonus: Number(item.bonus_quantity || 0), rate: Number(item.sale_rate || 0),
        discount: Number(item.discount || 0), amount: Number(item.amount || 0),
      };
    }));
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    const includes = (value, search) => String(value || "").toLowerCase().includes(search.trim().toLowerCase());
    return rows.filter((row) =>
      (!customerSearch || includes(row.customer, customerSearch)) &&
      (!productSearch || includes(row.product + " " + row.pack, productSearch)) &&
      (!supplierSearch || includes(row.supplier, supplierSearch)) &&
      (!batchSearch || includes(row.batch, batchSearch))
    );
  }, [rows, customerSearch, productSearch, supplierSearch, batchSearch]);

  const totals = filteredRows.reduce((sum, row) => ({ quantity: sum.quantity + row.quantity, bonus: sum.bonus + row.bonus, amount: sum.amount + row.amount }), { quantity: 0, bonus: 0, amount: 0 });

  return <main style={s.page}>
    <style>{".sales-summary input{width:100%;min-height:42px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:7px;padding:9px 11px;font-size:14px}.sales-summary input:focus{outline:2px solid #bfdbfe;border-color:#2563eb}.sales-summary th{background:#eaf0f8;color:#1e3a5f;padding:12px 10px;text-align:left;font-size:13px;white-space:nowrap;border-bottom:2px solid #cbd5e1}.sales-summary td{padding:12px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:13px;line-height:1.4}.sales-summary tbody tr:nth-child(even){background:#f8fafc}.sales-summary tbody tr:hover{background:#eff6ff}.sales-summary .number{text-align:right;white-space:nowrap;font-weight:600}"}</style>
    <div style={s.wrap} className="sales-summary">
      <header style={s.header}><div><h1 style={s.title}>Sales Summary</h1><p style={s.sub}>Product, supplier, customer aur batch-wise sale detail.</p></div><div style={s.actions}><a href="/sales/invoices" style={s.back}>← Sales Register</a><a href="/" style={s.back}>Dashboard</a></div></header>
      {error && <div style={s.error}>Summary load nahi ho saki: {error}<button onClick={load} style={s.retry}>Retry</button></div>}
      <section style={s.card}><div style={s.filters}>
        <label style={s.label}>Customer<input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customer" /></label>
        <label style={s.label}>Product<input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search product or pack" /></label>
        <label style={s.label}>Supplier<input value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Search supplier" /></label>
        <label style={s.label}>Batch<input value={batchSearch} onChange={(event) => setBatchSearch(event.target.value)} placeholder="Search batch number" /></label>
      </div><div style={s.summary}><div><span>Sale Lines</span><strong>{filteredRows.length}</strong></div><div><span>Total Qty</span><strong>{totals.quantity.toLocaleString()}</strong></div><div><span>Bonus</span><strong>{totals.bonus.toLocaleString()}</strong></div><div><span>Sale Amount</span><strong>{money(totals.amount)}</strong></div></div></section>
      <section style={s.card}>{loading ? <p>Loading sale summary...</p> : !filteredRows.length ? <p style={s.muted}>Is filter mein koi sale item nahi mila.</p> : <div style={s.scroll}><table style={s.table}><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Supplier</th><th>Product</th><th>Pack</th><th>Batch</th><th>Qty</th><th>Bonus</th><th>Rate</th><th>Discount</th><th>Amount</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id}><td>{dateText(row.date)}</td><td><strong>{row.invoiceNo}</strong></td><td>{row.customer}</td><td>{row.supplier}</td><td>{row.product}</td><td>{row.pack || "-"}</td><td>{row.batch}</td><td className="number">{row.quantity.toLocaleString()}</td><td className="number">{row.bonus.toLocaleString()}</td><td className="number">{money(row.rate)}</td><td className="number">{money(row.discount)}</td><td className="number">{money(row.amount)}</td></tr>)}</tbody></table></div>}</section>
    </div>
  </main>;
}

const s = {
  page: { minHeight: "100vh", background: "#f5f7fb", padding: "30px 16px", fontFamily: "Arial,Helvetica,sans-serif", color: "#172033" },
  wrap: { maxWidth: 1450, margin: "0 auto" }, header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  title: { margin: "0 0 6px", fontSize: 30 }, sub: { margin: 0, color: "#667085" }, actions: { display: "flex", gap: 10, flexWrap: "wrap" },
  back: { background: "#e8edf5", color: "#344054", textDecoration: "none", padding: "10px 15px", borderRadius: 8, fontWeight: 700 },
  card: { background: "#fff", border: "1px solid #e4e7ec", borderRadius: 14, padding: 22, marginBottom: 18 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#344054" },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginTop: 20 },
  scroll: { overflowX: "auto" }, table: { width: "100%", minWidth: 1300, borderCollapse: "collapse" },
  error: { background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 8, marginBottom: 18 },
  retry: { marginLeft: 12, border: 0, borderRadius: 6, padding: "6px 10px", background: "#991b1b", color: "#fff" }, muted: { color: "#667085" },
};
