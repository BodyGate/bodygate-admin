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

const mainMenu: MenuItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={20} /> },
  { label: "Clienti", href: "/customers", icon: <Users size={20} /> },
  { label: "Reception", href: "/reception", icon: <Monitor size={20} /> },
  { label: "Access Control", href: "/access-control", icon: <DoorOpen size={20} /> },
  { label: "Badge", href: "/badges", icon: <BadgeCheck size={20} /> },
  { label: "Pagamenti", href: "/payments", icon: <CreditCard size={20} />, permission: "view_payments" },
  { label: "Abbonamenti", href: "/subscriptions", icon: <CalendarDays size={20} /> },
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
    <aside
      style={{
        width: 88,
        minWidth: 88,
        height: "100vh",
        position: "sticky",
        top: 0,
        zIndex: 40,
        padding: "18px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        background:
          "radial-gradient(circle at top, rgba(91,61,245,0.14), transparent 38%), rgba(5,5,6,0.96)",
        backdropFilter: "blur(18px)",
      }}
    >
      <Link
        href="/"
        title="BodyGate"
        style={{
          width: 56,
          height: 56,
          borderRadius: 20,
          display: "grid",
          placeItems: "center",
          textDecoration: "none",
          color: "#fff",
          fontSize: 18,
          fontWeight: 950,
          background: "linear-gradient(135deg, #5b3df5, #3d2b99)",
          boxShadow: "0 18px 38px rgba(91,61,245,0.24)",
        }}
      >
        BG
      </Link>

      <nav
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          overflowY: "auto",
        }}
      >
        {mainMenu.map((item) => {
          const active = isActive(pathname, item.href);
          const isProtected = Boolean(item.permission);
          const disabled = isProtected && !loading && !hasPermission(item.permission!);
          const title = disabled
            ? `${item.label} · Protetto / Permessi non configurati`
            : item.label;

          if (disabled) {
            return (
              <button
                key={item.href}
                type="button"
                title={title}
                aria-label={title}
                disabled
                style={{
                  width: 56,
                  height: 52,
                  borderRadius: 18,
                  display: "grid",
                  placeItems: "center",
                  color: "#71717a",
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.045)",
                  cursor: "not-allowed",
                  opacity: 0.58,
                }}
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
              style={{
                width: 56,
                height: 52,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                color: active ? "#fff" : "#a1a1aa",
                textDecoration: "none",
                background: active
                  ? "linear-gradient(135deg, rgba(91,61,245,0.95), rgba(61,43,153,0.75))"
                  : "rgba(255,255,255,0.035)",
                border: active
                  ? "1px solid rgba(248,113,113,0.55)"
                  : "1px solid rgba(255,255,255,0.055)",
                boxShadow: active
                  ? "0 16px 32px rgba(91,61,245,0.22)"
                  : "none",
              }}
            >
              {item.icon}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
        <div
          title="Online"
          style={{
            width: 50,
            height: 38,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            color: "#86efac",
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.22)",
            fontWeight: 950,
          }}
        >
          ●
        </div>

        <button
          title="Logout"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
            window.location.href = "/login";
          }}
          style={{
            width: 50,
            height: 42,
            borderRadius: 16,
            cursor: "pointer",
            color: "#fecaca",
            background: "rgba(91,61,245,0.11)",
            border: "1px solid rgba(91,61,245,0.22)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
