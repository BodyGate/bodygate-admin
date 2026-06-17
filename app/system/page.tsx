import PermissionGuard from "../components/security/PermissionGuard";
import SystemLivePanel from "../components/SystemLivePanel";
import SystemStatusCard from "../components/SystemStatusCard";
import BGButton from "../components/ui/BGButton";
import BGCard from "../components/ui/BGCard";
import BGPageHeader from "../components/ui/BGPageHeader";

export default function SystemPage() {
  return (
    <PermissionGuard permission="manage_staff">
      <div className="bg-page-shell">
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

      <BGCard variant="premium">
        <div className="bg-section-header !mb-0">
          <div>
            <h2>Console operative collegate</h2>
            <p>Accessi rapidi alle pagine tecniche principali, così ogni area isolata resta raggiungibile dalla navigazione di sistema.</p>
          </div>
          <div className="bg-header-actions">
            <BGButton href="/access-control/debug" variant="secondary">Debug Center</BGButton>
            <BGButton href="/access-control/credentials-audit" variant="secondary">Credentials Audit</BGButton>
            <BGButton href="/system/staff" variant="secondary">Staff</BGButton>
            <BGButton href="/system/audit" variant="secondary">Audit Logs</BGButton>
            <BGButton href="/settings" variant="secondary">Settings</BGButton>
            <BGButton href="/settings/modules" variant="secondary">Moduli</BGButton>
            <BGButton href="/settings/permissions" variant="secondary">Permessi</BGButton>
            <BGButton href="/subscriptions/plans" variant="secondary">Subscription Plans</BGButton>
          </div>
        </div>
      </BGCard>

      <SystemLivePanel />
    </div>
    </PermissionGuard>
  );
}
