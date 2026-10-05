import Link from "next/link"

import styles from "./bodygate-ui.module.css"

type BGPillNavItem = {
  href: string
  label: string
  active?: boolean
}

type BGPillNavProps = {
  items: BGPillNavItem[]
  className?: string
}

export default function BGPillNav({ items, className = "" }: BGPillNavProps) {
  return (
    <nav className={`${styles.pillNav} ${className}`.trim()}>
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
