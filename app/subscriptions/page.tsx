import SubscriptionsTable from "../components/SubscriptionsTable";

export default function SubscriptionsPage() {
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
          BODYGATE SUBSCRIPTIONS
        </div>

        <h1
          style={{
            margin: "12px 0 0 0",
            fontSize: "54px",
            lineHeight: 1,
          }}
        >
          Subscription Management
        </h1>

        <div
          style={{
            marginTop: "14px",
            color: "var(--muted)",
            fontSize: "18px",
          }}
        >
          Gestione rinnovi e scadenze abbonamenti.
        </div>
      </div>

      <SubscriptionsTable />
    </main>
  );
}