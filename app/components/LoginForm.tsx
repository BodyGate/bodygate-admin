"use client";

import { useState } from "react";
import { BGButton, BGInput } from "@/components/bodygate-ui";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function doLogin() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(result.message || "Login non riuscito.");
        setLoading(false);
        return;
      }

      window.location.replace("/");
    } catch {
      setMessage("Errore durante il login.");
      setLoading(false);
    }
  }

  return (
    <div className={styles.form}>
      <div>
        <div className={styles.brand}>BodyGate</div>

        <div className={styles.subtitle}>
          Access Control Platform
        </div>
      </div>

      <div className={styles.fields}>
        <label className={styles.label}>
          EMAIL
          <BGInput
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
        </label>

        <label className={styles.label}>
          PASSWORD
          <BGInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </label>
      </div>

      {message && <div className={styles.message}>{message}</div>}

      <BGButton
        onClick={doLogin}
        disabled={loading}
        className={styles.submit}
      >
        {loading ? "Accesso..." : "Accedi"}
      </BGButton>
    </div>
  );
}
