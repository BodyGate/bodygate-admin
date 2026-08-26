"use client";

import { BGButton, BGCard } from "@/components/bodygate-ui";
import { useEffect, useMemo, useState } from "react";

type Risk = "critical" | "medium" | "low" | "ok";
type AuditItem = { id: string; code: string; risk: Risk; category: string; source: string; owner: string; credential_status: string; owner_status: string; explanation: string; recommended_action: string; debug_url: string; technical: Record<string, unknown> };
type Summary = { total_credentials: number; critical: number; medium: number; low: number; duplicates: number; suspicious: number; without_owner: number; customer_staff_overlaps: number; ok_records: number };
type Payload = { summary: Summary; items: AuditItem[]; warnings?: string[]; generated_at?: string; diagnostic_only?: boolean };
type Filter = "all" | "critical" | "medium" | "low" | "duplicates" | "suspicious" | "ownerless" | "overlap" | "ok";

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Tutte" }, { key: "critical", label: "Critiche" }, { key: "medium", label: "Medie" }, { key: "low", label: "Basse" }, { key: "duplicates", label: "Duplicate" }, { key: "suspicious", label: "Test/Sospette" }, { key: "ownerless", label: "Senza proprietario" }, { key: "overlap", label: "Cliente/Staff" }, { key: "ok", label: "OK" },
];

function StatusBadge({ tone = "neutral", label }: { tone?: "success" | "danger" | "warning" | "info" | "neutral"; label: string }) {
  const className = tone === "neutral" ? "bg-status" : `bg-status bg-status-${tone}`;
  return <span className={className}>{label}</span>;
}
function riskTone(risk: Risk) { return risk === "critical" ? "danger" : risk === "medium" ? "warning" : risk === "low" ? "info" : "success"; }
function kpiTone(value: number, danger = false) { return value ? (danger ? "danger" : "warning") : "success"; }

export default function CredentialsAuditPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  async function loadAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/access/credentials-audit", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Audit non riuscito");
      setPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAudit();
  }, []);

  const filtered = useMemo(() => {
    const items = payload?.items || [];
    if (filter === "all") return items;
    if (filter === "ok") return [];
    if (filter === "duplicates") return items.filter((i) => i.category.toLowerCase().includes("duplic"));
    if (filter === "suspicious") return items.filter((i) => i.category === "Test/Sospetta");
    if (filter === "ownerless") return items.filter((i) => i.category === "Senza proprietario");
    if (filter === "overlap") return items.filter((i) => i.category === "Cliente/Staff");
    return items.filter((i) => i.risk === filter);
  }, [payload, filter]);

  const summary = payload?.summary;
  const kpis = [
    ["Totale credenziali", summary?.total_credentials ?? 0, "info"],
    ["Critiche", summary?.critical ?? 0, kpiTone(summary?.critical ?? 0, true)],
    ["Medie", summary?.medium ?? 0, "warning"],
    ["Basse", summary?.low ?? 0, "info"],
    ["Duplicate", summary?.duplicates ?? 0, "warning"],
    ["Senza proprietario", summary?.without_owner ?? 0, kpiTone(summary?.without_owner ?? 0, true)],
    ["Cliente/Staff sovrapposte", summary?.customer_staff_overlaps ?? 0, kpiTone(summary?.customer_staff_overlaps ?? 0, true)],
  ] as const;

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(91,61,245,0.28),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(255,255,255,0.10),transparent_26%),linear-gradient(180deg,rgba(5,5,5,0),#050505_72%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="bg-page-header !mb-0">
          <div>
            <div className="bg-eyebrow">BodyGate Premium · Access Control</div>
            <h1>Audit Credenziali Accesso</h1>
            <p>Controllo badge, QR e credenziali staff senza modificare la logica di apertura</p>
          </div>
          <div className="bg-header-actions">
            <StatusBadge tone="info" label="Solo diagnostica" />
            <BGButton href="/access-control/debug" variant="ghost">Debug Center</BGButton>
            <BGButton href="/access-control" variant="secondary">Access Control</BGButton>
          </div>
        </header>

        {loading ? <BGCard variant="premium"><div className="grid gap-4"><div className="bg-eyebrow">Audit in corso</div><div className="h-4 w-2/3 animate-pulse rounded-full bg-white/15" /><div className="h-24 animate-pulse rounded-3xl bg-red-500/10" /><p className="text-sm font-bold text-zinc-300">Analisi read-only di credenziali clienti, badge legacy e staff...</p></div></BGCard> : null}
        {error ? <BGCard variant="danger"><div className="bg-section-header !mb-0"><div><h2>Audit non disponibile</h2><p>{error}</p></div><BGButton onClick={loadAudit} variant="secondary">Riprova</BGButton></div></BGCard> : null}

        {summary && !loading && !error ? <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {kpis.map(([label, value, tone]) => <BGCard key={label} variant="soft" className="!p-5"><div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{label}</div><div className="mt-3 text-4xl font-black">{value}</div><div className="mt-3"><StatusBadge tone={tone} label={value ? "attenzione" : "ok"} /></div></BGCard>)}
          </section>
          <BGCard variant="premium"><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item.key} onClick={() => setFilter(item.key)} className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${filter === item.key ? "border-red-400 bg-red-500/25 text-white" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-red-400/60"}`}>{item.label}</button>)}</div>{payload.warnings?.length ? <p className="mt-4 text-sm font-bold text-amber-200">Warning tecnici: {payload.warnings.join(" · ")}</p> : null}</BGCard>
          {filter === "ok" ? <BGCard variant="success"><div className="bg-section-header !mb-0"><div><h2>Record OK</h2><p>{summary.ok_records} credenziali non hanno anomalie operative rilevate dall&apos;audit.</p></div><StatusBadge tone="success" label="OK" /></div></BGCard> : null}
          {filter !== "ok" && !filtered.length ? <BGCard variant="success"><div className="text-center"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-emerald-400/15 text-3xl">✓</div><h2 className="text-3xl font-black">Nessuna anomalia rilevata</h2><p className="mt-2 text-sm font-bold text-zinc-300">La vista selezionata non contiene problemi da mostrare.</p></div></BGCard> : null}
          <section className="grid gap-4">{filtered.map((item) => <BGCard key={item.id} variant={item.risk === "critical" ? "danger" : item.risk === "medium" ? "warning" : "soft"}>
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start"><div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={riskTone(item.risk)} label={item.risk === "critical" ? "Rischio alto" : item.risk === "medium" ? "Rischio medio" : "Rischio basso"} /><StatusBadge label={item.category} /><span className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm font-black text-white">{item.code}</span></div><h2 className="mt-4 text-2xl font-black">{item.explanation}</h2><p className="mt-2 text-sm font-bold text-zinc-300">Azione consigliata: {item.recommended_action}</p></div><BGButton href={item.debug_url} variant="secondary">Apri nel Debug Center</BGButton></div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Info label="Fonte" value={item.source} /><Info label="Proprietario" value={item.owner} /><Info label="Stato credenziale" value={item.credential_status} /><Info label="Stato cliente/staff" value={item.owner_status} /></div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-300">Dettaglio tecnico sintetico</div><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Object.entries(item.technical || {}).slice(0, 8).map(([key, value]) => <Info key={key} label={key.replaceAll("_", " ")} value={String(value ?? "—")} />)}</div></div>
          </BGCard>)}</section>
        </> : null}
      </div>
    </main>
  );
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="bg-field-label">{label}</div><div className="mt-2 break-words text-sm font-extrabold text-zinc-100">{value || "—"}</div></div>; }
