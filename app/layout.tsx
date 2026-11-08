import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import AppShell from "./components/AppShell";
import "./globals.css";
import "./components/ui/bodygate-ui.css";
import "./components/ui/dashboard-quick-actions.css";

// Font inclusi nel repository (app/fonts): nessun download da Google in build.
const fontDisplay = localFont({
  src: "./fonts/PlusJakartaSans-latin-wght.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-display",
});

const fontBody = localFont({
  src: "./fonts/PublicSans-latin-wght.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-body",
});

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
  themeColor: "#f4f5f8",
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
    <html lang="it" className={`${fontDisplay.variable} ${fontBody.variable}`}>
      <body
        style={{
          margin: 0,
          background: "#f4f5f8",
          color: "#15161c",
          fontFamily: "var(--font-body)",
        }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
