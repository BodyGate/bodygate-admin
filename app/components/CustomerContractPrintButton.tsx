"use client";

import Link from "next/link";

export default function CustomerContractPrintButton({
  customerId,
}: {
  customerId: string;
}) {
  return (
    <div className="no-print" style={toolbarStyle}>
      <Link href={`/customers/${customerId}`} style={secondaryButtonStyle}>
        ← Torna alla scheda
      </Link>
      <button type="button" onClick={() => window.print()} style={primaryButtonStyle}>
        Stampa / Salva PDF
      </button>
    </div>
  );
}

const toolbarStyle: React.CSSProperties = {
  width: "210mm",
  margin: "0 auto 18px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "linear-gradient(to right, #5b3df5, #dc2626)",
  color: "white",
  border: "none",
  borderRadius: "14px",
  padding: "13px 18px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "13px 18px",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};
