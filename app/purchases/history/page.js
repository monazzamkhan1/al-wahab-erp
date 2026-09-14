```jsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPurchases();
  }, []);

  async function loadPurchases() {
    setLoading(true);

    const result = await supabase
      .from("purchases")
      .select("*")
      .order("invoice_date", { ascending: false });

    if (result.error) {
      setError(result.error.message);
      setPurchases([]);
    } else {
      setPurchases(result.data || []);
    }

    setLoading(false);
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-PK");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "30px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
            flexWrap: "wrap",
            gap: "15px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: "#111827",
              }}
            >
              Purchase History
            </h1>

            <p style={{ color: "#6b7280" }}>
              All purchase invoices
            </p>
          </div>

          <a
            href="/purchases"
            style={{
              background: "#2563eb",
              color: "white",
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
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            background: "white",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
              }}
            >
              Loading...
            </div>
          ) : purchases.length === 0 ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              <h3>No Purchase Records</h3>

              <p>
                Purchase invoices will appear here after
                they are recorded.
              </p>
            </div>
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
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Invoice No.</th>
                    <th style={th}>Supplier ID</th>
                    <th style={thRight}>Total</th>
                    <th style={thRight}>Paid</th>
                    <th style={thRight}>Payable</th>
                  </tr>
                </thead>

                <tbody>
                  {purchases.map((purchase) => {
                    const total = Number(
                      purchase.total_amount || 0
                    );

                    const paid = Number(
                      purchase.paid_amount || 0
                    );

                    const payable = total - paid;

                    return (
                      <tr key={purchase.id}>
                        <td style={td}>
                          {purchase.invoice_date || "-"}
                        </td>

                        <td style={td}>
                          {purchase.invoice_no || "-"}
                        </td>

                        <td style={td}>
                          {purchase.supplier_id || "-"}
                        </td>

                        <td style={tdRight}>
                          Rs. {money(total)}
                        </td>

                        <td
                          style={{
                            ...tdRight,
                            color: "#15803d",
                          }}
                        >
                          Rs. {money(paid)}
                        </td>

                        <td
                          style={{
                            ...tdRight,
                            color:
                              payable > 0
                                ? "#dc2626"
                                : "#15803d",
                          }}
                        >
                          Rs. {money(payable)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p
          style={{
            marginTop: "20px",
            color: "#6b7280",
          }}
        >
          Total Records: <strong>{purchases.length}</strong>
        </p>
      </div>
    </main>
  );
}

const th = {
  padding: "14px 16px",
  background: "#f3f4f6",
  borderBottom: "1px solid #e5e7eb",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const thRight = {
  ...th,
  textAlign: "right",
};

const td = {
  padding: "14px 16px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const tdRight = {
  ...td,
  textAlign: "right",
  fontWeight: "600",
};
```
