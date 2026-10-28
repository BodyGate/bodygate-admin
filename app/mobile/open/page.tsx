import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BGEmptyState, BGPageShell } from "@/components/bodygate-ui";
import { REMEMBERED_PASS_KEY, rememberedPassPath } from "../../lib/passManifest";
import OpenRememberedPass from "./OpenRememberedPass";

export const dynamic = "force-dynamic";

// Punto d'ingresso delle icone in Home: riapre l'ultimo pass aperto su questo telefono.
export default async function OpenPassPage() {
  const cookieStore = await cookies();
  const path = rememberedPassPath(cookieStore.get(REMEMBERED_PASS_KEY)?.value);

  if (path) redirect(path);

  return (
    <BGPageShell style={{ padding: 16 }}>
      <OpenRememberedPass />
      <BGEmptyState
        title="Apri il tuo pass"
        description="Apri il link del pass che hai ricevuto su WhatsApp: da lì il QR resta salvato anche per i prossimi accessi. Se non trovi il messaggio, chiedi alla reception di rinviartelo."
      />
    </BGPageShell>
  );
}
