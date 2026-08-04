"use client";

import CustomerDetailsClient from "./CustomerDetailsClient";

export default function UnifiedCustomerDetailsClient({
  customerId,
}: {
  customerId: string;
}) {
  return (
    <>
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
          > .bg-button {
          font-size: 0 !important;
        }

        .customer-page
          .bg-card:has(> .credential-section):not(:has(.qr-box)):not(:has(.mobile-pass-url))
          > .credential-section:nth-last-child(2)
          > .bg-button::after {
          content: "Attiva Pass digitale";
          font-size: 13px;
        }

        .customer-page
          .bg-card:has(> .credential-section):not(:has(.qr-box)):has(.mobile-pass-url)
          > .credential-section:nth-last-child(2)
          > .bg-button::after {
          content: "Completa Pass digitale";
          font-size: 13px;
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
          content: "Completa Pass digitale";
          font-size: 13px;
        }

        .customer-page
          .bg-card:has(> .credential-section):has(.qr-box):has(.mobile-pass-url)
          > .credential-section:nth-last-child(2)
          > .actions
          > .bg-button:last-child {
          display: none !important;
        }

        .customer-page .hero-actions > .bg-button:nth-child(4) {
          display: none !important;
        }

        .customer-page .mobile-pass-url {
          margin-top: 2px;
        }
      `}</style>
    </>
  );
}
