import BadgesTable from "../components/BadgesTable";
import BGPageHeader from "../components/ui/BGPageHeader";

export default function BadgesPage() {
  return (
    <main className="bg-page-shell">
      <BGPageHeader
        eyebrow="BodyGate Badges"
        title="Badge Management"
        subtitle="Gestione badge clienti e credenziali accesso con card, azioni e tabella uniformate al design system."
      />

      <BadgesTable />
    </main>
  );
}
