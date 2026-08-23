"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bell, LayoutGrid, LogOut, Menu, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { PLATINUM_SCREENS } from "@/architecture/platinum-screen-registry"
import { PLATINUM_NAVIGATION } from "@/architecture/platinum-navigation"
import styles from "./platinum.module.css"
import "./platinum-tokens.css"

const groups = [...new Set(PLATINUM_SCREENS.map(screen => screen.navigationGroup))]
function Brand() { return <Link href="/ui-lab/platinum" className={styles.brand}><span className={styles.brandMark}>BG</span><span><span className={styles.brandName}>BodyGate</span><span className={styles.brandEdition}>Platinum Lab</span></span></Link> }
function ScreenNavigation({ activeScreen, onNavigate }: { activeScreen?: string; onNavigate?: () => void }) {
  return <nav className={styles.nav} aria-label="Schermate Platinum">{groups.map(group => <section className={styles.navGroup} key={group}><h2 className={styles.navLabel}>{group}</h2>{PLATINUM_SCREENS.filter(screen => screen.navigationGroup === group).map(screen => <Link onClick={onNavigate} href={screen.prototypePath} className={`${styles.navItem} ${activeScreen === screen.id ? styles.navItemActive : ""}`} aria-current={activeScreen === screen.id ? "page" : undefined} key={screen.id}><span>{screen.label}</span></Link>)}</section>)}</nav>
}
type PaymentsAccess = "loading" | "allowed" | "denied"

function RuntimeNavigation({ pathname, onNavigate, paymentsAccess }: { pathname: string; onNavigate?: () => void; paymentsAccess: PaymentsAccess }) {
  return <nav className={styles.nav} aria-label="Navigazione operativa">{PLATINUM_NAVIGATION.map(item => {
    const paymentsDenied = item.id === "payments" && paymentsAccess === "denied"
    const label = paymentsDenied ? `${item.label} · Protetto / Permessi non configurati` : item.label
    return paymentsDenied
      ? <button key={item.id} type="button" className={styles.navItem} title={label} aria-label={label} disabled><span>{item.label}</span></button>
      : <Link key={item.id} onClick={onNavigate} href={item.href} className={`${styles.navItem} ${(item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) ? styles.navItemActive : ""}`}><span>{item.label}</span></Link>
  })}</nav>
}

export default function PlatinumAppShell({ children, activeScreen, runtime = false, systemStatus = "Da verificare", paymentsAccess = "allowed" }: { children: ReactNode; activeScreen?: string; runtime?: boolean; systemStatus?: string; paymentsAccess?: PaymentsAccess }) {
  const [drawer, setDrawer] = useState(false)
  const pathname = usePathname()
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
  const Navigation = runtime ? <RuntimeNavigation pathname={pathname} paymentsAccess={paymentsAccess} /> : <ScreenNavigation activeScreen={activeScreen} />
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => null); window.location.href = "/login" }
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>{runtime ? <Link href="/" className={styles.brand}><span className={styles.brandMark}>BG</span><span><span className={styles.brandName}>BodyGate</span><span className={styles.brandEdition}>Platinum</span></span></Link> : <Brand />}{Navigation}<div className={styles.sidebarFooter}>{runtime ? <button className={styles.button} onClick={logout}><LogOut /> Logout</button> : "40 anteprime · dati locali"}</div></aside>
    <div className={styles.content}>
      <header className={styles.topbar}><div><div className={styles.topbarTitle}>{runtime ? "BodyGate operativo" : "Platinum Page System"}</div><div className={styles.topbarMeta}>{runtime ? `Stato sistema: ${systemStatus}` : "Ambiente isolato · nessuna azione operativa"}</div></div><div className={styles.topbarActions}>
        <button ref={menuTrigger} className={`${styles.button} ${styles.mobileMenu}`} onClick={() => setDrawer(true)} aria-label="Apri elenco schermate"><Menu /></button>
        {runtime ? <Link href="/notifications" className={`${styles.button} ${styles.iconButton}`} aria-label="Apri notifiche"><Bell /></Link> : <span className={styles.tooltipHost}><button className={`${styles.button} ${styles.iconButton}`} aria-label="Notifiche dimostrative" aria-describedby="platinum-notifications-tooltip"><Bell /></button><span id="platinum-notifications-tooltip" role="tooltip" className={styles.inlineTooltip}>3 notifiche dimostrative</span></span>}
      </div></header>
      <main id="contenuto" className={styles.main}>{children}</main>
    </div>
    {drawer ? <div className={styles.mobileDrawerBackdrop} onClick={closeDrawer}><aside className={styles.mobileDrawer} role="dialog" aria-modal="true" aria-label="Navigazione" onClick={event => event.stopPropagation()}><div className={styles.drawerHeader}>{runtime ? <span className={styles.brand}>BodyGate Platinum</span> : <Brand />}<button ref={drawerClose} className={`${styles.button} ${styles.iconButton}`} onClick={closeDrawer} aria-label="Chiudi navigazione"><X /></button></div>{runtime ? <RuntimeNavigation pathname={pathname} onNavigate={closeDrawer} paymentsAccess={paymentsAccess} /> : <ScreenNavigation activeScreen={activeScreen} onNavigate={closeDrawer} />}</aside></div> : null}
    <nav className={styles.bottomNav} aria-label="Navigazione mobile Platinum">{runtime ? PLATINUM_NAVIGATION.filter(item => item.mobilePlacement === "bottom").map(item => <Link className={`${styles.bottomItem} ${(item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) ? styles.bottomItemActive : ""}`} href={item.href} key={item.id}><LayoutGrid /><span>{item.shortLabel}</span></Link>) : PLATINUM_SCREENS.filter(screen => ["dashboard", "reception", "customers", "payments"].includes(screen.id)).map(screen => <Link className={`${styles.bottomItem} ${activeScreen === screen.id ? styles.bottomItemActive : ""}`} href={screen.prototypePath} key={screen.id}><LayoutGrid /><span>{screen.label}</span></Link>)}<button className={styles.bottomItem} onClick={() => setDrawer(true)}><Menu /><span>Altro</span></button></nav>
  </div>
}
