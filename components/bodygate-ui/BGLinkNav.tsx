import Link from "next/link"

import styles from "./bodygate-ui.module.css"

export type BGLinkNavItem = { href: string; label: string; active?: boolean }

type BGLinkNavProps = {
  items: BGLinkNavItem[]
  ariaLabel?: string
  className?: string
}

export default function BGLinkNav({ items, ariaLabel = "Navigazione sezione", className = "" }: BGLinkNavProps) {
  return (
    <nav className={`${styles.linkNav} ${className}`.trim()} aria-label={ariaLabel}>
      {items.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.linkNavItem} ${item.active ? styles.linkNavItemActive : ""}`.trim()}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
