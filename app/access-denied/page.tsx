"use client"

import { BGButton, BGCard, BGPageHeader, BGPageShell, BGStatusBadge } from "@/components/bodygate-ui"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"


function AccessDeniedContent() {
  const searchParams = useSearchParams()
  const permission = searchParams.get("permission")
  const section = searchParams.get("section")

  return (
    <main>
      <BGPageShell>
        <BGPageHeader
          eyebrow="BodyGate Security"
          title="Accesso negato"
          subtitle="Pagina di fallback di sicurezza per permessi non disponibili o sessione non ancora caricata."
          actions={<BGStatusBadge tone="danger">Bloccato</BGStatusBadge>}
        />

        <BGCard variant="danger">
          <div className="grid gap-5">
            <p className="m-0 text-sm font-bold leading-6 text-zinc-200">
              Se hai un ruolo amministrativo valido, torna alla dashboard e
              riprova dopo il caricamento della sessione. Altrimenti richiedi a
              un amministratore il permesso indicato.
            </p>

            <div className="grid gap-2 rounded-lg border border-white/10 bg-black/25 p-4 text-sm font-black text-white">
              <span>Sezione: {section || "non specificata"}</span>
              <span>Permesso richiesto: {permission || "non specificato"}</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <BGButton href="/">Torna alla Dashboard</BGButton>
              <BGButton variant="secondary" onClick={() => window.history.back()}>
                Torna indietro
              </BGButton>
            </div>
          </div>
        </BGCard>
      </BGPageShell>
    </main>
  )
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={null}>
      <AccessDeniedContent />
    </Suspense>
  )
}
