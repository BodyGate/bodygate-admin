import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGCenteredScreenProps = ComponentPropsWithoutRef<"main"> & {
  children: ReactNode
}

export default function BGCenteredScreen({
  children,
  className = "",
  ...props
}: BGCenteredScreenProps) {
  return (
    <main className={`${styles.centeredScreen} ${className}`.trim()} {...props}>
      <div className={styles.centeredScreenInner}>{children}</div>
    </main>
  )
}
