"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublicStandalonePage =
    pathname.startsWith("/mobile") || pathname.startsWith("/login");

  if (isPublicStandalonePage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#050505",
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
        background: "#050505",
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
          style={{
            height: 88,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 26px",
            background: "rgba(5,5,6,0.94)",
            position: "sticky",
            top: 0,
            zIndex: 20,
            backdropFilter: "blur(16px)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                letterSpacing: "-0.8px",
              }}
            >
              BodyGate Reception
            </div>

            <div
              style={{
                color: "#9ca3af",
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Clienti · Accessi · Abbonamenti · Pagamenti
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#86efac",
              fontWeight: 950,
              letterSpacing: "1.6px",
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
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
