"use client";

import { useEffect } from "react";

import { REMEMBERED_PASS_KEY } from "../../lib/passManifest";

// Ricorda nel browser il pass appena aperto, così l'icona in Home salvata con il
// vecchio indirizzo fisso (vedi /mobile/open) ritrova il pass del cliente.
export default function RememberPass({ path }: { path: string }) {
  useEffect(() => {
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${REMEMBERED_PASS_KEY}=${encodeURIComponent(path)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    } catch {}

    try {
      window.localStorage.setItem(REMEMBERED_PASS_KEY, path);
    } catch {}
  }, [path]);

  return null;
}
