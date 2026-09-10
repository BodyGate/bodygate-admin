"use client";

import { useEffect, useState } from "react";

export default function OnboardingWarningBanner({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // The warning arrives as a query param from the onboarding redirect (a
    // one-time notice, not persistent state). Strip it from the URL after
    // the first render so a later reload of this page doesn't re-show a
    // possibly stale warning as if it just happened again.
    const url = new URL(window.location.href);
    url.searchParams.delete("onboarding_warning");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="no-print"
      style={{
        width: "210mm",
        margin: "0 auto 20px auto",
        background: "rgba(179, 121, 10, 0.1)",
        border: "1px solid rgba(179, 121, 10, 0.32)",
        color: "#8f620c",
        padding: "16px",
        borderRadius: "16px",
        fontWeight: 700,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
      }}
    >
      <span>
        Cliente creato correttamente. Alcuni passaggi accessori richiedono un
        secondo tentativo: {message}
      </span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Chiudi avviso"
        style={{
          background: "transparent",
          border: "none",
          color: "#8f620c",
          fontWeight: 800,
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
