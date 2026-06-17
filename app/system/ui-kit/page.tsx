import BGButton from "../../components/ui/BGButton";
import BGCard from "../../components/ui/BGCard";
import BGContentGrid from "../../components/ui/BGContentGrid";
import BGEmptyState from "../../components/ui/BGEmptyState";
import BGInlineAlert from "../../components/ui/BGInlineAlert";
import BGInput from "../../components/ui/BGInput";
import BGPageHeader from "../../components/ui/BGPageHeader";
import BGSelect from "../../components/ui/BGSelect";
import BGStatCard from "../../components/ui/BGStatCard";
import BGStatusBadge from "../../components/ui/BGStatusBadge";
import BGTextarea from "../../components/ui/BGTextarea";
import { BGChecklist, BGErrorState, BGOperationalRow, BGProgress, BGProgressSteps, BGReadinessPanel, BGSkeleton } from "../../components/ui/BGPrimitives";

const swatches = [
  ["Canvas", "var(--bg-canvas)"],
  ["Surface 1", "var(--bg-surface-1)"],
  ["Brand", "var(--bg-brand)"],
  ["Success", "var(--bg-success)"],
  ["Warning", "var(--bg-warning)"],
  ["Danger", "var(--bg-danger)"],
  ["Info", "var(--bg-info)"],
];

export default function UIKitPage() {
  return (
    <div className="bg-ui-kit-page">
      <BGPageHeader
        eyebrow="Sistema"
        title="UI Kit Platinum"
        subtitle="Fondazione visiva e operativa ufficiale BodyGate: token, componenti, stati e pattern riutilizzabili. Le demo sono statiche e non modificano dati operativi."
        actions={<BGButton href="/system" variant="secondary">Torna al Sistema</BGButton>}
      />

      <BGContentGrid>
        <BGCard>
          <h2>Token colore</h2>
          <div className="bg-token-grid">
            {swatches.map(([label, value]) => (
              <div className="bg-token-swatch" key={label}>
                <span style={{ background: value }} />
                <strong>{label}</strong>
                <small>{value}</small>
              </div>
            ))}
          </div>
        </BGCard>

        <BGCard>
          <h2>Typography</h2>
          <p className="bg-eyebrow">Eyebrow operativo</p>
          <h1 style={{ margin: 0 }}>Titolo pagina</h1>
          <p>Testo principale leggibile su desktop e tablet.</p>
          <p style={{ color: "var(--bg-text-muted)" }}>Testo secondario per descrizioni e prossime azioni.</p>
        </BGCard>
      </BGContentGrid>

      <BGCard>
        <h2>Azioni</h2>
        <div className="bg-header-actions" style={{ justifyContent: "flex-start" }}>
          <BGButton>Primaria</BGButton>
          <BGButton variant="secondary">Secondaria</BGButton>
          <BGButton variant="ghost">Neutra</BGButton>
          <BGButton variant="danger">Distruttiva</BGButton>
          <BGButton disabled>Disabilitata</BGButton>
        </div>
      </BGCard>

      <BGContentGrid>
        <BGCard>
          <h2>Form</h2>
          <div style={{ display: "grid", gap: 14 }}>
            <BGInput label="Cliente" placeholder="Cerca cliente" />
            <BGSelect label="Metodo pagamento" defaultValue="card"><option value="card">Carta</option><option value="cash">Contanti</option></BGSelect>
            <BGTextarea label="Nota operativa" placeholder="Scrivi una nota per la reception" />
          </div>
        </BGCard>
        <BGCard>
          <h2>Status e feedback</h2>
          <div className="bg-header-actions" style={{ justifyContent: "flex-start" }}>
            <BGStatusBadge tone="success">Accesso pronto</BGStatusBadge>
            <BGStatusBadge tone="warning">Da verificare</BGStatusBadge>
            <BGStatusBadge tone="danger">Bloccato</BGStatusBadge>
            <BGStatusBadge tone="info">Parziale</BGStatusBadge>
          </div>
          <BGInlineAlert tone="info">Operazione parzialmente completata: completa documento e certificato prima dell'accesso.</BGInlineAlert>
          <BGEmptyState title="Nessun risultato" description="Modifica i filtri o crea un nuovo cliente." />
        </BGCard>
      </BGContentGrid>

      <BGContentGrid>
        <BGStatCard label="Clienti attivi" value="128" note="Esempio demo" tone="green" />
        <BGStatCard label="Accessi oggi" value="42" note="Esempio demo" tone="blue" />
        <BGStatCard label="Criticità" value="3" note="Esempio demo" tone="yellow" />
      </BGContentGrid>

      <BGCard>
        <h2>Pattern workflow</h2>
        <BGProgress value={64} />
        <BGProgressSteps steps={["Dati", "Documenti", "Pagamento", "Accesso", "Verifica"]} active={2} />
        <BGChecklist items={[{ label: "Cliente creato", done: true }, { label: "Pagamento registrato", done: true }, { label: "Certificato medico da completare" }]} />
      </BGCard>

      <BGContentGrid>
        <BGCard>
          <h2>Righe operative e readiness</h2>
          <BGReadinessPanel>
            <BGOperationalRow title="Abbonamento" meta="Attivo fino al 31/12" status={<BGStatusBadge tone="success">Pronto</BGStatusBadge>} />
            <BGOperationalRow title="Certificato medico" meta="Manca validità" status={<BGStatusBadge tone="warning">Da completare</BGStatusBadge>} />
          </BGReadinessPanel>
        </BGCard>
        <BGCard>
          <h2>Loading ed error state</h2>
          <BGSkeleton lines={4} />
          <BGErrorState title="Operazione non completata" description="Riprova senza perdere i dati già inseriti." />
        </BGCard>
      </BGContentGrid>
    </div>
  );
}
