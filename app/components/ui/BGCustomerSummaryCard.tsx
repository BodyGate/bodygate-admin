"use client";

type BGCustomerSummaryCardProps = {
  label: string;
  value: string;
  detail: string;
  ok: boolean;
  actionLabel?: string;
  onOpen: () => void;
};

export default function BGCustomerSummaryCard({
  label,
  value,
  detail,
  ok,
  actionLabel = "Gestisci",
  onOpen,
}: BGCustomerSummaryCardProps) {
  return (
    <div className="overview-card bg-customer-summary-card">
      <div className="overview-label">{label}</div>
      <span className={`mini-badge ${ok ? "ok" : "ko"}`}>{ok ? "OK" : "Attenzione"}</span>
      <div className="overview-value">{value}</div>
      <p className="muted">{detail}</p>
      <button type="button" className="command-action secondary" onClick={onOpen}>
        {actionLabel}
      </button>
    </div>
  );
}
