import Link from "next/link";
import BGCard from "../components/ui/BGCard";

const activeCards = [
  {
    title: "Debug Center",
    href: "/access-control/debug",
    description:
      "Simula badge/QR e spiega il motivo dell’accesso consentito o negato senza aprire il tornello.",
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
];

const disabledCards = [
  {
    title: "Accessi negati",
    description: "Analisi separata dei tentativi negati e delle motivazioni più frequenti.",
    status: "In sviluppo",
  },
  {
    title: "Stato Bridge/Tornello",
    description: "Monitor tecnico dedicato allo stato del collegamento fisico e dei controller.",
    status: "Monitoraggio non disponibile",
  },
  {
    title: "Configurazione accessi",
    description: "Pannello protetto per policy e parametri accesso quando sarà disponibile.",
    status: "Protetto / In sviluppo",
  },
];

function StatusBadge({ tone, label }: { tone: "success" | "warning" | "info"; label: string }) {
  return <span className={`bg-status bg-status-${tone}`}>{label}</span>;
}

function ActiveCard({ card }: { card: (typeof activeCards)[number] }) {
  return (
    <Link
      href={card.href}
      className="group block rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(127,29,29,0.18))] p-6 text-white shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-red-400/60 hover:shadow-red-950/30 focus:outline-none focus:ring-2 focus:ring-red-400/70"
    >
      <div className="flex min-h-full flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge tone="success" label={card.status} />
          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100 transition group-hover:bg-red-500/20">
            Apri
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight">{card.title}</h2>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-300">{card.description}</p>
        </div>
        <div className="mt-auto text-sm font-black uppercase tracking-[0.16em] text-red-200">
          Vai a {card.href}
        </div>
      </div>
    </Link>
  );
}

function DisabledCard({ card }: { card: (typeof disabledCards)[number] }) {
  return (
    <BGCard variant="soft" className="opacity-75">
      <div className="flex min-h-full flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge tone="warning" label={card.status} />
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
            Non cliccabile
          </span>
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-100">{card.title}</h2>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-400">{card.description}</p>
        </div>
        <p className="mt-auto rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-extrabold text-amber-100">
          Funzione non operativa: nessuna azione collegata finché il modulo reale non sarà disponibile.
        </p>
      </div>
    </BGCard>
  );
}

export default function AccessControlHubPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(239,68,68,0.30),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(255,255,255,0.10),transparent_26%),linear-gradient(180deg,rgba(5,5,5,0),#050505_72%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="bg-page-header !mb-0">
          <div>
            <div className="bg-eyebrow">BodyGate Premium · Modulo Accessi</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1>Access Control</h1>
              <StatusBadge tone="success" label="Operativo" />
            </div>
            <p>Centro controllo accessi BodyGate</p>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-zinc-300">
              Diagnostica, audit e controllo credenziali senza modificare la pipeline reale del tornello.
            </p>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          {activeCards.map((card) => (
            <ActiveCard key={card.href} card={card} />
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {disabledCards.map((card) => (
            <DisabledCard key={card.title} card={card} />
          ))}
        </section>
      </div>
    </main>
  );
}
