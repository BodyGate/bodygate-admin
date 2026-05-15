"use client";

import Link from "next/link";
import { useState } from "react";

export default function CustomerContractActions({
  customerId,
}: {
  customerId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveDocument() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/customers/${customerId}/documents/create`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.ok) {
        setMessage("Documento salvato in archivio.");
      } else {
        setMessage(result.message || "Errore salvataggio documento.");
      }
    } catch {
      setMessage("Errore durante il salvataggio.");
    }

    setSaving(false);
  }

  return (
    <div className="no-print" style={wrapperStyle}>
      <div style={leftStyle}>
        <Link href={`/customers/${customerId}`} style={secondaryButtonStyle}>
          ← Torna alla scheda
        </Link>

        <button onClick={() => window.print()} style={primaryButtonStyle}>
          Stampa / Salva PDF
        </button>

        <button
          onClick={saveDocument}
          disabled={saving}
          style={{
            ...darkButtonStyle,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Salvataggio..." : "Salva in archivio"}
        </button>
      </div>

      {message && <div style={messageStyle}>{message}</div>}
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  width: "210mm",
  margin: "0 auto 20px auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  background: "white",
  color: "black",
  padding: "14px",
  borderRadius: "18px",
  boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
};

const leftStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "linear-gradient(to right, #ef4444, #dc2626)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "13px 18px",
  fontWeight: 800,
  cursor: "pointer",
};

const darkButtonStyle: React.CSSProperties = {
  background: "#111",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "13px 18px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#111",
  border: "1px solid #ddd",
  borderRadius: "14px",
  padding: "13px 18px",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};

const messageStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "12px",
  background: "#f3f4f6",
  color: "#111",
  fontWeight: 800,
};