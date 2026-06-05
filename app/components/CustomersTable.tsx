"use client";

import { useEffect, useMemo, useState } from "react";
import BGActionButton from "./ui/BGActionButton";
import BGActionLink from "./ui/BGActionLink";
import BGEmptyState from "./ui/BGEmptyState";
import BGInput from "./ui/BGInput";
import BGStatCard from "./ui/BGStatCard";
import BGStatusBadge from "./ui/BGStatusBadge";

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
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  return String(value || "")
    .toLowerCase()
    .trim();
}

function getName(customer: Customer) {
  const full = customer.full_name?.trim();
  const composed =
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  return full || composed || "Cliente senza nome";
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((p) => p[0]?.toUpperCase()).join("") : "BG";
}

function getAccessState(customer: Customer): {
  label: string;
  tone: Tone;
  hint: string;
} {
  const status = normalize(customer.subscription_status);
  const days = daysUntil(customer.subscription_expiry);

  if (!customer.active) {
    return { label: "Bloccato", tone: "red", hint: "Cliente non attivo" };
  }

  if (
    status.includes("expired") ||
    status.includes("scad") ||
    (days !== null && days < 0)
  ) {
    return { label: "Da verificare", tone: "red", hint: "Abbonamento scaduto" };
  }

  if (days !== null && days <= 7) {
    return {
      label: "In scadenza",
      tone: "yellow",
      hint: `Scade tra ${days} giorni`,
    };
  }

  return { label: "Accesso attivo", tone: "green", hint: "Cliente operativo" };
}

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  async function loadCustomers() {
    setLoading(true);
    setQueryError(null);

    try {
      const response = await fetch("/api/customers/list", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.ok) {
        setCustomers([]);
        setQueryError(payload?.error || "Impossibile caricare i clienti.");
        return;
      }

      const list = (payload.customers || []) as Customer[];
      setCustomers(list);

      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (error) {
      setCustomers([]);
      setQueryError(
        error instanceof Error ? error.message : "Errore imprevisto.",
      );
    } finally {
      setLoadedOnce(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadCustomers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return customers;

    return customers.filter((customer) => {
      const name = getName(customer).toLowerCase();

      return (
        name.includes(q) ||
        String(customer.phone || "")
          .toLowerCase()
          .includes(q) ||
        String(customer.email || "")
          .toLowerCase()
          .includes(q) ||
        String(customer.badge_code || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [customers, search]);

  const selectedCustomer = useMemo(() => {
    return (
      filteredCustomers.find((customer) => customer.id === selectedId) ||
      filteredCustomers[0] ||
      customers.find((customer) => customer.id === selectedId) ||
      null
    );
  }, [customers, filteredCustomers, selectedId]);

  const metrics = useMemo(() => {
    let active = 0;
    let attention = 0;
    let expiring = 0;
    let withBadge = 0;

    customers.forEach((customer) => {
      const state = getAccessState(customer);

      if (state.tone === "green") active += 1;
      if (state.tone === "red") attention += 1;
      if (state.tone === "yellow") expiring += 1;
      if (customer.badge_code) withBadge += 1;
    });

    return {
      total: customers.length,
      active,
      attention,
      expiring,
      withBadge,
    };
  }, [customers]);

  return (
    <section className="crm3-page">
      <style jsx>{`
        .crm3-page {
          min-height: calc(100vh - 120px);
          color: #fff;
        }

        .crm3-shell {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .crm3-hero {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 30px;
          padding: 24px;
          background:
            radial-gradient(
              circle at top left,
              rgba(239, 68, 68, 0.2),
              transparent 34%
            ),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.075),
              rgba(255, 255, 255, 0.025)
            ),
            rgba(7, 7, 9, 0.94);
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42);
        }

        .crm3-hero-inner {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-end;
        }

        .crm3-eyebrow {
          color: #ef4444;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin-bottom: 8px;
        }

        .crm3-title {
          margin: 0;
          font-size: clamp(34px, 5vw, 54px);
          line-height: 0.92;
          letter-spacing: -0.06em;
          font-weight: 950;
        }

        .crm3-subtitle {
          margin-top: 12px;
          color: #a1a1aa;
          font-size: 14px;
          max-width: 720px;
          line-height: 1.55;
        }

        .crm3-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .crm3-actions :global(.bg-action-link),
        .crm3-actions :global(.bg-action-button) {
          min-height: 42px;
        }

        .crm3-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .crm3-workspace {
          display: grid;
          grid-template-columns: 390px minmax(0, 1fr);
          gap: 18px;
          min-height: 690px;
        }

        .crm3-list-panel,
        .crm3-detail-panel {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.055),
              rgba(255, 255, 255, 0.018)
            ),
            rgba(8, 8, 10, 0.94);
          overflow: hidden;
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.34);
        }

        .crm3-list-head {
          display: grid;
          gap: 12px;
          padding: 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .crm3-count {
          color: #8b8b8b;
          font-size: 12px;
          font-weight: 800;
        }

        .crm3-list {
          max-height: 610px;
          overflow: auto;
          padding: 10px;
        }

        .crm3-list-item {
          width: 100%;
          border: 1px solid transparent;
          background: transparent;
          color: #fff;
          display: grid;
          grid-template-columns: 46px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border-radius: 18px;
          cursor: pointer;
          text-align: left;
        }

        .crm3-list-item:hover {
          background: rgba(255, 255, 255, 0.045);
        }

        .crm3-list-item-active {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.28);
        }

        .crm3-avatar {
          width: 46px;
          height: 46px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          color: #fff;
          font-weight: 950;
          background: linear-gradient(135deg, #ef4444, #7f1d1d);
          box-shadow: 0 14px 28px rgba(239, 68, 68, 0.2);
        }

        .crm3-list-name {
          font-size: 14px;
          font-weight: 950;
          line-height: 1.15;
        }

        .crm3-list-sub {
          margin-top: 5px;
          color: #8b8b8b;
          font-size: 12px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 210px;
        }

        .crm3-mini-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--dot);
          box-shadow: 0 0 15px var(--dot);
        }

        .crm3-dot-green {
          --dot: #22c55e;
        }
        .crm3-dot-red {
          --dot: #ef4444;
        }
        .crm3-dot-yellow {
          --dot: #eab308;
        }
        .crm3-dot-blue,
        .crm3-dot-neutral {
          --dot: #71717a;
        }

        .crm3-detail {
          display: grid;
          gap: 22px;
          padding: 26px;
        }

        .crm3-detail-hero {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 22px;
        }

        .crm3-detail-main {
          display: flex;
          gap: 18px;
          align-items: center;
          min-width: 0;
        }

        .crm3-detail-avatar {
          width: 82px;
          height: 82px;
          border-radius: 26px;
          display: grid;
          place-items: center;
          color: #fff;
          font-size: 28px;
          font-weight: 950;
          background: linear-gradient(135deg, #ef4444, #7f1d1d);
          box-shadow: 0 20px 44px rgba(239, 68, 68, 0.25);
        }

        .crm3-detail-name {
          font-size: clamp(30px, 4vw, 48px);
          line-height: 0.95;
          letter-spacing: -0.055em;
          font-weight: 950;
        }

        .crm3-detail-contact {
          margin-top: 10px;
          color: #a1a1aa;
          font-size: 14px;
          font-weight: 700;
        }

        .crm3-detail-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .crm3-info {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 22px;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 10px;
          min-height: 96px;
          padding: 18px;
          background: rgba(255, 255, 255, 0.035);
        }

        .crm3-info span {
          color: #8b8b8b;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }

        .crm3-info strong {
          display: block;
          margin-top: 0;
          color: #fff;
          font-size: 16px;
          font-weight: 950;
          word-break: break-word;
        }

        .crm3-action-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .crm3-action {
          min-height: 76px;
          border-radius: 20px;
          padding: 16px;
          text-decoration: none;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.045);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
        }

        .crm3-action strong {
          font-size: 15px;
          font-weight: 950;
        }

        .crm3-action span {
          color: #9ca3af;
          font-size: 12px;
          font-weight: 700;
        }

        .crm3-action-primary {
          background: linear-gradient(135deg, #ef4444, #991b1b);
          box-shadow: 0 18px 38px rgba(239, 68, 68, 0.22);
        }

        .crm3-note {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 22px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.035);
          color: #a1a1aa;
          line-height: 1.6;
          font-size: 14px;
        }

        .crm3-message {
          border-radius: 20px;
          padding: 18px;
          background: rgba(255, 255, 255, 0.045);
          color: #d4d4d8;
          font-weight: 800;
        }

        .crm3-message-error {
          color: #fecaca;
          border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.08);
        }

        @media (max-width: 1280px) {
          .crm3-workspace {
            grid-template-columns: 330px minmax(0, 1fr);
          }

          .crm3-detail-grid,
          .crm3-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .crm3-metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .crm3-hero-inner,
          .crm3-detail-hero {
            flex-direction: column;
            align-items: stretch;
          }

          .crm3-actions {
            justify-content: flex-start;
          }

          .crm3-workspace {
            grid-template-columns: 1fr;
          }

          .crm3-list {
            max-height: 360px;
          }

          .crm3-metrics,
          .crm3-detail-grid,
          .crm3-action-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="crm3-shell">
        <header className="crm3-hero">
          <div className="crm3-hero-inner">
            <div>
              <div className="crm3-eyebrow">CRM operativo fitness</div>
              <h2 className="crm3-title">Clienti</h2>
              <div className="crm3-subtitle">
                Ricerca, stato accesso, rinnovi e incassi in una vista unica.
                Pensato per lavorare veloce in reception.
              </div>
            </div>

            <div className="crm3-actions">
              <BGActionLink href="/customers/new" variant="primary">
                + Nuovo cliente
              </BGActionLink>
              <BGActionLink href="/reception">Reception</BGActionLink>
              <BGActionButton type="button" onClick={loadCustomers}>
                Aggiorna
              </BGActionButton>
            </div>
          </div>
        </header>

        <section className="crm3-metrics">
          <BGStatCard
            value={metrics.total}
            label="Clienti totali"
            tone="blue"
          />
          <BGStatCard
            value={metrics.active}
            label="Accesso attivo"
            tone="green"
          />
          <BGStatCard
            value={metrics.attention}
            label="Da verificare"
            tone={metrics.attention > 0 ? "red" : "neutral"}
          />
          <BGStatCard
            value={metrics.expiring}
            label="Scadenze vicine"
            tone={metrics.expiring > 0 ? "yellow" : "neutral"}
          />
          <BGStatCard
            value={metrics.withBadge}
            label="Con badge"
            tone="neutral"
          />
        </section>

        {loading && (
          <div className="crm3-message">Caricamento CRM clienti...</div>
        )}
        {queryError && (
          <div className="crm3-message crm3-message-error">{queryError}</div>
        )}

        {!queryError && loadedOnce && customers.length === 0 && (
          <BGEmptyState
            title="Nessun cliente trovato"
            description="Crea un nuovo cliente per popolare il CRM operativo."
          />
        )}

        {!loading && !queryError && customers.length > 0 && (
          <section className="crm3-workspace">
            <aside className="crm3-list-panel">
              <div className="crm3-list-head">
                <BGInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cerca cliente, badge, telefono o email..."
                />
                <div className="crm3-count">
                  {filteredCustomers.length} risultati su {customers.length}
                </div>
              </div>

              <div className="crm3-list">
                {filteredCustomers.map((customer) => {
                  const name = getName(customer);
                  const state = getAccessState(customer);
                  const contact =
                    customer.phone ||
                    customer.email ||
                    customer.badge_code ||
                    "Dati da completare";
                  const active = selectedCustomer?.id === customer.id;

                  return (
                    <button
                      key={customer.id}
                      type="button"
                      className={`crm3-list-item ${active ? "crm3-list-item-active" : ""}`}
                      onClick={() => setSelectedId(customer.id)}
                    >
                      <div className="crm3-avatar">{initials(name)}</div>
                      <div>
                        <div className="crm3-list-name">{name}</div>
                        <div className="crm3-list-sub">{contact}</div>
                      </div>
                      <span
                        className={`crm3-mini-dot crm3-dot-${state.tone}`}
                      />
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="crm3-detail-panel">
              {selectedCustomer && (
                <div className="crm3-detail">
                  {(() => {
                    const name = getName(selectedCustomer);
                    const state = getAccessState(selectedCustomer);
                    const subscriptionText =
                      selectedCustomer.subscription_status ||
                      (selectedCustomer.active ? "Attivo" : "Non attivo");

                    return (
                      <>
                        <div className="crm3-detail-hero">
                          <div className="crm3-detail-main">
                            <div className="crm3-detail-avatar">
                              {initials(name)}
                            </div>
                            <div>
                              <div className="crm3-detail-name">{name}</div>
                              <div className="crm3-detail-contact">
                                {selectedCustomer.phone ||
                                  selectedCustomer.email ||
                                  "Contatto da completare"}
                              </div>
                            </div>
                          </div>

                          <BGStatusBadge
                            tone={
                              state.tone === "green"
                                ? "success"
                                : state.tone === "red"
                                  ? "danger"
                                  : state.tone === "yellow"
                                    ? "warning"
                                    : "neutral"
                            }
                          >
                            {state.label}
                          </BGStatusBadge>
                        </div>

                        <div className="crm3-detail-grid">
                          <div className="crm3-info">
                            <span>Telefono</span>
                            <strong>
                              {selectedCustomer.phone || "Non inserito"}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>Email</span>
                            <strong>
                              {selectedCustomer.email || "Non inserita"}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>Badge</span>
                            <strong>
                              {selectedCustomer.badge_code || "Da associare"}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>Abbonamento</span>
                            <strong>{subscriptionText}</strong>
                          </div>

                          <div className="crm3-info">
                            <span>Scadenza</span>
                            <strong>
                              {formatDate(selectedCustomer.subscription_expiry)}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>Stato</span>
                            <strong>{state.hint}</strong>
                          </div>

                          <div className="crm3-info">
                            <span>Creato il</span>
                            <strong>
                              {formatDate(selectedCustomer.created_at)}
                            </strong>
                          </div>

                          <div className="crm3-info">
                            <span>ID operativo</span>
                            <strong>{selectedCustomer.id.slice(0, 8)}</strong>
                          </div>
                        </div>

                        <div className="crm3-action-grid">
                          <BGActionLink
                            className="crm3-action crm3-action-primary"
                            variant="primary"
                            href={`/customers/${selectedCustomer.id}`}
                          >
                            <strong>Apri scheda</strong>
                            <span>Profilo completo</span>
                          </BGActionLink>

                          <BGActionLink
                            className="crm3-action"
                            href={`/customers/${selectedCustomer.id}`}
                          >
                            <strong>Rinnova</strong>
                            <span>Abbonamento o quota</span>
                          </BGActionLink>

                          <BGActionLink
                            className="crm3-action"
                            href={`/payments?customer=${selectedCustomer.id}`}
                          >
                            <strong>Incasso</strong>
                            <span>Nuovo pagamento</span>
                          </BGActionLink>

                          <BGActionLink
                            className="crm3-action"
                            href={`/customers/${selectedCustomer.id}`}
                          >
                            <strong>Accesso</strong>
                            <span>Badge, QR, Mobile Pass</span>
                          </BGActionLink>
                        </div>

                        <div className="crm3-note">
                          Questa vista è pensata per la reception: cerca un
                          cliente, verifica subito se può accedere e scegli
                          l&apos;azione operativa senza aprire tabelle o
                          schermate secondarie.
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </section>
  );
}
