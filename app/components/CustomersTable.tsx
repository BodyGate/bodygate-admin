"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import CustomerStatus from "./CustomerStatus";

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

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCustomers(data as Customer[]);
    }

    setLoading(false);
  }

  function getCustomerName(customer: Customer) {
    const fromFullName = customer.full_name?.trim();

    const fromFirstLast = `${customer.first_name || ""} ${
      customer.last_name || ""
    }`.trim();

    return fromFullName || fromFirstLast || "Cliente senza nome";
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return customers;

    return customers.filter((customer) => {
      const customerName = getCustomerName(customer).toLowerCase();

      return (
        customerName.includes(value) ||
        customer.email?.toLowerCase().includes(value) ||
        customer.phone?.toLowerCase().includes(value) ||
        customer.badge_code?.toLowerCase().includes(value)
      );
    });
  }, [customers, search]);

  if (loading) {
    return <div className="card">Caricamento clienti...</div>;
  }

  return (
    <div className="card">
      <h2 className="card-title">Anagrafica clienti</h2>
      <p className="card-subtitle">
        Gestione badge, abbonamenti e stato accesso.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca cliente, badge, email..."
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "var(--bg-soft)",
            color: "var(--text)",
          }}
        />

        <button
          onClick={loadCustomers}
          style={{
            padding: "12px 18px",
            borderRadius: 14,
            border: "none",
            background: "#ef4444",
            color: "white",
            fontWeight: 700,
          }}
        >
          Aggiorna
        </button>
      </div>

      <div style={{ overflowX: "auto", marginTop: 22 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--muted)", fontSize: 13 }}>
              <th style={{ textAlign: "left", padding: 12 }}>Cliente</th>
              <th style={{ textAlign: "left", padding: 12 }}>Contatti</th>
              <th style={{ textAlign: "left", padding: 12 }}>Badge</th>
              <th style={{ textAlign: "left", padding: 12 }}>Stato</th>
              <th style={{ textAlign: "left", padding: 12 }}>Scadenza</th>
              <th style={{ textAlign: "left", padding: 12 }}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.map((customer) => {
              const customerName = getCustomerName(customer);

              return (
                <tr
                  key={customer.id}
                  style={{
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <td style={{ padding: 12 }}>
                    <strong>{customerName}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      ID: {customer.id.slice(0, 8)}
                    </div>
                  </td>

                  <td style={{ padding: 12 }}>
                    <div>{customer.email || "-"}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {customer.phone || "-"}
                    </div>
                  </td>

                  <td style={{ padding: 12 }}>{customer.badge_code || "-"}</td>

                  <td style={{ padding: 12 }}>
                    <CustomerStatus
                      active={customer.active}
                      subscriptionStatus={customer.subscription_status}
                    />
                  </td>

                  <td style={{ padding: 12 }}>
                    {customer.subscription_expiry
                      ? new Date(
                          customer.subscription_expiry
                        ).toLocaleDateString("it-IT")
                      : "-"}
                  </td>

                  <td style={{ padding: 12 }}>
                    <Link
                      href={`/customers/${customer.id}`}
                      style={{
                        color: "white",
                        fontWeight: 700,
                      }}
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
    </div>
  );
}