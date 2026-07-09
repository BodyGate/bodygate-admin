import AccessLogsTable from "../components/AccessLogsTable";
import BGPageHeader from "@/components/bodygate-ui/BGPageHeader";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function AccessLogsPage() {
  return (
    <main>
      <BGPageShell>
      <BGPageHeader
        eyebrow="Access Control"
        title="Access Logs"
        subtitle="Monitoraggio in tempo reale degli accessi al tornello BodyGate con badge stato premium e tabella dark enterprise."
      />

      <AccessLogsTable />
      </BGPageShell>
    </main>
  );
}
