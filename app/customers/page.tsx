import CustomersTable from "../components/CustomersTable";
import BGButton from "../components/ui/BGButton";
import BGPageHeader from "../components/ui/BGPageHeader";

export default function CustomersPage() {
  return (
    <main className="space-y-6">
      <BGPageHeader
        eyebrow="CRM BodyGate"
        title="Customers"
        subtitle="Gestione clienti, badge, abbonamenti e autorizzazioni di accesso in una vista operativa premium."
        actions={<BGButton href="/customers/new">Nuovo cliente</BGButton>}
      />

      <CustomersTable />
    </main>
  );
}
