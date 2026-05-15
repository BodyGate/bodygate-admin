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
                  height: "78px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 32px",
                  background: "rgba(10,10,10,0.9)",
                  backdropFilter: "blur(10px)",
                  position: "sticky",
                  top: 0,
                  zIndex: 50,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                    }}
                  >
                    BodyGate Admin
                  </div>

                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "13px",
                    }}
                  >
                    Access Control Management
                  </div>
                </div>
              </header>

              <main
                style={{
                  flex: 1,
                  padding: "32px",
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