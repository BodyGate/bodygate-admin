import AccessLogsTable from "../components/AccessLogsTable";

export default function AccessLogsPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">
          Access Logs
        </h1>
        <p className="mt-2 text-[var(--muted-text)]">
          Monitoraggio in tempo reale degli accessi al tornello BodyGate.
        </p>
      </div>

      <AccessLogsTable />
    </main>
  );
}