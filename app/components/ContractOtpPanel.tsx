"use client";

import { useState } from "react";

export default function ContractOtpPanel({
  documentId,
}: {
  documentId: string;
}) {
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generateOtp() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/contracts/send-otp",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            documentId,
          }),
        }
      );

      const result = await response.json();

      if (result.ok) {
        setGeneratedOtp(result.otp);
        setMessage(
          "OTP generato correttamente."
        );
      } else {
        setMessage(
          result.message ||
            "Errore generazione OTP."
        );
      }
    } catch {
      setMessage("Errore server.");
    }

    setLoading(false);
  }

  async function verifyOtp() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/contracts/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            documentId,
            otp,
          }),
        }
      );

      const result = await response.json();

      if (result.ok) {
        setMessage(
          "Documento firmato correttamente."
        );
      } else {
        setMessage(
          result.message ||
            "OTP non valido."
        );
      }
    } catch {
      setMessage("Errore server.");
    }

    setLoading(false);
  }

  return (
    <div
      className="no-print"
      style={{
        width: "210mm",
        margin: "0 auto 20px auto",
        background: "white",
        borderRadius: "18px",
        padding: "22px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "22px",
          fontWeight: "bold",
          color: "black",
        }}
      >
        Firma OTP contratto
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "#555",
        }}
      >
        Genera un codice OTP per confermare
        la firma del contratto.
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "20px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={generateOtp}
          disabled={loading}
          style={buttonStyle}
        >
          Genera OTP
        </button>

        <input
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value)
          }
          placeholder="Inserisci OTP"
          style={inputStyle}
        />

        <button
          onClick={verifyOtp}
          disabled={loading}
          style={buttonStyle}
        >
          Conferma firma
        </button>
      </div>

      {generatedOtp && (
        <div
          style={{
            marginTop: "18px",
            padding: "16px",
            borderRadius: "14px",
            background: "#f3f4f6",
            color: "black",
            fontWeight: "bold",
            fontSize: "24px",
            letterSpacing: "0.2em",
          }}
        >
          OTP: {generatedOtp}
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            borderRadius: "14px",
            background: "#f3f4f6",
            color: "black",
            fontWeight: "bold",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "black",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "14px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: "12px",
  padding: "14px 16px",
  minWidth: "220px",
};