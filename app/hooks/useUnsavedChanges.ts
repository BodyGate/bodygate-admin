"use client";

import { useEffect } from "react";

export function useUnsavedChanges(enabled: boolean, message = "Ci sono modifiche non salvate. Uscire dalla pagina?") {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, message]);
}
