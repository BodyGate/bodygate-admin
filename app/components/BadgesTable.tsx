"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BGButton,
  BGEmptyState,
  BGInput,
  BGSection,
  BGStatCard,
  BGStatGrid,
  BGStatusBadge,
  BGTable,
} from "@/components/bodygate-ui";

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

    const response = await fetch("/api/customers/badges-list", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);

    if (response.ok && result?.ok) {
      setCustomers(result.customers as CustomerBadge[]);
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
      <BGStatGrid>
        <BGStatCard label="Badge attivi" value={activeBadges} tone="green" />
        <BGStatCard label="Badge bloccati" value={blockedBadges} tone="red" />
        <BGStatCard label="Badge scaduti" value={expiredBadges} tone="yellow" />
        <BGStatCard label="Totale badge" value={customers.length} tone="blue" />
      </BGStatGrid>

      <BGSection
        title="Elenco badge"
        description="Gestione badge e associazioni clienti."
        actions={
          <BGInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ricerca badge o cliente..."
          />
        }
      >
        {loading ? (
          <BGEmptyState title="Caricamento badge..." />
        ) : filteredCustomers.length === 0 ? (
          <BGEmptyState title="Nessun badge trovato." />
        ) : (
          <BGTable>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Badge</th>
                <th>Stato</th>
                <th>Abbonamento</th>
                <th>Scadenza</th>
                <th>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map((customer) => {
                const status = !customer.active
                  ? { label: "BLOCCATO", tone: "danger" as const }
                  : customer.subscription_status === "expired"
                  ? { label: "SCADUTO", tone: "warning" as const }
                  : { label: "ATTIVO", tone: "success" as const };

                return (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.full_name}</strong>{" "}
                      <small>ID {customer.id.slice(0, 8)}</small>
                    </td>
                    <td>{customer.badge_code}</td>
                    <td>
                      <BGStatusBadge tone={status.tone}>
                        {status.label}
                      </BGStatusBadge>
                    </td>
                    <td>{customer.subscription_status || "-"}</td>
                    <td>
                      {customer.subscription_expiry
                        ? new Date(
                            customer.subscription_expiry
                          ).toLocaleDateString("it-IT")
                        : "-"}
                    </td>
                    <td>
                      <BGButton
                        href={`/customers/${customer.id}`}
                        variant="secondary"
                      >
                        Apri scheda
                      </BGButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </BGTable>
        )}
      </BGSection>
    </div>
  );
}
