import { BGPageHeader, BGPageShell } from "@/components/bodygate-ui";
import BadgesTable from "../components/BadgesTable";

export default function BadgesPage() {
  return (
    <main>
      <BGPageShell>
      <BGPageHeader
        eyebrow="BodyGate Badges"
        title="Badge Management"
        subtitle="Gestione badge clienti e credenziali accesso con card, azioni e tabella uniformate al design system."
      />

      <BadgesTable />
      </BGPageShell>
    </main>
  );
}
