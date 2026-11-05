"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const customerTypes = [
  "Hospital",
  "Clinic",
  "Medical Store",
  "Pharmacy",
  "Doctor",
  "Distributor",
  "Other",
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [commissionHolders, setCommissionHolders] = useState([]);
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
    commission_holder_id: "",
    commission_percent: "",
    commission_enabled_default: false,
    notes: "",
  });

  useEffect(() => {
    loadCustomers();
    loadCommissionHolders();
  }, []);

  async function loadCommissionHolders() {
    const { data, error } = await supabase.from("commission_holders").select("id, name").eq("is_active", true).order("name");
    if (error) {
      if (error.code !== "42P01") setMessage(error.message);
      return;
    }
    setCommissionHolders(data || []);
  }

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
      commission_holder_id: "",
      commission_percent: "",
      commission_enabled_default: false,
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
      commission_holder_id: form.commission_holder_id || null,
      commission_percent: Number(form.commission_percent) || 0,
      commission_enabled_default: Boolean(form.commission_enabled_default),
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
        : customer.customer_type === "medical store"
        ? "Medical Store"
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
      commission_holder_id: customer.commission_holder_id || "",
      commission_percent: customer.commission_percent || "",
      commission_enabled_default: Boolean(customer.commission_enabled_default),
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

    setMessage("");
    const [salesCheck, paymentsCheck] = await Promise.all([
      supabase.from("sales").select("id", { count: "exact", head: true }).eq("customer_id", id),
      supabase.from("customer_payments").select("id", { count: "exact", head: true }).eq("customer_id", id),
    ]);

    if (salesCheck.error || paymentsCheck.error) {
      setMessage(`Customer delete check nahi ho saka: ${(salesCheck.error || paymentsCheck.error).message}`);
      return;
    }

    if (Number(salesCheck.count || 0) || Number(paymentsCheck.count || 0)) {
      setMessage("Is customer ki sale ya payment history maujood hai, is liye accounting record safe rakhne ke liye delete nahi kiya ja sakta.");
      return;
    }

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

  function commissionLabel(customer) {
    const holder = commissionHolders.find((item) => item.id === customer.commission_holder_id);
    if (!holder || !Number(customer.commission_percent || 0)) return null;
    return `${holder.name} · ${Number(customer.commission_percent).toFixed(2)}% on TP`;
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
        background: "linear-gradient(135deg, #f3f7fc 0%, #f8fafc 55%, #edf7f3 100%)",
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "linear-gradient(110deg, #102f54, #0f766e)",
          color: "#fff",
          padding: "24px 26px",
          borderRadius: "16px",
          marginBottom: "20px",
          boxShadow: "0 12px 28px rgba(15, 54, 83, .16)",
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1.2px", color: "#bfe8dd" }}>CUSTOMER MASTER</span>
        <h1 style={{ margin: "7px 0 0", fontSize: "30px" }}>Customers</h1>

        <p
          style={{
            margin: "6px 0 0",
            color: "#d1d5db",
            fontSize: "14px",
          }}
        >
          Customer profiles, credit limits aur default commission settings manage karein.
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
          borderRadius: "9px",
          border: "1px solid #dbe5f0",
          fontWeight: "bold",
          boxShadow: "0 2px 5px rgba(15,23,42,.05)",
        }}
      >
        ← Dashboard
      </a>

      <section
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "16px",
          border: "1px solid #dce6f0",
          boxShadow: "0 8px 22px rgba(28,50,80,.05)",
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

            <div>
              <label style={labelStyle}>Commission Holder</label>
              <select name="commission_holder_id" value={form.commission_holder_id} onChange={handleChange} style={inputStyle}>
                <option value="">No commission holder</option>
                {commissionHolders.map((holder) => <option key={holder.id} value={holder.id}>{holder.name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Commission % (on TP)</label>
              <input name="commission_percent" value={form.commission_percent} onChange={handleChange} type="number" min="0" max="100" step="0.01" placeholder="Example: 10" style={inputStyle} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "27px" }}>
              <input id="commission_enabled_default" type="checkbox" checked={form.commission_enabled_default} onChange={(e) => setForm({ ...form, commission_enabled_default: e.target.checked })} />
              <label htmlFor="commission_enabled_default" style={labelStyle}>Apply commission by default</label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Address</label>

              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder={"One line per row — e.g.\nC/o Dr. Faheem Akbar Khan\nKacha Road, Kahna Nau\nLahore"}
                rows="4"
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
          borderRadius: "16px",
          border: "1px solid #dce6f0",
          boxShadow: "0 8px 22px rgba(28,50,80,.05)",
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
          <div><h2 style={{ margin: 0 }}>Customer List</h2><p style={{ margin: "5px 0 0", color: "#667085", fontSize: "14px" }}>{filteredCustomers.length} customer record{filteredCustomers.length === 1 ? "" : "s"} · commission setup is shown with holder and TP rate</p></div>

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
                <tr style={{ background: "#eaf0f8" }}>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Contact Person</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>City</th>
                  <th style={thStyle}>Credit Limit</th>
                  <th style={thStyle}>Commission Setup</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} style={{ background: "#fff" }}>
                    <td style={tdStyle}>
                      <strong style={{ color: "#172033" }}>{customer.name}</strong>
                      {customer.address && <div style={{ marginTop: "4px", color: "#667085", fontSize: "12px", lineHeight: 1.35 }}>{customer.address.split("\n")[0]}</div>}
                    </td>

                    <td style={tdStyle}><span style={{ ...badgeStyle, background: "#eef2ff", color: "#3730a3" }}>{displayType(customer.customer_type)}</span></td>

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
                      <strong>Rs. {Number(customer.credit_limit || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}</strong>
                    </td>

                    <td style={tdStyle}>
                      {commissionLabel(customer) ? <div><strong style={{ color: "#0f766e", fontSize: "13px" }}>{commissionLabel(customer)}</strong><div style={{ marginTop: "5px" }}><span style={{ ...badgeStyle, background: customer.commission_enabled_default ? "#dcfce7" : "#fef3c7", color: customer.commission_enabled_default ? "#166534" : "#92400e" }}>{customer.commission_enabled_default ? "Default on invoices" : "Optional on invoice"}</span></div></div> : <span style={{ color: "#98a2b3" }}>No commission configured</span>}
                    </td>

                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
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
  color: "#344054",
};

const inputStyle = {
  width: "100%",
  padding: "11px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  boxSizing: "border-box",
  background: "#fff",
};

const buttonStyle = {
  padding: "12px 20px",
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: "9px",
  cursor: "pointer",
  fontWeight: "bold",
};

const thStyle = {
  padding: "13px 12px",
  textAlign: "left",
  borderBottom: "2px solid #cbd5e1",
  fontSize: "13px",
  color: "#183b63",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "14px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: "14px",
  color: "#344054",
  verticalAlign: "middle",
};

const badgeStyle = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 700,
};
