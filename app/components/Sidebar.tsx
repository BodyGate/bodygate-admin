"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useEnabledModules } from "../hooks/useEnabledModules";
import { useCurrentPermissions } from "../hooks/useCurrentPermissions";

const allMenu = [
  {
    label: "Dashboard",
    href: "/",
    permission: "view_dashboard",
  },

  {
    label: "Clienti",
    href: "/customers",
    permission: "view_customers",
  },

  {
    label: "Accessi",
    href: "/access-logs",
    permission: "view_access_logs",
  },

  {
    label: "Badge",
    href: "/badges",
    permission: "manage_access",
  },

  {
    label: "Abbonamenti",
    href: "/subscriptions",
    permission: "view_customers",
  },

  {
    label: "Pagamenti",
    href: "/payments",
    module: "advanced_payments",
    permission: "view_payments",
  },

  {
    label: "Analytics",
    href: "/analytics",
    permission: "view_analytics",
  },

  {
    label: "Notifiche",
    href: "/notifications",
    module: "notifications",
    permission: "view_notifications",
  },

  {
    label: "Reception",
    href: "/reception",
    module: "reception_mode",
    permission: "view_dashboard",
  },
  
  {
  label: "Pricing",
  href: "/settings/pricing",
  permission: "manage_payments",
},

  {
    label: "Training",
    href: "/training",
    module: "training_platform",
    permission: "manage_training",
  },
  
  {
  label: "Esercizi",
  href: "/training/library",
  module: "training_platform",
  permission: "manage_training",
},

  {
    label: "Moduli",
    href: "/settings/modules",
    permission: "manage_modules",
  },

  {
    label: "Permessi",
    href: "/settings/permissions",
    module: "staff_permissions",
    permission: "manage_staff",
  },

  {
    label: "Sistema",
    href: "/system",
    permission: "manage_staff",
  },
  
  {
  label: "Audit Logs",
  href: "/system/audit",
  permission: "manage_staff",
},
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const { enabledModules } = useEnabledModules();

  const {
    hasPermission,
    staffName,
    roleKey,
  } = useCurrentPermissions();

  const menu = allMenu.filter((item) => {
    const moduleAllowed = item.module
      ? enabledModules.includes(item.module)
      : true;

    const permissionAllowed = item.permission
      ? hasPermission(item.permission)
      : true;

    return moduleAllowed && permissionAllowed;
  });

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

      <div
        style={{
          background: "rgba(15,23,42,0.92)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "var(--muted)",
            marginBottom: "8px",
          }}
        >
          Staff Attuale
        </div>

        <div
          style={{
            fontWeight: 800,
            fontSize: "16px",
          }}
        >
          {staffName || "Nessun utente"}
        </div>

        <div
          style={{
            marginTop: "6px",
            color: "#60a5fa",
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {roleKey || "no-role"}
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