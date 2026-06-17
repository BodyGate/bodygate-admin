"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentPermissions } from "../hooks/useCurrentPermissions";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  DoorOpen,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Monitor,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

type MenuItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
};

type SidebarProps = {
  mode?: "desktop" | "drawer";
  onNavigate?: () => void;
};

const mainMenu: MenuItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={20} aria-hidden="true" /> },
  { label: "Clienti", href: "/customers", icon: <Users size={20} aria-hidden="true" /> },
  { label: "Reception", href: "/reception", icon: <Monitor size={20} aria-hidden="true" /> },
  { label: "Access Control", href: "/access-control", icon: <DoorOpen size={20} aria-hidden="true" /> },
  { label: "Badge", href: "/badges", icon: <BadgeCheck size={20} aria-hidden="true" /> },
  { label: "Pagamenti", href: "/payments", icon: <CreditCard size={20} aria-hidden="true" />, permission: "view_payments" },
  { label: "Abbonamenti", href: "/subscriptions", icon: <CalendarDays size={20} aria-hidden="true" /> },
  { label: "Notifiche", href: "/notifications", icon: <Bell size={20} aria-hidden="true" /> },
  { label: "Training", href: "/training", icon: <Dumbbell size={20} aria-hidden="true" /> },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 size={20} aria-hidden="true" /> },
  { label: "Contabilità", href: "/accounting", icon: <Receipt size={20} aria-hidden="true" /> },
  { label: "Sistema", href: "/system", icon: <Settings size={20} aria-hidden="true" /> },
  { label: "Impostazioni", href: "/settings", icon: <Settings size={20} aria-hidden="true" /> },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ mode = "desktop", onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { loading, hasPermission } = useCurrentPermissions();
  const isDrawer = mode === "drawer";

  return (
    <aside className={isDrawer ? "bg-sidebar bg-sidebar--drawer" : "bg-sidebar bg-sidebar--desktop"} aria-label="Navigazione principale">
      <Link href="/" title="BodyGate" aria-label="BodyGate dashboard" className="bg-sidebar__brand" onClick={onNavigate}>
        <span aria-hidden="true">BG</span>
      </Link>

      {isDrawer ? <div className="bg-sidebar__section-label">Menu principale</div> : null}

      <nav className="bg-sidebar__nav" aria-label="Sezioni BodyGate">
        {mainMenu.map((item) => {
          const active = isActive(pathname, item.href);
          const disabled = Boolean(item.permission) && !loading && !hasPermission(item.permission!);
          const title = disabled ? `${item.label} · Protetto / Permessi non configurati` : item.label;
          const className = `bg-sidebar__item${active ? " bg-sidebar__item--active" : ""}${isDrawer ? " bg-sidebar__item--drawer" : ""}`;

          if (disabled) {
            return (
              <button key={item.href} type="button" title={title} aria-label={title} disabled className={`${className} bg-sidebar__item--disabled`}>
                {item.icon}
                {isDrawer ? <span>{item.label}</span> : null}
              </button>
            );
          }

          return (
            <Link key={item.href} href={item.href} title={title} aria-label={title} aria-current={active ? "page" : undefined} className={className} onClick={onNavigate}>
              {item.icon}
              {isDrawer ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="bg-sidebar__footer">
        <div title="Online" aria-label="Sistema online" className="bg-sidebar__online">●</div>
        <button
          title="Logout"
          aria-label="Logout"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
            window.location.href = "/login";
          }}
          className="bg-sidebar__logout"
        >
          <LogOut size={18} aria-hidden="true" />
          {isDrawer ? <span>Logout</span> : null}
        </button>
      </div>
    </aside>
  );
}
