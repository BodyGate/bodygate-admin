import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGFullPageStateProps = ComponentPropsWithoutRef<"main"> & {
  children: ReactNode
}

export default function BGFullPageState({
  children,
  className = "",
  ...props
}: BGFullPageStateProps) {
  return (
    <main className={`${styles.fullPageState} ${className}`.trim()} {...props}>
      <div className={styles.fullPageStateInner}>{children}</div>
    </main>
  )
}
