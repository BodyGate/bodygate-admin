"use client"

import BGButton from "@/components/bodygate-ui/BGButton"
import BGCard from "@/components/bodygate-ui/BGCard"
import BGPageHeader from "@/components/bodygate-ui/BGPageHeader"
import BGPageShell from "@/components/bodygate-ui/BGPageShell"
import BGStatusBadge from "@/components/bodygate-ui/BGStatusBadge"

export default function Page() {
  async function openGate() {
    const res = await fetch("/api/gate/open", {
      method: "POST",
    })

    const data = await res.json()

    if (data.ok) {
      alert("Tornello aperto")
    } else {
      alert("Errore: " + data.error)
    }
  }

  return (
    <main>
      <BGPageShell>
        <BGPageHeader
          eyebrow="BodyGate Test"
          title="Test Tornello"
          subtitle="Azione manuale di test per apertura tornello."
          actions={<BGStatusBadge tone="warning">Operazione tecnica</BGStatusBadge>}
        />
        <BGCard variant="danger">
          <div className="grid gap-4">
            <div>
              <h2 className="text-xl font-black text-white">Apertura manuale</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-zinc-300">
                Usa questo comando solo per test controllati.
              </p>
            </div>
            <BGButton onClick={openGate} variant="danger">
              Apri tornello
            </BGButton>
          </div>
        </BGCard>
      </BGPageShell>
    </main>
  )
}
