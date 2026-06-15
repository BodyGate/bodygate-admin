"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentPermissions } from "../../hooks/useCurrentPermissions";

const menu = [
  {
    label: "Dashboard",
    href: "/training/dashboard",
  },
  {
    label: "Clienti",
    href: "/training/clients",
  },
  {
    label: "Programmi",
    href: "/training/programs",
    permission: "manage_training",
  },
  {
    label: "Workout",
    href: "/training/workouts",
  },
  {
    label: "Check-in",
    href: "/training/checkins",
  },
  {
    label: "Libreria",
    href: "/training/library",
    permission: "manage_training",
  },
];

export default function TrainingSidebar() {
  const pathname = usePathname();
  const { loading, hasPermission } = useCurrentPermissions();

  return (
    <aside
      style={{
        width: 270,
        minHeight: "100vh",
        background: "#020617",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: 22,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 30 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#fff",
          }}
        >
          BodyGate
        </div>

        <div
          style={{
            color: "#60a5fa",
            fontSize: 13,
            marginTop: 4,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Training Platform
        </div>
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {menu.map((item) => {
          const active = pathname === item.href;
          const disabled = Boolean(item.permission) && !loading && !hasPermission(item.permission!);
          const title = disabled
            ? `${item.label} · Protetto / Permessi non configurati`
            : item.label;

          if (disabled) {
            return (
              <button
                key={item.href}
                type="button"
                title={title}
                disabled
                style={{
                  padding: "14px 16px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.035)",
                  color: "#64748b",
                  fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.06)",
                  cursor: "not-allowed",
                  textAlign: "left",
                }}
              >
                {item.label} · Protetto
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={title}
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                textDecoration: "none",
                background: active
                  ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
                  : "transparent",
                color: active ? "#fff" : "#cbd5e1",
                fontWeight: active ? 800 : 600,
                border: active
                  ? "none"
                  : "1px solid rgba(255,255,255,0.06)",
                transition: "0.2s",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          paddingTop: 20,
        }}
      >
        <Link
          href="/"
          style={{
            display: "block",
            padding: "14px 16px",
            borderRadius: 16,
            textDecoration: "none",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Torna al gestionale
        </Link>
      </div>
    </aside>
  );
}
