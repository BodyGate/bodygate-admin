"use client";

import { useEffect, useState } from "react";
import { BGStatCard } from "@/components/bodygate-ui";

type Health = {
  ok: boolean;
  status?: "ok" | "warning" | "critical" | "closed" | "unknown";
  minutesSinceLastAccess?: number | null;
  lastAccessAt?: string | null;
};

const REFRESH_MS = 30_000;

function describe(health: Health | null) {
  if (!health || !health.ok) {
    return { value: "NON VERIFICABILE", tone: "yellow" as const, note: "Impossibile leggere gli ultimi accessi." };
  }
  const minutes = health.minutesSinceLastAccess;
  switch (health.status) {
    case "ok":
      return { value: `${minutes} min fa`, tone: "green" as const, note: "Ultimo passaggio registrato." };
    case "warning":
      return {
        value: `${minutes} min fa`,
        tone: "yellow" as const,
        note: "Nessun passaggio da un po': prova un badge e controlla il controller DNake.",
      };
    case "critical":
      return {
        value: `${minutes} min fa`,
        tone: "red" as const,
        note: "Nessun passaggio registrato: il tornello potrebbe non registrare. Riavvia il DNake e verifica il bridge.",
      };
    case "closed":
      return { value: "CHIUSO", tone: "neutral" as const, note: "Fuori orario di apertura." };
    default:
      return { value: "NESSUN DATO", tone: "yellow" as const, note: "Nessun accesso registrato." };
  }
}

export default function AccessHealthCard() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/system/access-health", { cache: "no-store" });
        const json = (await response.json()) as Health;
        if (!cancelled) setHealth(json);
      } catch {
        if (!cancelled) setHealth({ ok: false });
      }
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const { value, tone, note } = describe(health);
  return <BGStatCard label="Ultimo passaggio tornello" value={value} tone={tone} note={note} />;
}
