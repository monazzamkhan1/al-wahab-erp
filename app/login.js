"use client";

import { useState } from "react";
import { supabase } from "./supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f7fa",
        fontFamily: "Arial, sans-serif",
        padding: "20px",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#fff",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0 5px 25px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginBottom: "8px" }}>
          Al Wahab Enterprises
        </h1>

        <p style={{ color: "#666", marginBottom: "25px" }}>
          ERP Login
        </p>

        <label>Email</label>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "6px",
            marginBottom: "18px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxSizing: "border-box",
          }}
        />

        <label>Password</label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "6px",
            marginBottom: "18px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ color: "red", fontSize: "14px" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px",
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
