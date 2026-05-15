import AnalyticsDashboard from "../components/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <main style={{ display: "grid", gap: "22px" }}>
      <div>
        <div
          style={{
            color: "var(--muted)",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          BODYGATE ANALYTICS
        </div>

        <h1
          style={{
            margin: "12px 0 0 0",
            fontSize: "54px",
            lineHeight: 1,
          }}
        >
          Analytics Dashboard
        </h1>

        <div
          style={{
            marginTop: "14px",
            color: "var(--muted)",
            fontSize: "18px",
          }}
        >
          Monitoraggio realtime accessi e andamento palestra.
        </div>
      </div>

      <AnalyticsDashboard />
    </main>
  );
}