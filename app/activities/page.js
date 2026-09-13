"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const activityTypes = [
  ["marketing", "Marketing"],
  ["promotional", "Promotional"],
  ["event", "Event"],
  ["meeting", "Meeting"],
  ["professional_service", "Professional Service"],
  ["other", "Other"],
];

const statuses = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

export default function ActivitiesPage() {
  const [customers, setCustomers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    customer_id: "",
    activity_type: "marketing",
    title: "",
    start_date: "",
    end_date: "",
    approved_budget: "",
    target_sales: "",
    actual_expense: "",
    approval_status: "pending",
    payment_reference: "",
    supporting_document: "",
    notes: "",
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadCustomers();
    loadActivities();
  }, []);

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, customer_type")
      .in("customer_type", ["doctor", "clinic"])
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setCustomers(data || []);
  }

  async function loadActivities() {
    setLoading(true);

    const { data, error } = await supabase
      .from("activities")
      .select(`
        *,
        customers (
          id,
          name,
          customer_type
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Activities load nahi ho sakin: " + error.message);
    } else {
      setActivities(data || []);
    }

    setLoading(false);
  }

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function saveActivity(e) {
    e.preventDefault();

    if (!form.customer_id) {
      alert("Doctor / Clinic select karein.");
      return;
    }

    if (!form.title.trim()) {
      alert("Activity title enter karein.");
      return;
    }

    setSaving(true);

    const payload = {
      customer_id: form.customer_id,
      activity_type: form.activity_type,
      title: form.title.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      approved_budget: Number(form.approved_budget || 0),
      target_sales: Number(form.target_sales || 0),
      actual_expense: Number(form.actual_expense || 0),
      approval_status: form.approval_status,
      payment_reference: form.payment_reference.trim() || null,
      supporting_document: form.supporting_document.trim() || null,
      notes: form.notes.trim() || null,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from("activities")
        .update(payload)
        .eq("id", editingId);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      payload.created_by = user?.id || null;

      result = await supabase
        .from("activities")
        .insert([payload]);
    }

    if (result.error) {
      alert("Save error: " + result.error.message);
    } else {
      alert(editingId ? "Activity update ho gayi." : "Activity create ho gayi.");

      setForm(emptyForm);
      setEditingId(null);
      loadActivities();
    }

    setSaving(false);
  }

  function editActivity(activity) {
    setEditingId(activity.id);

    setForm({
      customer_id: activity.customer_id || "",
      activity_type: activity.activity_type || "marketing",
      title: activity.title || "",
      start_date: activity.start_date || "",
      end_date: activity.end_date || "",
      approved_budget: activity.approved_budget || "",
      target_sales: activity.target_sales || "",
      actual_expense: activity.actual_expense || "",
      approval_status: activity.approval_status || "pending",
      payment_reference: activity.payment_reference || "",
      supporting_document: activity.supporting_document || "",
      notes: activity.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteActivity(id) {
    const confirmDelete = window.confirm(
      "Kya aap ye activity delete karna chahte hain?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Delete error: " + error.message);
      return;
    }

    loadActivities();
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  const filteredActivities = activities.filter((activity) => {
    const text = `
      ${activity.title || ""}
      ${activity.customers?.name || ""}
      ${activity.activity_type || ""}
      ${activity.approval_status || ""}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  function money(value) {
    return Number(value || 0).toLocaleString("en-PK");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "30px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, color: "#172033" }}>
              Activity & Business Development
            </h1>

            <p style={{ color: "#687386", marginTop: "8px" }}>
              Doctor / Clinic activities aur approved business-development
              expenses manage karein.
            </p>
          </div>

          <a
            href="/"
            style={{
              textDecoration: "none",
              background: "#172033",
              color: "white",
              padding: "11px 18px",
              borderRadius: "8px",
            }}
          >
            ← Dashboard
          </a>
        </div>

        <section
          style={{
            background: "white",
            borderRadius: "14px",
            padding: "25px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
            marginBottom: "30px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {editingId ? "Edit Activity" : "Create New Activity"}
          </h2>

          <form onSubmit={saveActivity}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <label>Doctor / Clinic *</label>
                <select
                  name="customer_id"
                  value={form.customer_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Select Doctor / Clinic</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} (
                      {customer.customer_type === "doctor"
                        ? "Doctor"
                        : "Clinic"}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Activity Type</label>
                <select
                  name="activity_type"
                  value={form.activity_type}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  {activityTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Activity Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Clinic Promotional Activity"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label>End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Approved Budget</label>
                <input
                  type="number"
                  min="0"
                  name="approved_budget"
                  value={form.approved_budget}
                  onChange={handleChange}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Target Sales</label>
                <input
                  type="number"
                  min="0"
                  name="target_sales"
                  value={form.target_sales}
                  onChange={handleChange}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Actual Expense</label>
                <input
                  type="number"
                  min="0"
                  name="actual_expense"
                  value={form.actual_expense}
                  onChange={handleChange}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Approval Status</label>
                <select
                  name="approval_status"
                  value={form.approval_status}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  {statuses.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Payment / Voucher Reference</label>
                <input
                  name="payment_reference"
                  value={form.payment_reference}
                  onChange={handleChange}
                  placeholder="Voucher / reference no."
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Supporting Document Reference</label>
                <input
                  name="supporting_document"
                  value={form.supporting_document}
                  onChange={handleChange}
                  placeholder="Document / file reference"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: "18px" }}>
              <label>Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Activity details / notes"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "10px",
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: "#1769aa",
                  color: "white",
                  border: "none",
                  padding: "12px 22px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Activity"
                  : "Create Activity"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    background: "#e5e7eb",
                    color: "#222",
                    border: "none",
                    padding: "12px 22px",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section
          style={{
            background: "white",
            borderRadius: "14px",
            padding: "25px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ margin: 0 }}>Activity History</h2>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity / doctor..."
              style={{
                ...inputStyle,
                maxWidth: "300px",
              }}
            />
          </div>

          {loading ? (
            <p>Loading activities...</p>
          ) : filteredActivities.length === 0 ? (
            <p style={{ color: "#687386" }}>
              Abhi koi activity record nahi hai.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1050px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f4f8" }}>
                    <th style={thStyle}>Doctor / Clinic</th>
                    <th style={thStyle}>Activity</th>
                    <th style={thStyle}>Dates</th>
                    <th style={thStyle}>Budget</th>
                    <th style={thStyle}>Target Sales</th>
                    <th style={thStyle}>Expense</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredActivities.map((activity) => (
                    <tr key={activity.id}>
                      <td style={tdStyle}>
                        <strong>
                          {activity.customers?.name || "Unknown"}
                        </strong>
                        <br />
                        <small>
                          {activity.customers?.customer_type || ""}
                        </small>
                      </td>

                      <td style={tdStyle}>
                        <strong>{activity.title}</strong>
                        <br />
                        <small>{activity.activity_type}</small>
                      </td>

                      <td style={tdStyle}>
                        {activity.start_date || "-"}
                        <br />
                        {activity.end_date || "-"}
                      </td>

                      <td style={tdStyle}>
                        Rs. {money(activity.approved_budget)}
                      </td>

                      <td style={tdStyle}>
                        Rs. {money(activity.target_sales)}
                      </td>

                      <td style={tdStyle}>
                        Rs. {money(activity.actual_expense)}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: "5px 9px",
                            borderRadius: "20px",
                            background:
                              activity.approval_status === "approved"
                                ? "#dcfce7"
                                : activity.approval_status === "completed"
                                ? "#dbeafe"
                                : activity.approval_status === "rejected"
                                ? "#fee2e2"
                                : "#fef3c7",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          {activity.approval_status}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <button
                          onClick={() => editActivity(activity)}
                          style={actionButton}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteActivity(activity.id)}
                          style={{
                            ...actionButton,
                            background: "#dc2626",
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
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: "7px",
  padding: "11px 12px",
  border: "1px solid #d5dbe5",
  borderRadius: "8px",
  fontSize: "14px",
  background: "white",
};

const thStyle = {
  textAlign: "left",
  padding: "13px",
  borderBottom: "1px solid #ddd",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "13px",
  borderBottom: "1px solid #eee",
  fontSize: "13px",
  verticalAlign: "top",
};

const actionButton = {
  border: "none",
  background: "#1769aa",
  color: "white",
  padding: "7px 10px",
  borderRadius: "6px",
  marginRight: "6px",
  cursor: "pointer",
};
