"use client"

import type { ReactElement, ReactNode } from "react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import styles from "./platinum.module.css"

export function BGDialog({ trigger, title, description, children }: { trigger: ReactNode; title: string; description: string; children?: ReactNode }) {
  return <Dialog><DialogTrigger render={trigger as ReactElement} /><DialogContent className={styles.dialog} showCloseButton={false}><div className={styles.dialogBody}><DialogTitle className={styles.dialogTitle}>{title}</DialogTitle><DialogDescription className={styles.dialogText}>{description}</DialogDescription>{children}</div><DialogFooter className={styles.dialogActions}><DialogClose className={styles.button}>Annulla</DialogClose><DialogClose className={`${styles.button} ${styles.buttonPrimary}`}>Conferma azione</DialogClose></DialogFooter></DialogContent></Dialog>
}
