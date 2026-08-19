"use client"

import { CalendarDays, Download, Plus, SlidersHorizontal } from "lucide-react"
import type { PlatinumScreen } from "@/architecture/platinum-screen-registry"
import {
  BGAccessStatus, BGAlert, BGButton, BGConfirmationDialog, BGCustomerIdentity,
  BGDemoNotice, BGDetailDrawer, BGEmptyState, BGErrorState, BGFieldGroup, BGFilters,
  BGFormSection, BGInput, BGInstallmentSchedule, BGLoadingState, BGPageHeader,
  BGPageShell, BGPaymentSummary, BGReceiptSummary, BGResponsiveActionBar, BGSearch,
  BGSection, BGSelect, BGStatCard, BGStatusBadge, BGTable, BGTabs, BGTimeline,
  PlatinumAppShell,
} from "@/components/bodygate-ui"
import { PLATINUM_PREVIEW_CONTENT } from "./preview-content"
import styles from "./screens.module.css"

const formScreens = new Set(["customer-new", "customer-edit", "configuration", "settings", "operator-profile"])
const installmentScreens = new Set(["annual-installments", "installment-deadlines", "payments", "receipts"])

function FormPreview({ screen }: { screen: PlatinumScreen }) {
  const isCustomer = screen.domain === "customers"
  return <BGSection>
    <BGFormSection title={isCustomer ? "Informazioni principali" : "Preferenze e parametri"}>
      <BGFieldGroup>
        <label className={styles.field}>{isCustomer ? "Nome" : "Sezione"}<BGInput defaultValue={isCustomer ? "Martina" : screen.label} /></label>
        <label className={styles.field}>{isCustomer ? "Cognome" : "Ambito"}<BGInput defaultValue={isCustomer ? "Rossi" : "Club dimostrativo"} /></label>
        <label className={styles.field}>{isCustomer ? "Email" : "Valore"}<BGInput type={isCustomer ? "email" : "text"} placeholder={isCustomer ? "nome@esempio.test" : "Valore dimostrativo"} /></label>
        <label className={styles.field}>Stato<BGSelect defaultValue="active"><option value="active">Attivo</option><option value="review">Da verificare</option></BGSelect></label>
      </BGFieldGroup>
    </BGFormSection>
  </BGSection>
}

function Installments() {
  return <>
    <BGSection title="Piano annuale in tre fasi" description="Primo acconto all’iscrizione, secondo acconto dopo un mese e saldo il mese successivo.">
      <BGPaymentSummary />
      <BGInstallmentSchedule />
    </BGSection>
    <div className={styles.twoColumns}>
      <BGSection title="Stato accesso"><BGAccessStatus /><BGConfirmationDialog label="Registra pagamento" /></BGSection>
      <BGSection title="Ricevute"><BGReceiptSummary /><BGTimeline items={[{ title: "Pagamento parziale registrato", detail: "15 febbraio 2026 · € 250" }, { title: "Primo acconto", detail: "15 gennaio 2026 · € 400" }]} /></BGSection>
    </div>
  </>
}

function metricValue(label: string, index: number) {
  if (/importo totale/i.test(label)) return "€ 1.200"
  if (/importo pagato/i.test(label)) return "€ 650"
  if (/residuo/i.test(label)) return index === 2 ? "€ 550" : "€ 8.900"
  if (/incasso|incassi|incassato|incassati|entrate|uscite|saldo|valore|ticket|ricavo|totale demo|prezzo/i.test(label)) return index === 0 ? "€ 62.600" : index === 1 ? "€ 72" : "€ 8.900"
  if (/tasso|incidenza|presenze medie/i.test(label)) return index === 0 ? "78%" : "82%"
  if (/giorni/i.test(label)) return "18"
  if (/ultimo accesso|ultimo controllo/i.test(label)) return "Oggi, 09:40"
  return index === 0 ? "128" : index === 1 ? "7" : "24"
}

function ScreenContent({ screen }: { screen: PlatinumScreen }) {
  const preview = PLATINUM_PREVIEW_CONTENT[screen.id]
  return <>
    <div className={styles.metrics}>
      {preview.metrics.map((label, index) => <BGStatCard key={label} label={label} value={metricValue(label, index)} note={index === 0 ? "Dataset locale dimostrativo" : index === 1 ? "Priorità corrente" : "Aggiornato nel periodo demo"} tone={index === 1 ? "yellow" : index === 2 ? "green" : "neutral"} />)}
    </div>
    {screen.domain === "customers" ? <BGCustomerIdentity /> : null}
    {formScreens.has(screen.id) ? <FormPreview screen={screen} /> : null}
    {installmentScreens.has(screen.id) ? <Installments /> : null}
    <BGSection title={screen.domain === "direction" ? "Analisi del periodo" : "Vista operativa"} description="Informazioni locali ordinate secondo l’obiettivo specifico della schermata.">
      <BGTabs items={["Panoramica", "Attività", "Cronologia"]} />
      <BGTable aria-label={`Dati dimostrativi: ${screen.label}`}>
        <thead><tr>{preview.columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{preview.rows.map(row => <tr key={`${row[0]}-${row[2]}`}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td><BGStatusBadge tone={/regolare|attivo|attiva|attivi|attive|consentito|completato|completata|disponibile|pubblicato|firmato|quadrato|incassato|valido|valida|positivo|positiva|crescita|aperta/i.test(row[3]) ? "success" : /verifica|verificare|attenzione|scaduta|scadute|parziale|mancante|attesa|revisionare|revisione|contattare|contatto|calo/i.test(row[3]) ? "warning" : "info"}>{row[3]}</BGStatusBadge></td></tr>)}</tbody>
      </BGTable>
    </BGSection>
    <div className={styles.twoColumns}>
      <BGSection title="Attività recente"><BGTimeline items={[{ title: `${screen.label}: verifica completata`, detail: "Oggi, 09:40 · Operatore demo" }, { title: "Nota contestuale aggiunta", detail: "Ieri, 18:12 · Nessun dato operativo" }]} /></BGSection>
      <BGSection title="Attenzione richiesta"><BGAlert title={`Controllo ${screen.label.toLowerCase()}`} tone="warning">Verifica il contesto prima di proseguire. Nessuna azione è collegata ai sistemi reali.</BGAlert></BGSection>
    </div>
  </>
}

export default function PlatinumScreenPreview({ screen }: { screen: PlatinumScreen }) {
  const preview = PLATINUM_PREVIEW_CONTENT[screen.id]
  return <PlatinumAppShell activeScreen={screen.id}>
    <BGPageShell>
      <BGDemoNotice />
      <BGPageHeader eyebrow={screen.navigationGroup} title={screen.label} subtitle={screen.description} actions={<BGResponsiveActionBar><BGButton variant="secondary"><Download />Esporta demo</BGButton><BGConfirmationDialog label={preview.primaryAction} /></BGResponsiveActionBar>} />
      <BGFilters><BGSearch label={`Cerca in ${screen.label.toLowerCase()}`} /><BGButton variant="secondary"><SlidersHorizontal />Filtri</BGButton><BGButton variant="ghost"><CalendarDays />Periodo</BGButton></BGFilters>
      <ScreenContent screen={screen} />
      <BGSection title="Stati dell’interfaccia" description="Stati specifici previsti dal registry, verificabili senza servizi esterni.">
        <div className={styles.states}><BGLoadingState label={screen.label} /><BGEmptyState title="Nessun elemento" description={preview.empty} /><BGErrorState label={screen.label} /></div>
      </BGSection>
      <BGResponsiveActionBar><BGDetailDrawer title={`Dettaglio ${screen.label.toLowerCase()}`} /><BGButton><Plus />{preview.primaryAction}</BGButton></BGResponsiveActionBar>
    </BGPageShell>
  </PlatinumAppShell>
}
