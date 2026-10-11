"use client";

import { useState } from "react";

import {
  BGActionBar,
  BGButton,
  BGCard,
  BGInput,
  BGSectionHeader,
  BGStatusBadge,
} from "@/components/bodygate-ui";

export default function ContractOtpPanel({
  documentId,
  customerPhone,
  customerName,
}: {
  documentId: string;
  customerPhone: string;
  customerName: string;
}) {
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generateOtp() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/contracts/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        setGeneratedOtp(result.otp);
        setMessage("OTP generato correttamente.");
      } else {
        setMessage(result.message || "Errore generazione OTP.");
      }
    } catch {
      setMessage("Errore server.");
    }

    setLoading(false);
  }

  function normalizePhone(phone: string) {
    const clean = phone.replace(/[^\d]/g, "");

    if (!clean) return "";

    if (clean.startsWith("39")) {
      return clean;
    }

    if (clean.startsWith("0")) {
      return `39${clean}`;
    }

    return `39${clean}`;
  }

  function sendWhatsappOtp() {
    if (!generatedOtp) {
      setMessage("Genera prima l'OTP.");
      return;
    }

    const phone = normalizePhone(customerPhone);

    if (!phone) {
      setMessage("Numero telefono cliente mancante. Inserisci il numero nella scheda cliente.");
      return;
    }

    const text = encodeURIComponent(
      `Ciao ${customerName || "cliente"},\n\n` +
        `il tuo codice OTP BodyGate per firmare il contratto è:\n\n` +
        `${generatedOtp}\n\n` +
        `Non condividere questo codice con altre persone.`
    );

    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  }

  async function verifyOtp() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/contracts/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          otp,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        setMessage("Documento firmato correttamente.");
      } else {
        setMessage(result.message || "OTP non valido.");
      }
    } catch {
      setMessage("Errore server.");
    }

    setLoading(false);
  }

  return (
    <BGCard className="no-print">
      <BGSectionHeader
        title="Firma OTP contratto"
        subtitle="Genera il codice OTP e invialo al cliente tramite WhatsApp."
      />

      <BGActionBar>
        <BGButton onClick={generateOtp} disabled={loading}>
          Genera OTP
        </BGButton>

        <BGButton
          variant="secondary"
          onClick={sendWhatsappOtp}
          disabled={!generatedOtp}
        >
          Invia OTP WhatsApp
        </BGButton>

        <BGInput
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Inserisci OTP"
        />

        <BGButton onClick={verifyOtp} disabled={loading}>
          Conferma firma
        </BGButton>
      </BGActionBar>

      {generatedOtp && (
        <BGCard variant="soft">
          <BGStatusBadge tone="info">OTP: {generatedOtp}</BGStatusBadge>
        </BGCard>
      )}

      {message && (
        <BGCard variant="soft" role="status">
          {message}
        </BGCard>
      )}
    </BGCard>
  );
}
