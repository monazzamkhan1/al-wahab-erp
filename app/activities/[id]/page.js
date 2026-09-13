"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export default function ActivityDetailsPage({ params }) {
  const activityId = params.id;

  const [activity, setActivity] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    adjustment_type: "recovery",
    amount: "",
    adjustment_date: "",
    reason: "",
    reference_no: "",
    supporting_document: "",
    approved_by: "",
    notes: "",
  });

  useEffect(() => {
    loadActivity();
    loadAdjustments();
  }, [activityId]);

  async function loadActivity() {
    setLoading(true);

    const { data, error } = await supabase
      .from("activities")
      .select(`
        *,
        customers (
          id,
          name,
          customer_type,
          phone,
          email,
          address,
          city
        )
      `)
      .eq("id", activityId)
      .single();

    if (error) {
      console.error(error);
      alert("Activity load nahi ho saki: " + error.message);
    } else {
      setActivity(data);
    }

    setLoading(false);
  }

  async function loadAdjustments() {
    const { data, error } = await supabase
      .from("activity_adjustments")
      .select("*")
      .eq("activity_id", activityId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Adjustment history load nahi ho saki: " + error.message);
      return;
    }

    setAdjustments(data || []);
  }

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function addAdjustment(e) {
    e.preventDefault();

    if (!form.amount || Number(form.amount) <= 0) {
      alert("Adjustment amount enter karein.");
      return;
    }

    if (!form.reason.trim()) {
      alert("Adjustment reason enter karein.");
      return;
    }

    const approvedBudget = Number(activity?.approved_budget || 0);
    const currentTotal = adjustments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const remaining = approvedBudget - currentTotal;

    if (Number(form.amount) > remaining) {
      alert(
        `Adjustment amount remaining amount se zyada nahi ho sakta.\nRemaining: Rs. ${remaining.toLocaleString(
          "en-PK"
        )}`
      );
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      activity_id: activityId,
      adjustment_type: form.adjustment_type,
      amount: Number(form.amount),
      adjustment_date:
        form.adjustment_date ||
        new Date().toISOString().split("T")[0],
      reason: form.reason.trim(),
      reference_no: form.reference_no.trim() || null,
      supporting_document:
        form.supporting_document.trim() || null,
      approved_by: form.approved_by.trim() || null,
      notes: form.notes.trim() || null,
      created_by: user?.id || null,
    };

    const { error } = await supabase
      .from("activity_adjustments")
      .insert([payload]);

    if (error) {
      alert("Adjustment save error: " + error.message);
    } else {
      alert("Adjustment successfully add ho gayi.");

      setForm({
        adjustment_type: "recovery",
        amount: "",
        adjustment_date: "",
        reason: "",
        reference_no: "",
        supporting_document: "",
        approved_by: "",
        notes: "",
      });

      loadAdjustments();
    }

    setSaving(false);
  }

  async function deleteAdjustment(id) {
    const confirmDelete = window.confirm(
      "Kya aap ye adjustment record delete karna chahte hain?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("activity_adjustments")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Delete error: " + error.message);
      return;
    }

    loadAdjustments();
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-PK");
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <p>Loading activity...</p>
        </div>
      </main>
    );
  }

  if (!activity) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <h2>Activity not found</h2>

          <a href="/activities" style={backButton}>
            ← Back to Activities
          </a>
        </div>
      </main>
    );
  }

  const approvedBudget = Number(activity.approved_budget || 0);
  const actualExpense = Number(activity.actual_expense || 0);
  const targetSales = Number(activity.target_sales || 0);

  const totalAdjustments = adjustments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const netActivityAmount = Math.max(
    0,
    approvedBudget - totalAdjustments
  );

  const remainingAdjustment = Math.max(
    0,
    approvedBudget - totalAdjustments
  );

  const salesAchievement =
    targetSales > 0
      ? Math.min(
          100,
          (Number(activity.actual_sales || 0) / targetSales) * 100
        )
      : 0;

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ margin: 0 }}>
              Activity Details
            </h1>

            <p style={{ color: "#687386" }}>
              Complete activity record, settlement aur adjustment history
            </p>
          </div>

          <a href="/activities" style={backButton}>
            ← Activities
          </a>
        </div>

        {/* ACTIVITY SUMMARY */}

        <section style={cardStyle}>
          <div style={sectionHeader}>
            <h2 style={{ margin: 0 }}>
              {activity.title}
            </h2>

            <span
              style={{
                ...statusBadge,
                background:
                  activity.approval_status === "completed"
                    ? "#dcfce7"
                    : activity.approval_status === "approved"
                    ? "#dbeafe"
                    : activity.approval_status === "rejected"
                    ? "#fee2e2"
                    : "#fef3c7",
              }}
            >
              {activity.approval_status}
            </span>
          </div>

          <div style={gridStyle}>
            <Info
              label="Doctor / Clinic"
              value={activity.customers?.name || "-"}
            />

            <Info
              label="Customer Type"
              value={activity.customers?.customer_type || "-"}
            />

            <Info
              label="Activity Type"
              value={activity.activity_type || "-"}
            />

            <Info
              label="Start Date"
              value={activity.start_date || "-"}
            />

            <Info
              label="End Date"
              value={activity.end_date || "-"}
            />

            <Info
              label="Phone"
              value={activity.customers?.phone || "-"}
            />

            <Info
              label="City"
              value={activity.customers?.city || "-"}
            />

            <Info
              label="Payment Reference"
              value={activity.payment_reference || "-"}
            />
          </div>

          {activity.notes && (
            <div style={notesBox}>
              <strong>Activity Notes</strong>
              <p>{activity.notes}</p>
            </div>
          )}
        </section>

        {/* FINANCIAL SUMMARY */}

        <section style={cardStyle}>
          <h2>Activity Financial Summary</h2>

          <div style={summaryGrid}>
            <SummaryCard
              title="Approved Budget"
              value={`Rs. ${money(approvedBudget)}`}
            />

            <SummaryCard
              title="Actual Expense"
              value={`Rs. ${money(actualExpense)}`}
            />

            <SummaryCard
              title="Total Recovery / Adjustment"
              value={`Rs. ${money(totalAdjustments)}`}
            />

            <SummaryCard
              title="Net Activity Amount"
              value={`Rs. ${money(netActivityAmount)}`}
            />

            <SummaryCard
              title="Target Sales"
              value={`Rs. ${money(targetSales)}`}
            />

            <SummaryCard
              title="Actual Sales"
              value={`Rs. ${money(activity.actual_sales || 0)}`}
            />
          </div>

          <div style={{ marginTop: "25px" }}>
            <strong>Business Achievement</strong>

            <div
              style={{
                marginTop: "8px",
                height: "12px",
                background: "#e5e7eb",
                borderRadius: "20px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${salesAchievement}%`,
                  height: "100%",
                  background: "#1769aa",
                }}
              />
            </div>

            <p style={{ color: "#687386" }}>
              {salesAchievement.toFixed(1)}% of target
            </p>
          </div>
        </section>

        {/* COMPLETION */}

        <section style={cardStyle}>
          <h2>Activity Completion</h2>

          <div style={gridStyle}>
            <Info
              label="Current Status"
              value={activity.approval_status || "-"}
            />

            <Info
              label="Completion Date"
              value={activity.completion_date || "Not completed"}
            />

            <Info
              label="Completion Remarks"
              value={activity.completion_remarks || "No remarks"}
            />
          </div>

          <p style={{ color: "#687386" }}>
            Completion fields ko hum next database update mein add karenge.
            Filhaal activity status aur financial history yahan available hai.
          </p>
        </section>

        {/* ADJUSTMENT FORM */}

        <section style={cardStyle}>
          <h2>Adjustment / Recovery</h2>

          <p style={{ color: "#687386" }}>
            Agar approved activity amount ka koi hissa approved process ke
            mutabiq recover/return ya adjust karna ho, yahan separate entry
            banayein. Original activity record delete nahi hoga.
          </p>

          <div
            style={{
              background: "#f1f5f9",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          >
            <strong>
              Remaining Adjustment Amount:
            </strong>

            <span style={{ marginLeft: "8px" }}>
              Rs. {money(remainingAdjustment)}
            </span>
          </div>

          <form onSubmit={addAdjustment}>
            <div style={gridStyle}>
              <div>
                <label>Adjustment Type</label>

                <select
                  name="adjustment_type"
                  value={form.adjustment_type}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="recovery">
                    Recovery
                  </option>

                  <option value="partial_return">
                    Partial Return
                  </option>

                  <option value="full_return">
                    Full Return
                  </option>

                  <option value="other">
                    Other Adjustment
                  </option>
                </select>
              </div>

              <div>
                <label>Amount *</label>

                <input
                  type="number"
                  min="1"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="Enter amount"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Adjustment Date</label>

                <input
                  type="date"
                  name="adjustment_date"
                  value={form.adjustment_date}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Reference / Voucher No.</label>

                <input
                  name="reference_no"
                  value={form.reference_no}
                  onChange={handleChange}
                  placeholder="Reference number"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Approved By</label>

                <input
                  name="approved_by"
                  value={form.approved_by}
                  onChange={handleChange}
                  placeholder="Name / designation"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Supporting Document</label>

                <input
                  name="supporting_document"
                  value={form.supporting_document}
                  onChange={handleChange}
                  placeholder="Document reference"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: "18px" }}>
              <label>Reason *</label>

              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows="3"
                placeholder="Reason for adjustment / recovery"
                style={inputStyle}
              />
            </div>

            <div style={{ marginTop: "18px" }}>
              <label>Notes</label>

              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Additional notes"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={saving || remainingAdjustment <= 0}
              style={{
                marginTop: "18px",
                background:
                  remainingAdjustment > 0
                    ? "#1769aa"
                    : "#9ca3af",
                color: "white",
                border: "none",
                padding: "12px 22px",
                borderRadius: "8px",
                cursor:
                  remainingAdjustment > 0
                    ? "pointer"
                    : "not-allowed",
                fontWeight: "bold",
              }}
            >
              {saving ? "Saving..." : "Add Adjustment"}
            </button>
          </form>
        </section>

        {/* ADJUSTMENT HISTORY */}

        <section style={cardStyle}>
          <h2>Adjustment / Recovery History</h2>

          {adjustments.length === 0 ? (
            <p style={{ color: "#687386" }}>
              Abhi koi adjustment/recovery record nahi hai.
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
                  <tr style={{ background: "#f1f4f8" }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Reference</th>
                    <th style={thStyle}>Approved By</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {adjustments.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>
                        {item.adjustment_date}
                      </td>

                      <td style={tdStyle}>
                        {item.adjustment_type}
                      </td>

                      <td style={tdStyle}>
                        Rs. {money(item.amount)}
                      </td>

                      <td style={tdStyle}>
                        {item.reason}
                      </td>

                      <td style={tdStyle}>
                        {item.reference_no || "-"}
                      </td>

                      <td style={tdStyle}>
                        {item.approved_by || "-"}
                      </td>

                      <td style={tdStyle}>
                        <button
                          onClick={() =>
                            deleteAdjustment(item.id)
                          }
                          style={deleteButton}
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

function Info({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: "12px",
          color: "#687386",
          marginBottom: "5px",
        }}
      >
        {label}
      </div>

      <strong style={{ color: "#172033" }}>
        {value}
      </strong>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "18px",
      }}
    >
      <div
        style={{
          color: "#687386",
          fontSize: "13px",
          marginBottom: "7px",
        }}
      >
        {title}
      </div>

      <strong
        style={{
          fontSize: "20px",
          color: "#172033",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f5f7fb",
  padding: "30px",
  fontFamily: "Arial, sans-serif",
};

const containerStyle = {
  maxWidth: "1400px",
  margin: "0 auto",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  flexWrap: "wrap",
  marginBottom: "25px",
};

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  padding: "25px",
  boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
  marginBottom: "25px",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  marginBottom: "25px",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "20px",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "15px",
};

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

const statusBadge = {
  padding: "7px 12px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "bold",
};

const backButton = {
  textDecoration: "none",
  background: "#172033",
  color: "white",
  padding: "11px 18px",
  borderRadius: "8px",
};

const notesBox = {
  marginTop: "25px",
  padding: "15px",
  background: "#f8fafc",
  borderRadius: "10px",
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

const deleteButton = {
  border: "none",
  background: "#dc2626",
  color: "white",
  padding: "7px 10px",
  borderRadius: "6px",
  cursor: "pointer",
};
