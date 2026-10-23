"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import styles from "./bodygate-ui.module.css"

type BGNavPillsProps = {
  items: ReadonlyArray<{ href: string; label: string }>
  className?: string
}

/** Horizontal pill navigation between sibling routes; highlights the current section. */
export default function BGNavPills({ items, className = "" }: BGNavPillsProps) {
  const pathname = usePathname() ?? ""

  return (
    <nav className={`${styles.navPills} ${className}`.trim()}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navPill} ${active ? styles.navPillActive : ""}`.trim()}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
