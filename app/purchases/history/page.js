```jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPurchases = async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("purchases")
      .select(`
        id,
        supplier_id,
        invoice_no,
        invoice_date,
        total_amount,
        paid_amount,
        notes,
        created_at,
        companies (
          id,
          name
        )
      `)
      .order("invoice_date", { ascending: false });

    if (error) {
      console.error(error);
      setError(error.message);
      setPurchases([]);
    } else {
      setPurchases(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  const formatAmount = (value) => {
    return Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getPayable = (purchase) => {
    const total = Number(purchase.total_amount || 0);
    const paid = Number(purchase.paid_amount || 0);

    return total - paid;
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Purchase History</h1>

            <p style={styles.subtitle}>
              View all purchase invoices and supplier payables.
            </p>
          </div>

          <a href="/purchases" style={styles.newButton}>
            + New Purchase
          </a>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={styles.card}>

          {loading ? (
            <div style={styles.message}>
              Loading purchase history...
            </div>
          ) : purchases.length === 0 ? (
            <div style={styles.message}>
              <div style={styles.icon}>📦</div>

              <h3 style={styles.emptyTitle}>
                No Purchase Records
              </h3>

              <p style={styles.emptyText}>
                Purchase invoices will appear here after they are recorded.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>

                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Invoice No.</th>
                    <th style={styles.th}>Supplier</th>
                    <th style={styles.thRight}>Total</th>
                    <th style={styles.thRight}>Paid</th>
                    <th style={styles.thRight}>Payable</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {purchases.map((purchase) => {
                    const payable = getPayable(purchase);

                    return (
                      <tr key={purchase.id}>

                        <td style={styles.td}>
                          {purchase.invoice_date || "-"}
                        </td>

                        <td style={styles.td}>
                          <strong>
                            {purchase.invoice_no || "-"}
                          </strong>
                        </td>

                        <td style={styles.td}>
                          {purchase.companies
                            ? purchase.companies.name
                            : "Unknown Supplier"}
                        </td>

                        <td style={styles.tdRight}>
                          Rs. {formatAmount(purchase.total_amount)}
                        </td>

                        <td
                          style={{
                            ...styles.tdRight,
                            color: "#15803d",
                          }}
                        >
                          Rs. {formatAmount(purchase.paid_amount)}
                        </td>

                        <td
                          style={{
                            ...styles.tdRight,
                            color:
                              payable > 0
                                ? "#dc2626"
                                : "#15803d",
                            fontWeight: "700",
                          }}
                        >
                          Rs. {formatAmount(payable)}
                        </td>

                        <td style={styles.td}>
                          {purchase.notes || "-"}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}

        </div>

        <div style={styles.footer}>
          Total Purchase Records:{" "}
          <strong>{purchases.length}</strong>
        </div>

      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "30px 20px",
    fontFamily: "Arial, sans-serif",
  },

  container: {
    maxWidth: "1250px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
    marginBottom: "25px",
  },

  title: {
    margin: 0,
    fontSize: "28px",
    color: "#111827",
  },

  subtitle: {
    marginTop: "7px",
    marginBottom: 0,
    color: "#6b7280",
    fontSize: "15px",
  },

  newButton: {
    background: "#2563eb",
    color: "#ffffff",
    padding: "11px 18px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "600",
    display: "inline-block",
  },

  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "14px",
    borderRadius: "8px",
    marginBottom: "20px",
    border: "1px solid #fecaca",
  },

  card: {
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },

  message: {
    padding: "55px 20px",
    textAlign: "center",
    color: "#6b7280",
  },

  icon: {
    fontSize: "45px",
    marginBottom: "10px",
  },

  emptyTitle: {
    margin: "0 0 8px",
    color: "#374151",
  },

  emptyText: {
    margin: 0,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "900px",
  },

  th: {
    padding: "14px 16px",
    background: "#f3f4f6",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "14px",
    textAlign: "left",
    whiteSpace: "nowrap",
  },

  thRight: {
    padding: "14px 16px",
    background: "#f3f4f6",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "14px",
    textAlign: "right",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "14px 16px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "14px",
  },

  tdRight: {
    padding: "14px 16px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "14px",
    textAlign: "right",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },

  footer: {
    marginTop: "20px",
    color: "#6b7280",
    fontSize: "14px",
  },
};
```
