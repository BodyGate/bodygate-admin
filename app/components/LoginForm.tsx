"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@bodygate.it");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        setMessage(result.message || "Login non riuscito.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setMessage("Errore durante il login.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={login} style={formStyle}>
      <div>
        <div style={brandStyle}>BodyGate</div>

        <div style={subtitleStyle}>
          Access Control Platform
        </div>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        <label style={labelStyle}>
          EMAIL
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="Email"
          />
        </label>

        <label style={labelStyle}>
          PASSWORD
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            placeholder="Password"
          />
        </label>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? "Accesso..." : "Accedi"}
      </button>
    </form>
  );
}

const formStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "34px",
  display: "grid",
  gap: "26px",
  boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
};

const brandStyle: React.CSSProperties = {
  fontSize: "42px",
  fontWeight: "bold",
  color: "var(--text)",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: "8px",
  color: "var(--muted)",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  color: "var(--muted)",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "16px",
  outline: "none",
  fontWeight: 600,
};

const buttonStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "16px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "15px",
};

const messageStyle: React.CSSProperties = {
  background: "rgba(239,68,68,0.12)",
  color: "#ef4444",
  border: "1px solid rgba(239,68,68,0.35)",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "bold",
};