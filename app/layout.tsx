import type { Metadata, Viewport } from "next";
import AppShell from "./components/AppShell";
import "./globals.css";
import "./components/ui/bodygate-ui.css";
import "./components/ui/dashboard-quick-actions.css";

export const metadata: Metadata = {
  title: "BodyGate",
  description: "BodyGate Smart Gym Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BodyGate",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
