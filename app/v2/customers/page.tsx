"use client";
import { useEffect, useMemo, useState } from "react";
import "../../components/bodygate-v2/bodygate-v2.css";
import BGButton from "../../components/bodygate-v2/BGButton";
import BGMetricCard from "../../components/bodygate-v2/BGMetricCard";
import BGCustomerCard, { BGCustomer } from "../../components/bodygate-v2/BGCustomerCard";
export default function CustomersV2Page() {
  const [customers, setCustomers] = useState<BGCustomer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); const res = await fetch(`/api/bodygate-v2/customers?q=${encodeURIComponent(q)}`, { cache: "no-store" }); const json = await res.json(); if (json.ok) setCustomers(json.customers || []); setLoading(false); }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);
  const metrics = useMemo(() => ({ total: customers.length, active: customers.filter(c => c.access_state === "active").length, expiring: customers.filter(c => c.access_state === "expiring").length, critical: customers.filter(c => ["expired","blocked","suspended"].includes(String(c.access_state))).length }), [customers]);
  return <main className="bg2-page"><div className="bg2-shell"><header className="bg2-topbar"><div className="bg2-title"><h1>Clienti</h1><p>CRM Operativo Fitness</p></div><div className="bg2-actions"><BGButton onClick={load}>Aggiorna</BGButton><BGButton href="/reception">Reception</BGButton><BGButton href="/customers/new" variant="primary">+ Nuovo cliente</BGButton></div></header><section className="bg2-metrics"><BGMetricCard value={metrics.total} label="Clienti totali" note="Anagrafiche visibili" tone="green" /><BGMetricCard value={metrics.active} label="Accesso attivo" note="Clienti operativi" tone="blue" /><BGMetricCard value={metrics.expiring} label="In scadenza" note="Da seguire" tone="yellow" /><BGMetricCard value={metrics.critical} label="Critici" note="Richiede attenzione" tone="red" /></section><section className="bg2-search-row"><div className="bg2-search"><span>⌕</span><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Cerca cliente per nome, telefono, email o badge..." /></div><select className="bg2-filter"><option>Tutti i clienti</option><option>Attivi</option><option>In scadenza</option><option>Critici</option></select></section>{loading ? <div className="bg2-metric">Caricamento CRM...</div> : <section className="bg2-grid">{customers.map(c => <BGCustomerCard key={c.id} customer={c} />)}</section>}<footer className="bg2-footer"><span>Mostrati {customers.length} clienti</span><span>BodyGate Premium V2</span></footer></div></main>;
}
