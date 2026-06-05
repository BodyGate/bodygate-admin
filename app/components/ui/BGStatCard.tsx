"use client";

type BGStatCardProps = {
  label: string;
  value: string | number;
  note?: string;
  tone?: "neutral" | "red" | "green" | "yellow" | "blue";
};

export default function BGStatCard({ label, value, note, tone = "neutral" }: BGStatCardProps) {
  return (
    <div className={`bg-stat bg-kpi-card bg-stat-${tone}`}>
      <div className="bg-stat-label bg-kpi-label">{label}</div>
      <div className="bg-stat-value bg-kpi-value">{value}</div>
      {note && <div className="bg-stat-note">{note}</div>}
    </div>
  );
}
