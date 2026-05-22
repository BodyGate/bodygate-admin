"use client";

import Link from "next/link";

export default function QuickLinksPanel() {
  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>Backoffice</h2>

      <p style={sectionTextStyle}>
        Gestione clienti, badge, abbonamenti, pagamenti e programmi.
      </p>

      <div style={quickLinksStyle}>
        <Link href="/customers" style={quickLinkStyle}>
          Clienti
        </Link>

        <Link href="/badges" style={quickLinkStyle}>
          Badge
        </Link>

        <Link href="/subscriptions" style={quickLinkStyle}>
          Abbonamenti
        </Link>

        <Link href="/payments" style={quickLinkStyle}>
          Pagamenti
        </Link>
      </div>
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #181818, #101010)",
  border: "1px solid var(--border)",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 12px 35px rgba(0,0,0,0.28)",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--text)",
  fontSize: "22px",
  margin: "0 0 10px",
  letterSpacing: "-0.5px",
};

const sectionTextStyle: React.CSSProperties = {
  color: "var(--muted)",
  margin: "0 0 22px",
  lineHeight: 1.6,
};

const quickLinksStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
};

const quickLinkStyle: React.CSSProperties = {
  background: "var(--panel-2)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  padding: "16px",
  textDecoration: "none",
  fontWeight: 800,
};