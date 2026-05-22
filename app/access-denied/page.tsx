export default function AccessDeniedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#020617",
        color: "white",
        padding: 24,
      }}
    >
      <section
        style={{
          maxWidth: 560,
          width: "100%",
          borderRadius: 28,
          padding: 32,
          background:
            "linear-gradient(135deg, rgba(239,68,68,0.22), rgba(15,23,42,0.96))",
          border: "1px solid rgba(248,113,113,0.35)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        }}
      >
        <p
          style={{
            color: "#f87171",
            textTransform: "uppercase",
            letterSpacing: 2,
            fontSize: 13,
            fontWeight: 900,
            margin: 0,
          }}
        >
          BodyGate Security
        </p>

        <h1
          style={{
            fontSize: 42,
            fontWeight: 900,
            margin: "12px 0",
          }}
        >
          Accesso negato
        </h1>

        <p
          style={{
            color: "#cbd5e1",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          Non hai i permessi necessari per visualizzare questa sezione.
          Contatta un amministratore BodyGate.
        </p>

        <a
          href="/"
          style={{
            display: "inline-block",
            textDecoration: "none",
            background: "#ef4444",
            color: "white",
            padding: "13px 18px",
            borderRadius: 16,
            fontWeight: 800,
          }}
        >
          Torna alla Dashboard
        </a>
      </section>
    </main>
  );
}