"use client";

import { BGButton, BGCard } from "@/components/bodygate-ui";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type DebugMatch = {
  source?: string;
  field?: string;
  id?: string | null;
  owner_type?: string;
  owner_id?: string | null;
  code?: string;
  active?: boolean | null;
  status?: string | null;
};

type DebugPerson = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  branch_id?: string | null;
  is_active?: boolean;
  role?: string | null;
  badge_code?: string | null;
  controller_code?: string | null;
};

type DebugCheck = {
  status?: string;
  required?: boolean;
  active_matches?: number;
  inactive_matches?: number;
  customer_fields?: Record<string, unknown>;
  latest_records?: unknown[];
  item?: Record<string, unknown> | null;
  items?: Record<string, unknown>[];
};

type DebugResponse = {
  input?: { code?: string; variants?: string[]; checked_at?: string };
  matches?: DebugMatch[];
  owner_type?: string;
  customer?: DebugPerson | null;
  staff?: DebugPerson | null;
  checks?: Record<string, DebugCheck>;
  warnings?: string[];
  final_allowed?: boolean;
  final_reason?: string;
  simulation_only?: boolean;
};

type Tone = "success" | "danger" | "warning" | "info" | "neutral";

const POSITIVE_STATUSES = new Set(["valid", "active", "clear", "not_required", "valid_or_legacy"]);
const WARNING_STATUSES = new Set(["not_checked", "unknown", "legacy"]);

function statusTone(status?: string): Tone {
  if (!status) return "neutral";
  if (POSITIVE_STATUSES.has(status)) return "success";
  if (WARNING_STATUSES.has(status)) return "warning";
  return "danger";
}

function StatusBadge({ tone = "neutral", label }: { tone?: Tone; label: string }) {
  const className = tone === "neutral" ? "bg-status" : `bg-status bg-status-${tone}`;
  return <span className={className}>{label}</span>;
}


function TechnicalSummary({ data }: { data: DebugResponse }) {
  const checks = Object.entries(data.checks || {});
  return (
    <BGCard variant="soft">
      <div className="bg-section-header">
        <div>
          <h2>Dettaglio tecnico sintetico</h2>
          <p>Dati diagnostici resi in formato leggibile, senza JSON grezzo in pagina.</p>
        </div>
        <StatusBadge tone={data.final_allowed ? "success" : "warning"} label={data.simulation_only ? "simulazione" : "diagnostica"} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <FieldRow label="Codice verificato" value={data.input?.code} />
        <FieldRow label="Verificato il" value={data.input?.checked_at} />
        <FieldRow label="Esito finale" value={data.final_reason} />
        {checks.map(([key, check]) => (
          <FieldRow key={key} label={key.replaceAll("_", " ")} value={check.status || "n/d"} />
        ))}
      </div>
    </BGCard>
  );
}

function DiagnosticCard({ title, status, children }: { title: string; status?: string; children: ReactNode }) {
  return (
    <BGCard variant="soft" className="min-h-full">
      <div className="bg-section-header !mb-0">
        <div>
          <h2>{title}</h2>
        </div>
        <StatusBadge tone={statusTone(status)} label={status || "n/d"} />
      </div>
      <div className="grid gap-3">{children}</div>
    </BGCard>
  );
}

function FieldRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="bg-label-value-row rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <span className="bg-field-label">{label}</span>
      <span className="min-w-0 break-words text-sm font-extrabold text-zinc-100">{value ?? "—"}</span>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "Disponibile nel dettaglio tecnico";
}

function CheckSummary({ check }: { check?: DebugCheck }) {
  if (!check) return <p className="bg-empty-description">Controllo non eseguito per questo codice.</p>;
  const rows = Object.entries(check).filter(([key]) => key !== "status").slice(0, 4);
  return rows.length ? rows.map(([key, value]) => <FieldRow key={key} label={key.replaceAll("_", " ")} value={compactValue(value)} />) : <p className="bg-empty-description">Nessun dato aggiuntivo disponibile.</p>;
}

export default function AccessControlDebugPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialCode = new URLSearchParams(window.location.search).get("code");
    if (initialCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(initialCode);
    }
  }, []);


  const checks = useMemo(() => result?.checks || {}, [result]);
  const owner = result?.customer || result?.staff || null;
  const finalTone: Tone = result?.final_allowed ? "success" : "danger";

  async function runDebug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/access/debug-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await res.json()) as DebugResponse;
      setResult(json);
      if (!res.ok) setError(json.final_reason || "Diagnostica non riuscita");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(91,61,245,0.28),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(255,255,255,0.10),transparent_26%),linear-gradient(180deg,rgba(5,5,5,0),#050505_72%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="bg-page-header !mb-0">
          <div>
            <div className="bg-eyebrow">BodyGate Premium · Access Control</div>
            <h1>Access Control Debug Center</h1>
            <p>Diagnostica badge/QR in simulazione sicura</p>
          </div>
          <div className="bg-header-actions">
            <StatusBadge tone="info" label="Simulation only" />
            <BGButton href="/access-control" variant="ghost">← Access Control</BGButton>
            <BGButton href="/access-control/credentials-audit" variant="secondary">Audit credenziali</BGButton>
            <BGButton href="/" variant="secondary">Dashboard</BGButton>
          </div>
        </header>

        <BGCard variant="premium">
          <div className="bg-section-header !mb-0">
            <div>
              <h2>Ricerca credenziale</h2>
              <p>Inserisci o scansiona un codice badge/QR: la verifica usa solo la route di debug e non apre varchi.</p>
            </div>
            {loading ? <StatusBadge tone="info" label="Analisi in corso" /> : <StatusBadge label="Pronto" />}
          </div>
          <form onSubmit={runDebug} className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="bg-field">
              <span className="bg-field-label">Codice badge / QR</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="bg-input !min-h-[58px] !text-base"
                placeholder="Scansiona o inserisci codice..."
                autoFocus
                disabled={loading}
              />
            </label>
            <BGButton type="submit" disabled={loading || !code.trim()} className="!min-h-[58px] !px-7">
              {loading ? "Analisi..." : "Analizza codice"}
            </BGButton>
          </form>
          {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-extrabold text-red-100">{error}</div> : null}
        </BGCard>

        {result ? (
          <>
            <BGCard variant={result.final_allowed ? "success" : "danger"}>
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="bg-eyebrow">Esito finale</div>
                  <h2 className={`text-4xl font-black tracking-tight md:text-6xl ${result.final_allowed ? "text-emerald-200" : "text-red-100"}`}>
                    {result.final_allowed ? "ACCESSO CONSENTITO" : "ACCESSO NEGATO"}
                  </h2>
                  <p className="mt-3 max-w-3xl text-lg font-bold text-white">{result.final_reason || "Motivo non disponibile"}</p>
                  <p className="mt-3 text-sm font-semibold text-zinc-300">Simulazione sicura: nessuna apertura tornello, nessun log accesso</p>
                </div>
                <StatusBadge tone={finalTone} label={result.final_allowed ? "consentito" : "negato"} />
              </div>
            </BGCard>

            <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              <DiagnosticCard title="Input ricevuto" status="valid">
                <FieldRow label="Codice" value={<span className="font-mono">{result.input?.code || "—"}</span>} />
                <FieldRow label="Varianti normalizzate" value={(result.input?.variants || []).join(" · ") || "—"} />
                <FieldRow label="Verificato il" value={formatDateTime(result.input?.checked_at)} />
              </DiagnosticCard>

              <DiagnosticCard title="Dove è stato trovato" status={result.matches?.length ? result.owner_type || "found" : "missing"}>
                <FieldRow label="Owner type" value={result.owner_type || "none"} />
                <FieldRow label="Corrispondenze" value={result.matches?.length || 0} />
                {result.matches?.slice(0, 3).map((match, index) => <FieldRow key={`${match.source}-${index}`} label={match.source || `match ${index + 1}`} value={`${match.field || "campo"} · ${match.status || "n/d"}`} />)}
              </DiagnosticCard>

              <DiagnosticCard title="Cliente/Staff" status={checks.customer?.status || checks.staff?.status || (owner ? "active" : "missing")}>
                <FieldRow label="Nome" value={owner?.name} />
                <FieldRow label="Email" value={owner?.email} />
                <FieldRow label="Telefono" value={owner?.phone} />
                <FieldRow label="Ruolo/Sede" value={owner?.role || owner?.branch_id} />
              </DiagnosticCard>

              <DiagnosticCard title="Credenziale" status={checks.credential?.status}><CheckSummary check={checks.credential} /></DiagnosticCard>
              <DiagnosticCard title="Abbonamento" status={checks.subscription?.status}><CheckSummary check={checks.subscription} /></DiagnosticCard>
              <DiagnosticCard title="Certificato medico" status={checks.medical_certificate?.status}><CheckSummary check={checks.medical_certificate} /></DiagnosticCard>
              <DiagnosticCard title="Quota associativa" status={checks.membership_fee?.status}><CheckSummary check={checks.membership_fee} /></DiagnosticCard>
              <DiagnosticCard title="Blocchi" status={checks.blocks?.status}><CheckSummary check={checks.blocks} /></DiagnosticCard>
              <DiagnosticCard title="Warning/anomalie" status={result.warnings?.length ? "warning" : "clear"}>
                {result.warnings?.length ? result.warnings.map((warning, index) => <div key={`${warning}-${index}`} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">{warning}</div>) : <p className="bg-empty-description">Nessun warning rilevato.</p>}
              </DiagnosticCard>
            </section>

            <TechnicalSummary data={result} />
          </>
        ) : null}
      </div>
    </main>
  );
}
