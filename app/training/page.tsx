import Link from "next/link";

export const dynamic = "force-dynamic";

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.09)",
  background: "linear-gradient(180deg, rgba(24,24,27,0.96), rgba(12,12,13,0.96))",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.07)",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 14,
};

const modules = [
  {
    title: "Libreria esercizi",
    description: "Archivio esercizi con gruppo muscolare, attrezzo, difficoltà, immagini e video.",
    status: "Da configurare",
  },
  {
    title: "Schede allenamento",
    description: "Programmi personalizzati per cliente, divisi per giorni e obiettivi.",
    status: "In preparazione",
  },
  {
    title: "App atleta",
    description: "In futuro il cliente vedrà scheda, progressi e QR accesso dalla PWA mobile.",
    status: "Roadmap",
  },
  {
    title: "Progressi",
    description: "Foto, misure, carichi e storico allenamenti collegati al CRM cliente.",
    status: "Roadmap",
  },
];

export default function TrainingPage() {
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section
        style={{
          ...cardStyle,
          padding: 28,
          background:
            "radial-gradient(circle at top left, rgba(239,68,68,0.22), transparent 34%), linear-gradient(180deg, rgba(24,24,27,0.96), rgba(10,10,12,0.96))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
          <div>
            <div
              style={{
                color: "#f87171",
                fontWeight: 950,
                letterSpacing: "2.5px",
                fontSize: 13,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              BodyGate Training
            </div>

            <h1
              style={{
                color: "#fff",
                fontSize: 42,
                margin: 0,
                letterSpacing: "-1.7px",
                lineHeight: 1.05,
              }}
            >
              Piattaforma allenamenti
            </h1>

            <p style={{ color: "#cbd5e1", margin: "10px 0 0", fontSize: 16, maxWidth: 760 }}>
              Area dedicata a schede, esercizi, progressi e futura app atleta. Questa pagina è pronta per la build
              Vercel e non contiene più SQL dentro il codice React.
            </p>
          </div>

          <Link href="/customers" style={{ ...buttonStyle, background: "#ef4444", minWidth: 150 }}>
            Vai ai clienti
          </Link>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {[
          ["Esercizi", "0", "da importare"],
          ["Schede attive", "0", "in preparazione"],
          ["Atleti", "CRM", "collegati ai clienti"],
          ["Stato", "Ready", "pagina build-safe"],
        ].map(([title, value, subtitle]) => (
          <div key={title} style={cardStyle}>
            <div style={{ color: "#cbd5e1", fontWeight: 900, fontSize: 14 }}>{title}</div>
            <div style={{ color: "#fff", fontSize: 36, fontWeight: 950, marginTop: 12 }}>{value}</div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>{subtitle}</div>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18,
        }}
      >
        {modules.map((module) => (
          <div key={module.title} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
              <div>
                <h2 style={{ color: "#fff", margin: 0, fontSize: 22 }}>{module.title}</h2>
                <p style={{ color: "#94a3b8", margin: "8px 0 0", lineHeight: 1.5 }}>{module.description}</p>
              </div>

              <span
                style={{
                  border: "1px solid rgba(248,113,113,0.28)",
                  background: "rgba(239,68,68,0.12)",
                  color: "#fca5a5",
                  borderRadius: 999,
                  padding: "7px 10px",
                  fontWeight: 900,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                {module.status}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section style={cardStyle}>
        <h2 style={{ color: "#fff", margin: 0, fontSize: 24 }}>Prossimo step consigliato</h2>
        <p style={{ color: "#94a3b8", margin: "8px 0 18px", lineHeight: 1.6 }}>
          Prima di sviluppare le schede, eseguiamo lo SQL delle tabelle training nel Supabase SQL Editor.
          Il codice SQL non deve stare dentro <code>page.tsx</code>, altrimenti Next.js prova a compilarlo come
          TypeScript e la build fallisce.
        </p>

        <div
          style={{
            border: "1px solid rgba(59,130,246,0.18)",
            background: "rgba(59,130,246,0.08)",
            color: "#bfdbfe",
            borderRadius: 16,
            padding: 16,
            lineHeight: 1.55,
            fontSize: 14,
          }}
        >
          Dopo il deploy Vercel completiamo il modulo Training con libreria esercizi, creazione scheda e collegamento
          alla PWA cliente.
        </div>
      </section>
    </div>
  );
}
