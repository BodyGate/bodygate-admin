import Link from "next/link"

import styles from "./bodygate-ui.module.css"

type BGPillNavItem = { href: string; label: string; active?: boolean }

export default function BGPillNav({ items, className = "" }: { items: BGPillNavItem[]; className?: string }) {
  return (
    <nav className={`${styles.pillNav} ${className}`.trim()}>
      {items.map(item => (
        <Link key={item.href} href={item.href} className={`${styles.pill} ${item.active ? styles.pillActive : ""}`.trim()}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
