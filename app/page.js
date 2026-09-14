"use client";

import { useEffect, useState } from "react";
import Login from "./login";
import { supabase } from "./supabase";

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [dashboardData, setDashboardData] = useState({
    products: 0,
    stock: 0,
    customers: 0,
    suppliers: 0,
    sales: 0,
    purchases: 0,
    receivables: 0,
    payables: 0,
  });

  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadDashboardData() {
    setDataLoading(true);

    try {
      const [
        productsResult,
        stockResult,
        customersResult,
        suppliersResult,
        salesResult,
        purchasesResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("product_batches")
          .select("quantity"),

        supabase
          .from("customers")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("companies")
          .select("id", { count: "exact", head: true })
          .in("company_type", ["supplier", "both"]),

        supabase
          .from("sales")
          .select("total_amount, received_amount"),

        supabase
          .from("purchases")
          .select("total_amount, paid_amount"),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (stockResult.error) throw stockResult.error;
      if (customersResult.error) throw customersResult.error;
      if (suppliersResult.error) throw suppliersResult.error;
      if (salesResult.error) throw salesResult.error;
      if (purchasesResult.error) throw purchasesResult.error;

      const totalStock = (stockResult.data || []).reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

      const totalSales = (salesResult.data || []).reduce(
        (sum, item) => sum + Number(item.total_amount || 0),
        0
      );

      const totalReceived = (salesResult.data || []).reduce(
        (sum, item) => sum + Number(item.received_amount || 0),
        0
      );

      const totalPurchases = (purchasesResult.data || []).reduce(
        (sum, item) => sum + Number(item.total_amount || 0),
        0
      );

      const totalPaid = (purchasesResult.data || []).reduce(
        (sum, item) => sum + Number(item.paid_amount || 0),
        0
      );

      setDashboardData({
        products: productsResult.count || 0,
        stock: totalStock,
        customers: customersResult.count || 0,
        suppliers: suppliersResult.count || 0,
        sales: totalSales,
        purchases: totalPurchases,
        receivables: Math.max(totalSales - totalReceived, 0),
        payables: Math.max(totalPurchases - totalPaid, 0),
      });
    } catch (error) {
      console.error("Dashboard data error:", error);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (session) {
      loadDashboardData();
    }
  }, [session]);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading...
      </main>
    );
  }

  if (!session) {
    return <Login />;
  }

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString("en-PK");
  };

  const formatCurrency = (value) => {
    return "Rs. " + Number(value || 0).toLocaleString("en-PK");
  };

  const cards = [
    {
      title: "Products",
      value: dataLoading ? "..." : formatNumber(dashboardData.products),
      icon: "💊",
      link: "/products",
    },
    {
      title: "Current Stock",
      value: dataLoading ? "..." : formatNumber(dashboardData.stock),
      icon: "📦",
      link: "/stock",
    },
    {
      title: "Customers",
      value: dataLoading ? "..." : formatNumber(dashboardData.customers),
      icon: "🏥",
      link: "/customers",
    },
    {
      title: "Suppliers",
      value: dataLoading ? "..." : formatNumber(dashboardData.suppliers),
      icon: "🏭",
      link: "/companies",
    },
    {
      title: "Sales",
      value: dataLoading ? "..." : formatCurrency(dashboardData.sales),
      icon: "🧾",
      link: "#",
    },
    {
      title: "Purchases",
      value: dataLoading ? "..." : formatCurrency(dashboardData.purchases),
      icon: "🛒",
      link: "/purchases",
    },
    {
      title: "Receivables",
      value: dataLoading
        ? "..."
        : formatCurrency(dashboardData.receivables),
      icon: "💰",
      link: "#",
    },
    {
      title: "Payables",
      value: dataLoading ? "..." : formatCurrency(dashboardData.payables),
      icon: "💸",
      link: "#",
    },
  ];

  const sidebarItems = [
    { label: "💊 Products", link: "/products" },
    { label: "📦 Stock", link: "/stock" },
    { label: "🏥 Customers", link: "/customers" },
    { label: "🏭 Suppliers", link: "/companies" },
    { label: "🧾 Sales", link: "#" },
    { label: "🛒 Purchases", link: "/purchases" },
    { label: "💰 Accounts", link: "#" },
    { label: "📈 Reports", link: "#" },
    { label: "👥 Users", link: "#" },
    { label: "⚙️ Settings", link: "#" },
  ];

  const quickActions = [
    { label: "Add Product", link: "/products" },
    { label: "Add Customer", link: "/customers" },
    { label: "Add Supplier", link: "/companies" },
    { label: "New Sale", link: "#" },
    { label: "New Purchase", link: "/purchases" },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          background: "#111827",
          color: "#fff",
          padding: "18px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "15px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "22px" }}>
            Al Wahab Enterprises
          </h1>

          <p
            style={{
              margin: "5px 0 0",
              color: "#d1d5db",
              fontSize: "13px",
            }}
          >
            Pharmaceutical Distribution Management System
          </p>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
          style={{
            padding: "10px 16px",
            background: "#fff",
            color: "#111827",
            border: "none",
            borderRadius: "7px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logout
        </button>
      </header>

      <div
        style={{
          display: "flex",
          minHeight: "calc(100vh - 80px)",
        }}
      >
        <aside
          style={{
            width: "220px",
            background: "#1f2937",
            color: "#fff",
            padding: "20px 12px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              padding: "12px",
              marginBottom: "10px",
              background: "#374151",
              borderRadius: "8px",
              fontWeight: "bold",
            }}
          >
            📊 Dashboard
          </div>

          {sidebarItems.map((item) => (
            <a
              key={item.label}
              href={item.link}
              style={{
                display: "block",
                padding: "12px",
                marginBottom: "4px",
                borderRadius: "7px",
                color: "#d1d5db",
                cursor: item.link === "#" ? "default" : "pointer",
                textDecoration: "none",
              }}
              onClick={(e) => {
                if (item.link === "#") {
                  e.preventDefault();
                }
              }}
            >
              {item.label}
            </a>
          ))}
        </aside>

        <section
          style={{
            flex: 1,
            padding: "25px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ marginBottom: "25px" }}>
            <h2
              style={{
                margin: 0,
                color: "#111827",
              }}
            >
              Dashboard
            </h2>

            <p
              style={{
                marginTop: "7px",
                color: "#6b7280",
              }}
            >
              Welcome to Al Wahab Enterprises ERP.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "16px",
            }}
          >
            {cards.map((card) => (
              <a
                key={card.title}
                href={card.link}
                onClick={(e) => {
                  if (card.link === "#") {
                    e.preventDefault();
                  }
                }}
                style={{
                  display: "block",
                  background: "#fff",
                  padding: "20px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                  border: "1px solid #e5e7eb",
                  textDecoration: "none",
                  color: "inherit",
                  cursor:
                    card.link === "#" ? "default" : "pointer",
                }}
              >
                <div style={{ fontSize: "28px" }}>
                  {card.icon}
                </div>

                <p
                  style={{
                    margin: "12px 0 5px",
                    color: "#6b7280",
                    fontSize: "14px",
                  }}
                >
                  {card.title}
                </p>

                <h3
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    color: "#111827",
                  }}
                >
                  {card.value}
                </h3>
              </a>
            ))}
          </div>

          <div
            style={{
              marginTop: "25px",
              background: "#fff",
              padding: "22px",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Quick Actions</h3>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              {quickActions.map((action) => (
                <a
                  key={action.label}
                  href={action.link}
                  onClick={(e) => {
                    if (action.link === "#") {
                      e.preventDefault();
                    }
                  }}
                  style={{
                    display: "inline-block",
                    padding: "11px 15px",
                    background: "#111827",
                    color: "#fff",
                    border: "none",
                    borderRadius: "7px",
                    cursor:
                      action.link === "#"
                        ? "default"
                        : "pointer",
                    textDecoration: "none",
                  }}
                >
                  + {action.label}
                </a>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: "25px",
              background: "#fff",
              padding: "22px",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Recent Activity</h3>

            <p style={{ color: "#6b7280" }}>
              No transactions recorded yet.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
