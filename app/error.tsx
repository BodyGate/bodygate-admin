"use client";

import BGButton from "./components/ui/BGButton";
import BGInlineAlert from "./components/ui/BGInlineAlert";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="bg-card" role="alert" style={{ maxWidth: 760, margin: "48px auto" }}>
      <div className="bg-eyebrow">Errore applicazione</div>
      <h1 style={{ margin: 0 }}>Qualcosa non ha funzionato</h1>
      <p style={{ color: "var(--bg-text-muted)", lineHeight: 1.6 }}>
        L'operazione non è stata completata. Puoi riprovare ora oppure tornare al Command Center senza perdere il controllo del flusso.
      </p>
      {error.digest ? <BGInlineAlert tone="info">Codice errore: {error.digest}</BGInlineAlert> : null}
      <div className="bg-header-actions" style={{ justifyContent: "flex-start" }}>
        <BGButton onClick={reset}>Riprova</BGButton>
        <BGButton href="/" variant="secondary">Torna al Command Center</BGButton>
      </div>
    </section>
  );
}
