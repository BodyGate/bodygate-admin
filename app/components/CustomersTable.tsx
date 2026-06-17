"use client";

import { useEffect, useMemo, useState } from "react";
import BGActionButton from "./ui/BGActionButton";
import BGActionLink from "./ui/BGActionLink";
import BGEmptyState from "./ui/BGEmptyState";
import BGInput from "./ui/BGInput";
import BGStatCard from "./ui/BGStatCard";
import BGStatusBadge from "./ui/BGStatusBadge";
import { BGErrorState, BGFilterBar, BGOperationalRow, BGSkeleton, BGSurface, BGToolbar } from "./ui/BGPrimitives";
import { bgFetchJson } from "../lib/clientFetch";

type Customer = { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null; email: string | null; phone: string | null; badge_code: string | null; controller_code?: string | null; subscription_status: string | null; subscription_expiry: string | null; active: boolean; created_at: string };
type ListFilter = "active" | "all" | "inactive" | "to_check" | "with_badge" | "without_badge";
type CustomerListStats = { total_customers: number; total_records: number; inactive_customers: number; access_active: number; to_check: number; expiring_soon: number; with_badge: number; without_badge: number };
type Payload = { ok?: boolean; customers?: Customer[]; stats?: CustomerListStats; error?: string };

const LIST_FILTERS: Array<{ value: ListFilter; label: string }> = [
  { value: "active", label: "Attivi" }, { value: "all", label: "Tutti" }, { value: "inactive", label: "Inattivi" }, { value: "to_check", label: "Da verificare" }, { value: "with_badge", label: "Con badge" }, { value: "without_badge", label: "Senza badge" },
];
function formatDate(value?: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); }
function daysUntil(value?: string | null) { if (!value) return null; const expiry = new Date(value); if (Number.isNaN(expiry.getTime())) return null; const today = new Date(); today.setHours(0,0,0,0); expiry.setHours(0,0,0,0); return Math.ceil((expiry.getTime() - today.getTime()) / 86400000); }
function getName(customer: Customer) { return customer.full_name?.trim() || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Cliente senza nome"; }
function getBadgeCode(customer: Customer) { return String(customer.badge_code || customer.controller_code || "").trim(); }
function initials(name: string) { const parts = name.split(" ").filter(Boolean).slice(0, 2); return parts.length ? parts.map((p) => p[0]?.toUpperCase()).join("") : "BG"; }
function getAccessState(customer: Customer) { const status = String(customer.subscription_status || "").toLowerCase(); const days = daysUntil(customer.subscription_expiry); if (!customer.active) return { label: "Bloccato", tone: "danger" as const, hint: "Cliente non attivo" }; if (status.includes("expired") || status.includes("scad") || (days !== null && days < 0)) return { label: "Da verificare", tone: "danger" as const, hint: "Abbonamento scaduto" }; if (days !== null && days <= 7) return { label: "In scadenza", tone: "warning" as const, hint: `Scade tra ${days} giorni` }; return { label: "Accesso attivo", tone: "success" as const, hint: "Cliente operativo" }; }

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>(() => (typeof sessionStorage === "undefined" ? "active" : ((sessionStorage.getItem("bodygate.customers.filter") as ListFilter) || "active")));
  const [serverStats, setServerStats] = useState<CustomerListStats | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search), 220); return () => window.clearTimeout(timer); }, [search]);
  async function loadCustomers(mode: "initial" | "refresh" = loadedOnce ? "refresh" : "initial") {
    if (mode === "initial") setLoading(true); else setRefreshing(true);
    setQueryError(null);
    const result = await bgFetchJson<Payload>(`/api/customers/list?status=${listFilter}`, { cache: "no-store", timeoutMs: 9000, retries: 1, userMessage: "Elenco clienti non aggiornato. Manteniamo i dati già caricati." });
    if (!result.ok) setQueryError(result.userMessage);
    else if (!result.data?.ok) setQueryError(result.data?.error || "Impossibile caricare i clienti.");
    else {
      const list = result.data.customers || [];
      setCustomers(list); setServerStats(result.data.stats || null);
      setSelectedId((current) => current && list.some((customer) => customer.id === current) ? current : list[0]?.id || null);
    }
    setLoadedOnce(true); setLoading(false); setRefreshing(false);
  }
  useEffect(() => { if (typeof sessionStorage !== "undefined") sessionStorage.setItem("bodygate.customers.filter", listFilter); void loadCustomers("initial"); }, [listFilter]);

  const filteredCustomers = useMemo(() => { const q = debouncedSearch.toLowerCase().trim(); if (!q) return customers; return customers.filter((customer) => [getName(customer), customer.phone || "", customer.email || "", getBadgeCode(customer)].some((value) => value.toLowerCase().includes(q))); }, [customers, debouncedSearch]);
  const selectedCustomer = useMemo(() => filteredCustomers.find((customer) => customer.id === selectedId) || filteredCustomers[0] || null, [filteredCustomers, selectedId]);
  const metrics = useMemo(() => serverStats ? { total: serverStats.total_customers, active: serverStats.access_active, attention: serverStats.to_check, expiring: serverStats.expiring_soon, withBadge: serverStats.with_badge } : customers.reduce((acc, customer) => { const state = getAccessState(customer); if (state.tone === "success") acc.active += 1; if (state.tone === "danger") acc.attention += 1; if (state.tone === "warning") acc.expiring += 1; if (getBadgeCode(customer)) acc.withBadge += 1; return acc; }, { total: customers.length, active: 0, attention: 0, expiring: 0, withBadge: 0 }), [customers, serverStats]);

  return <section className="crm-platinum">
    <BGSurface elevated>
      <BGToolbar sticky>
        <div><h2 className="bg-card-title-reset">Vista operativa Clienti</h2><p className="crm-muted">{filteredCustomers.length} risultati su {customers.length}{serverStats ? ` · ${serverStats.total_records} record totali` : ""}</p></div>
        <div className="bg-action-group"><BGActionLink href="/customers/new" variant="primary">Nuovo cliente</BGActionLink><BGActionLink href="/reception">Reception</BGActionLink><BGActionButton onClick={() => loadCustomers("refresh")} disabled={refreshing}>{refreshing ? "Aggiorno…" : "Aggiorna"}</BGActionButton></div>
      </BGToolbar>
      <BGFilterBar>{LIST_FILTERS.map((filter) => <button key={filter.value} type="button" className={`bg-filter-chip ${listFilter === filter.value ? "bg-filter-chip-active" : ""}`} onClick={() => { setSelectedId(null); setListFilter(filter.value); }}>{filter.label}</button>)}</BGFilterBar>
    </BGSurface>

    <section className="crm-metrics"><BGStatCard value={metrics.total} label="Clienti" tone="blue" /><BGStatCard value={metrics.active} label="Accesso attivo" tone="green" /><BGStatCard value={metrics.attention} label="Da verificare" tone={metrics.attention > 0 ? "red" : "neutral"} /><BGStatCard value={metrics.expiring} label="Scadenze" tone={metrics.expiring > 0 ? "yellow" : "neutral"} /><BGStatCard value={metrics.withBadge} label="Con badge" tone="neutral" /></section>

    {loading && <BGSurface><BGSkeleton lines={8} /></BGSurface>}
    {queryError && <BGErrorState title="Clienti non aggiornati" description={queryError} action={<BGActionButton onClick={() => loadCustomers(customers.length ? "refresh" : "initial")}>Riprova</BGActionButton>} />}
    {!queryError && loadedOnce && customers.length === 0 && <BGEmptyState title="Nessun cliente trovato" description="Crea un nuovo cliente per popolare il CRM operativo." />}

    {!loading && customers.length > 0 && <section className="crm-workspace-platinum">
      <BGSurface className="crm-list-panel">
        <BGInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca cliente, badge, telefono o email…" aria-label="Cerca cliente" />
        {search ? <button className="bg-filter-chip" type="button" onClick={() => setSearch("")}>Reset ricerca</button> : null}
        <div className="bg-data-list">{filteredCustomers.length === 0 ? <BGEmptyState title="Nessun risultato" description="Modifica ricerca o filtri." /> : filteredCustomers.map((customer) => { const name = getName(customer); const state = getAccessState(customer); const active = selectedCustomer?.id === customer.id; return <button key={customer.id} type="button" className={`crm-customer-row ${active ? "crm-customer-row-active" : ""}`} onClick={() => setSelectedId(customer.id)}><span className="crm-avatar">{initials(name)}</span><span><strong>{name}</strong><small>{customer.phone || customer.email || getBadgeCode(customer) || "Dati da completare"}</small></span><BGStatusBadge tone={state.tone}>{state.label}</BGStatusBadge></button>; })}</div>
      </BGSurface>
      <BGSurface className="crm-detail-panel">
        {selectedCustomer ? (() => { const name = getName(selectedCustomer); const state = getAccessState(selectedCustomer); return <div className="crm-detail-grid-platinum"><div className="crm-detail-hero-platinum"><span className="crm-avatar crm-avatar-lg">{initials(name)}</span><div><h2>{name}</h2><p>{selectedCustomer.phone || selectedCustomer.email || "Contatto da completare"}</p></div><BGStatusBadge tone={state.tone}>{state.label}</BGStatusBadge></div><div className="crm-info-grid"><BGOperationalRow title="Telefono" meta={selectedCustomer.phone || "Non inserito"} /><BGOperationalRow title="Email" meta={selectedCustomer.email || "Non inserita"} /><BGOperationalRow title="Badge" meta={getBadgeCode(selectedCustomer) || "Da associare"} /><BGOperationalRow title="Scadenza" meta={formatDate(selectedCustomer.subscription_expiry)} /><BGOperationalRow title="Stato" meta={state.hint} /><BGOperationalRow title="Creato il" meta={formatDate(selectedCustomer.created_at)} /></div><div className="crm-action-grid-platinum"><BGActionLink href={`/customers/${selectedCustomer.id}`} variant="primary">Apri scheda</BGActionLink><BGActionLink href={`/customers/${selectedCustomer.id}`}>Rinnova</BGActionLink><BGActionLink href={`/payments?customer=${selectedCustomer.id}`}>Incasso</BGActionLink><BGActionLink href={`/customers/${selectedCustomer.id}`}>Accesso</BGActionLink></div><p className="crm-muted">Le azioni aprono flussi reali già esistenti. Nessun comando finto viene mostrato come operativo.</p></div>; })() : <BGEmptyState title="Seleziona un cliente" description="Tocca una riga per aprire il dettaglio rapido." />}
      </BGSurface>
    </section>}
  </section>;
}
