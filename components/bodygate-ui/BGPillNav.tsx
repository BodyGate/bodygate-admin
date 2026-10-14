import Link from "next/link"

import styles from "./bodygate-ui.module.css"

type BGPillNavItem = { href: string; label: string; active?: boolean }

type BGPillNavProps = {
  items: BGPillNavItem[]
  ariaLabel?: string
  className?: string
}

export default function BGPillNav({ items, ariaLabel = "Navigazione sezione", className = "" }: BGPillNavProps) {
  return (
    <nav aria-label={ariaLabel} className={`${styles.pillNav} ${className}`.trim()}>
      {items.map(item => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`${styles.pill} ${item.active ? styles.pillActive : ""}`.trim()}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
