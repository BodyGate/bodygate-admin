import Link from "next/link"

import styles from "./bodygate-ui.module.css"

type BGPillNavItem = {
  href: string
  label: string
  active?: boolean
}

type BGPillNavProps = {
  items: BGPillNavItem[]
  label: string
  className?: string
}

export default function BGPillNav({ items, label, className = "" }: BGPillNavProps) {
  return (
    <nav aria-label={label} className={`${styles.pillNav} ${className}`.trim()}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.pill} ${item.active ? styles.pillActive : ""}`.trim()}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
