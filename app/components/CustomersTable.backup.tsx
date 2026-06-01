"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Customer = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email: string | null;
  phone: string | null;
  badge_code: string | null;
  subscription_status: string | null;
  subscription_expiry: string | null;
  active: boolean;
  created_at: string;
};

type Tone = "green" | "red" | "yellow" | "blue" | "neutral";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

function normalize(value?: string | null) {
  return String(value || "").toLowerCase().trim();
}

function getName(customer: Customer) {
  const full = customer.full_name?.trim();
  const composed = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  return full || composed || "Cliente senza nome";
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((p) => p[0]?.toUpperCase()).join("") : "BG";
}

function getAccessState(customer: Customer): { label: string; tone: Tone; hint: string } {
  const status = normalize(customer.subscription_status);
  const days = daysUntil(customer.subscription_expiry);

  if (!customer.active) return { label: "Bloccato", tone: "red", hint: "Cliente non attivo" };
  if (status.includes("expired") || status.includes("scad") || (days !== null && days < 0)) {
    return { label: "Da verificare", tone: "red", hint: "Abbonamento scaduto" };
  }
  if (days !== null && days <= 7) return { label: "In scadenza", tone: "yellow", hint: `Scade tra ${days}g` };
  if (customer.active) return { label: "Accesso attivo", tone: "green", hint: "Cliente operativo" };
  return { label: "Da controllare", tone: "neutral", hint: "Stato non definito" };
}

function Metric({ value, label, tone = "neutral" }: { value: number | string; label: string; tone?: Tone }) {
  return (
    <div className={`crm2-metric crm2-${tone}`}>
      <div className="crm2-metric-value">{value}</div>
      <div className="crm2-metric-label">{label}</div>
    </div>
  );
}

function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`crm2-status crm2-status-${tone}`}>{children}</span>;
}

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  async function loadCustomers() {
    setLoading(true);
    setQueryError(null);

    try {
      const response = await fetch("/api/customers/list", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        setCustomers([]);
        setQueryError(payload?.error || "Impossibile caricare i clienti.");
        return;
      }

      setCustomers((payload.customers || []) as Customer[]);
    } catch (error) {
      setCustomers([]);
      setQueryError(error instanceof Error ? error.message : "Errore imprevisto.");
    } finally {
      setLoadedOnce(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter((customer) => {
      const name = getName(customer).toLowerCase();
      return (
        name.includes(q) ||
        customer.email?.toLowerCase().includes(q) ||
        customer.phone?.toLowerCase().includes(q) ||
        customer.badge_code?.toLowerCase().includes(q) ||
        customer.id.toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  const metrics = useMemo(() => {
    const active = customers.filter((c) => c.active).length;
    const attention = customers.filter((c) => getAccessState(c).tone === "red").length;
    const expiring = customers.filter((c) => getAccessState(c).tone === "yellow").length;
    const withBadge = customers.filter((c) => Boolean(c.badge_code)).length;

    return { total: customers.length, active, attention, expiring, withBadge };
  }, [customers]);

  return (
    <section className="crm2-page">
      <style jsx>{`
        .crm2-page {
          color: #fff;
        }

        .crm2-shell {
          display: grid;
          gap: 18px;
        }

        .crm2-hero {
          position: relative;
          overflow: hidden;
          border-radius: 32px;
          padding: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(circle at 10% 0%, rgba(239, 68, 68, 0.32), transparent 31%),
            radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.1), transparent 26%),
            linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.028)),
            #070707;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45);
        }

        .crm2-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) auto;
          gap: 18px;
          align-items: end;
        }

        .crm2-eyebrow {
          color: #ef4444;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .crm2-title {
          margin: 0;
          font-size: clamp(36px, 6vw, 74px);
          line-height: 0.87;
          letter-spacing: -0.075em;
          font-weight: 950;
        }

        .crm2-subtitle {
          margin-top: 13px;
          max-width: 760px;
          color: #a9a9a9;
          line-height: 1.55;
          font-size: 14px;
        }

        .crm2-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .crm2-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 12px 16px;
          border-radius: 16px;
          color: #fff;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.07);
          font-size: 13px;
          font-weight: 950;
          white-space: nowrap;
          transition: 0.18s ease;
        }

        .crm2-button:hover {
          transform: translateY(-1px);
          border-color: rgba(239, 68, 68, 0.42);
        }

        .crm2-button-primary {
          border-color: transparent;
          background: linear-gradient(135deg, #ef4444, #991b1b);
          box-shadow: 0 18px 38px rgba(239, 68, 68, 0.24);
        }

        .crm2-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .crm2-metric {
          min-height: 126px;
          border-radius: 26px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(circle at top right, var(--glow), transparent 50%),
            linear-gradient(145deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.026)),
            rgba(9, 9, 9, 0.94);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.34);
        }

        .crm2-green { --glow: rgba(34, 197, 94, 0.24); }
        .crm2-red { --glow: rgba(239, 68, 68, 0.3); }
        .crm2-yellow { --glow: rgba(250, 204, 21, 0.22); }
        .crm2-blue { --glow: rgba(56, 189, 248, 0.22); }
        .crm2-neutral { --glow: rgba(255, 255, 255, 0.075); }

        .crm2-metric-value {
          font-size: clamp(34px, 4vw, 50px);
          font-weight: 950;
          letter-spacing: -0.07em;
          line-height: 0.9;
        }

        .crm2-metric-label {
          margin-top: 14px;
          color: #8f8f8f;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .crm2-search-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          border-radius: 28px;
          padding: 13px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(8, 8, 8, 0.86);
          box-shadow: 0 22px 65px rgba(0, 0, 0, 0.28);
        }

        .crm2-search-wrap {
          position: relative;
        }

        .crm2-search-icon {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          color: #ef4444;
          font-size: 18px;
          font-weight: 950;
        }

        .crm2-search {
          width: 100%;
          min-height: 62px;
          border-radius: 21px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.055);
          color: #fff;
          padding: 0 18px 0 50px;
          outline: none;
          font-size: 15px;
          font-weight: 800;
        }

        .crm2-search:focus {
          border-color: rgba(239, 68, 68, 0.68);
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12);
        }

        .crm2-search::placeholder {
          color: #6e6e6e;
        }

        .crm2-results-count {
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
          padding: 0 10px;
        }

        .crm2-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .crm2-card {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          min-height: 364px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(circle at top right, var(--glow), transparent 48%),
            linear-gradient(145deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.025)),
            #080808;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
          transition: 0.2s ease;
        }

        .crm2-card:hover {
          transform: translateY(-3px);
          border-color: rgba(239, 68, 68, 0.46);
          box-shadow: 0 34px 92px rgba(0, 0, 0, 0.48);
        }

        .crm2-card-top {
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr);
          gap: 13px;
          align-items: start;
        }

        .crm2-avatar {
          width: 56px;
          height: 56px;
          border-radius: 20px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, #ef4444, #450a0a);
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 16px 38px rgba(239, 68, 68, 0.22);
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #fff;
        }

        .crm2-name {
          margin-top: 1px;
          color: #fff;
          font-size: 20px;
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -0.045em;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .crm2-mini-line {
          margin-top: 8px;
          color: #858585;
          font-size: 12px;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm2-status {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          gap: 8px;
          padding: 8px 11px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.055);
          color: #d4d4d4;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .crm2-status::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 16px currentColor;
        }

        .crm2-status-green { color: #86efac; border-color: rgba(34, 197, 94, 0.26); background: rgba(34, 197, 94, 0.09); }
        .crm2-status-red { color: #fecaca; border-color: rgba(239, 68, 68, 0.32); background: rgba(239, 68, 68, 0.11); }
        .crm2-status-yellow { color: #fde68a; border-color: rgba(250, 204, 21, 0.3); background: rgba(250, 204, 21, 0.1); }
        .crm2-status-blue { color: #bae6fd; border-color: rgba(56, 189, 248, 0.25); background: rgba(56, 189, 248, 0.09); }
        .crm2-status-neutral { color: #d4d4d4; }

        .crm2-health {
          margin: 17px 0 15px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .crm2-hint {
          color: #888;
          font-size: 12px;
          line-height: 1.4;
          font-weight: 750;
        }

        .crm2-facts {
          display: grid;
          gap: 9px;
          margin-top: 8px;
        }

        .crm2-fact {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr);
          gap: 9px;
          align-items: center;
          min-height: 40px;
          border-radius: 16px;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.055);
        }

        .crm2-fact-icon {
          width: 26px;
          height: 26px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          color: #fff;
          background: rgba(255, 255, 255, 0.075);
          font-size: 13px;
        }

        .crm2-fact-label {
          color: #747474;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .crm2-fact-value {
          margin-top: 2px;
          color: #f5f5f5;
          font-size: 13px;
          font-weight: 850;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm2-card-actions {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr 0.9fr;
          gap: 9px;
          margin-top: 16px;
        }

        .crm2-card-button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 15px;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.065);
          color: #fff;
          font-size: 12px;
          font-weight: 950;
          transition: 0.18s ease;
        }

        .crm2-card-button:hover {
          transform: translateY(-1px);
          border-color: rgba(239, 68, 68, 0.44);
        }

        .crm2-card-button-primary {
          border-color: transparent;
          background: linear-gradient(135deg, #ef4444, #991b1b);
        }

        .crm2-message {
          border-radius: 26px;
          padding: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          color: #d4d4d4;
          font-weight: 850;
        }

        .crm2-message-error {
          border-color: rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.1);
          color: #fecaca;
        }

        @media (max-width: 1440px) {
          .crm2-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .crm2-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }

        @media (max-width: 1024px) {
          .crm2-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .crm2-hero-inner { grid-template-columns: 1fr; }
          .crm2-actions { justify-content: flex-start; }
        }

        @media (max-width: 720px) {
          .crm2-hero { padding: 20px; border-radius: 26px; }
          .crm2-grid,
          .crm2-metrics,
          .crm2-search-panel { grid-template-columns: 1fr; }
          .crm2-card { min-height: auto; }
          .crm2-card-actions { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="crm2-shell">
        <header className="crm2-hero">
          <div className="crm2-hero-inner">
            <div>
              <div className="crm2-eyebrow">CRM operativo fitness</div>
              <h2 className="crm2-title">Clienti</h2>
              <div className="crm2-subtitle">
                Persone, accessi e rinnovi in un'unica vista. Niente tabelle infinite: solo stato, priorità e azioni rapide.
              </div>
            </div>

            <div className="crm2-actions">
              <Link href="/customers/new" className="crm2-button crm2-button-primary">+ Nuovo cliente</Link>
              <Link href="/reception" className="crm2-button">Reception</Link>
              <button type="button" className="crm2-button" onClick={loadCustomers}>Aggiorna</button>
            </div>
          </div>
        </header>

        <section className="crm2-metrics">
          <Metric value={metrics.total} label="Clienti totali" tone="blue" />
          <Metric value={metrics.active} label="Accesso attivo" tone="green" />
          <Metric value={metrics.attention} label="Da verificare" tone={metrics.attention > 0 ? "red" : "neutral"} />
          <Metric value={metrics.expiring} label="Scadenze vicine" tone={metrics.expiring > 0 ? "yellow" : "neutral"} />
          <Metric value={metrics.withBadge} label="Con badge" tone="neutral" />
        </section>

        <section className="crm2-search-panel">
          <div className="crm2-search-wrap">
            <span className="crm2-search-icon">⌕</span>
            <input
              className="crm2-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca cliente, badge, telefono o email..."
            />
          </div>
          <div className="crm2-results-count">{filteredCustomers.length} / {customers.length}</div>
        </section>

        {loading && <div className="crm2-message">Caricamento CRM clienti...</div>}
        {queryError && <div className="crm2-message crm2-message-error">{queryError}</div>}

        {!queryError && loadedOnce && filteredCustomers.length === 0 && (
          <div className="crm2-message">Nessun cliente trovato. Prova con nome, telefono, email o badge.</div>
        )}

        {!loading && filteredCustomers.length > 0 && (
          <section className="crm2-grid">
            {filteredCustomers.map((customer) => {
              const name = getName(customer);
              const state = getAccessState(customer);
              const expiryDays = daysUntil(customer.subscription_expiry);
              const expiryText = formatDate(customer.subscription_expiry);
              const subscriptionText = customer.subscription_status || (customer.active ? "Attivo" : "Non attivo");
              const contact = customer.phone || customer.email || "Contatto non inserito";

              return (
                <article className={`crm2-card crm2-${state.tone}`} key={customer.id}>
                  <div>
                    <div className="crm2-card-top">
                      <div className="crm2-avatar">{initials(name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="crm2-name">{name}</div>
                        <div className="crm2-mini-line">{contact}</div>
                      </div>
                    </div>

                    <div className="crm2-health">
                      <Status tone={state.tone}>{state.label}</Status>
                      <div className="crm2-hint">{state.hint}</div>
                    </div>

                    <div className="crm2-facts">
                      <div className="crm2-fact">
                        <div className="crm2-fact-icon">☎</div>
                        <div>
                          <div className="crm2-fact-label">Telefono</div>
                          <div className="crm2-fact-value">{customer.phone || "Non inserito"}</div>
                        </div>
                      </div>

                      <div className="crm2-fact">
                        <div className="crm2-fact-icon">●</div>
                        <div>
                          <div className="crm2-fact-label">Abbonamento</div>
                          <div className="crm2-fact-value">{subscriptionText}</div>
                        </div>
                      </div>

                      <div className="crm2-fact">
                        <div className="crm2-fact-icon">↗</div>
                        <div>
                          <div className="crm2-fact-label">Scadenza</div>
                          <div className="crm2-fact-value">
                            {expiryText}{expiryDays !== null && expiryDays >= 0 && expiryDays <= 15 ? ` · ${expiryDays}g` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="crm2-fact">
                        <div className="crm2-fact-icon">▣</div>
                        <div>
                          <div className="crm2-fact-label">Badge</div>
                          <div className="crm2-fact-value">{customer.badge_code || "Da associare"}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="crm2-card-actions">
                    <Link href={`/customers/${customer.id}`} className="crm2-card-button crm2-card-button-primary">Apri</Link>
                    <Link href={`/customers/${customer.id}`} className="crm2-card-button">Rinnova</Link>
                    <Link href="/payments" className="crm2-card-button">Incassa</Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </section>
  );
}
