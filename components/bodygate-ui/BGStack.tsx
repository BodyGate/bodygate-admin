import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStackProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
}

/** Vertical layout primitive: children separated by a consistent gap. */
export default function BGStack({ children, className = "", ...props }: BGStackProps) {
  return (
    <div className={`${styles.stack} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
