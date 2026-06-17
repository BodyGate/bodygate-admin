import BGButton from "./components/ui/BGButton";

export default function NotFound() {
  return (
    <section className="bg-card" style={{ maxWidth: 760, margin: "48px auto" }}>
      <div className="bg-eyebrow">Pagina non trovata</div>
      <h1 style={{ margin: 0 }}>Questa area non è disponibile</h1>
      <p style={{ color: "var(--bg-text-muted)", lineHeight: 1.6 }}>
        Il collegamento potrebbe essere cambiato o il modulo potrebbe non essere ancora operativo. Torna al Command Center e scegli una destinazione disponibile.
      </p>
      <div className="bg-header-actions" style={{ justifyContent: "flex-start" }}>
        <BGButton href="/">Torna al Command Center</BGButton>
      </div>
    </section>
  );
}
