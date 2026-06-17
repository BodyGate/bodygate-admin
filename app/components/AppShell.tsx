"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isReceiptPage = pathname.startsWith("/customers/") && pathname.includes("/receipt/");
  const isContractPrintPage = pathname.startsWith("/customers/") && pathname.endsWith("/contract/print");
  const isPublicStandalonePage =
    pathname.startsWith("/mobile") ||
    pathname.startsWith("/staff-mobile") ||
    pathname.startsWith("/login") ||
    isReceiptPage ||
    isContractPrintPage;

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || []);
    focusable[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  if (isPublicStandalonePage) {
    return <div className={isReceiptPage || isContractPrintPage ? "bg-standalone-page bg-standalone-page--print" : "bg-standalone-page"}>{children}</div>;
  }

  return (
    <div className="bg-app-shell">
      <Sidebar />

      <div className="bg-app-main-column">
        <header className="bg-app-header">
          <button ref={triggerRef} type="button" className="bg-mobile-menu-button" aria-label="Apri navigazione" aria-expanded={drawerOpen} aria-controls="bodygate-mobile-nav" onClick={() => setDrawerOpen(true)}>
            <Menu size={20} aria-hidden="true" />
          </button>

          <div className="bg-app-title-block">
            <div className="bg-app-title">{titleFromPath(pathname)}</div>
            <div className="bg-app-subtitle">BodyGate · CRM Operativo Fitness</div>
          </div>

          <div className="bg-app-status"><span aria-hidden="true" />OPERATIVO</div>
        </header>

        <main className="bg-app-content">{children}</main>
      </div>

      {drawerOpen ? (
        <div className="bg-mobile-nav-layer" role="presentation">
          <button type="button" className="bg-mobile-nav-backdrop" aria-label="Chiudi navigazione" onClick={() => { setDrawerOpen(false); triggerRef.current?.focus(); }} />
          <div id="bodygate-mobile-nav" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigazione BodyGate" className="bg-mobile-nav-dialog">
            <button type="button" className="bg-mobile-nav-close" aria-label="Chiudi navigazione" onClick={() => { setDrawerOpen(false); triggerRef.current?.focus(); }}>
              <X size={20} aria-hidden="true" />
            </button>
            <Sidebar mode="drawer" onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
