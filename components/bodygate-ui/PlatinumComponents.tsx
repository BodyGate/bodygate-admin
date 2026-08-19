"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { AlertCircle, Check, ChevronRight, LoaderCircle, Search, X } from "lucide-react"
import BGButton from "./BGButton"
import { BGDialog } from "./BGDialog"
import styles from "./platinum-screen.module.css"

export function BGDemoNotice() { return <div className={styles.notice} role="note"><AlertCircle />Ambiente dimostrativo isolato: i dati mostrati non provengono dai sistemi operativi.</div> }
export function BGAlert({ title, children, tone = "info" }: { title: string; children: ReactNode; tone?: "info" | "warning" | "danger" }) { return <div className={`${styles.alert} ${styles[tone]}`} role="status"><AlertCircle /><div><strong>{title}</strong><p>{children}</p></div></div> }
export function BGSearch({ label = "Cerca" }: { label?: string }) { return <label className={styles.search}><span className="sr-only">{label}</span><Search /><input type="search" placeholder={label} /></label> }
export function BGFilters({ children }: { children: ReactNode }) { return <div className={styles.filters} aria-label="Filtri">{children}</div> }
export function BGTabs({ items }: { items: readonly string[] }) { const [active, setActive] = useState(items[0]); return <div className={styles.tabs} role="tablist">{items.map(item => <button role="tab" aria-selected={active === item} onClick={() => setActive(item)} key={item}>{item}</button>)}</div> }
export function BGFormSection({ title, children }: { title: string; children: ReactNode }) { return <fieldset className={styles.formSection}><legend>{title}</legend>{children}</fieldset> }
export function BGFieldGroup({ children }: { children: ReactNode }) { return <div className={styles.fieldGroup}>{children}</div> }
export function BGTimeline({ items }: { items: readonly { title: string; detail: string }[] }) { return <ol className={styles.timeline}>{items.map(item => <li key={item.title}><Check /><div><strong>{item.title}</strong><span>{item.detail}</span></div></li>)}</ol> }
export function BGInstallmentSchedule() { const rows = [["Primo acconto", "15 gennaio 2026", "€ 400", "Pagata"], ["Secondo acconto", "15 febbraio 2026", "€ 250 di € 400", "Parziale"], ["Saldo", "15 marzo 2026", "€ 400", "Scaduta"]]; return <div className={styles.schedule}>{rows.map(([name,date,value,status]) => <article key={name}><div><strong>{name}</strong><span>{date}</span></div><b>{value}</b><span className={styles.pill}>{status}</span></article>)}</div> }
export function BGPaymentSummary() { return <div className={styles.summary}><div><span>Importo totale</span><strong>€ 1.200</strong></div><div><span>Importo pagato</span><strong>€ 650</strong></div><div><span>Residuo</span><strong>€ 550</strong></div><div><span>Prossima scadenza</span><strong>15 marzo 2026</strong></div></div> }
export function BGReceiptSummary() { return <div className={styles.receipts}><strong>Riepilogo ricevute</strong><span>2 ricevute dimostrative · € 650 registrati</span></div> }
export function BGAccessStatus() { return <BGAlert title="Accesso da verificare" tone="warning">È presente una rata scaduta. Nessun blocco reale viene applicato.</BGAlert> }
export function BGCustomerIdentity() { return <div className={styles.identity}><span>MR</span><div><strong>Martina Rossi</strong><small>Cliente demo · BG-00042</small></div></div> }
export function BGLoadingState({ label = "anteprima" }: { label?: string }) { return <div className={styles.state} data-qa-state="loading"><LoaderCircle className={styles.spin} /><strong>Caricamento {label.toLowerCase()}</strong><span>I dati dimostrativi stanno per essere visualizzati.</span></div> }
export function BGErrorState({ label = "anteprima" }: { label?: string }) { return <div className={styles.state} data-qa-state="error"><X /><strong>{label}: dati non disponibili</strong><span>Riprova. Nessuna modifica è stata applicata.</span></div> }
export function BGConfirmationDialog({ label }: { label: string }) { return <BGDialog trigger={<BGButton>{label}</BGButton>} title="Conferma azione dimostrativa" description="Questa conferma non modifica dati operativi."><p>Puoi verificare struttura, testo e gestione del focus in sicurezza.</p></BGDialog> }
export function BGDetailDrawer({ label = "Apri dettaglio", title = "Dettaglio attività" }: { label?: string; title?: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [open])
  const close = () => { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()) }
  return <><button ref={triggerRef} className={styles.drawerTrigger} type="button" onClick={() => setOpen(true)}>{label}<ChevronRight /></button>{open && <aside className={styles.detailDrawer} role="dialog" aria-modal="true" aria-labelledby="platinum-detail-title"><button ref={closeRef} onClick={close} aria-label="Chiudi dettaglio"><X /></button><h2 id="platinum-detail-title">{title}</h2><p>Contesto e cronologia sono presentati senza collegamenti operativi.</p></aside>}</>
}
export function BGResponsiveActionBar({ children }: { children: ReactNode }) { return <div className={styles.actionBar}>{children}</div> }
