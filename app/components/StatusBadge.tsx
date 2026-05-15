"use client";

type StatusBadgeProps = {
  allowed: boolean;
  reason?: string | null;
};

export default function StatusBadge({ allowed, reason }: StatusBadgeProps) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
          allowed
            ? "bg-emerald-500/15 text-emerald-500"
            : "bg-red-500/15 text-red-500"
        }`}
      >
        {allowed ? "Consentito" : "Negato"}
      </span>

      {reason && (
        <span className="text-xs text-[var(--muted-text)]">
          {reason}
        </span>
      )}
    </div>
  );
}