"use client";

import { useEffect, useState } from "react";

import { BGAlert, BGButton } from "@/components/bodygate-ui";

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
    <div className="no-print mx-auto mb-5 flex w-[210mm] items-start justify-between gap-3">
      <div className="flex-1">
        <BGAlert title="Cliente creato correttamente" tone="warning">
          Alcuni passaggi accessori richiedono un secondo tentativo: {message}
        </BGAlert>
      </div>
      <BGButton
        variant="ghost"
        onClick={() => setVisible(false)}
        aria-label="Chiudi avviso"
      >
        ×
      </BGButton>
    </div>
  );
}
