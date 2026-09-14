```jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPurchases() {
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
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError(error.message);
      setPurchases([]);
    } else {
      setPurchases(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPurchases();
  }, []);

  function formatAmount(amount) {
    return Number(amount || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function payableAmount(purchase) {
    return Number(purchase.total_amount || 0) -
      Number(purchase.paid_amount || 0);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "30px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1250px",
          margin: "0 auto",
        }}
      >
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
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                color: "#111827",
              }}
            >
              Purchase History
            </h1>

            <p
              style={{
                marginTop: "7px",
                color: "#6b7280",
              }}
            >
              View all recorded purchase invoices and supplier payables.
            </p>
          </div>

          <a
            href="/purchases"
            style={{
              background: "#2563eb",
              color: "#fff",
              padding: "11px 18px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            + New Purchase
          </a>
        </div>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "14px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              Loading purchase history...
            </div>
          ) : purchases.length === 0 ? (
            <div
              style={{
                padding: "50px 20px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              <div
                style={{
                  fontSize: "45px",
                  marginBottom: "10px",
                }}
              >
                📦
              </div>

              <h3
                style={{
                  margin: "0 0 8px",
                  color: "#374151",
                }}
              >
                No Purchase Records
              </h3>

              <p style={{ margin: 0 }}>
                Purchase invoices will appear here after they are recorded.
              </p>
            </div>
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
                  <tr
                    style={{
                      background: "#f3f4f6",
                      textAlign: "left",
                    }}
                  >
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Invoice No.</th>
                    <th style={thStyle}>Supplier</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>
                      Total
                    </th>
                    <th style={{ ...thStyle, textAlign: "right" }}>
                      Paid
                    </th>
                    <th style={{ ...thStyle, textAlign: "right" }}>
                      Payable
                    </th>
                    <th style={thStyle}>Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {purchases.map((purchase) => {
                    const payable = payableAmount(purchase);

                    return (
                      <tr key={purchase.id}>
                        <td style={tdStyle}>
                          {purchase.invoice_date || "-"}
                        </td>

                        <td style={tdStyle}>
                          <strong>
                            {purchase.invoice_no || "-"}
                          </strong>
                        </td>

                        <td style={tdStyle}>
                          {purchase.companies?.name || "Unknown Supplier"}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontWeight: "600",
                          }}
                        >
                          Rs. {formatAmount(purchase.total_amount)}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            color: "#15803d",
                            fontWeight: "600",
                          }}
                        >
                          Rs. {formatAmount(purchase.paid_amount)}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            color: payable > 0 ? "#dc2626" : "#15803d",
                            fontWeight: "700",
                          }}
                        >
                          Rs. {formatAmount(payable)}
                        </td>

                        <td style={tdStyle}>
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

        <div
          style={{
            marginTop: "20px",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          Total Purchase Records:{" "}
          <strong>{purchases.length}</strong>
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid #e5e7eb",
  color: "#374151",
  fontSize: "14px",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid #e5e7eb",
  color: "#374151",
  fontSize: "14px",
};
```
