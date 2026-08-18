"use client"

import { useState, type ReactNode } from "react"
import { BarChart3, Bell, BookOpen, Building2, CalendarClock, ChevronDown, CircleDollarSign, CreditCard, DoorOpen, Dumbbell, FileCheck2, Gauge, KeyRound, LayoutDashboard, LogOut, MoreHorizontal, Settings, ShieldCheck, Users, Wrench } from "lucide-react"

import { navigationForRole, PLATINUM_GROUP_LABELS, PLATINUM_GROUPS, type PlatinumNavigationItem, type PlatinumRole } from "@/architecture/platinum-navigation"
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import styles from "./platinum.module.css"
import "./platinum-tokens.css"

const icons = { dashboard: LayoutDashboard, reception: DoorOpen, customers: Users, access: ShieldCheck, payments: CircleDollarSign, subscriptions: CreditCard, notifications: CalendarClock, training: Dumbbell, reports: BarChart3, accounting: BookOpen, staff: Building2, settings: Settings, system: Gauge, credentials: KeyRound, debug: Wrench, audit: FileCheck2 }
const roleLabels: Record<PlatinumRole, string> = { reception: "Reception", direction: "Direzione", administrator: "Amministratore" }

function DemoLink({ item, compact = false }: { item: PlatinumNavigationItem; compact?: boolean }) {
  const Icon = icons[item.icon]
  return <button type="button" className={`${styles.navItem} ${item.id === "dashboard" ? styles.navItemActive : ""}`} aria-current={item.id === "dashboard" ? "page" : undefined} title={`${item.label} · ${item.href}`} onClick={() => undefined}>
    <Icon aria-hidden="true" /><span>{compact ? item.shortLabel : item.label}</span>
  </button>
}

function DesktopNavigation({ role }: { role: PlatinumRole }) {
  const items = navigationForRole(role)
  return <nav className={styles.nav} aria-label="Navigazione Platinum dimostrativa">
    {PLATINUM_GROUPS.map((group) => {
      const grouped = items.filter((item) => item.group === group)
      if (!grouped.length) return null
      return <section className={styles.navGroup} key={group} aria-labelledby={`group-${group}`}><h2 id={`group-${group}`} className={styles.navLabel}>{PLATINUM_GROUP_LABELS[group]}</h2>
        {grouped.map((item) => item.children.length ? <details className={styles.navDetails} open key={item.id}><summary className={styles.navItem} title={`${item.label} · ${item.href}`}>{(() => { const Icon = icons[item.icon]; return <Icon aria-hidden="true" /> })()}<span>{item.label}</span><ChevronDown className={styles.chevron} aria-hidden="true" /></summary><div className={styles.subnav}>{item.children.map((child) => <DemoLink item={child} key={child.id} />)}</div></details> : <DemoLink item={item} key={item.id} />)}
      </section>
    })}
  </nav>
}

function Brand() {
  return <div className={styles.brand}><div className={styles.brandMark} aria-hidden="true">BG</div><div><div className={styles.brandName}>BodyGate</div><div className={styles.brandEdition}>Platinum</div></div></div>
}

function MoreDrawer({ role }: { role: PlatinumRole }) {
  const more = navigationForRole(role).filter((item) => item.mobilePlacement === "more")
  return <Sheet><SheetTrigger className={styles.bottomItem} aria-label="Apri il menu Altro"><MoreHorizontal aria-hidden="true" /><span>Altro</span></SheetTrigger>
    <SheetContent side="right" className={styles.drawer} showCloseButton={false}><div className={styles.drawerHeader}><div><SheetTitle className={styles.drawerTitle}>Altro</SheetTitle><p>Funzioni disponibili per il ruolo {roleLabels[role]}.</p></div><SheetClose className={`${styles.button} ${styles.iconButton}`} aria-label="Chiudi il menu Altro">×</SheetClose></div>
      <nav className={styles.moreNav} aria-label="Altre funzioni">{more.map((item) => <DemoLink item={item} key={item.id} />)}</nav>
      <button type="button" className={styles.logoutDemo} onClick={() => undefined}><LogOut aria-hidden="true" />Logout <span>Solo demo</span></button>
    </SheetContent>
  </Sheet>
}

function BottomNavigation({ role }: { role: PlatinumRole }) {
  const bottom = navigationForRole(role).filter((item) => item.mobilePlacement === "bottom")
  return <nav className={styles.bottomNav} aria-label="Navigazione mobile Platinum">{bottom.map((item) => { const Icon = icons[item.icon]; return <button type="button" className={`${styles.bottomItem} ${item.id === "dashboard" ? styles.bottomItemActive : ""}`} key={item.id} title={`${item.label} · ${item.href}`}><Icon aria-hidden="true" /><span>{item.shortLabel}</span></button> })}<MoreDrawer role={role} /></nav>
}

export default function PlatinumAppShell({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PlatinumRole>("reception")
  return <TooltipProvider delay={250}><div className={styles.shell}>
    <aside className={styles.sidebar}><Brand /><DesktopNavigation role={role} /><div className={styles.sidebarFooter}><div className={styles.operator}><div className={styles.avatar}>BG</div><div><strong>Operatore BodyGate</strong><span>{roleLabels[role]}</span></div></div></div></aside>
    <div className={styles.content}><header className={styles.topbar}><div><div className={styles.topbarTitle}>Platinum Navigation Lab</div><div className={styles.topbarMeta}>Ambiente isolato · nessuna azione operativa</div></div>
      <div className={styles.topbarActions}><label className={styles.rolePicker}><span>Scenario</span><select value={role} onChange={(event) => setRole(event.target.value as PlatinumRole)}><option value="reception">Reception</option><option value="direction">Direzione</option><option value="administrator">Amministratore</option></select></label><Tooltip><TooltipTrigger className={`${styles.button} ${styles.iconButton}`} aria-label="Notifiche dimostrative"><Bell /></TooltipTrigger><TooltipContent className={styles.tooltip}>3 notifiche dimostrative</TooltipContent></Tooltip></div>
    </header><main id="contenuto" className={styles.main}>{children}</main></div><BottomNavigation role={role} />
  </div></TooltipProvider>
}
