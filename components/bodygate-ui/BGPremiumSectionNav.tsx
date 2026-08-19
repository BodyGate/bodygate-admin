"use client"

import type { ReactNode } from "react"

type Item<T extends string> = { key: T; label: string; eyebrow?: string; icon?: ReactNode }

export default function BGPremiumSectionNav<T extends string>({ items, activeKey, onChange, ariaLabel = "Navigazione scheda cliente" }: { items: Item<T>[]; activeKey: T; onChange: (key: T) => void; ariaLabel?: string }) {
  return <nav className="bg-premium-section-nav" aria-label={ariaLabel}>{items.map(item => { const active = item.key === activeKey; return <button key={item.key} type="button" className={`bg-premium-section-nav-item ${active ? "bg-premium-section-nav-item-active" : ""}`} onClick={() => onChange(item.key)} aria-pressed={active}>{item.icon ? <span className="bg-premium-section-nav-icon">{item.icon}</span> : null}<span className="bg-premium-section-nav-copy">{item.eyebrow ? <span className="bg-premium-section-nav-eyebrow">{item.eyebrow}</span> : null}<span className="bg-premium-section-nav-label">{item.label}</span></span></button> })}</nav>
}
