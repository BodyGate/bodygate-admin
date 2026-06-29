"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

function titleFromPath(pathname: string) {
  if (pathname === "/") return "Command Center";
  if (pathname.startsWith("/customers")) return "CRM Clienti";
  if (pathname.startsWith("/reception")) return "Reception";
  if (pathname.startsWith("/payments")) return "Pagamenti";
  if (pathname.startsWith("/access")) return "Access Control";
  if (pathname.startsWith("/badges")) return "Credenziali";
  if (pathname.startsWith("/subscriptions")) return "Abbonamenti";
  if (pathname.startsWith("/notifications")) return "Notifiche";
  if (pathname.startsWith("/training")) return "Training";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/accounting")) return "Contabilità";
  if (pathname.startsWith("/settings")) return "Impostazioni";
  if (pathname.startsWith("/system")) return "Sistema";
  return "BodyGate";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isReceiptPage =
    pathname.startsWith("/customers/") && pathname.includes("/receipt/");
  const isContractPrintPage =
    pathname.startsWith("/customers/") && pathname.endsWith("/contract/print");

  const isPublicStandalonePage =
    pathname.startsWith("/mobile") ||
    pathname.startsWith("/staff-mobile") ||
    pathname.startsWith("/login") ||
    isReceiptPage ||
    isContractPrintPage;

  if (isPublicStandalonePage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: isReceiptPage || isContractPrintPage ? "#ffffff" : "#050505",
        }}
      >
        {children}
      </main>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background:
          "radial-gradient(circle at top left, rgba(239,68,68,.12), transparent 34%), #050505",
        color: "#fff",
      }}
    >
      <Sidebar />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          className="bodygate-shell-header"
          style={{
            height: 76,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 26px",
            background: "rgba(5,5,6,0.74)",
            position: "sticky",
            top: 0,
            zIndex: 20,
            backdropFilter: "blur(18px)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 950,
                letterSpacing: "-0.7px",
              }}
            >
              {titleFromPath(pathname)}
            </div>

            <div
              style={{
                color: "#8b8b8b",
                fontSize: 12,
                marginTop: 4,
                fontWeight: 700,
              }}
            >
              BodyGate · CRM Operativo Fitness
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#86efac",
              fontWeight: 950,
              letterSpacing: "1.2px",
              fontSize: 12,
              padding: "10px 12px",
              borderRadius: 999,
              background: "rgba(34,197,94,.08)",
              border: "1px solid rgba(34,197,94,.18)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#22c55e",
                boxShadow: "0 0 18px rgba(34,197,94,0.85)",
              }}
            />
            OPERATIVO
          </div>
        </header>

        <main
          style={{
            flex: 1,
            padding: 24,
            overflowX: "hidden",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}