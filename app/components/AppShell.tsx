"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

type SystemStatus = "check" | "ok" | "warning" | "offline" | "expired";

const titles: Array<[string, string]> = [
  ["/customers", "Clienti"],
  ["/reception", "Reception"],
  ["/payments", "Pagamenti"],
  ["/access-control", "Accessi"],
  ["/access", "Accessi"],
  ["/badges", "Credenziali"],
  ["/subscriptions", "Abbonamenti"],
  ["/notifications", "Notifiche"],
  ["/training", "Training"],
  ["/analytics", "Analytics"],
  ["/accounting", "Contabilità"],
  ["/settings", "Impostazioni"],
  ["/system", "Sistema"],
];

function titleFromPath(pathname: string) {
  if (pathname === "/") return "Command Center";
  return titles.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "BodyGate";
}

function statusLabel(status: SystemStatus) {
  if (status === "ok") return "Operativo";
  if (status === "warning") return "Operativo con avvisi";
  if (status === "offline") return "Bridge offline";
  if (status === "expired") return "Sessione da rinnovare";
  return "Da verificare";
}

function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>("check");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);

    fetch("/api/bridge/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) return "check" as const;
          return "warning" as const;
        }
        const data = await response.json().catch(() => null);
        if (data?.online === false || data?.bridgeOnline === false) return "offline" as const;
        if (data?.warnings?.length || data?.degraded) return "warning" as const;
        return "ok" as const;
      })
      .catch(() => "check" as const)
      .then((nextStatus) => {
        if (!ignore) {
          setStatus(nextStatus);
          setUpdatedAt(new Date());
        }
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      ignore = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return { status, updatedAt };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const { status, updatedAt } = useSystemStatus();

  const isReceiptPage = pathname.startsWith("/customers/") && pathname.includes("/receipt/");
  const isContractPrintPage = pathname.startsWith("/customers/") && pathname.endsWith("/contract/print");
  const isPublicStandalonePage =
    pathname.startsWith("/mobile") ||
    pathname.startsWith("/staff-mobile") ||
    pathname.startsWith("/login") ||
    isReceiptPage ||
    isContractPrintPage;

  const pageTitle = useMemo(() => titleFromPath(pathname), [pathname]);

  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const focusable = drawerRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key === "Tab" && drawerRef.current) {
        const nodes = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ));
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.body.classList.add("bg-nav-lock");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("bg-nav-lock");
      window.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [navOpen]);

  if (isPublicStandalonePage) {
    return <main className={isReceiptPage || isContractPrintPage ? "bg-print-root" : "bg-public-root"}>{children}</main>;
  }

  return (
    <div className="bg-app-shell">
      <Sidebar mobileOpen={navOpen} onCloseMobile={() => setNavOpen(false)} drawerRef={drawerRef} />
      <div className="bg-app-workspace">
        <header className="bg-app-topbar">
          <button ref={menuButtonRef} className="bg-mobile-menu" type="button" onClick={() => setNavOpen(true)} aria-label="Apri navigazione" aria-expanded={navOpen} aria-controls="bodygate-mobile-nav">
            <Menu size={20} />
          </button>
          <div className="bg-app-title-block">
            <div className="bg-app-title">{pageTitle}</div>
            <div className="bg-app-subtitle">BodyGate · gestionale operativo Body Energy ASD</div>
          </div>
          <div className={`bg-system-pill bg-system-pill-${status}`} title={updatedAt ? `Aggiornato ${updatedAt.toLocaleTimeString("it-IT")}` : undefined}>
            <span className="bg-system-dot" />
            {status === "check" ? <RefreshCw size={14} aria-hidden="true" /> : null}
            <span>{statusLabel(status)}</span>
          </div>
        </header>
        <main className="bg-app-content">{children}</main>
        <nav className="bg-mobile-service-nav" aria-label="Navigazione rapida mobile">
          <a href="/">Home</a><a href="/customers">Clienti</a><a href="/reception">Reception</a><a href="/access-control">Accessi</a><button type="button" onClick={() => setNavOpen(true)}>Altro</button>
        </nav>
      </div>
    </div>
  );
}
