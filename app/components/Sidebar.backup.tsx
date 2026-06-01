"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  badge?: string;
};

const mainMenu: MenuItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Clienti", href: "/customers" },
  { label: "Credenziali", href: "/badges" },
  { label: "Accessi", href: "/access-logs" },
  { label: "Abbonamenti", href: "/subscriptions" },
  { label: "Pagamenti", href: "/payments" },
  { label: "Contabilità", href: "/accounting" },
  { label: "Reception", href: "/reception" },
  { label: "Training", href: "/training" },
  { label: "Analytics", href: "/analytics" },
  { label: "Notifiche", href: "/notifications" },
  { label: "Sistema", href: "/system" },
  { label: "Impostazioni", href: "/settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 292,
        minWidth: 292,
        height: "100vh",
        position: "sticky",
        top: 0,
        background:
          "linear-gradient(180deg, rgba(12,12,14,0.98), rgba(5,5,6,0.98))",
        borderRight: "1px solid rgba(255,255,255,0.09)",
        padding: "26px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        overflowY: "auto",
      }}
    >
      <div>
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "#fff",
            fontSize: 34,
            fontWeight: 950,
            letterSpacing: "-1.4px",
            display: "block",
            lineHeight: 1,
          }}
        >
          BodyGate
        </Link>
        <div
          style={{
            marginTop: 8,
            color: "#9ca3af",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Smart Gym Platform
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(59,130,246,0.22)",
          background: "rgba(15,23,42,0.72)",
          borderRadius: 18,
          padding: 18,
        }}
      >
        <div style={{ color: "#93c5fd", fontSize: 12, marginBottom: 8 }}>
          Staff attuale
        </div>
        <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>
          Operatore
        </div>
        <div
          style={{
            color: "#60a5fa",
            fontSize: 12,
            fontWeight: 900,
            marginTop: 6,
            textTransform: "uppercase",
          }}
        >
          Reception
        </div>
      </div>

      <nav style={{ display: "grid", gap: 7 }}>
        {mainMenu.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                textDecoration: "none",
                color: active ? "#fff" : "#cbd5e1",
                background: active
                  ? "linear-gradient(90deg, rgba(239,68,68,0.95), rgba(153,27,27,0.55))"
                  : "rgba(255,255,255,0.035)",
                border: active
                  ? "1px solid rgba(248,113,113,0.65)"
                  : "1px solid rgba(255,255,255,0.055)",
                borderRadius: 14,
                padding: "12px 14px",
                fontSize: 14,
                fontWeight: active ? 900 : 750,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "all 160ms ease",
              }}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "#fff",
                    background: "rgba(255,255,255,0.16)",
                    padding: "3px 7px",
                    borderRadius: 999,
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div
        style={{
          border: "1px solid rgba(34,197,94,0.18)",
          background: "rgba(20,20,20,0.86)",
          borderRadius: 18,
          padding: 18,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 12 }}>
          Sistema online
        </div>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
            window.location.href = "/login";
          }}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 14,
            padding: "13px 14px",
            background: "#ef4444",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
