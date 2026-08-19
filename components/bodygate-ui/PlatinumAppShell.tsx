"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bell, LayoutGrid, Menu, X } from "lucide-react"
import { PLATINUM_SCREENS } from "@/architecture/platinum-screen-registry"
import styles from "./platinum.module.css"
import "./platinum-tokens.css"

const groups = [...new Set(PLATINUM_SCREENS.map(screen => screen.navigationGroup))]
function Brand() { return <Link href="/ui-lab/platinum" className={styles.brand}><span className={styles.brandMark}>BG</span><span><span className={styles.brandName}>BodyGate</span><span className={styles.brandEdition}>Platinum Lab</span></span></Link> }
function ScreenNavigation({ activeScreen, onNavigate }: { activeScreen?: string; onNavigate?: () => void }) {
  return <nav className={styles.nav} aria-label="Schermate Platinum">{groups.map(group => <section className={styles.navGroup} key={group}><h2 className={styles.navLabel}>{group}</h2>{PLATINUM_SCREENS.filter(screen => screen.navigationGroup === group).map(screen => <Link onClick={onNavigate} href={screen.prototypePath} className={`${styles.navItem} ${activeScreen === screen.id ? styles.navItemActive : ""}`} aria-current={activeScreen === screen.id ? "page" : undefined} key={screen.id}><span>{screen.label}</span></Link>)}</section>)}</nav>
}
export default function PlatinumAppShell({ children, activeScreen }: { children: ReactNode; activeScreen?: string }) {
  const [drawer, setDrawer] = useState(false)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const drawerClose = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!drawer) return
    drawerClose.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setDrawer(false); requestAnimationFrame(() => menuTrigger.current?.focus()) } }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [drawer])
  const closeDrawer = () => { setDrawer(false); requestAnimationFrame(() => menuTrigger.current?.focus()) }
  return <div className={styles.shell}>
    <aside className={styles.sidebar}><Brand /><ScreenNavigation activeScreen={activeScreen} /><div className={styles.sidebarFooter}>40 anteprime · dati locali</div></aside>
    <div className={styles.content}>
      <header className={styles.topbar}><div><div className={styles.topbarTitle}>Platinum Page System</div><div className={styles.topbarMeta}>Ambiente isolato · nessuna azione operativa</div></div><div className={styles.topbarActions}>
        <button ref={menuTrigger} className={`${styles.button} ${styles.mobileMenu}`} onClick={() => setDrawer(true)} aria-label="Apri elenco schermate"><Menu /></button>
        <span className={styles.tooltipHost}><button className={`${styles.button} ${styles.iconButton}`} aria-label="Notifiche dimostrative" aria-describedby="platinum-notifications-tooltip"><Bell /></button><span id="platinum-notifications-tooltip" role="tooltip" className={styles.inlineTooltip}>3 notifiche dimostrative</span></span>
      </div></header>
      <main id="contenuto" className={styles.main}>{children}</main>
    </div>
    {drawer ? <div className={styles.mobileDrawerBackdrop} onClick={closeDrawer}><aside className={styles.mobileDrawer} role="dialog" aria-modal="true" aria-label="Elenco schermate Platinum" onClick={event => event.stopPropagation()}><div className={styles.drawerHeader}><Brand /><button ref={drawerClose} className={`${styles.button} ${styles.iconButton}`} onClick={closeDrawer} aria-label="Chiudi elenco schermate"><X /></button></div><ScreenNavigation activeScreen={activeScreen} onNavigate={closeDrawer} /></aside></div> : null}
    <nav className={styles.bottomNav} aria-label="Navigazione mobile Platinum">{PLATINUM_SCREENS.filter(screen => ["dashboard", "reception", "customers", "payments"].includes(screen.id)).map(screen => <Link className={`${styles.bottomItem} ${activeScreen === screen.id ? styles.bottomItemActive : ""}`} href={screen.prototypePath} key={screen.id}><LayoutGrid /><span>{screen.label}</span></Link>)}<button className={styles.bottomItem} onClick={() => setDrawer(true)}><Menu /><span>Altro</span></button></nav>
  </div>
}
