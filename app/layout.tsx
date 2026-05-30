import type { Metadata } from "next";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "BodyGate",
  description: "BodyGate Smart Gym Platform",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          background: "#050505",
          color: "#fff",
          fontFamily:
            'Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
