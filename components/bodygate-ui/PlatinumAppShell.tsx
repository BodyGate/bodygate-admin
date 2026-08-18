"use client"

import type { ReactNode } from "react"
import { Bell, Dumbbell, LayoutDashboard, Menu, Settings, Users, X } from "lucide-react"

import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import styles from "./platinum.module.css"
import "./platinum-tokens.css"

const navigation = [
  { label: "Panoramica", icon: LayoutDashboard, active: true },
  { label: "Clienti", icon: Users },
  { label: "Attività", icon: Dumbbell },
  { label: "Impostazioni", icon: Settings },
]

function Navigation() {
  return <nav className={styles.nav} aria-label="Navigazione Platinum"><div className={styles.navLabel}>Area gestionale</div>{navigation.map(({label,icon:Icon,active}) => <a key={label} href="#contenuto" aria-current={active ? "page" : undefined} className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}><Icon aria-hidden="true" />{label}</a>)}</nav>
}

function Brand() {
  return <div className={styles.brand}><div className={styles.brandMark} aria-hidden="true">BG</div><div><div className={styles.brandName}>BodyGate</div><div className={styles.brandEdition}>Platinum</div></div></div>
}

export default function PlatinumAppShell({ children }: { children: ReactNode }) {
  return <TooltipProvider delay={250}><div className={styles.shell}>
    <aside className={styles.sidebar}><Brand /><Navigation /><div className={styles.sidebarFooter}><div className={styles.operator}><div className={styles.avatar}>BG</div><div><strong>Operatore BodyGate</strong><span>Reception</span></div></div></div></aside>
    <div className={styles.content}><header className={styles.topbar}>
      <div style={{display:"flex",alignItems:"center",gap:12}}><Sheet><SheetTrigger className={`${styles.button} ${styles.iconButton} ${styles.mobileMenu}`} aria-label="Apri menu"><Menu /></SheetTrigger><SheetContent side="left" className={styles.drawer}><SheetTitle className="sr-only">Menu principale</SheetTitle><SheetClose className={`${styles.button} ${styles.iconButton} ${styles.drawerClose}`} aria-label="Chiudi menu"><X /></SheetClose><Brand /><div className={styles.drawerNav}><Navigation /></div></SheetContent></Sheet><div><div className={styles.topbarTitle}>Platinum Foundation</div><div className={styles.topbarMeta}>Martedì 18 agosto · Body Energy Palermo</div></div></div>
      <div className={styles.topbarActions}><div className={styles.systemStatus}><span className={styles.statusDot} />SISTEMA OPERATIVO</div><Tooltip><TooltipTrigger className={`${styles.button} ${styles.iconButton}`} aria-label="Notifiche"><Bell /></TooltipTrigger><TooltipContent className={styles.tooltip}>3 notifiche operative</TooltipContent></Tooltip><div className={styles.avatar} aria-label="Profilo operatore BodyGate">BG</div></div>
    </header><main id="contenuto" className={styles.main}>{children}</main></div>
  </div></TooltipProvider>
}
