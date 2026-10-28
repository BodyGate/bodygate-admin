"use client";

import { useEffect } from "react";

import { REMEMBERED_PASS_KEY, rememberedPassPath } from "../../lib/passManifest";

// Se il cookie manca (es. l'app in Home ha uno spazio separato dal browser) prova
// il localStorage; altrimenti resta visibile il messaggio della pagina.
export default function OpenRememberedPass() {
  useEffect(() => {
    try {
      const path = rememberedPassPath(window.localStorage.getItem(REMEMBERED_PASS_KEY));
      if (path) window.location.replace(path);
    } catch {}
  }, []);

  return null;
}
