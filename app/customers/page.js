"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const customerTypes = [
  "Hospital",
  "Clinic",
  "Pharmacy",
  "Doctor",
  "Distributor",
  "Other",
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    customer_type: "Hospital",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    credit_limit: "",
    notes: "",
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setCustomers(data || []);
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
      customer_type: "Hospital",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      credit_limit: "",
      notes: "",
    });

    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const customerData = {
      name: form.name.trim(),
      customer_type: form.customer_type.toLowerCase(),
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      credit_limit: Number(form.credit_limit) || 0,
      notes: form.notes || null,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from("customers")
        .update(customerData)
        .eq("id", editingId);
    } else {
      result = await supabase
        .from("customers")
        .insert([customerData]);
    }

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage(
        editingId
          ? "Customer updated successfully."
          : "Customer added successfully."
      );

      resetForm();
      await loadCustomers();
    }

    setSaving(false);
  }

  function editCustomer(customer) {
    setEditingId(customer.id);

    const type =
      customer.customer_type === "hospital"
        ? "Hospital"
        : customer.customer_type === "clinic"
        ? "Clinic"
        : customer.customer_type === "pharmacy"
        ? "Pharmacy"
        : customer.customer_type === "doctor"
        ? "Doctor"
        : customer.customer_type === "distributor"
        ? "Distributor"
        : "Other";

    setForm({
      name: customer.name || "",
      customer_type: type,
      contact_person: customer.contact_person || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      city: customer.city || "",
      credit_limit: customer.credit_limit || "",
      notes: customer.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteCustomer(id) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this customer?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Customer deleted successfully.");
      await loadCustomers();
    }
  }

  function displayType(type) {
    if (!type) return "-";

    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  const filteredCustomers = customers.filter((customer) => {
    const text = `
      ${customer.name || ""}
      ${customer.customer_type || ""}
      ${customer.contact_person || ""}
      ${customer.phone || ""}
      ${customer.city || ""}
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
        <h1 style={{ margin: 0 }}>🏥 Customers</h1>

        <p
          style={{
            margin: "6px 0 0",
            color: "#d1d5db",
            fontSize: "14px",
          }}
        >
          Hospital, Clinic, Pharmacy, Doctor & Customer Master
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
          {editingId ? "Edit Customer" : "Add New Customer"}
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
              <label style={labelStyle}>Customer Name *</label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Example: Social Security Hospital"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Customer Type *</label>

              <select
                name="customer_type"
                value={form.customer_type}
                onChange={handleChange}
                style={inputStyle}
              >
                {customerTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Contact Person</label>

              <input
                name="contact_person"
                value={form.contact_person}
                onChange={handleChange}
                placeholder="Contact person"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone</label>

              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone number"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>

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
              <label style={labelStyle}>City</label>

              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Example: Lahore"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Credit Limit</label>

              <input
                name="credit_limit"
                value={form.credit_limit}
                onChange={handleChange}
                type="number"
                step="0.01"
                placeholder="0.00"
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Address</label>

              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Customer address"
                rows="3"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Notes</label>

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
                ? "Update Customer"
                : "Save Customer"}
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
          <h2 style={{ margin: 0 }}>Customer List</h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer..."
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
          <p>Loading customers...</p>
        ) : filteredCustomers.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            No customers found.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "900px",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Contact Person</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>City</th>
                  <th style={thStyle}>Credit Limit</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td style={tdStyle}>
                      <strong>{customer.name}</strong>
                    </td>

                    <td style={tdStyle}>
                      {displayType(customer.customer_type)}
                    </td>

                    <td style={tdStyle}>
                      {customer.contact_person || "-"}
                    </td>

                    <td style={tdStyle}>
                      {customer.phone || "-"}
                    </td>

                    <td style={tdStyle}>
                      {customer.city || "-"}
                    </td>

                    <td style={tdStyle}>
                      Rs.{" "}
                      {Number(
                        customer.credit_limit || 0
                      ).toFixed(2)}
                    </td>

                    <td style={tdStyle}>
                      <button
                        onClick={() =>
                          editCustomer(customer)
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
                          deleteCustomer(customer.id)
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
