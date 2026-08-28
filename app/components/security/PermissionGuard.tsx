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
          background: "var(--bg)",
          color: "var(--text)",
          padding: 24,
        }}
      >
        <section
          style={{
            width: "min(520px, 100%)",
            borderRadius: 28,
            padding: 28,
            background:
              "radial-gradient(circle at top left, rgba(91,61,245,0.06), transparent 36%), var(--panel)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 2px rgba(21,22,28,0.04), 0 12px 32px -12px rgba(21,22,28,0.1)",
          }}
        >
          <p style={{ color: "var(--accent)", textTransform: "uppercase", letterSpacing: 2, fontSize: 12, fontWeight: 950, margin: 0 }}>
            BodyGate Security
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 950, margin: "10px 0" }}>
            Verifica permessi in corso
          </h1>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
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
          background: "var(--bg)",
          color: "var(--text)",
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
              "radial-gradient(circle at top left, rgba(214,49,74,0.08), transparent 34%), var(--panel)",
            border: "1px solid rgba(214,49,74,0.28)",
            boxShadow: "0 1px 2px rgba(21,22,28,0.04), 0 12px 32px -12px rgba(21,22,28,0.1)",
          }}
        >
          <p style={{ color: "var(--danger)", textTransform: "uppercase", letterSpacing: 2, fontSize: 13, fontWeight: 950, margin: 0 }}>
            BodyGate Security
          </p>
          <h1 style={{ fontSize: 38, fontWeight: 950, margin: "12px 0" }}>
            Area protetta
          </h1>
          <p style={{ color: "var(--muted)", lineHeight: 1.65, marginBottom: 18 }}>
            Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a {section}, chiedi a un amministratore di assegnare il permesso richiesto.
          </p>
          <div style={{ display: "grid", gap: 10, marginBottom: 24, color: "var(--text)", fontWeight: 800 }}>
            <span>Permesso richiesto: {permission}</span>
            <span>Profilo: {staffName || "sessione non riconosciuta"}</span>
            <span>Ruolo: {roleKey || "non configurato"}{isAdmin ? " · amministrazione" : ""}</span>
          </div>
          <Link href="/" style={{ display: "inline-flex", textDecoration: "none", background: "var(--accent)", color: "white", padding: "13px 18px", borderRadius: 16, fontWeight: 900 }}>
            Torna alla Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
