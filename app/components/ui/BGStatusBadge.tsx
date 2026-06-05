"use client";

type BGStatusBadgeProps = {
  children: string;
  tone?: "neutral" | "success" | "danger" | "warning" | "info";
};

export default function BGStatusBadge({ children, tone = "neutral" }: BGStatusBadgeProps) {
  return <span className={`bg-status bg-status-badge bg-status-${tone}`}>{children}</span>;
}
