import type { ReactNode } from "react"

export default function BGSectionHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return <div className="bg-section-header"><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{actions ? <div className="bg-section-actions">{actions}</div> : null}</div>
}
