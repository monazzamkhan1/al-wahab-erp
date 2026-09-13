"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const companyTypes = [
  "Manufacturer / Principal",
  "Distributor / Supplier",
  "Both",
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    company_type: "Manufacturer / Principal",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    tax_number: "",
    notes: "",
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    setLoading(true);

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setCompanies(data || []);
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
      name: "",
      company_type: "Manufacturer / Principal",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      tax_number: "",
      notes: "",
    });

    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const companyData = {
      name: form.name.trim(),
      company_type:
        form.company_type === "Manufacturer / Principal"
          ? "manufacturer"
          : form.company_type === "Distributor / Supplier"
          ? "supplier"
          : "both",
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      tax_number: form.tax_number || null,
      notes: form.notes || null,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from("companies")
        .update(companyData)
        .eq("id", editingId);
    } else {
      result = await supabase
        .from("companies")
        .insert([companyData]);
    }

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage(
        editingId
          ? "Company updated successfully."
          : "Company added successfully."
      );

      resetForm();
      await loadCompanies();
    }

    setSaving(false);
  }

  function editCompany(company) {
    setEditingId(company.id);

    let type = "Manufacturer / Principal";

    if (company.company_type === "supplier") {
      type = "Distributor / Supplier";
    }

    if (company.company_type === "both") {
      type = "Both";
    }

    setForm({
      name: company.name || "",
      company_type: type,
      contact_person: company.contact_person || "",
      phone: company.phone || "",
      email: company.email || "",
      address: company.address || "",
      tax_number: company.tax_number || "",
      notes: company.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteCompany(id) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this company?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Company deleted successfully.");
      await loadCompanies();
    }
  }

  function displayType(type) {
    if (type === "manufacturer") {
      return "Manufacturer / Principal";
    }

    if (type === "supplier") {
      return "Distributor / Supplier";
    }

    if (type === "both") {
      return "Both";
    }

    return type || "-";
  }

  const filteredCompanies = companies.filter((company) => {
    const text = `
      ${company.name || ""}
      ${company.contact_person || ""}
      ${company.phone || ""}
      ${displayType(company.company_type)}
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
        <h1 style={{ margin: 0 }}>
          🏭 Companies & Suppliers
        </h1>

        <p
          style={{
            margin: "6px 0 0",
            color: "#d1d5db",
            fontSize: "14px",
          }}
        >
          Manufacturer, Principal & Supplier Master
        </p>
      </div>

      {/* Dashboard */}
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
          {editingId
            ? "Edit Company"
            : "Add Company / Supplier"}
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
                Company Name *
              </label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Example: Medicraft Pharmaceuticals"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Company Type *
              </label>

              <select
                name="company_type"
                value={form.company_type}
                onChange={handleChange}
                style={inputStyle}
              >
                {companyTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Contact Person
              </label>

              <input
                name="contact_person"
                value={form.contact_person}
                onChange={handleChange}
                placeholder="Contact person"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Phone
              </label>

              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone number"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Email
              </label>

              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Tax Number
              </label>

              <input
                name="tax_number"
                value={form.tax_number}
                onChange={handleChange}
                placeholder="NTN / Tax Number"
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                Address
              </label>

              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Company address"
                rows="3"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                Notes
              </label>

              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Additional notes"
                rows="3"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
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
              style={buttonStyle}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Company"
                : "Save Company"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  ...buttonStyle,
                  background: "#e5e7eb",
                  color: "#111827",
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

      {/* Company List */}
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
            Company List
          </h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company..."
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
          <p>Loading companies...</p>
        ) : filteredCompanies.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            No companies found.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "800px",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Contact Person</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCompanies.map((company) => (
                  <tr key={company.id}>
                    <td style={tdStyle}>
                      <strong>{company.name}</strong>
                    </td>

                    <td style={tdStyle}>
                      {displayType(company.company_type)}
                    </td>

                    <td style={tdStyle}>
                      {company.contact_person || "-"}
                    </td>

                    <td style={tdStyle}>
                      {company.phone || "-"}
                    </td>

                    <td style={tdStyle}>
                      {company.email || "-"}
                    </td>

                    <td style={tdStyle}>
                      <button
                        onClick={() =>
                          editCompany(company)
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
                          deleteCompany(company.id)
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

const buttonStyle = {
  padding: "12px 20px",
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: "7px",
  cursor: "pointer",
  fontWeight: "bold",
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
