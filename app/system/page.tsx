import SystemLivePanel from "../components/SystemLivePanel";
import SystemStatusCard from "../components/SystemStatusCard";
import BGPageHeader from "../components/ui/BGPageHeader";

export default function SystemPage() {
  return (
    <main className="bg-page-shell">
      <BGPageHeader
        eyebrow="BodyGate System"
        title="System Control"
        subtitle="Monitoraggio realtime piattaforma, bridge e controller in una console ordinata e coerente."
      />

      <section className="bg-kpi-grid">
        <SystemStatusCard title="Bridge" value="ONLINE" status="online" />
        <SystemStatusCard title="Controller" value="CONNECTED" status="online" />
        <SystemStatusCard title="Supabase" value="SYNCED" status="online" />
        <SystemStatusCard title="Realtime" value="ACTIVE" status="online" />
      </section>

      <SystemLivePanel />
    </main>
  );
}
