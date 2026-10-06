"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import styles from "./bodygate-ui.module.css"

type BGLinkTabsItem = { href: string; label: string }

type BGLinkTabsProps = {
  items: BGLinkTabsItem[]
  ariaLabel?: string
  className?: string
}

export default function BGLinkTabs({ items, ariaLabel = "Sezioni", className = "" }: BGLinkTabsProps) {
  const pathname = usePathname() ?? ""

  return (
    <nav className={`${styles.linkTabs} ${className}`.trim()} aria-label={ariaLabel}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.linkTab} ${active ? styles.linkTabActive : ""}`.trim()}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
