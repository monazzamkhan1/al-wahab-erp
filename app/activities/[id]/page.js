"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../supabase";

export default function ActivityDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const activityId = params?.id;

  const [activity, setActivity] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [actualSales, setActualSales] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [completionRemarks, setCompletionRemarks] = useState("");
  const [status, setStatus] = useState("");

  const [adjustmentType, setAdjustmentType] = useState("recovery");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentReference, setAdjustmentReference] = useState("");
  const [adjustmentDocument, setAdjustmentDocument] = useState("");
  const [adjustmentApprovedBy, setAdjustmentApprovedBy] = useState("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  useEffect(() => {
    if (activityId) {
      loadActivity();
    }
  }, [activityId]);

  async function loadActivity() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("activities")
      .select(`
        *,
        customers (
          id,
          name,
          customer_type,
          contact_person,
          phone,
          email,
          city,
          address
        )
      `)
      .eq("id", activityId)
      .single();

    if (error) {
      console.error(error);
      setMessage("Activity load nahi ho saki.");
      setLoading(false);
      return;
    }

    setActivity(data);
    setActualSales(data.actual_sales ?? "");
    setCompletionDate(data.completion_date ?? "");
    setCompletionRemarks(data.completion_remarks ?? "");
    setStatus(data.approval_status ?? "pending");

    await loadAdjustments();

    setLoading(false);
  }

  async function loadAdjustments() {
    const { data, error } = await supabase
      .from("activity_adjustments")
      .select("*")
      .eq("activity_id", activityId)
      .order("adjustment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setAdjustments(data || []);
  }

  async function saveCompletion() {
    if (!activity) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("activities")
      .update({
        actual_sales: Number(actualSales || 0),
        completion_date: completionDate || null,
        completion_remarks: completionRemarks || null,
        approval_status: status,
      })
      .eq("id", activity.id);

    setSaving(false);

    if (error) {
      console.error(error);
      setMessage("Activity update nahi ho saki: " + error.message);
      return;
    }

    setMessage("Activity successfully updated.");
    await loadActivity();
  }

  async function addAdjustment(e) {
    e.preventDefault();

    if (!activity) return;

    const amount = Number(adjustmentAmount);

    if (!amount || amount <= 0) {
      setMessage("Adjustment amount enter karein.");
      return;
    }

    if (!adjustmentReason.trim()) {
      setMessage("Adjustment ka reason enter karein.");
      return;
    }

    const totalAdjustments = adjustments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const remaining =
      Number(activity.approved_budget || 0) - totalAdjustments;

    if (amount > remaining) {
      setMessage(
        `Adjustment amount remaining budget se zyada nahi ho sakta. Remaining: Rs. ${remaining.toLocaleString()}`
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("activity_adjustments")
      .insert({
        activity_id: activity.id,
        adjustment_type: adjustmentType,
        amount,
        adjustment_date:
          adjustmentDate ||
          new Date().toISOString().split("T")[0],
        reason: adjustmentReason.trim(),
        reference_no: adjustmentReference || null,
        supporting_document: adjustmentDocument || null,
        approved_by: adjustmentApprovedBy || null,
        notes: adjustmentNotes || null,
        created_by: user?.id || null,
      });

    setSaving(false);

    if (error) {
      console.error(error);
      setMessage("Adjustment save nahi ho saki: " + error.message);
      return;
    }

    setAdjustmentType("recovery");
    setAdjustmentAmount("");
    setAdjustmentDate("");
    setAdjustmentReason("");
    setAdjustmentReference("");
    setAdjustmentDocument("");
    setAdjustmentApprovedBy("");
    setAdjustmentNotes("");

    setMessage("Adjustment successfully added.");

    await loadAdjustments();
  }

  async function deleteAdjustment(id) {
    const confirmed = window.confirm(
      "Kya aap is adjustment ko delete karna chahte hain?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("activity_adjustments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage("Adjustment delete nahi ho saki.");
      return;
    }

    setMessage("Adjustment deleted.");
    await loadAdjustments();
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading activity...</div>
      </main>
    );
  }

  if (!activity) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h2>Activity Not Found</h2>
          <button style={styles.backButton} onClick={() => router.push("/activities")}>
            ← Back to Activities
          </button>
        </div>
      </main>
    );
  }

  const approvedBudget = Number(activity.approved_budget || 0);
  const actualExpense = Number(activity.actual_expense || 0);
  const targetSales = Number(activity.target_sales || 0);
  const achievedSales = Number(actualSales || 0);

  const totalAdjustments = adjustments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const remainingBudget = approvedBudget - totalAdjustments;

  const salesPercentage =
    targetSales > 0
      ? Math.min((achievedSales / targetSales) * 100, 100)
      : 0;

  const expensePercentage =
    approvedBudget > 0
      ? Math.min((actualExpense / approvedBudget) * 100, 100)
      : 0;

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <button
              style={styles.backButton}
              onClick={() => router.push("/activities")}
            >
              ← Back to Activities
            </button>

            <h1 style={styles.title}>
              Activity Details
            </h1>

            <p style={styles.subtitle}>
              Complete activity information, business achievement and settlement
            </p>
          </div>

          <div style={styles.statusBox}>
            <span style={styles.statusLabel}>Status</span>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={styles.statusSelect}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        {/* ACTIVITY INFORMATION */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Activity Information</h2>

          <div style={styles.grid}>
            <Info
              label="Doctor / Clinic"
              value={activity.customers?.name || "-"}
            />

            <Info
              label="Customer Type"
              value={activity.customers?.customer_type || "-"}
            />

            <Info
              label="Contact Person"
              value={activity.customers?.contact_person || "-"}
            />

            <Info
              label="Phone"
              value={activity.customers?.phone || "-"}
            />

            <Info
              label="Activity Type"
              value={activity.activity_type || "-"}
            />

            <Info
              label="Activity Title"
              value={activity.title || "-"}
            />

            <Info
              label="Start Date"
              value={activity.start_date || "-"}
            />

            <Info
              label="End Date"
              value={activity.end_date || "-"}
            />
          </div>

          {activity.notes && (
            <div style={styles.notesBox}>
              <strong>Notes</strong>
              <p>{activity.notes}</p>
            </div>
          )}
        </section>

        {/* FINANCIAL SUMMARY */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Financial Summary</h2>

          <div style={styles.summaryGrid}>
            <SummaryCard
              title="Approved Budget"
              value={`Rs. ${approvedBudget.toLocaleString()}`}
            />

            <SummaryCard
              title="Actual Expense"
              value={`Rs. ${actualExpense.toLocaleString()}`}
            />

            <SummaryCard
              title="Total Recovery / Adjustment"
              value={`Rs. ${totalAdjustments.toLocaleString()}`}
            />

            <SummaryCard
              title="Remaining Amount"
              value={`Rs. ${remainingBudget.toLocaleString()}`}
            />

            <SummaryCard
              title="Target Sales"
              value={`Rs. ${targetSales.toLocaleString()}`}
            />

            <SummaryCard
              title="Actual Sales"
              value={`Rs. ${achievedSales.toLocaleString()}`}
            />
          </div>
        </section>

        {/* BUSINESS ACHIEVEMENT */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Business Achievement</h2>

          <div style={styles.progressHeader}>
            <span>
              Target: Rs. {targetSales.toLocaleString()}
            </span>

            <strong>
              {Math.round(salesPercentage)}%
            </strong>
          </div>

          <div style={styles.progressBackground}>
            <div
              style={{
                ...styles.progressFill,
                width: `${salesPercentage}%`,
              }}
            />
          </div>

          <p style={styles.smallText}>
            Actual Business: Rs. {achievedSales.toLocaleString()}
          </p>
        </section>

        {/* EXPENSE */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Expense Utilization</h2>

          <div style={styles.progressHeader}>
            <span>
              Budget: Rs. {approvedBudget.toLocaleString()}
            </span>

            <strong>
              {Math.round(expensePercentage)}%
            </strong>
          </div>

          <div style={styles.progressBackground}>
            <div
              style={{
                ...styles.progressFill,
                width: `${expensePercentage}%`,
              }}
            />
          </div>

          <p style={styles.smallText}>
            Actual Expense: Rs. {actualExpense.toLocaleString()}
          </p>
        </section>

        {/* COMPLETION */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Activity Completion
          </h2>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Actual Sales / Business
              <input
                type="number"
                value={actualSales}
                onChange={(e) => setActualSales(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Completion Date
              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Activity Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={styles.input}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>

          <label style={styles.label}>
            Completion Remarks
            <textarea
              value={completionRemarks}
              onChange={(e) => setCompletionRemarks(e.target.value)}
              placeholder="Activity completion details..."
              rows={4}
              style={styles.textarea}
            />
          </label>

          <button
            onClick={saveCompletion}
            disabled={saving}
            style={styles.primaryButton}
          >
            {saving ? "Saving..." : "Save Activity Completion"}
          </button>
        </section>

        {/* ADJUSTMENT */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Recovery / Adjustment
          </h2>

          <p style={styles.warningText}>
            Adjustment original activity ko delete nahi karta. Har recovery
            ya adjustment ka separate record maintain hota hai.
          </p>

          <form onSubmit={addAdjustment}>
            <div style={styles.formGrid}>

              <label style={styles.label}>
                Adjustment Type
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value)}
                  style={styles.input}
                >
                  <option value="recovery">Recovery</option>
                  <option value="partial_return">Partial Return</option>
                  <option value="full_return">Full Return</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label style={styles.label}>
                Amount
                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="0"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Adjustment Date
                <input
                  type="date"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Reference / Voucher No.
                <input
                  type="text"
                  value={adjustmentReference}
                  onChange={(e) =>
                    setAdjustmentReference(e.target.value)
                  }
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Approved By
                <input
                  type="text"
                  value={adjustmentApprovedBy}
                  onChange={(e) =>
                    setAdjustmentApprovedBy(e.target.value)
                  }
                  placeholder="Name / designation"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Supporting Document
                <input
                  type="text"
                  value={adjustmentDocument}
                  onChange={(e) =>
                    setAdjustmentDocument(e.target.value)
                  }
                  placeholder="Document reference"
                  style={styles.input}
                />
              </label>
            </div>

            <label style={styles.label}>
              Reason
              <textarea
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Adjustment / recovery reason"
                rows={3}
                style={styles.textarea}
              />
            </label>

            <label style={styles.label}>
              Notes
              <textarea
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                placeholder="Additional notes"
                rows={3}
                style={styles.textarea}
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              style={styles.secondaryButton}
            >
              {saving ? "Saving..." : "Add Recovery / Adjustment"}
            </button>
          </form>
        </section>

        {/* ADJUSTMENT HISTORY */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Adjustment History
          </h2>

          {adjustments.length === 0 ? (
            <div style={styles.empty}>
              No recovery or adjustment recorded yet.
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Reason</th>
                    <th style={styles.th}>Reference</th>
                    <th style={styles.th}>Approved By</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {adjustments.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>
                        {item.adjustment_date || "-"}
                      </td>

                      <td style={styles.td}>
                        {formatAdjustmentType(item.adjustment_type)}
                      </td>

                      <td style={styles.td}>
                        Rs. {Number(item.amount || 0).toLocaleString()}
                      </td>

                      <td style={styles.td}>
                        {item.reason || "-"}
                      </td>

                      <td style={styles.td}>
                        {item.reference_no || "-"}
                      </td>

                      <td style={styles.td}>
                        {item.approved_by || "-"}
                      </td>

                      <td style={styles.td}>
                        <button
                          onClick={() => deleteAdjustment(item.id)}
                          style={styles.deleteButton}
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

        {/* DOCUMENT / PAYMENT INFO */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Supporting Information
          </h2>

          <div style={styles.grid}>
            <Info
              label="Payment / Voucher Reference"
              value={activity.payment_reference || "-"}
            />

            <Info
              label="Supporting Document"
              value={activity.supporting_document || "-"}
            />

            <Info
              label="Created At"
              value={
                activity.created_at
                  ? new Date(activity.created_at).toLocaleString()
                  : "-"
              }
            />
          </div>
        </section>

      </div>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryTitle}>{title}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function formatAdjustmentType(type) {
  if (type === "partial_return") return "Partial Return";
  if (type === "full_return") return "Full Return";
  if (type === "recovery") return "Recovery";
  return "Other";
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "30px 16px",
    fontFamily:
      "Arial, Helvetica, sans-serif",
    color: "#172033",
  },

  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },

  title: {
    margin: "12px 0 5px",
    fontSize: "30px",
  },

  subtitle: {
    margin: 0,
    color: "#667085",
  },

  backButton: {
    border: "none",
    background: "#e8edf5",
    color: "#344054",
    padding: "9px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  statusBox: {
    background: "#fff",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #e4e7ec",
    minWidth: "180px",
  },

  statusLabel: {
    display: "block",
    fontSize: "12px",
    color: "#667085",
    marginBottom: "6px",
  },

  statusSelect: {
    width: "100%",
    padding: "9px",
    borderRadius: "7px",
    border: "1px solid #d0d5dd",
    background: "#fff",
  },

  card: {
    background: "#fff",
    border: "1px solid #e4e7ec",
    borderRadius: "14px",
    padding: "22px",
    marginBottom: "18px",
    boxShadow: "0 2px 8px rgba(16,24,40,0.04)",
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "20px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
  },

  infoItem: {
    background: "#f8fafc",
    borderRadius: "9px",
    padding: "13px",
  },

  infoLabel: {
    display: "block",
    fontSize: "12px",
    color: "#667085",
    marginBottom: "6px",
  },

  infoValue: {
    fontSize: "14px",
  },

  notesBox: {
    marginTop: "18px",
    padding: "14px",
    background: "#f8fafc",
    borderRadius: "9px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },

  summaryCard: {
    border: "1px solid #e4e7ec",
    borderRadius: "10px",
    padding: "16px",
    background: "#fafbfc",
  },

  summaryTitle: {
    display: "block",
    fontSize: "12px",
    color: "#667085",
    marginBottom: "8px",
  },

  summaryValue: {
    fontSize: "19px",
  },

  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    fontSize: "14px",
  },

  progressBackground: {
    height: "12px",
    background: "#e9edf3",
    borderRadius: "20px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#16a34a",
    borderRadius: "20px",
    transition: "width 0.3s ease",
  },

  smallText: {
    color: "#667085",
    fontSize: "13px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
    marginBottom: "15px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "14px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "7px",
    padding: "11px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "14px",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "7px",
    padding: "11px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    resize: "vertical",
    fontFamily: "inherit",
    fontSize: "14px",
  },

  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "11px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  secondaryButton: {
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "11px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  deleteButton: {
    border: "none",
    background: "#dc2626",
    color: "#fff",
    padding: "7px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
  },

  warningText: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "18px",
  },

  message: {
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#067647",
    padding: "12px 15px",
    borderRadius: "8px",
    marginBottom: "18px",
  },

  empty: {
    padding: "20px",
    textAlign: "center",
    color: "#667085",
    background: "#f8fafc",
    borderRadius: "8px",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "850px",
  },

  th: {
    textAlign: "left",
    padding: "11px",
    background: "#f8fafc",
    borderBottom: "1px solid #e4e7ec",
    fontSize: "12px",
  },

  td: {
    padding: "11px",
    borderBottom: "1px solid #eaecf0",
    fontSize: "13px",
  },
};
