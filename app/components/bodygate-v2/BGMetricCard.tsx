type Props = { value: string | number; label: string; note?: string; tone?: "green" | "blue" | "yellow" | "red" };
export default function BGMetricCard({ value, label, note, tone = "green" }: Props) {
  return <div className={`bg2-metric bg2-metric-${tone}`}><div className="bg2-metric-value">{value}</div><div className="bg2-metric-label">{label}</div>{note && <div className="bg2-metric-note">{note}</div>}</div>;
}
