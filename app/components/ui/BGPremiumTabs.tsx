"use client";

import type { ReactNode } from "react";

type BGPremiumTabItem<T extends string> = {
  key: T;
  label: string;
  eyebrow?: string;
  icon?: ReactNode;
};

type BGPremiumTabsProps<T extends string> = {
  items: BGPremiumTabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
};

export default function BGPremiumTabs<T extends string>({
  items,
  activeKey,
  onChange,
  ariaLabel = "Navigazione sezione",
}: BGPremiumTabsProps<T>) {
  return (
    <nav className="bg-premium-tabs" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <button
            key={item.key}
            type="button"
            className={`bg-premium-tab ${isActive ? "bg-premium-tab-active" : ""}`}
            onClick={() => onChange(item.key)}
            aria-current={isActive ? "page" : undefined}
          >
            {item.icon ? <span className="bg-premium-tab-icon">{item.icon}</span> : null}
            <span className="bg-premium-tab-copy">
              {item.eyebrow ? <span className="bg-premium-tab-eyebrow">{item.eyebrow}</span> : null}
              <span className="bg-premium-tab-label">{item.label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
