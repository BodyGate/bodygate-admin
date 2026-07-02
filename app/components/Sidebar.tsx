"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentPermissions } from "../hooks/useCurrentPermissions";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpenCheck,
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

const mainMenu: MenuItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={20} /> },
  { label: "Clienti", href: "/customers", icon: <Users size={20} /> },
  { label: "Reception", href: "/reception", icon: <Monitor size={20} /> },
  {
    label: "Corsi",
    href: "/courses",
    icon: <BookOpenCheck size={20} />,
    permission: "view_courses",
  },
  {
    label: "Access Control",
    href: "/access-control",
    icon: <DoorOpen size={20} />,
  },
  { label: "Badge", href: "/badges", icon: <BadgeCheck size={20} /> },
  {
    label: "Pagamenti",
    href: "/payments",
    icon: <CreditCard size={20} />,
    permission: "view_payments",
  },
  {
    label: "Abbonamenti",
    href: "/subscriptions",
    icon: <CalendarDays size={20} />,
  },
  { label: "Notifiche", href: "/notifications", icon: <Bell size={20} /> },
  { label: "Training", href: "/training", icon: <Dumbbell size={20} /> },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 size={20} /> },
  { label: "Contabilità", href: "/accounting", icon: <Receipt size={20} /> },
  { label: "Sistema", href: "/system", icon: <Settings size={20} /> },
  { label: "Impostazioni", href: "/settings", icon: <Settings size={20} /> },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const { loading, hasPermission } = useCurrentPermissions();

  return (
    <aside className="bodygate-sidebar" aria-label="Navigazione principale">
      <Link href="/" title="BodyGate" className="bodygate-sidebar-brand">
        BG
      </Link>

      <nav className="bodygate-sidebar-nav">
        {mainMenu.map((item) => {
          const active = isActive(pathname, item.href);
          const protectedItem = Boolean(item.permission);
          const disabled =
            protectedItem && !loading && !hasPermission(item.permission!);
          const title = disabled
            ? `${item.label} · Protetto / Permessi non configurati`
            : item.label;
          const itemClassName = `bodygate-sidebar-item${
            active ? " bodygate-sidebar-item-active" : ""
          }`;

          if (disabled) {
            return (
              <button
                key={item.href}
                type="button"
                title={title}
                aria-label={title}
                disabled
                className={`${itemClassName} bodygate-sidebar-item-disabled`}
              >
                {item.icon}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={title}
              aria-label={title}
              className={itemClassName}
            >
              {item.icon}
            </Link>
          );
        })}
      </nav>

      <div className="bodygate-sidebar-footer">
        <div
          title="Online"
          aria-label="Sistema online"
          className="bodygate-sidebar-online"
        >
          <span aria-hidden="true" />
        </div>

        <button
          type="button"
          title="Logout"
          aria-label="Logout"
          className="bodygate-sidebar-logout"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" }).catch(
              () => null,
            );
            window.location.href = "/login";
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
