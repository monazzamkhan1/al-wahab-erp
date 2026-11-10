"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const dosageForms = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Injection",
  "Infusion",
  "Cream",
  "Ointment",
  "Gel",
  "Lotion",
  "Drops",
  "Sachet",
  "Powder",
  "Inhaler",
  "Suppository",
  "Other",
];

const categories = [
  "Antibiotic",
  "Analgesic / Painkiller",
  "Antipyretic",
  "Antiallergic",
  "Gastro",
  "Cardiovascular",
  "Diabetic",
  "Vitamins & Supplements",
  "Dermatology",
  "Respiratory",
  "Neurology",
  "Gynecology",
  "Pediatric",
  "Other",
];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productSuppliers, setProductSuppliers] = useState({});
  const [downloading, setDownloading] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    product_code: "",
    product_name: "",
    generic_name: "",
    dosage_form: "",
    strength: "",
    pack_size: "",
    category: "",
    company_id: "",
    mrp: "",
    tp_discount_percent: "15",
    is_milk_formula: false,
    purchase_rate: "",
    sale_rate: "",
    min_stock: "",
    supplier_ids: [],
  });

  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [defaultTp, setDefaultTp] = useState("15");

  useEffect(() => {
    loadProducts();
    loadCompanies();
    loadGlobalSettings();
  }, []);

  async function loadGlobalSettings() {
    const { data, error } = await supabase.from("erp_settings").select("default_tp_discount_percent").eq("id", true).maybeSingle();
    if (error || !data) return;
    const value = String(data.default_tp_discount_percent ?? 15);
    setDefaultTp(value);
    setForm((current) => current.product_name || current.tp_discount_percent !== "15" ? current : { ...current, tp_discount_percent: value });
  }

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        companies!products_company_id_fkey (
          id,
          name,
          company_type
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setProducts(data || []);
      const { data: links, error: linkError } = await supabase.from("product_suppliers").select("product_id,supplier_id,companies!product_suppliers_supplier_id_fkey(name)");
      if (linkError) setMessage(`Product suppliers load nahi ho sake: ${linkError.message}`);
      else setProductSuppliers((links || []).reduce((map, link) => { (map[link.product_id] ||= []).push({ id: link.supplier_id, name: link.companies?.name || "Supplier" }); return map; }, {}));
    }

    setLoading(false);
  }

  async function loadCompanies() {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, company_type")
      .in("company_type", ["manufacturer", "both"])
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      setMessage(error.message);
    } else {
      setCompanies(data || []);
    }

    const { data: supplierData, error: supplierError } = await supabase.from("companies").select("id,name,company_type").in("company_type", ["supplier", "both"]).eq("is_active", true).order("name", { ascending: true });
    if (supplierError) setMessage(supplierError.message); else setSuppliers(supplierData || []);
  }

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function resetForm() {
    setForm({
      product_code: "",
      product_name: "",
      generic_name: "",
      dosage_form: "",
      strength: "",
      pack_size: "",
      category: "",
      company_id: "",
      mrp: "",
      tp_discount_percent: defaultTp,
      is_milk_formula: false,
      purchase_rate: "",
      sale_rate: "",
      min_stock: "",
      supplier_ids: [],
    });

    setEditingId(null);
    setSupplierSearch("");
    setSupplierOpen(false);
  }

  function generateProductCode() {
    const numbers = products
      .map((product) => {
        const code = product.product_code || "";
        const match = code.match(/^AW-(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
      .filter((number) => number > 0);

    const nextNumber =
      numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

    return `AW-${String(nextNumber).padStart(4, "0")}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const productCode =
      form.product_code.trim() || generateProductCode();

    const productData = {
      product_code: productCode,
      product_name: form.product_name,
      generic_name: form.generic_name || null,
      dosage_form: form.dosage_form || null,
      strength: form.strength || null,
      pack_size: form.pack_size || null,
      category: form.category || null,
      company_id: form.company_id || null,
      mrp: Number(form.mrp) || 0,
      tp_discount_percent: Number(form.tp_discount_percent) || 0,
      is_milk_formula: Boolean(form.is_milk_formula),
      purchase_rate: Number(form.purchase_rate) || 0,
      sale_rate: Number(form.sale_rate) || 0,
      min_stock: Number(form.min_stock) || 0,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingId)
        .select("id")
        .single();
    } else {
      result = await supabase
        .from("products")
        .insert([productData])
        .select("id")
        .single();
    }

    if (result.error) {
      setMessage(result.error.message);
    } else {
      const productId = result.data.id;
      const { error: removeSupplierError } = await supabase.from("product_suppliers").delete().eq("product_id", productId);
      if (removeSupplierError) { setMessage(`Product save ho gaya, lekin supplier update nahi ho saka: ${removeSupplierError.message}`); setSaving(false); return; }
      if (form.supplier_ids.length) {
        const { error: supplierSaveError } = await supabase.from("product_suppliers").insert(form.supplier_ids.map((supplierId) => ({ product_id: productId, supplier_id: supplierId })));
        if (supplierSaveError) { setMessage(`Product save ho gaya, lekin supplier update nahi ho saka: ${supplierSaveError.message}`); setSaving(false); return; }
      }
      setMessage(
        editingId
          ? "Product updated successfully."
          : `Product added successfully. Code: ${productCode}`
      );

      resetForm();
      await loadProducts();
    }

    setSaving(false);
  }

  function editProduct(product) {
    setEditingId(product.id);

    setForm({
      product_code: product.product_code || "",
      product_name: product.product_name || "",
      generic_name: product.generic_name || "",
      dosage_form: product.dosage_form || "",
      strength: product.strength || "",
      pack_size: product.pack_size || "",
      category: product.category || "",
      company_id: product.company_id || "",
      mrp: product.mrp || "",
      tp_discount_percent: product.tp_discount_percent ?? "15",
      is_milk_formula: Boolean(product.is_milk_formula),
      purchase_rate: product.purchase_rate || "",
      sale_rate: product.sale_rate || "",
      min_stock: product.min_stock || "",
      supplier_ids: (productSuppliers[product.id] || []).map((supplier) => supplier.id),
    });
    setSupplierSearch("");
    setSupplierOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function downloadProductPdf() {
    const target = document.querySelector(".productListPdf");
    if (!target || downloading) return;

    setDownloading(true);
    target.classList.add("exporting");

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const pdf = new jsPDF("l", "mm", "a4");
      const margin = 8;
      const width = 297 - margin * 2;
      const pageHeight = 210 - margin * 2;
      const height = (canvas.height * width) / canvas.width;
      const image = canvas.toDataURL("image/png");

      for (let offset = 0; offset < height; offset += pageHeight) {
        if (offset) pdf.addPage();
        pdf.addImage(image, "PNG", margin, margin - offset, width, height);
      }

      const suffix = search.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      pdf.save(`Al-Wahab-Product-List${suffix ? `-${suffix}` : ""}.pdf`);
    } catch (error) {
      setMessage(`Product PDF nahi ban saki: ${error.message}`);
    } finally {
      target.classList.remove("exporting");
      setDownloading(false);
    }
  }

  async function deleteProduct(id) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Product deleted successfully.");
      await loadProducts();
    }
  }

  const filteredProducts = products.filter((product) => {
    const text = `
      ${product.product_name || ""}
      ${product.product_code || ""}
      ${product.generic_name || ""}
      ${product.category || ""}
      ${product.companies?.name || ""}
      ${(productSuppliers[product.id] || []).map((supplier) => supplier.name).join(" ")}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  const matchingSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  function toggleSupplier(supplierId) {
    setForm((current) => ({
      ...current,
      supplier_ids: current.supplier_ids.includes(supplierId)
        ? current.supplier_ids.filter((id) => id !== supplierId)
        : [...current.supplier_ids, supplierId],
    }));
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#111827",
          color: "#fff",
          padding: "18px 20px",
          borderRadius: "10px",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ margin: 0 }}>💊 Products</h1>

        <p
          style={{
            margin: "6px 0 0",
            color: "#d1d5db",
            fontSize: "14px",
          }}
        >
          Al Wahab Enterprises - Product Master
        </p>
      </div>

      <a
        href="/"
        style={{
          display: "inline-block",
          marginBottom: "15px",
          padding: "10px 15px",
          background: "#fff",
          color: "#111827",
          textDecoration: "none",
          borderRadius: "7px",
          border: "1px solid #ddd",
          fontWeight: "bold",
        }}
      >
        ← Dashboard
      </a>

      <style>{`.productListPdf.exporting .productListControls { display: none !important; }`}</style>

      <section
        className="productListPdf"
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "10px",
          border: "1px solid #e5e7eb",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          {editingId ? "Edit Product" : "Add New Product"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            <div>
              <label style={labelStyle}>
                Product Code
              </label>

              <input
                name="product_code"
                value={form.product_code}
                onChange={handleChange}
                placeholder="Leave blank for automatic code"
                style={inputStyle}
              />

              <small style={{ color: "#6b7280" }}>
                Example: AW-0001
              </small>
            </div>

            <div>
              <label style={labelStyle}>
                Product Name *
              </label>

              <input
                name="product_name"
                value={form.product_name}
                onChange={handleChange}
                required
                placeholder="Enter product name"
                style={inputSt>Sale/TP</th>>Sale/TP</th>le}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Manufacturer / Principal
              </label>

              <select
                name="company_id"
                value={form.company_id}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">
                  Select Manufacturer / Principal
                </option>

                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              {companies.length === 0 && (
                <small
                  style={{
                    color: "#dc2626",
                    display: "block",
                    marginTop: "5px",
                  }}
                >
                  No Manufacturer/Principal added yet.
                </small>
              )}
            </div>

            <div style={{ gridColumn: "span 2", position: "relative" }}>
              <label style={labelStyle}>Supplier / Distributor</label>
              <div style={{ ...inputStyle, minHeight: 42, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "6px 8px" }}>
                {form.supplier_ids.map((id) => {
                  const supplier = suppliers.find((item) => item.id === id);
                  return supplier ? <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 700 }}>{supplier.name}<button type="button" onClick={() => toggleSupplier(id)} aria-label={`Remove ${supplier.name}`} style={{ border: 0, background: "transparent", color: "#1d4ed8", cursor: "pointer", fontWeight: 800, padding: 0 }}>×</button></span> : null;
                })}
                <input value={supplierSearch} onFocus={() => setSupplierOpen(true)} onBlur={() => setTimeout(() => setSupplierOpen(false), 150)} onChange={(event) => { setSupplierSearch(event.target.value); setSupplierOpen(true); }} placeholder={form.supplier_ids.length ? "Add another supplier..." : "Type supplier name or choose from list"} style={{ border: 0, outline: "none", flex: "1 1 180px", minWidth: 180, padding: "5px", fontSize: 14 }} />
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setSupplierOpen((open) => !open)} aria-label="Open supplier list" style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 18, color: "#475569" }}>⌄</button>
              </div>
              {supplierOpen && <div style={{ position: "absolute", zIndex: 30, top: 70, left: 0, right: 0, maxHeight: 230, overflowY: "auto", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 12px 26px rgba(15,23,42,.16)", padding: 5 }}>
                {matchingSuppliers.length ? matchingSuppliers.map((supplier) => <button key={supplier.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { toggleSupplier(supplier.id); setSupplierSearch(""); }} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 10, border: 0, background: form.supplier_ids.includes(supplier.id) ? "#eff6ff" : "#fff", color: "#172033", cursor: "pointer", padding: "9px 10px", borderRadius: 5, textAlign: "left" }}><span>{supplier.name}</span><span style={{ color: form.supplier_ids.includes(supplier.id) ? "#2563eb" : "#64748b", fontSize: 12 }}>{form.supplier_ids.includes(supplier.id) ? "Selected" : "Select"}</span></button>) : <p style={{ margin: "9px 10px", color: "#64748b", fontSize: 13 }}>No matching supplier.</p>}
              </div>}
              <small style={{ color: "#6b7280" }}>Ek product ke ek se zyada supplier select kar sakte hain.</small>
            </div>

            <div>
              <label style={labelStyle}>
                Generic Name
              </label>

              <input
                name="generic_name"
                value={form.generic_name}
                onChange={handleChange}
                placeholder="Enter generic name"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Dosage Form
              </label>

              <select
                name="dosage_form"
                value={form.dosage_form}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">
                  Select Dosage Form
                </option>

                {dosageForms.map((formName) => (
                  <option key={formName} value={formName}>
                    {formName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Strength
              </label>

              <input
                name="strength"
                value={form.strength}
                onChange={handleChange}
                placeholder="Example: 500mg"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Pack Size
              </label>

              <input
                name="pack_size"
                value={form.pack_size}
                onChange={handleChange}
                placeholder="Example: 10 Tablets"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Category
              </label>

              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">
                  Select Category
                </option>

                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>MRP</label>
              <input name="mrp" value={form.mrp} onChange={handleChange} type="number" step="0.01" min="0" placeholder="0.00" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>TP Discount %</label>
              <input name="tp_discount_percent" value={form.tp_discount_percent} onChange={handleChange} type="number" step="0.01" min="0" max="100" placeholder="15" style={inputStyle} />
              <small style={{ color: "#6b7280" }}>Normal 15%; milk formula 5.6%.</small>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "25px" }}>
              <input id="is_milk_formula" name="is_milk_formula" checked={form.is_milk_formula} onChange={(e) => setForm({ ...form, is_milk_formula: e.target.checked, tp_discount_percent: e.target.checked ? "5.6" : form.tp_discount_percent || "15" })} type="checkbox" />
              <label htmlFor="is_milk_formula" style={labelStyle}>Milk Formula</label>
            </div>

            <div>
              <label style={labelStyle}>
                Purchase Rate
              </label>

              <input
                name="purchase_rate"
                value={form.purchase_rate}
                onChange={handleChange}
                type="number"
                step="0.01"
                placeholder="0.00"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Sale Rate
              </label>

              <input
                name="sale_rate"
                value={form.sale_rate}
                onChange={handleChange}
                type="number"
                step="0.01"
                placeholder="0.00"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Minimum Stock
              </label>

              <input
                name="min_stock"
                value={form.min_stock}
                onChange={handleChange}
                type="number"
                step="0.01"
                placeholder="0"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "18px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "12px 20px",
                background: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: "7px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Product"
                : "Save Product"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: "12px 20px",
                  background: "#e5e7eb",
                  color: "#111827",
                  border: "none",
                  borderRadius: "7px",
                  cursor: "pointer",
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {message && (
          <p
            style={{
              marginTop: "15px",
              padding: "10px",
              background: "#f3f4f6",
              borderRadius: "6px",
            }}
          >
            {message}
          </p>
        )}
      </section>

      <section
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "10px",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "15px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Product List</h2>
            <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>
              Manufacturer aur purchase source ke saath product master
            </p>
          </div>

          <div className="productListControls" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, manufacturer or supplier..."
              style={{ padding: "10px", width: "290px", maxWidth: "100%", border: "1px solid #d1d5db", borderRadius: "7px" }}
            />
            <button onClick={downloadProductPdf} disabled={downloading || loading} style={{ padding: "10px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer" }}>
              {downloading ? "Preparing PDF..." : "Download PDF"}
            </button>
          </div>
        </div>

        {loading ? (
          <p>Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            No products found.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1120px",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Manufacturer</th>
                  <th style={thStyle}>Supplier / Distributor</th>
                  <th style={thStyle}>Generic</th>
                  <th style={thStyle}>Form</th>
                  <th style={thStyle}>Pack</th>
                  <th style={thStyle}>Purchase</th>
                  <th style={thStyle}>MRP</th>
                  <th style={thStyle}>TP Rule</th>
                  <th style={thStyle}>Sale</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td style={tdStyle}>
                      {product.product_code || "-"}
                    </td>

                    <td style={tdStyle}>
                      <strong>
                        {product.product_name}
                      </strong>
                    </td>

                    <td style={tdStyle}>
                      {product.companies?.name || "-"}
                    </td>

                    <td style={tdStyle}>
                      {(productSuppliers[product.id] || []).map((supplier) => supplier.name).join(", ") || "-"}
                    </td>

                    <td style={tdStyle}>
                      {product.generic_name || "-"}
                    </td>

                    <td style={tdStyle}>
                      {product.dosage_form || "-"}
                    </td>

                    <td style={tdStyle}>
                      {product.pack_size || "-"}
                    </td>

                    <td style={tdStyle}>
                      Rs.{" "}
                      {Number(
                        product.purchase_rate || 0
                      ).toFixed(2)}
                    </td>

                    <td style={tdStyle}>Rs. {Number(product.mrp || 0).toFixed(2)}</td>
                    <td style={tdStyle}>{Number(product.tp_discount_percent ?? 15).toFixed(2)}% off{product.is_milk_formula ? " (Milk)" : ""}</td>

                    <td style={tdStyle}>
                      Rs.{" "}
                      {Number(
                        product.sale_rate || 0
                      ).toFixed(2)}
                    </td>

                    <td style={tdStyle}>
                      <button
                        onClick={() =>
                          editProduct(product)
                        }
                        style={{
                          padding: "7px 10px",
                          marginRight: "5px",
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          borderRadius: "5px",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          deleteProduct(product.id)
                        }
                        style={{
                          padding: "7px 10px",
                          background: "#dc2626",
                          color: "#fff",
                          border: "none",
                          borderRadius: "5px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "#374151",
};

const inputStyle = {
  width: "100%",
  padding: "11px",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  boxSizing: "border-box",
  background: "#fff",
};

const thStyle = {
  padding: "12px",
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  fontSize: "13px",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #eee",
  fontSize: "14px",
};
