"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  icon: string;
  description: string;
};

const menu: MenuItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: "🏠",
    description: "Panoramica reception",
  },
  {
    label: "Clienti",
    href: "/customers",
    icon: "👥",
    description: "Anagrafica e CRM",
  },
  {
    label: "Credenziali",
    href: "/badges",
    icon: "🎫",
    description: "RFID, NFC e QR",
  },
  {
    label: "Accessi",
    href: "/access-logs",
    icon: "🚪",
    description: "Log tornello",
  },
  {
    label: "Abbonamenti",
    href: "/subscriptions",
    icon: "💳",
    description: "Piani e rinnovi",
  },
  {
    label: "Pagamenti",
    href: "/payments",
    icon: "💰",
    description: "Incassi e ricevute",
  },
  {
    label: "Reception",
    href: "/reception",
    icon: "🖥️",
    description: "Modalità banco",
  },
  {
    label: "Training",
    href: "/training",
    icon: "🏋️",
    description: "Schede e atleti",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "📊",
    description: "Statistiche",
  },
  {
    label: "Sistema",
    href: "/system",
    icon: "⚙️",
    description: "Impostazioni",
  },
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
        width: "270px",
        flexShrink: 0,
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, rgba(12,12,14,0.98), rgba(24,24,27,0.98))",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        padding: "18px",
        position: "sticky",
        top: 0,
      }}
    >
      <Link
        href="/"
        style={{
          textDecoration: "none",
          color: "inherit",
          marginBottom: "22px",
          display: "block",
        }}
      >
        <div
          style={{
            borderRadius: "22px",
            padding: "18px",
            background:
              "linear-gradient(135deg, rgba(91,61,245,0.22), rgba(61,43,153,0.12))",
            border: "1px solid rgba(91,61,245,0.24)",
          }}
        >
          <div
            style={{
              fontSize: "29px",
              fontWeight: 900,
              letterSpacing: "-1px",
              color: "#fff",
              lineHeight: 1,
            }}
          >
            BodyGate
          </div>

          <div
            style={{
              marginTop: "8px",
              color: "rgba(255,255,255,0.62)",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Smart Gym Platform
          </div>
        </div>
      </Link>

      <div
        style={{
          marginBottom: "14px",
          padding: "0 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "rgba(255,255,255,0.42)",
          fontSize: "11px",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        <span>Menu principale</span>
        <span>●</span>
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          overflowY: "auto",
          paddingRight: "2px",
        }}
      >
        {menu.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 13px",
                borderRadius: "17px",
                textDecoration: "none",
                color: active ? "#fff" : "rgba(255,255,255,0.68)",
                background: active
                  ? "linear-gradient(135deg, #5b3df5, #3d2b99)"
                  : "rgba(255,255,255,0.035)",
                border: active
                  ? "1px solid rgba(255,255,255,0.18)"
                  : "1px solid rgba(255,255,255,0.055)",
                boxShadow: active
                  ? "0 12px 30px rgba(91,61,245,0.24)"
                  : "none",
                transition: "0.18s ease",
              }}
            >
              <span
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(255,255,255,0.06)",
                  fontSize: "17px",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>

              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 850,
                    lineHeight: 1.1,
                  }}
                >
                  {item.label}
                </span>

                <span
                  style={{
                    display: "block",
                    marginTop: "4px",
                    fontSize: "11px",
                    color: active
                      ? "rgba(255,255,255,0.78)"
                      : "rgba(255,255,255,0.38)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: "18px" }}>
        <div
          style={{
            borderRadius: "20px",
            padding: "14px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.075)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: "#22c55e",
                boxShadow: "0 0 18px rgba(34,197,94,0.9)",
              }}
            />
            <div
              style={{
                color: "rgba(255,255,255,0.68)",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              Sistema operativo
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              width: "100%",
              border: "none",
              background: "rgba(91,61,245,0.14)",
              color: "#fecaca",
              padding: "12px",
              borderRadius: "15px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
