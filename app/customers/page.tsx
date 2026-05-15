import CustomersTable from "../components/CustomersTable";

export default function CustomersPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">
          Customers
        </h1>
        <p className="mt-2 text-[var(--muted-text)]">
          Gestione clienti, badge, abbonamenti e autorizzazioni di accesso.
        </p>
      </div>

      <CustomersTable />
    </main>
  );
}