import { BGCard, BGPageHeader, BGPageShell, BGStatusBadge } from "@/components/bodygate-ui"
import Link from "next/link"
import styles from "./access-control.module.css"


const activeCards = [
  {
    title: "Debug Center",
    href: "/access-control/debug",
    description:
      "Simula badge/QR e spiega il motivo dell'accesso consentito o negato senza aprire il tornello.",
    status: "Disponibile",
  },
  {
    title: "Audit Credenziali",
    href: "/access-control/credentials-audit",
    description:
      "Analizza duplicati, codici test, credenziali sospette, cliente/staff sovrapposti e proprietari mancanti.",
    status: "Disponibile",
  },
  {
    title: "Registro accessi",
    href: "/access-logs",
    description:
      "Consulta lo storico transiti dalla console operativa senza avviare comandi sul tornello.",
    status: "Disponibile",
  },
]

const disabledCards = [
  {
    title: "Accessi negati",
    description:
      "Analisi separata dei tentativi negati e delle motivazioni piu frequenti.",
    status: "In sviluppo",
  },
  {
    title: "Stato Bridge/Tornello",
    description:
      "Monitor tecnico dedicato allo stato del collegamento fisico e dei controller.",
    status: "Monitoraggio non disponibile",
  },
  {
    title: "Configurazione accessi",
    description:
      "Pannello protetto per policy e parametri accesso quando sara disponibile.",
    status: "Protetto / In sviluppo",
  },
]

function StatusBadge({
  tone,
  label,
}: {
  tone: "success" | "warning" | "info"
  label: string
}) {
  return <BGStatusBadge tone={tone}>{label}</BGStatusBadge>
}

function ActiveCard({ card }: { card: (typeof activeCards)[number] }) {
  return (
    <Link
      href={card.href}
      className={styles.cardLink}
    >
      <div className={styles.disabledContent}>
        <div className={styles.cardTop}>
          <StatusBadge tone="success" label={card.status} />
          <span className={styles.openLabel}>
            Apri
          </span>
        </div>
        <div>
          <h2 className={styles.cardTitle}>{card.title}</h2>
          <p className={styles.cardDescription}>
            {card.description}
          </p>
        </div>
        <div className={styles.cardDestination}>
          Vai a {card.href}
        </div>
      </div>
    </Link>
  )
}

function DisabledCard({ card }: { card: (typeof disabledCards)[number] }) {
  return (
    <BGCard variant="soft" className={styles.disabledCard}>
      <div className={styles.disabledContent}>
        <div className={styles.cardTop}>
          <StatusBadge tone="warning" label={card.status} />
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
            Non cliccabile
          </span>
        </div>
        <div>
          <h2 className={styles.disabledTitle}>
            {card.title}
          </h2>
          <p className={styles.cardDescription}>
            {card.description}
          </p>
        </div>
        <p className={styles.disabledNotice}>
          Funzione non operativa: nessuna azione collegata finche il modulo
          reale non sara disponibile.
        </p>
      </div>
    </BGCard>
  )
}

export default function AccessControlHubPage() {
  return (
    <main>
      <BGPageShell>
        <BGPageHeader
          eyebrow="BodyGate Premium - Modulo Accessi"
          title="Access Control"
          subtitle="Diagnostica, audit e controllo credenziali senza modificare la pipeline reale del tornello."
          actions={<StatusBadge tone="success" label="Operativo" />}
        />

        <section className={styles.grid}>
          {activeCards.map((card) => (
            <ActiveCard key={card.href} card={card} />
          ))}
        </section>

        <section className={styles.grid}>
          {disabledCards.map((card) => (
            <DisabledCard key={card.title} card={card} />
          ))}
        </section>
      </BGPageShell>
    </main>
  )
}
