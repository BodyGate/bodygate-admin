import AnalyticsDashboard from "../components/AnalyticsDashboard";
import BGPageHeader from "@/components/bodygate-ui/BGPageHeader";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function AnalyticsPage() {
  return (
    <main>
      <BGPageShell>
      <BGPageHeader
        eyebrow="BodyGate Analytics"
        title="Analytics Dashboard"
        subtitle="Monitoraggio realtime accessi e andamento palestra con sezioni allineate al layout premium."
      />

      <AnalyticsDashboard />
      </BGPageShell>
    </main>
  );
}
