"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type CustomerSubscription = {
  id: string;
  full_name: string;
  active: boolean;
  subscription_status: string | null;
  subscription_expiry: string | null;
};

export default function SubscriptionsTable() {
  const [customers, setCustomers] = useState<CustomerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadSubscriptions() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select(`
        id,
        full_name,
        active,
        subscription_status,
        subscription_expiry
      `)
      .order("full_name", { ascending: true });

    if (!error && data) {
      setCustomers(data as CustomerSubscription[]);
    }

    setLoading(false);
  }

  async function renewSubscription(
    customer: CustomerSubscription,
    days: number
  ) {
    setSavingId(customer.id);

    const now = new Date();

    const currentExpiry = customer.subscription_expiry
      ? new Date(customer.subscription_expiry)
      : now;

    const baseDate =
      currentExpiry > now ? currentExpiry : now;

    const newExpiry = new Date(baseDate);

    newExpiry.setDate(newExpiry.getDate() + days);

    const { error } = await supabase
      .from("customers")
      .update({
        subscription_status: "active",
        subscription_expiry: newExpiry.toISOString(),
        active: true,
      })
      .eq("id", customer.id);

    if (!error) {
      await loadSubscriptions();
    }

    setSavingId(null);
  }

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const filteredCustomers = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return customers;

    return customers.filter((customer) =>
      customer.full_name.toLowerCase().includes(value)
    );
  }, [customers, search]);

  const activeCount = customers.filter(
    (c) => c.subscription_status === "active" && c.active
  ).length;

  const expiredCount = customers.filter(
    (c) => c.subscription_status === "expired"
  ).length;

  const blockedCount = customers.filter(
    (c) => !c.active
  ).length;

  const expiringSoonCount = customers.filter((customer) => {
    if (!customer.subscription_expiry) return false;

    const expiry = new Date(customer.subscription_expiry);
    const now = new Date();

    const diffDays = Math.ceil(
      (expiry.getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return diffDays >= 0 && diffDays <= 7;
  }).length;

  return (
    <div style={{ display: "grid", gap: "22px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: "18px",
        }}
      >
        <StatsCard
          title="Attivi"
          value={activeCount.toString()}
          color="#22c55e"
        />

        <StatsCard
          title="In scadenza"
          value={expiringSoonCount.toString()}
          color="#f59e0b"
        />

        <StatsCard
          title="Scaduti"
          value={expiredCount.toString()}
          color="#ef4444"
        />

        <StatsCard
          title="Bloccati"
          value={blockedCount.toString()}
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
              Subscription Management
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
              }}
            >
              Gestione abbonamenti BodyGate.
            </div>
          </div>

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Ricerca cliente..."
            style={inputStyle}
          />
        </div>

        {loading ? (
          <div style={loadingStyle}>
            Caricamento abbonamenti...
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1100px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-soft)",
                    textAlign: "left",
                  }}
                >
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Stato</th>
                  <th style={thStyle}>Scadenza</th>
                  <th style={thStyle}>
                    Giorni residui
                  </th>
                  <th style={thStyle}>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => {
                  const expiry =
                    customer.subscription_expiry
                      ? new Date(
                          customer.subscription_expiry
                        )
                      : null;

                  const now = new Date();

                  const remainingDays = expiry
                    ? Math.ceil(
                        (expiry.getTime() -
                          now.getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : null;

                  let status = {
                    label: "ATTIVO",
                    color: "#22c55e",
                    bg: "rgba(34,197,94,0.12)",
                  };

                  if (!customer.active) {
                    status = {
                      label: "BLOCCATO",
                      color: "#ef4444",
                      bg: "rgba(239,68,68,0.12)",
                    };
                  } else if (
                    customer.subscription_status ===
                    "expired"
                  ) {
                    status = {
                      label: "SCADUTO",
                      color: "#f59e0b",
                      bg: "rgba(245,158,11,0.12)",
                    };
                  } else if (
                    remainingDays !== null &&
                    remainingDays <= 7
                  ) {
                    status = {
                      label: "IN SCADENZA",
                      color: "#f59e0b",
                      bg: "rgba(245,158,11,0.12)",
                    };
                  }

                  return (
                    <tr
                      key={customer.id}
                      style={{
                        borderTop:
                          "1px solid var(--border)",
                      }}
                    >
                      <td style={tdStyle}>
                        <div
                          style={{
                            fontWeight: "bold",
                          }}
                        >
                          {customer.full_name}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "var(--muted)",
                            fontSize: "12px",
                          }}
                        >
                          ID{" "}
                          {customer.id.slice(0, 8)}
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
                        {expiry
                          ? expiry.toLocaleDateString(
                              "it-IT"
                            )
                          : "-"}
                      </td>

                      <td style={tdStyle}>
                        {remainingDays !== null
                          ? `${remainingDays} giorni`
                          : "-"}
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() =>
                              renewSubscription(
                                customer,
                                30
                              )
                            }
                            disabled={
                              savingId === customer.id
                            }
                            style={renewButton}
                          >
                            +30g
                          </button>

                          <button
                            onClick={() =>
                              renewSubscription(
                                customer,
                                90
                              )
                            }
                            disabled={
                              savingId === customer.id
                            }
                            style={renewButton}
                          >
                            +90g
                          </button>

                          <Link
                            href={`/customers/${customer.id}`}
                            style={openButton}
                          >
                            Scheda
                          </Link>
                        </div>
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
};

const tdStyle: React.CSSProperties = {
  padding: "18px",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "14px 16px",
  color: "var(--text)",
  minWidth: "260px",
  outline: "none",
};

const renewButton: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: "bold",
  cursor: "pointer",
};

const openButton: React.CSSProperties = {
  background: "var(--bg-soft)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: "bold",
};

const loadingStyle: React.CSSProperties = {
  padding: "28px",
  color: "var(--muted)",
};