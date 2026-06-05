import AccessLogsTable from "../components/AccessLogsTable";
import BGPageHeader from "../components/ui/BGPageHeader";

export default function AccessLogsPage() {
  return (
    <main className="bg-page-shell">
      <BGPageHeader
        eyebrow="Access Control"
        title="Access Logs"
        subtitle="Monitoraggio in tempo reale degli accessi al tornello BodyGate con badge stato premium e tabella dark enterprise."
      />

      <AccessLogsTable />
    </main>
  );
}
