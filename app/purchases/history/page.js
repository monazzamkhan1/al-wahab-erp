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
            marginTop: 0,
            color: "#111827",
          }}
        >
          Purchase History
        </h1>

        <p
          style={{
            color: "#6b7280",
          }}
        >
          Purchase history module is ready.
        </p>

        <a
          href="/purchases"
          style={{
            display: "inline-block",
            marginTop: "15px",
            padding: "10px 16px",
            background: "#2563eb",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: "8px",
          }}
        >
          Go to Purchases
        </a>
      </div>
    </main>
  );
}
```
