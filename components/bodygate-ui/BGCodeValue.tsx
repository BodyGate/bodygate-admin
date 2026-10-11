import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGCodeValueProps = {
  children: ReactNode
  className?: string
}

export default function BGCodeValue({ children, className = "" }: BGCodeValueProps) {
  return <div className={`${styles.codeValue} ${className}`.trim()}>{children}</div>
}
