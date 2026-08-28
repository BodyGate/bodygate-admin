"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type CustomerBadge = {
  id: string;
  full_name: string;
  badge_code: string | null;
  active: boolean;
  subscription_status: string | null;
  subscription_expiry: string | null;
};

export default function BadgesTable() {
  const [customers, setCustomers] = useState<CustomerBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadBadges() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select(
        `
        id,
        full_name,
        badge_code,
        active,
        subscription_status,
        subscription_expiry
      `
      )
      .not("badge_code", "is", null)
      .order("full_name", { ascending: true });

    if (!error && data) {
      setCustomers(data as CustomerBadge[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void Promise.resolve().then(loadBadges);
  }, []);

  const filteredCustomers = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return customers;

    return customers.filter((customer) => {
      return (
        customer.full_name?.toLowerCase().includes(value) ||
        customer.badge_code?.toLowerCase().includes(value)
      );
    });
  }, [customers, search]);

  const activeBadges = customers.filter((c) => c.active).length;
  const blockedBadges = customers.filter((c) => !c.active).length;
  const expiredBadges = customers.filter(
    (c) => c.subscription_status === "expired"
  ).length;

  return (
    <div className="bg-stack-lg">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "18px",
        }}
      >
        <StatsCard
          title="Badge attivi"
          value={activeBadges.toString()}
          color="#22c55e"
        />

        <StatsCard
          title="Badge bloccati"
          value={blockedBadges.toString()}
          color="#5b3df5"
        />

        <StatsCard
          title="Badge scaduti"
          value={expiredBadges.toString()}
          color="#f59e0b"
        />

        <StatsCard
          title="Totale badge"
          value={customers.length.toString()}
          color="#3b82f6"
        />
      </div>

      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "26px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            gap: "20px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              Badge Management
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
              }}
            >
              Gestione badge e associazioni clienti.
            </div>
          </div>

          <input
            className="bg-input bg-form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ricerca badge o cliente..."
          />
        </div>

        {loading ? (
          <div
            style={{
              padding: "28px",
              color: "var(--muted)",
            }}
          >
            Caricamento badge...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div
            style={{
              padding: "28px",
              color: "var(--muted)",
            }}
          >
            Nessun badge trovato.
          </div>
        ) : (
          <div className="bg-table-wrap">
            <table className="bg-table" style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Badge</th>
                  <th style={thStyle}>Stato</th>
                  <th style={thStyle}>Abbonamento</th>
                  <th style={thStyle}>Scadenza</th>
                  <th style={thStyle}>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => {
                  const status = !customer.active
                    ? {
                        label: "BLOCCATO",
                        color: "#5b3df5",
                        bg: "rgba(91,61,245,0.12)",
                      }
                    : customer.subscription_status === "expired"
                    ? {
                        label: "SCADUTO",
                        color: "#f59e0b",
                        bg: "rgba(245,158,11,0.12)",
                      }
                    : {
                        label: "ATTIVO",
                        color: "#22c55e",
                        bg: "rgba(34,197,94,0.12)",
                      };

                  return (
                    <tr key={customer.id} className="bg-table-row">
                      <td style={tdStyle}>
                        <div style={{ fontWeight: "bold" }}>
                          {customer.full_name}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "var(--muted)",
                            fontSize: "12px",
                          }}
                        >
                          ID {customer.id.slice(0, 8)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: "18px",
                            fontWeight: "bold",
                          }}
                        >
                          {customer.badge_code}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 14px",
                            borderRadius: "999px",
                            background: status.bg,
                            color: status.color,
                            fontWeight: "bold",
                            fontSize: "13px",
                          }}
                        >
                          ● {status.label}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        {customer.subscription_status || "-"}
                      </td>

                      <td style={tdStyle}>
                        {customer.subscription_expiry
                          ? new Date(
                              customer.subscription_expiry
                            ).toLocaleDateString("it-IT")
                          : "-"}
                      </td>

                      <td style={tdStyle}>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="bg-action-link bg-action-link-primary"
                        >
                          Apri scheda
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: `1px solid ${color}33`,
        borderRadius: "22px",
        padding: "22px",
      }}
    >
      <div
        style={{
          color: "var(--muted)",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.06em",
        }}
      >
        {title.toUpperCase()}
      </div>

      <div
        style={{
          marginTop: "12px",
          fontSize: "42px",
          fontWeight: "bold",
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "18px",
  color: "var(--muted)",
  fontSize: "13px",
  letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "18px",
};