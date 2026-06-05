import AnalyticsDashboard from "../components/AnalyticsDashboard";
import BGPageHeader from "../components/ui/BGPageHeader";

export default function AnalyticsPage() {
  return (
    <main className="bg-page-shell">
      <BGPageHeader
        eyebrow="BodyGate Analytics"
        title="Analytics Dashboard"
        subtitle="Monitoraggio realtime accessi e andamento palestra con sezioni allineate al layout premium."
      />

      <AnalyticsDashboard />
    </main>
  );
}
