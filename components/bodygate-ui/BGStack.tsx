import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStackProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
}

/**
 * Vertical layout with consistent spacing between children, to avoid
 * ad-hoc `display: flex; flex-direction: column; gap` inline styles.
 */
export default function BGStack({ children, className = "", ...props }: BGStackProps) {
  return (
    <div className={`${styles.stack} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
