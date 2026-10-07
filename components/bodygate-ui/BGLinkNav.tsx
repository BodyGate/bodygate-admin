import Link from "next/link"

import styles from "./bodygate-ui.module.css"

type BGLinkNavItem = {
  href: string
  label: string
}

type BGLinkNavProps = {
  items: readonly BGLinkNavItem[]
  activeHref?: string
  ariaLabel?: string
  className?: string
}

export default function BGLinkNav({ items, activeHref, ariaLabel = "Navigazione sezione", className = "" }: BGLinkNavProps) {
  return (
    <nav className={`${styles.linkNav} ${className}`.trim()} aria-label={ariaLabel}>
      {items.map(item => {
        const active = activeHref === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.linkNavItem} ${active ? styles.linkNavItemActive : ""}`.trim()}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
