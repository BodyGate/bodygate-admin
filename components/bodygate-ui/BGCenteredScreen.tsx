import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGCenteredScreenProps = {
  children: ReactNode
  wide?: boolean
  className?: string
}

export default function BGCenteredScreen({
  children,
  wide = false,
  className = "",
}: BGCenteredScreenProps) {
  return (
    <main className={`${styles.centeredScreen} ${className}`.trim()}>
      <div className={`${styles.centeredPanel} ${wide ? styles.centeredPanelWide : ""}`.trim()}>
        {children}
      </div>
    </main>
  )
}
