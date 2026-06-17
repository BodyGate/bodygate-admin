"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BadgeCheck, BarChart3, Bell, CalendarDays, ChevronLeft, ChevronRight, CreditCard, DoorOpen, Dumbbell, Home, LogOut, Monitor, Receipt, Settings, Shield, Users, X } from "lucide-react";
import { useCurrentPermissions } from "../hooks/useCurrentPermissions";

type MenuItem = { label: string; href: string; icon: React.ReactNode; permission?: string; soon?: boolean };
type MenuGroup = { label: string; items: MenuItem[] };

const menuGroups: MenuGroup[] = [
  { label: "Operazioni", items: [
    { label: "Command Center", href: "/", icon: <Home size={20} /> },
    { label: "Reception", href: "/reception", icon: <Monitor size={20} /> },
    { label: "Clienti", href: "/customers", icon: <Users size={20} /> },
    { label: "Accessi", href: "/access-control", icon: <DoorOpen size={20} /> },
  ] },
  { label: "Commerciale", items: [
    { label: "Pagamenti", href: "/payments", icon: <CreditCard size={20} />, permission: "view_payments" },
    { label: "Abbonamenti", href: "/subscriptions", icon: <CalendarDays size={20} /> },
    { label: "Corsi", href: "/training/programs", icon: <Dumbbell size={20} />, soon: true },
  ] },
  { label: "Team", items: [
    { label: "Staff", href: "/system/staff", icon: <Shield size={20} /> },
    { label: "Training", href: "/training", icon: <Dumbbell size={20} /> },
  ] },
  { label: "Controllo", items: [
    { label: "Analytics", href: "/analytics", icon: <BarChart3 size={20} /> },
    { label: "Contabilità", href: "/accounting", icon: <Receipt size={20} /> },
  ] },
  { label: "Sistema", items: [
    { label: "Notifiche", href: "/notifications", icon: <Bell size={20} /> },
    { label: "Sistema", href: "/system", icon: <Settings size={20} /> },
    { label: "Impostazioni", href: "/settings", icon: <Settings size={20} /> },
    { label: "UI Kit", href: "/system/ui-kit", icon: <BadgeCheck size={20} /> },
  ] },
];

function isActive(pathname: string, href: string) { return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`); }

export default function Sidebar({ mobileOpen = false, onCloseMobile }: { mobileOpen?: boolean; onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const { loading, hasPermission } = useCurrentPermissions();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("bodygate.sidebar.expanded");
    if (saved) setExpanded(saved === "1");
  }, []);
  function toggleExpanded() {
    setExpanded((value) => { window.localStorage.setItem("bodygate.sidebar.expanded", value ? "0" : "1"); return !value; });
  }

  const sidebar = (
    <aside className={`bg-sidebar ${expanded ? "bg-sidebar-expanded" : ""}`} aria-label="Navigazione principale">
      <div className="bg-sidebar-brand-row">
        <Link href="/" className="bg-sidebar-brand" aria-label="BodyGate Command Center">BG</Link>
        <span className="bg-sidebar-brand-text">BodyGate</span>
        <button type="button" className="bg-sidebar-close" onClick={onCloseMobile} aria-label="Chiudi navigazione"><X size={18} /></button>
      </div>
      <button type="button" className="bg-sidebar-toggle" onClick={toggleExpanded} aria-label={expanded ? "Comprimi navigazione" : "Espandi navigazione"}>
        {expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}<span>{expanded ? "Comprimi" : "Espandi"}</span>
      </button>
      <nav className="bg-sidebar-nav">
        {menuGroups.map((group) => <div className="bg-sidebar-group" key={group.label}>
          <div className="bg-sidebar-group-label">{group.label}</div>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const disabled = item.soon || (Boolean(item.permission) && !loading && !hasPermission(item.permission!));
            const title = item.soon ? `${item.label} · In preparazione` : disabled ? `${item.label} · Permesso richiesto` : item.label;
            if (disabled) return <button key={item.href} type="button" disabled className="bg-sidebar-link bg-sidebar-link-disabled" title={title} aria-label={title}>{item.icon}<span>{item.label}</span><em>{item.soon ? "In preparazione" : "Protetto"}</em></button>;
            return <Link key={item.href} href={item.href} className={`bg-sidebar-link ${active ? "bg-sidebar-link-active" : ""}`} aria-current={active ? "page" : undefined} title={title}>{item.icon}<span>{item.label}</span></Link>;
          })}
        </div>)}
      </nav>
      <button title="Logout" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => null); window.location.href = "/login"; }} className="bg-sidebar-logout"><LogOut size={18} /><span>Logout</span></button>
    </aside>
  );

  return <>{sidebar}<div className={`bg-nav-scrim ${mobileOpen ? "bg-nav-scrim-open" : ""}`} onClick={onCloseMobile} /> <div className={`bg-nav-drawer ${mobileOpen ? "bg-nav-drawer-open" : ""}`}>{sidebar}</div></>;
}
