"use client";

import { BGButton, BGStack } from "@/components/bodygate-ui";
import type { NotificationSeverity } from "./NotificationCenterClient";

type Filter = "all" | NotificationSeverity;

export default function NotificationFilters({
  activeFilter,
  onChange,
}: {
  activeFilter: Filter;
  onChange: (filter: Filter) => void;
}) {
  const filters: { label: string; value: Filter }[] = [
    { label: "Tutte", value: "all" },
    { label: "Critiche", value: "critical" },
    { label: "Warning", value: "warning" },
    { label: "Info", value: "info" },
  ];

  return (
    <BGStack direction="row">
      {filters.map((filter) => (
        <BGButton
          key={filter.value}
          variant={activeFilter === filter.value ? "primary" : "secondary"}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </BGButton>
      ))}
    </BGStack>
  );
}
