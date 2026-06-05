type Props = {
  title: string;
  value: string;
  status?: "online" | "offline" | "warning";
};

export default function SystemStatusCard({
  title,
  value,
  status = "online",
}: Props) {
  const tone = status === "offline" ? "red" : status === "warning" ? "yellow" : "green";

  return (
    <div className={`bg-stat bg-kpi-card bg-stat-${tone}`}>
      <div className="bg-stat-label bg-kpi-label">{title}</div>
      <div className="bg-stat-value bg-kpi-value">{value}</div>
      <div className={`bg-status bg-status-badge bg-status-${status === "offline" ? "danger" : status === "warning" ? "warning" : "success"}`}>
        {status === "offline" ? "Offline" : status === "warning" ? "Warning" : "Online"}
      </div>
    </div>
  );
}
