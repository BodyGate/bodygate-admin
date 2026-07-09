"use client"

import { useEffect, useMemo, useState } from "react"

import BGButton from "@/components/bodygate-ui/BGButton"
import BGCard from "@/components/bodygate-ui/BGCard"
import BGInput from "@/components/bodygate-ui/BGInput"
import BGPageHeader from "@/components/bodygate-ui/BGPageHeader"
import BGPageShell from "@/components/bodygate-ui/BGPageShell"
import BGSelect from "@/components/bodygate-ui/BGSelect"
import BGStatCard from "@/components/bodygate-ui/BGStatCard"
import BGStatusBadge from "@/components/bodygate-ui/BGStatusBadge"
import type { BGCustomer } from "@/app/components/bodygate-v2/BGCustomerCard"

function displayName(customer: BGCustomer) {
  return (
    customer.display_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    "Cliente BodyGate"
  )
}

function statusTone(customer: BGCustomer) {
  const state = String(customer.access_state || customer.access_status || "")
  if (customer.is_active === false || ["expired", "blocked", "suspended"].includes(state)) return "danger"
  if (state === "expiring") return "warning"
  return "success"
}

function statusLabel(customer: BGCustomer) {
  const state = String(customer.access_state || customer.access_status || "")
  if (customer.is_active === false || state === "blocked" || state === "suspended") return "Bloccato"
  if (state === "expired") return "Scaduto"
  if (state === "expiring") return "In scadenza"
  return "Attivo"
}

export default function CustomersV2Page() {
  const [customers, setCustomers] = useState<BGCustomer[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/bodygate-v2/customers?q=${encodeURIComponent(q)}`, { cache: "no-store" })
    const json = await res.json()
    if (json.ok) setCustomers(json.customers || [])
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [q])

  const metrics = useMemo(
    () => ({
      total: customers.length,
      active: customers.filter((c) => c.access_state === "active").length,
      expiring: customers.filter((c) => c.access_state === "expiring").length,
      critical: customers.filter((c) => ["expired", "blocked", "suspended"].includes(String(c.access_state))).length,
    }),
    [customers],
  )

  return (
    <main>
      <BGPageShell>
        <BGPageHeader
          eyebrow="BodyGate CRM"
          title="Clienti V2"
          subtitle="Vista compatta clienti con ricerca operativa e stato accesso."
          actions={
            <>
              <BGButton onClick={load} variant="secondary">Aggiorna</BGButton>
              <BGButton href="/reception" variant="secondary">Reception</BGButton>
              <BGButton href="/customers/new">+ Nuovo cliente</BGButton>
            </>
          }
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BGStatCard value={metrics.total} label="Clienti totali" note="Anagrafiche visibili" />
          <BGStatCard value={metrics.active} label="Accesso attivo" note="Clienti operativi" tone="green" />
          <BGStatCard value={metrics.expiring} label="In scadenza" note="Da seguire" tone="yellow" />
          <BGStatCard value={metrics.critical} label="Critici" note="Richiede attenzione" tone={metrics.critical ? "red" : "neutral"} />
        </section>

        <BGCard>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <BGInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente per nome, telefono, email o badge..." />
            <BGSelect defaultValue="all" aria-label="Filtro clienti">
              <option value="all">Tutti i clienti</option>
              <option value="active">Attivi</option>
              <option value="expiring">In scadenza</option>
              <option value="critical">Critici</option>
            </BGSelect>
          </div>
        </BGCard>

        {loading ? (
          <BGCard>Caricamento CRM...</BGCard>
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {customers.map((customer) => (
              <BGCard key={customer.id} variant="soft">
                <div className="grid gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="m-0 truncate text-base font-black text-white">{displayName(customer)}</h2>
                      <p className="mt-1 truncate text-xs font-bold text-zinc-400">{customer.phone || customer.email || "Contatto da completare"}</p>
                    </div>
                    <BGStatusBadge tone={statusTone(customer)}>{statusLabel(customer)}</BGStatusBadge>
                  </div>
                  <div className="grid gap-2 text-xs font-bold text-zinc-300">
                    <div className="flex justify-between gap-3"><span className="text-zinc-500">Badge</span><strong>{customer.badge_code || "-"}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-zinc-500">Abbonamento</span><strong>{customer.subscription_status || "Da verificare"}</strong></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <BGButton href={`/customers/${customer.id}`} variant="secondary">Apri scheda</BGButton>
                    <BGButton href={`/payments?customer=${customer.id}`} variant="ghost">Incasso</BGButton>
                  </div>
                </div>
              </BGCard>
            ))}
          </section>
        )}
      </BGPageShell>
    </main>
  )
}
