"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const menu = [
  { label: "Dashboard", href: "/" },
  { label: "Accessi", href: "/access-logs" },
  { label: "Clienti", href: "/customers" },
  { label: "Badge", href: "/badges" },
  { label: "Abbonamenti", href: "/subscriptions" },
  { label: "Pagamenti", href: "/payments" },
  { label: "Analytics", href: "/analytics" },
  { label: "Reception", href: "/reception" },
  { label: "Training", href: "/training" },
  { label: "Sistema", href: "/system" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      style={{
        width: "280px",
        flexShrink: 0,
        background: "var(--bg-soft)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "40px" }}>
        <div
          style={{
            fontSize: "30px",
            fontWeight: 800,
            letterSpacing: "-1px",
          }}
        >
          BodyGate
        </div>

        <div
          style={{
            color: "var(--muted)",
            marginTop: "8px",
            fontSize: "13px",
          }}
        >
          Smart Gym Platform
        </div>
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {menu.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "14px 18px",
                borderRadius: "18px",
                textDecoration: "none",
                color: active ? "white" : "var(--muted)",
                background: active
                  ? "linear-gradient(to right, #ef4444, #dc2626)"
                  : "transparent",
                border: active
                  ? "1px solid transparent"
                  : "1px solid var(--border)",
                fontWeight: active ? 700 : 500,
                transition: "0.2s",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto" }}>
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "22px",
            padding: "18px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "var(--muted)",
              marginBottom: "14px",
            }}
          >
            Sistema online
          </div>

          <button
            onClick={logout}
            style={{
              width: "100%",
              border: "none",
              background: "#ef4444",
              color: "white",
              padding: "14px",
              borderRadius: "16px",
              fontWeight: 700,
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}