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
    purchase_rate: "",
    sale_rate: "",
    min_stock: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
    loadCompanies();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        companies (
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
      purchase_rate: "",
      sale_rate: "",
      min_stock: "",
    });

    setEditingId(null);
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
      purchase_rate: Number(form.purchase_rate) || 0,
      sale_rate: Number(form.sale_rate) || 0,
      min_stock: Number(form.min_stock) || 0,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingId);
    } else {
      result = await supabase
        .from("products")
        .insert([productData]);
    }

    if (result.error) {
      setMessage(result.error.message);
    } else {
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
      purchase_rate: product.purchase_rate || "",
      sale_rate: product.sale_rate || "",
      min_stock: product.min_stock || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

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

      <section
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
                style={inputStyle}
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
          <h2 style={{ margin: 0 }}>
            Product List
          </h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product..."
            style={{
              padding: "10px",
              width: "240px",
              maxWidth: "100%",
              border: "1px solid #d1d5db",
              borderRadius: "7px",
            }}
          />
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
                minWidth: "1000px",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Manufacturer</th>
                  <th style={thStyle}>Generic</th>
                  <th style={thStyle}>Form</th>
                  <th style={thStyle}>Pack</th>
                  <th style={thStyle}>Purchase</th>
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
