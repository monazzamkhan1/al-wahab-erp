"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
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
    purchase_rate: "",
    sale_rate: "",
    min_stock: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setProducts(data || []);
    }

    setLoading(false);
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
      purchase_rate: "",
      sale_rate: "",
      min_stock: "",
    });

    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const productData = {
      product_code: form.product_code || null,
      product_name: form.product_name,
      generic_name: form.generic_name || null,
      dosage_form: form.dosage_form || null,
      strength: form.strength || null,
      pack_size: form.pack_size || null,
      category: form.category || null,
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
          : "Product added successfully."
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
      {/* Header */}
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

      {/* Back Button */}
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

      {/* Form */}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            {[
              ["product_code", "Product Code"],
              ["product_name", "Product Name"],
              ["generic_name", "Generic Name"],
              ["dosage_form", "Dosage Form"],
              ["strength", "Strength"],
              ["pack_size", "Pack Size"],
              ["category", "Category"],
              ["purchase_rate", "Purchase Rate"],
              ["sale_rate", "Sale Rate"],
              ["min_stock", "Minimum Stock"],
            ].map(([name, label]) => (
              <div key={name}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#374151",
                  }}
                >
                  {label}
                </label>

                <input
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  required={name === "product_name"}
                  type={
                    ["purchase_rate", "sale_rate", "min_stock"].includes(name)
                      ? "number"
                      : "text"
                  }
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: "11px",
                    border: "1px solid #d1d5db",
                    borderRadius: "7px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
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

      {/* Product List */}
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
          <h2 style={{ margin: 0 }}>Product List</h2>

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
                minWidth: "850px",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Product</th>
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
                      <strong>{product.product_name}</strong>
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
                      Rs. {Number(product.purchase_rate || 0).toFixed(2)}
                    </td>

                    <td style={tdStyle}>
                      Rs. {Number(product.sale_rate || 0).toFixed(2)}
                    </td>

                    <td style={tdStyle}>
                      <button
                        onClick={() => editProduct(product)}
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
                        onClick={() => deleteProduct(product.id)}
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
