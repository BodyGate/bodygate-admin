"use client";

import Link from "next/link";
import { useCurrentPermissions } from "../../hooks/useCurrentPermissions";

export default function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { loading, hasPermission, roleKey, staffName, isAdmin } = useCurrentPermissions();
  const section = "questa sezione";

  if (loading) {
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
            width: "min(520px, 100%)",
            borderRadius: 28,
            padding: 28,
            background:
              "radial-gradient(circle at top left, rgba(91,61,245,0.20), transparent 36%), linear-gradient(135deg, rgba(24,24,27,0.98), rgba(5,5,6,0.98))",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 28px 90px rgba(0,0,0,0.46)",
          }}
        >
          <p style={{ color: "#f87171", textTransform: "uppercase", letterSpacing: 2, fontSize: 12, fontWeight: 950, margin: 0 }}>
            BodyGate Security
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 950, margin: "10px 0" }}>
            Verifica permessi in corso
          </h1>
          <p style={{ color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
            Stiamo validando sessione, ruolo e permessi prima di aprire la sezione richiesta.
          </p>
        </section>
      </main>
    );
  }

  if (!hasPermission(permission)) {
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
            maxWidth: 680,
            width: "100%",
            borderRadius: 30,
            padding: 32,
            background:
              "radial-gradient(circle at top left, rgba(91,61,245,0.24), transparent 34%), linear-gradient(135deg, rgba(24,24,27,0.98), rgba(5,5,6,0.98))",
            border: "1px solid rgba(248,113,113,0.28)",
            boxShadow: "0 28px 90px rgba(0,0,0,0.46)",
          }}
        >
          <p style={{ color: "#f87171", textTransform: "uppercase", letterSpacing: 2, fontSize: 13, fontWeight: 950, margin: 0 }}>
            BodyGate Security
          </p>
          <h1 style={{ fontSize: 38, fontWeight: 950, margin: "12px 0" }}>
            Area protetta
          </h1>
          <p style={{ color: "#cbd5e1", lineHeight: 1.65, marginBottom: 18 }}>
            Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a {section}, chiedi a un amministratore di assegnare il permesso richiesto.
          </p>
          <div style={{ display: "grid", gap: 10, marginBottom: 24, color: "#f8fafc", fontWeight: 800 }}>
            <span>Permesso richiesto: {permission}</span>
            <span>Profilo: {staffName || "sessione non riconosciuta"}</span>
            <span>Ruolo: {roleKey || "non configurato"}{isAdmin ? " · amministrazione" : ""}</span>
          </div>
          <Link href="/" style={{ display: "inline-flex", textDecoration: "none", background: "#5b3df5", color: "white", padding: "13px 18px", borderRadius: 16, fontWeight: 900 }}>
            Torna alla Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
