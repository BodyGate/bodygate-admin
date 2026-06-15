"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type DebugResponse = {
  input?: { code?: string; checked_at?: string };
  matches?: any[];
  owner_type?: string;
  customer?: any;
  staff?: any;
  checks?: Record<string, any>;
  warnings?: string[];
  final_allowed?: boolean;
  final_reason?: string;
  simulation_only?: boolean;
};

function StatusPill({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-red-500/40 bg-red-500/10 text-red-100"}`}>
      {label}
    </span>
  );
}

function DebugCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function JsonBox({ value }: { value: unknown }) {
  return <pre className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/50 p-4 text-xs leading-relaxed text-zinc-200">{JSON.stringify(value, null, 2)}</pre>;
}

function CheckLine({ label, value }: { label: string; value: string }) {
  const good = ["valid", "active", "clear", "not_required", "valid_or_legacy"].includes(value);
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <span className="text-sm font-bold text-zinc-300">{label}</span>
      <StatusPill ok={good} label={value} />
    </div>
  );
}

export default function AccessControlDebugPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(() => result?.checks || {}, [result]);

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
      const json = await res.json();
      setResult(json);
      if (!res.ok) setError(json.final_reason || "Diagnostica non riuscita");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.24),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.08),transparent_28%)]" />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <Link href="/" className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-400 transition hover:text-white">← Dashboard</Link>

        <header className="mt-6 overflow-hidden rounded-[34px] border border-red-500/20 bg-gradient-to-br from-zinc-950 via-black to-red-950/40 p-8 shadow-2xl shadow-red-950/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-red-300">BodyGate Premium · Access Control</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Debug Center</h1>
              <p className="mt-4 max-w-2xl text-zinc-300">Diagnostica badge/QR in sola simulazione: legge fonti, duplicati, cliente/staff, certificati, quota, blocchi e abbonamento senza aprire il tornello.</p>
            </div>
            <StatusPill ok label="simulation only" />
          </div>
        </header>

        <section className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/30">
          <form onSubmit={runDebug} className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/60 px-5 py-4 text-lg font-bold text-white outline-none ring-red-500/40 transition placeholder:text-zinc-600 focus:border-red-400 focus:ring-4"
              placeholder="Scansiona o inserisci codice badge / QR"
              autoFocus
              disabled={loading}
            />
            <button className="rounded-2xl bg-red-600 px-8 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || !code.trim()}>
              {loading ? "Analisi..." : "Esegui debug"}
            </button>
          </form>
          {error ? <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">{error}</p> : null}
        </section>

        {result ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <DebugCard title="Input ricevuto" subtitle="Payload normalizzato dalla diagnostica">
              <JsonBox value={result.input} />
            </DebugCard>

            <DebugCard title="Esito finale" subtitle="Simulazione: nessuna apertura reale">
              <div className="space-y-4">
                <StatusPill ok={result.final_allowed} label={result.final_allowed ? "consentito" : "negato"} />
                <p className="text-2xl font-black text-white">{result.final_reason}</p>
                {result.simulation_only ? <p className="text-sm text-zinc-400">API separata di debug: non scrive log accesso e non attiva bridge/tornello.</p> : null}
              </div>
            </DebugCard>

            <DebugCard title="Dove è stato trovato" subtitle={`Owner type: ${result.owner_type || "none"}`}>
              {result.matches?.length ? <JsonBox value={result.matches} /> : <p className="text-zinc-400">Nessuna corrispondenza trovata.</p>}
            </DebugCard>

            <DebugCard title="Cliente / Staff">
              <JsonBox value={result.customer || result.staff || { status: "Nessun proprietario risolto" }} />
            </DebugCard>

            <DebugCard title="Credenziale">
              <CheckLine label="Stato" value={checks.credential?.status || "unknown"} />
              <JsonBox value={checks.credential} />
            </DebugCard>

            <DebugCard title="Abbonamento">
              <CheckLine label="Stato" value={checks.subscription?.status || "not_checked"} />
              <JsonBox value={checks.subscription} />
            </DebugCard>

            <DebugCard title="Certificato medico">
              <CheckLine label="Stato" value={checks.medical_certificate?.status || "not_checked"} />
              <JsonBox value={checks.medical_certificate} />
            </DebugCard>

            <DebugCard title="Quota associativa">
              <CheckLine label="Stato" value={checks.membership_fee?.status || "not_checked"} />
              <JsonBox value={checks.membership_fee} />
            </DebugCard>

            <DebugCard title="Blocchi cliente">
              <CheckLine label="Stato" value={checks.blocks?.status || "not_checked"} />
              <JsonBox value={checks.blocks} />
            </DebugCard>

            <DebugCard title="Warning duplicati / incoerenze">
              {result.warnings?.length ? (
                <ul className="space-y-3">
                  {result.warnings.map((warning, index) => <li key={`${warning}-${index}`} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">{warning}</li>)}
                </ul>
              ) : <p className="text-zinc-400">Nessun warning rilevato.</p>}
            </DebugCard>
          </div>
        ) : null}
      </div>
    </main>
  );
}
