import SystemLivePanel from "../components/SystemLivePanel";
import SystemStatusCard from "../components/SystemStatusCard";

export default function SystemPage() {
  return (
    <main>
      <div style={{ marginBottom: "34px" }}>
        <div
          style={{
            color: "var(--muted)",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            marginBottom: "10px",
          }}
        >
          BODYGATE SYSTEM
        </div>

        <h1
          style={{
            fontSize: "52px",
            lineHeight: 1,
            margin: 0,
          }}
        >
          System Control
        </h1>

        <div
          style={{
            marginTop: "14px",
            color: "var(--muted)",
            fontSize: "18px",
          }}
        >
          Monitoraggio realtime piattaforma, bridge e controller.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: "18px",
          marginBottom: "22px",
        }}
      >
        <SystemStatusCard
          title="Bridge"
          value="ONLINE"
          status="online"
        />

        <SystemStatusCard
          title="Controller"
          value="CONNECTED"
          status="online"
        />

        <SystemStatusCard
          title="Supabase"
          value="SYNCED"
          status="online"
        />

        <SystemStatusCard
          title="Realtime"
          value="ACTIVE"
          status="online"
        />
      </div>

      <SystemLivePanel />
    </main>
  );
}