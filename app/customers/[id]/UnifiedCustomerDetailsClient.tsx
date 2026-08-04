"use client";

import { useState, type MouseEvent } from "react";
import CustomerDetailsClient from "./CustomerDetailsClient";
import { supabase } from "../../lib/supabaseClient";

const ACTIVATION_LABELS = [
  "genera qr dnake",
  "attiva pass digitale",
  "completa pass digitale",
  "crea mobile pass",
];

function normalizePhone(value: unknown) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");

  if (!digits) return "";
  return digits.startsWith("39") ? digits : `39${digits}`;
}

export default function UnifiedCustomerDetailsClient({
  customerId,
}: {
  customerId: string;
}) {
  const [working, setWorking] = useState(false);

  async function handleUnifiedPassClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button");

    if (!button || !button.closest(".credential-section")) return;

    const buttonLabel = String(button.textContent || "")
      .trim()
      .toLowerCase();
    const isActivationAction = ACTIVATION_LABELS.some((label) =>
      buttonLabel.includes(label),
    );

    if (!isActivationAction) return;

    event.preventDefault();
    event.stopPropagation();

    if (working) return;

    const whatsAppWindow = window.open("", "_blank");
    setWorking(true);

    try {
      const [response, customerResult] = await Promise.all([
        fetch("/api/customers/ensure-digital-pass", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer_id: customerId }),
        }),
        supabase
          .from("customers")
          .select("first_name, phone")
          .eq("id", customerId)
          .maybeSingle(),
      ]);

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error || "Errore durante la creazione del Pass digitale.",
        );
      }

      const publicBase =
        process.env.NEXT_PUBLIC_BODYGATE_PUBLIC_URL || window.location.origin;
      const passUrl =
        result.pass_url ||
        (result.mobile_url
          ? `${publicBase.replace(/\/$/, "")}${result.mobile_url}`
          : "");

      if (!passUrl) {
        throw new Error("Pass creato, ma il link mobile non è disponibile.");
      }

      if (customerResult.error) {
        console.warn("Impossibile leggere il telefono cliente:", customerResult.error);
      }

      const firstName =
        customerResult.data?.first_name ||
        String(result.customer_name || "").split(" ")[0] ||
        "";
      const phone = normalizePhone(customerResult.data?.phone);
      const message =
        `Ciao ${firstName}, ecco il tuo Pass digitale BodyGate di Body Energy:\n\n` +
        `${passUrl}\n\n` +
        "Aprilo dal telefono e mostra il QR al lettore all'ingresso. " +
        "Puoi salvarlo anche sulla schermata Home.";
      const encodedMessage = encodeURIComponent(message);
      const whatsAppUrl = phone
        ? `https://wa.me/${phone}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;

      if (whatsAppWindow) {
        whatsAppWindow.location.href = whatsAppUrl;
      } else {
        window.open(whatsAppUrl, "_blank");
      }

      window.setTimeout(() => window.location.reload(), 700);
    } catch (error: unknown) {
      if (whatsAppWindow && !whatsAppWindow.closed) {
        whatsAppWindow.close();
      }

      alert(
        error instanceof Error
          ? error.message
          : "Errore imprevisto durante l'attivazione del Pass digitale.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      className={`unified-pass-shell${working ? " unified-pass-working" : ""}`}
      onClickCapture={handleUnifiedPassClick}
    >
      <CustomerDetailsClient customerId={customerId} />
      <style jsx global>{`
        .customer-page
          .bg-card:has(> .credential-section)
          > .credential-section:nth-last-child(2) {
          margin-bottom: 0 !important;
          padding-bottom: 14px !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-bottom: 0 !important;
          border-radius: 22px 22px 0 0 !important;
          background:
            radial-gradient(
              circle at 92% 0%,
              rgba(239, 68, 68, 0.12),
              transparent 38%
            ),
            rgba(8, 8, 10, 0.82) !important;
        }

        .customer-page
          .bg-card:has(> .credential-section)
          > .credential-section:last-child {
          margin-top: 0 !important;
          padding-top: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-top: 0 !important;
          border-radius: 0 0 22px 22px !important;
          background: rgba(8, 8, 10, 0.82) !important;
        }

        .customer-page
          .bg-card:has(> .credential-section)
          > .credential-section:nth-last-child(2)
          > .credential-section-title {
          font-size: 0 !important;
        }

        .customer-page
          .bg-card:has(> .credential-section)
          > .credential-section:nth-last-child(2)
          > .credential-section-title::after {
          content: "Pass digitale BodyGate";
          color: #fff;
          font-size: 16px;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .customer-page
          .bg-card:has(> .credential-section)
          > .credential-section:last-child
          > .credential-section-title,
        .customer-page
          .bg-card:has(> .credential-section)
          > .credential-section:last-child
          > .bg-empty-state {
          display: none !important;
        }

        .customer-page
          .bg-card:has(> .credential-section):not(:has(.qr-box))
          > .credential-section:last-child
          > .actions,
        .customer-page
          .bg-card:has(> .credential-section):not(:has(.mobile-pass-url))
          > .credential-section:last-child
          > .actions {
          display: none !important;
        }

        .customer-page
          .bg-card:has(> .credential-section):has(.qr-box):has(.mobile-pass-url)
          > .credential-section:last-child
          > .actions
          > .bg-button:first-child {
          display: none !important;
        }

        .customer-page
          .bg-card:has(> .credential-section):not(:has(.qr-box))
          > .credential-section:nth-last-child(2)
          > .bg-empty-state
          .bg-empty-title {
          font-size: 0 !important;
        }

        .customer-page
          .bg-card:has(> .credential-section):not(:has(.qr-box))
          > .credential-section:nth-last-child(2)
          > .bg-empty-state
          .bg-empty-title::after {
          content: "Pass digitale non attivo";
          font-size: 16px;
        }

        .customer-page
          .bg-card:has(> .credential-section):not(:has(.qr-box))
          > .credential-section:nth-last-child(2)
          > .bg-button {
          font-size: 0 !important;
        }

        .customer-page
          .bg-card:has(> .credential-section):not(:has(.qr-box))
          > .credential-section:nth-last-child(2)
          > .bg-button::after {
          content: "Crea e invia Pass su WhatsApp";
          font-size: 13px;
        }

        .unified-pass-working
          .customer-page
          .bg-card:has(> .credential-section)
          > .credential-section:nth-last-child(2)
          > .bg-button::after {
          content: "Creazione Pass in corso...";
        }

        .customer-page
          .bg-card:has(> .credential-section):has(.qr-box):not(:has(.mobile-pass-url))
          > .credential-section:nth-last-child(2)
          > .actions
          > .bg-button:first-child {
          display: none !important;
        }

        .customer-page
          .bg-card:has(> .credential-section):has(.qr-box):not(:has(.mobile-pass-url))
          > .credential-section:nth-last-child(2)
          > .actions
          > .bg-button:last-child {
          font-size: 0 !important;
        }

        .customer-page
          .bg-card:has(> .credential-section):has(.qr-box):not(:has(.mobile-pass-url))
          > .credential-section:nth-last-child(2)
          > .actions
          > .bg-button:last-child::after {
          content: "Crea e invia Pass su WhatsApp";
          font-size: 13px;
        }

        .unified-pass-working
          .customer-page
          .bg-card:has(> .credential-section):has(.qr-box):not(:has(.mobile-pass-url))
          > .credential-section:nth-last-child(2)
          > .actions
          > .bg-button:last-child::after {
          content: "Creazione Pass in corso...";
        }

        .customer-page
          .bg-card:has(> .credential-section):has(.qr-box):has(.mobile-pass-url)
          > .credential-section:nth-last-child(2)
          > .actions
          > .bg-button:last-child {
          display: none !important;
        }

        .unified-pass-working .credential-section .bg-button {
          opacity: 0.72;
          cursor: wait !important;
          pointer-events: none;
        }

        .customer-page .hero-actions > .bg-button:nth-child(4) {
          display: none !important;
        }

        .customer-page .mobile-pass-url {
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
