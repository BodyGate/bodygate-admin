import type { Metadata } from "next";
import Sidebar from "./components/Sidebar";
import { ThemeProvider } from "./components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "BodyGate",
  description: "BodyGate Access Control Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <ThemeProvider>
          <div
            style={{
              display: "flex",
              minHeight: "100vh",
              background: "var(--bg)",
              color: "var(--text)",
            }}
          >
            <Sidebar />

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <header
                style={{
                  minHeight: "72px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 22px",
                  background: "rgba(10,10,10,0.82)",
                  backdropFilter: "blur(12px)",
                  position: "sticky",
                  top: 0,
                  zIndex: 50,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "19px",
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    BodyGate Reception
                  </div>

                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "12px",
                      marginTop: "3px",
                    }}
                  >
                    Clienti · Accessi · Abbonamenti · Pagamenti
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#86efac",
                    fontSize: "12px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "999px",
                      background: "#22c55e",
                      boxShadow: "0 0 14px rgba(34,197,94,0.9)",
                    }}
                  />
                  Operativo
                </div>
              </header>

              <main
                style={{
                  flex: 1,
                  padding: "20px",
                  overflowX: "hidden",
                }}
              >
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
