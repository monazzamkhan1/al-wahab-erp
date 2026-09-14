```jsx
"use client";

export default function PurchaseHistoryPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        background: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          background: "#ffffff",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px 0",
            color: "#111827",
            fontSize: "28px",
          }}
        >
          Purchase History
        </h1>

        <p
          style={{
            margin: "0 0 25px 0",
            color: "#6b7280",
            fontSize: "15px",
          }}
        >
          Purchase history module is ready.
        </p>

        <div
          style={{
            padding: "20px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px 0",
              fontSize: "18px",
              color: "#374151",
            }}
          >
            No Purchase Records
          </h2>

          <p
            style={{
              margin: 0,
              color: "#6b7280",
            }}
          >
            Purchase invoices will appear here after they are recorded.
          </p>
        </div>

        <a
          href="/purchases"
          style={{
            display: "inline-block",
            padding: "11px 18px",
            background: "#2563eb",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: "600",
          }}
        >
          Go to Purchases
        </a>
      </div>
    </main>
  );
}
```
