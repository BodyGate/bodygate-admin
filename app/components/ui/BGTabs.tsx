"use client";

export type BGTabItem<T extends string = string> = {
  id: T;
  label: string;
};

type BGTabsProps<T extends string = string> = {
  tabs: BGTabItem<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  ariaLabel?: string;
};

export default function BGTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel = "Sezioni",
}: BGTabsProps<T>) {
  return (
    <nav className="tabs bg-tabs" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-button bg-tab-button ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
