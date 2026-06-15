"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const permission = searchParams.get("permission");
  const section = searchParams.get("section");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#050505",
        color: "white",
        padding: 24,
      }}
    >
      <section
        style={{
          maxWidth: 620,
          width: "100%",
          borderRadius: 30,
          padding: 32,
          background:
            "radial-gradient(circle at top left, rgba(239,68,68,0.24), transparent 34%), linear-gradient(135deg, rgba(24,24,27,0.98), rgba(5,5,6,0.98))",
          border: "1px solid rgba(248,113,113,0.35)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.46)",
        }}
      >
        <p style={{ color: "#f87171", textTransform: "uppercase", letterSpacing: 2, fontSize: 13, fontWeight: 950, margin: 0 }}>
          BodyGate Security
        </p>

        <h1 style={{ fontSize: 42, fontWeight: 950, margin: "12px 0" }}>
          Accesso negato
        </h1>

        <p style={{ color: "#cbd5e1", lineHeight: 1.65, marginBottom: 18 }}>
          Questa è una pagina di fallback: la sidebar non deve usarla come destinazione normale. La sezione richiesta è protetta oppure i permessi non sono ancora configurati per il tuo profilo.
        </p>

        <div style={{ display: "grid", gap: 8, marginBottom: 24, color: "#f8fafc", fontWeight: 800 }}>
          <span>Sezione: {section || "non specificata"}</span>
          <span>Permesso richiesto: {permission || "non specificato"}</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ display: "inline-flex", textDecoration: "none", background: "#ef4444", color: "white", padding: "13px 18px", borderRadius: 16, fontWeight: 900 }}>
            Torna alla Dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            style={{ display: "inline-flex", border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.07)", color: "white", padding: "13px 18px", borderRadius: 16, fontWeight: 900, cursor: "pointer" }}
          >
            Torna indietro
          </button>
        </div>
      </section>
    </main>
  );
}


export default function AccessDeniedPage() {
  return (
    <Suspense fallback={null}>
      <AccessDeniedContent />
    </Suspense>
  );
}
