"use client";

type Props = {
  active: boolean;
  subscriptionStatus?: string | null;
};

export default function CustomerStatus({ active, subscriptionStatus }: Props) {
  const isExpired = subscriptionStatus === "expired";
  const isBlocked = !active;

  const label = isBlocked ? "Bloccato" : isExpired ? "Scaduto" : "Attivo";

  const style = isBlocked
    ? "bg-red-500/15 text-red-500"
    : isExpired
    ? "bg-amber-500/15 text-amber-500"
    : "bg-emerald-500/15 text-emerald-500";

  return (
    <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}