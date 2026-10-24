import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGCenteredStageProps = ComponentPropsWithoutRef<"main"> & {
  children: ReactNode
}

export default function BGCenteredStage({
  children,
  className = "",
  ...props
}: BGCenteredStageProps) {
  return (
    <main className={`${styles.centerStage} ${className}`.trim()} {...props}>
      <div className={styles.centerStageInner}>{children}</div>
    </main>
  )
}
