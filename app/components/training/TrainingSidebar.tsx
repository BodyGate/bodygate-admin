"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentPermissions } from "../../hooks/useCurrentPermissions";

const menu = [
  { label: "Dashboard", href: "/training/dashboard" },
  { label: "Clienti", href: "/training/clients" },
  {
    label: "Programmi",
    href: "/training/programs",
    permission: "manage_training",
  },
  { label: "Workout", href: "/training/workouts" },
  { label: "Check-in", href: "/training/checkins" },
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
        width: 220,
        minWidth: 0,
        flex: "0 0 220px",
        height: "calc(100dvh - 76px)",
        position: "sticky",
        top: 76,
        overflow: "hidden",
        background: "#020617",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 24, flex: "0 0 auto" }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "#fff",
            overflowWrap: "anywhere",
          }}
        >
          BodyGate
        </div>

        <div
          style={{
            color: "#60a5fa",
            fontSize: 12,
            marginTop: 4,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            overflowWrap: "anywhere",
          }}
        >
          Training Platform
        </div>
      </div>

      <nav
        style={{
          display: "flex",
          flex: "1 1 auto",
          minHeight: 0,
          flexDirection: "column",
          gap: 9,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
        }}
      >
        {menu.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const disabled =
            Boolean(item.permission) &&
            !loading &&
            !hasPermission(item.permission!);
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
                  width: "100%",
                  minWidth: 0,
                  padding: "13px 14px",
                  borderRadius: 15,
                  background: "rgba(255,255,255,0.035)",
                  color: "#64748b",
                  fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.06)",
                  cursor: "not-allowed",
                  textAlign: "left",
                  overflowWrap: "anywhere",
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
                display: "block",
                width: "100%",
                minWidth: 0,
                padding: "13px 14px",
                borderRadius: 15,
                textDecoration: "none",
                background: active
                  ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
                  : "transparent",
                color: active ? "#fff" : "#cbd5e1",
                fontWeight: active ? 800 : 600,
                border: active
                  ? "1px solid transparent"
                  : "1px solid rgba(255,255,255,0.06)",
                overflowWrap: "anywhere",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 18, flex: "0 0 auto" }}>
        <Link
          href="/"
          style={{
            display: "block",
            width: "100%",
            minWidth: 0,
            padding: "13px 14px",
            borderRadius: 15,
            textDecoration: "none",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontWeight: 700,
            textAlign: "center",
            overflowWrap: "anywhere",
          }}
        >
          Torna al gestionale
        </Link>
      </div>
    </aside>
  );
}
