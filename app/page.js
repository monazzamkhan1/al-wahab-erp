"use client";

import { useEffect, useState } from "react";
import Login from "./login";
import { supabase } from "./supabase";

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "30px",
        fontFamily: "Arial, sans-serif",
        background: "#f5f7fa",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <h1>Al Wahab Enterprises</h1>

        <p>
          Pharmaceutical Distribution Management System
        </p>

        <div
          style={{
            marginTop: "30px",
            padding: "25px",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 5px 20px rgba(0,0,0,0.06)",
          }}
        >
          <h2>Dashboard</h2>
          <p>Welcome to Al Wahab Enterprises ERP.</p>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            style={{
              marginTop: "20px",
              padding: "10px 18px",
              background: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}
