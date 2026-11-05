"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

const money = (value) => "Rs. " + Number(value || 0).toLocaleString("en-PK");
const dateText = (value) => {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return day && month && year ? day + "-" + month + "-" + year : value;
};

function SearchDropdown({ label, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const matches = options.filter((option) => option.toLowerCase().includes(value.toLowerCase())).slice(0, 12);
  return <label style={s.label} className="summarySelect">{label}<div className="summarySelectBox"><input value={value} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} placeholder={placeholder}/><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((shown) => !shown)}>⌄</button>{open && <div className="summaryOptions"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); setOpen(false); }}>All {label}s</button>{matches.length ? matches.map((option) => <button type="button" key={option} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option); setOpen(false); }}>{option}</button>) : <p>No matching {label.toLowerCase()}.</p>}</div>}</div></label>;
}

export default function SalesSummaryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    const [salesResult, itemsResult, productsResult, customersResult, batchesResult, suppliersResult, purchaseItemsResult, purchasesResult, returnsResult] = await Promise.all([
      supabase.from("sales").select("id,invoice_no,invoice_date,customer_id").order("invoice_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("sale_items").select("id,sale_id,product_id,batch_id,product_name_snapshot,batch_no_snapshot,quantity,bonus_quantity,sale_rate,discount,amount"),
      supabase.from("products").select("id,product_name,pack_size"),
      supabase.from("customers").select("id,name"),
      supabase.from("product_batches").select("id,batch_no"),
      supabase.from("companies").select("id,name").in("company_type", ["supplier", "both"]).order("name"),
      supabase.from("purchase_items").select("product_id,purchase_id"),
      supabase.from("purchases").select("id,supplier_id"),
      supabase.from("stock_returns").select("sale_item_id,quantity,return_amount"),
    ]);
    const firstError = [salesResult, itemsResult, productsResult, customersResult, batchesResult, suppliersResult, purchaseItemsResult, purchasesResult, returnsResult].find((result) => result.error)?.error;
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

    const returnsByItem = (returnsResult.data || []).reduce((map, row) => {
      if (!row.sale_item_id) return map;
      const current = map.get(row.sale_item_id) || { quantity: 0, amount: 0 };
      map.set(row.sale_item_id, { quantity: current.quantity + Number(row.quantity || 0), amount: current.amount + Number(row.return_amount || 0) });
      return map;
    }, new Map());
    setRows((itemsResult.data || []).map((item) => {
      const sale = salesById[item.sale_id] || {};
      const product = productsById[item.product_id] || {};
      const supplierNames = [...(suppliersByProduct[item.product_id] || [])].map((id) => suppliersById[id]).filter(Boolean);
      const returned = returnsByItem.get(item.id) || { quantity: 0, amount: 0 };
      return {
        id: item.id, date: sale.invoice_date, invoiceNo: sale.invoice_no || "-",
        customer: customersById[sale.customer_id] || "Customer",
        product: item.product_name_snapshot || product.product_name || "Product",
        pack: product.pack_size || "", batch: item.batch_no_snapshot || batchesById[item.batch_id] || "-",
        supplier: supplierNames.join(", ") || "-", quantity: Number(item.quantity || 0),
        bonus: Number(item.bonus_quantity || 0), rate: Number(item.sale_rate || 0),
        discount: Number(item.discount || 0), amount: Number(item.amount || 0), returnQuantity: returned.quantity, returnAmount: returned.amount,
      };
    }));
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    // Product choices display pack size in brackets, e.g. "Vitaferol - D3 Inj (1's)".
    // Match normalized words so brackets/apostrophes never make a valid selection blank.
    const includes = (value, search) => {
      const normalize = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return normalize(value).includes(normalize(search));
    };
    return rows.filter((row) =>
      (!customerSearch || includes(row.customer, customerSearch)) &&
      (!productSearch || includes(row.product + (row.pack ? " (" + row.pack + ")" : ""), productSearch)) &&
      (!supplierSearch || includes(row.supplier, supplierSearch)) &&
      (!batchSearch || includes(row.batch, batchSearch)) &&
      (!fromDate || row.date >= fromDate) &&
      (!toDate || row.date <= toDate)
    );
  }, [rows, customerSearch, productSearch, supplierSearch, batchSearch, fromDate, toDate]);

  const dropdownOptions = {
    customer: [...new Set(rows.map((row) => row.customer).filter(Boolean))].sort(),
    product: [...new Set(rows.map((row) => (row.product + (row.pack ? " (" + row.pack + ")" : "")).trim()).filter(Boolean))].sort(),
    supplier: [...new Set(rows.flatMap((row) => row.supplier.split(", ").filter((name) => name && name !== "-")))].sort(),
    batch: [...new Set(rows.map((row) => row.batch).filter((batch) => batch && batch !== "-"))].sort(),
  };

  const totals = filteredRows.reduce((sum, row) => ({ quantity: sum.quantity + row.quantity - row.returnQuantity, bonus: sum.bonus + row.bonus, amount: sum.amount + row.amount - row.returnAmount, returns: sum.returns + row.returnAmount }), { quantity: 0, bonus: 0, amount: 0, returns: 0 });

  async function downloadPdf() {
    const target = document.querySelector(".summaryPdf");
    if (!target || downloading) return;
    setDownloading(true);
    try {
      const tableWrap = target.querySelector(".summaryTableWrap");
      const original = {
        border: target.style.border,
        boxShadow: target.style.boxShadow,
        borderRadius: target.style.borderRadius,
        width: target.style.width,
        overflow: tableWrap?.style.overflow,
      };
      target.style.border = "none";
      target.style.boxShadow = "none";
      target.style.borderRadius = "0";
      target.style.width = "1450px";
      if (tableWrap) tableWrap.style.overflow = "visible";
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      target.style.border = original.border;
      target.style.boxShadow = original.boxShadow;
      target.style.borderRadius = original.borderRadius;
      target.style.width = original.width;
      if (tableWrap) tableWrap.style.overflow = original.overflow;
      const pdf = new jsPDF("l", "mm", "a4");
      const margin = 8;
      const pageWidth = 297 - (margin * 2);
      const pageHeight = 210 - (margin * 2);
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      const image = canvas.toDataURL("image/png");
      let renderedHeight = 0;
      while (renderedHeight < imageHeight) {
        if (renderedHeight > 0) pdf.addPage();
        pdf.addImage(image, "PNG", margin, margin - renderedHeight, pageWidth, imageHeight);
        renderedHeight += pageHeight;
      }
      pdf.save("Al-Wahab-Sales-Summary.pdf");
    } catch (downloadError) {
      setError("PDF download nahi ho saki: " + downloadError.message);
    } finally {
      const target = document.querySelector(".summaryPdf");
      if (target) {
        target.style.border = "";
        target.style.boxShadow = "";
        target.style.borderRadius = "";
        target.style.width = "";
        const tableWrap = target.querySelector(".summaryTableWrap");
        if (tableWrap) tableWrap.style.overflow = "";
      }
      setDownloading(false);
    }
  }

  return <main style={s.page}>
    <style>{".sales-summary input{width:100%;min-height:42px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:7px;padding:9px 11px;font-size:14px}.sales-summary input:focus{outline:2px solid #bfdbfe;border-color:#2563eb}.sales-summary .summarySelectBox{position:relative}.sales-summary .summarySelectBox>button{position:absolute;right:1px;top:1px;border:0;background:transparent;width:40px;height:40px;font-size:18px;color:#475467;cursor:pointer}.sales-summary .summarySelectBox input{padding-right:42px}.sales-summary .summaryOptions{position:absolute;z-index:20;top:calc(100% + 4px);left:0;right:0;max-height:245px;overflow:auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 22px rgba(15,23,42,.15);padding:4px}.sales-summary .summaryOptions button{display:block;width:100%;padding:9px 10px;border:0;border-radius:5px;background:#fff;text-align:left;color:#172033;cursor:pointer;font-size:14px}.sales-summary .summaryOptions button:hover{background:#eff6ff}.sales-summary .summaryOptions p{margin:9px 10px;color:#667085;font-size:13px;font-weight:400}.sales-summary th{background:#eaf0f8;color:#1e3a5f;padding:12px 10px;text-align:left;font-size:13px;white-space:nowrap;border-bottom:2px solid #cbd5e1}.sales-summary td{padding:12px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:13px;line-height:1.4}.sales-summary tbody tr:nth-child(even){background:#f8fafc}.sales-summary tbody tr:hover{background:#eff6ff}.sales-summary .number{text-align:right;white-space:nowrap;font-weight:600}"}</style>
    <div style={s.wrap} className="sales-summary">
      <header style={s.header}><div><h1 style={s.title}>Sales Summary</h1><p style={s.sub}>Product, supplier, customer aur batch-wise sale detail.</p></div><div style={s.actions}><button onClick={downloadPdf} disabled={downloading || loading} style={s.pdf}>{downloading ? "Preparing PDF..." : "Download PDF"}</button><a href="/sales/invoices" style={s.back}>← Sales Register</a><a href="/" style={s.back}>Dashboard</a></div></header>
      {error && <div style={s.error}>Summary load nahi ho saki: {error}<button onClick={load} style={s.retry}>Retry</button></div>}
      <section style={s.card}><div style={s.filters}>
        <SearchDropdown label="Customer" value={customerSearch} onChange={setCustomerSearch} options={dropdownOptions.customer} placeholder="Search customer" />
        <SearchDropdown label="Product" value={productSearch} onChange={setProductSearch} options={dropdownOptions.product} placeholder="Search product or pack" />
        <SearchDropdown label="Supplier" value={supplierSearch} onChange={setSupplierSearch} options={dropdownOptions.supplier} placeholder="Search supplier" />
        <SearchDropdown label="Batch" value={batchSearch} onChange={setBatchSearch} options={dropdownOptions.batch} placeholder="Search batch number" />
        <label style={s.label}>From Date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label style={s.label}>To Date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      </div><div style={s.summary}><div><span>Sale Lines</span><strong>{filteredRows.length}</strong></div><div><span>Net Qty</span><strong>{totals.quantity.toLocaleString()}</strong></div><div><span>Return Value</span><strong>{money(totals.returns)}</strong></div><div><span>Net Sale</span><strong>{money(totals.amount)}</strong></div></div></section>
      <section className="summaryPdf" style={s.card}><div style={s.pdfTitle}><div style={s.brand}><img src="/images/al-wahab-logo-transparent.png" alt="" style={s.logo}/><div style={s.brandText}><strong>Al Wahab Enterprises</strong><small>Pharmaceutical Distribution</small></div></div><div style={s.reportTitle}><strong>SALES SUMMARY</strong><small>{fromDate || toDate ? (fromDate || "Start") + " to " + (toDate || "Today") : "All sales records"}</small></div></div>{loading ? <p>Loading sale summary...</p> : !filteredRows.length ? <p style={s.muted}>Is filter mein koi sale item nahi mila.</p> : <div className="summaryTableWrap" style={s.scroll}><table style={s.table}><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Supplier</th><th>Product</th><th>Pack</th><th>Batch</th><th>Sold Qty</th><th>Return Qty</th><th>Net Qty</th><th>Rate</th><th>Gross</th><th>Return</th><th>Net Sale</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id}><td>{dateText(row.date)}</td><td><strong>{row.invoiceNo}</strong></td><td>{row.customer}</td><td>{row.supplier}</td><td>{row.product}</td><td>{row.pack || "-"}</td><td>{row.batch}</td><td className="number">{row.quantity.toLocaleString()}</td><td className="number">{row.returnQuantity.toLocaleString()}</td><td className="number">{(row.quantity-row.returnQuantity).toLocaleString()}</td><td className="number">{money(row.rate)}</td><td className="number">{money(row.amount)}</td><td className="number">{money(row.returnAmount)}</td><td className="number">{money(row.amount-row.returnAmount)}</td></tr>)}</tbody></table></div>}</section>
    </div>
  </main>;
}

const s = {
  page: { minHeight: "100vh", background: "#f5f7fb", padding: "30px 16px", fontFamily: "Arial,Helvetica,sans-serif", color: "#172033" },
  wrap: { maxWidth: 1450, margin: "0 auto" }, header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  title: { margin: "0 0 6px", fontSize: 30 }, sub: { margin: 0, color: "#667085" }, actions: { display: "flex", gap: 10, flexWrap: "wrap" },
  back: { background: "#e8edf5", color: "#344054", textDecoration: "none", padding: "10px 15px", borderRadius: 8, fontWeight: 700 },
  pdf: { border: 0, background: "#0f766e", color: "#fff", padding: "10px 15px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  card: { background: "#fff", border: "1px solid #e4e7ec", borderRadius: 14, padding: 22, marginBottom: 18 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#344054" },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginTop: 20 },
  scroll: { overflowX: "auto" }, table: { width: "100%", minWidth: 1560, borderCollapse: "collapse" },
  pdfTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginBottom: 18, paddingBottom: 12, borderBottom: "2px solid #0f172a", color: "#172033" },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandText: { display: "flex", flexDirection: "column", gap: 2, fontSize: 16 },
  reportTitle: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, fontSize: 16, letterSpacing: ".4px" },
  logo: { width: 46, height: 46, objectFit: "contain" },
  error: { background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 8, marginBottom: 18 },
  retry: { marginLeft: 12, border: 0, borderRadius: 6, padding: "6px 10px", background: "#991b1b", color: "#fff" }, muted: { color: "#667085" },
};
