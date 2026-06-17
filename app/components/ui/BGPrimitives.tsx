"use client";

import type { ReactNode } from "react";

export function BGPageContainer({ children, className = "" }: { children: ReactNode; className?: string }) { return <main className={`bg-page-container ${className}`.trim()}>{children}</main>; }
export function BGSection({ children, title, subtitle, actions, className = "" }: { children: ReactNode; title?: string; subtitle?: string; actions?: ReactNode; className?: string }) { return <section className={`bg-section ${className}`.trim()}>{title ? <div className="bg-section-heading"><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{actions ? <div className="bg-section-actions">{actions}</div> : null}</div> : null}{children}</section>; }
export function BGSurface({ children, className = "", elevated = false }: { children: ReactNode; className?: string; elevated?: boolean }) { return <div className={`bg-surface ${elevated ? "bg-surface-elevated" : ""} ${className}`.trim()}>{children}</div>; }
export function BGStack({ children, gap = "md", className = "" }: { children: ReactNode; gap?: "sm" | "md" | "lg"; className?: string }) { return <div className={`bg-stack bg-stack-${gap} ${className}`.trim()}>{children}</div>; }
export function BGToolbar({ children, sticky = false, className = "" }: { children: ReactNode; sticky?: boolean; className?: string }) { return <div className={`bg-toolbar ${sticky ? "bg-toolbar-sticky" : ""} ${className}`.trim()}>{children}</div>; }
export function BGStickyActions({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`bg-sticky-actions ${className}`.trim()}>{children}</div>; }
export function BGIconButton({ children, label, className = "", disabled = false, onClick }: { children: ReactNode; label: string; className?: string; disabled?: boolean; onClick?: () => void }) { return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`bg-icon-button ${className}`.trim()}>{children}</button>; }
export function BGActionGroup({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`bg-action-group ${className}`.trim()}>{children}</div>; }
export function BGSkeleton({ lines = 3 }: { lines?: number }) { return <div className="bg-skeleton" aria-label="Caricamento">{Array.from({ length: lines }).map((_, i) => <span key={i} />)}</div>; }
export function BGSpinner() { return <span className="bg-spinner" aria-label="Caricamento" />; }
export function BGProgress({ value }: { value: number }) { return <div className="bg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }
export function BGErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) { return <div className="bg-state bg-state-error" role="alert"><strong>{title}</strong>{description ? <p>{description}</p> : null}{action}</div>; }
export function BGOperationalRow({ title, meta, status, actions }: { title: string; meta?: string; status?: ReactNode; actions?: ReactNode }) { return <div className="bg-operational-row"><div><strong>{title}</strong>{meta ? <span>{meta}</span> : null}</div>{status}{actions ? <div className="bg-row-actions">{actions}</div> : null}</div>; }
export function BGDataList({ children }: { children: ReactNode }) { return <div className="bg-data-list">{children}</div>; }
export function BGResponsiveTable({ children }: { children: ReactNode }) { return <div className="bg-responsive-table"><table>{children}</table></div>; }
export function BGFilterBar({ children }: { children: ReactNode }) { return <div className="bg-filter-bar">{children}</div>; }
export function BGPagination({ children }: { children: ReactNode }) { return <div className="bg-pagination">{children}</div>; }
export function BGChecklist({ items }: { items: Array<{ label: string; done?: boolean; tone?: string }> }) { return <ul className="bg-checklist">{items.map((item) => <li key={item.label} data-done={item.done ? "true" : "false"}><span />{item.label}</li>)}</ul>; }
export function BGProgressSteps({ steps, active }: { steps: string[]; active: number }) { return <ol className="bg-progress-steps">{steps.map((step, index) => <li key={step} data-active={index === active} data-done={index < active}>{step}</li>)}</ol>; }
export function BGReadinessPanel({ children }: { children: ReactNode }) { return <div className="bg-readiness-panel">{children}</div>; }
export function BGDocumentRow({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) { return <div className="bg-document-row"><div><strong>{title}</strong>{description ? <span>{description}</span> : null}</div>{actions}</div>; }
export function BGFileTrigger({ label, inputId }: { label: string; inputId: string }) { return <label className="bg-file-trigger" htmlFor={inputId}>{label}</label>; }
