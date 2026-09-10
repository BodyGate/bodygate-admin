import BGButton from "./BGButton"
import BGStatusBadge from "./BGStatusBadge"
import styles from "./bodygate-ui.module.css"

export type ContractSignState = "signed" | "pending" | "not_generated"

type BGContractStatusProps = {
  state: ContractSignState
  /** Formatted, ready-to-display date/time - keep locale formatting out of this component. */
  signedAtLabel?: string | null
  otpSentAtLabel?: string | null
  pdfUrl?: string | null
  contractHref: string
  whatsappHref?: string | null
}

const stateClass: Record<ContractSignState, string> = {
  signed: styles.contractStatusSigned,
  pending: styles.contractStatusPending,
  not_generated: "",
}

const stateBadgeTone: Record<ContractSignState, "success" | "warning" | "neutral"> = {
  signed: "success",
  pending: "warning",
  not_generated: "neutral",
}

const stateBadgeLabel: Record<ContractSignState, string> = {
  signed: "Firmato",
  pending: "In attesa di firma",
  not_generated: "Non disponibile",
}

export default function BGContractStatus({
  state,
  signedAtLabel,
  otpSentAtLabel,
  pdfUrl,
  contractHref,
  whatsappHref,
}: BGContractStatusProps) {
  const meta =
    state === "signed"
      ? signedAtLabel
        ? `Firmato il ${signedAtLabel}`
        : "Documento firmato"
      : state === "pending"
        ? otpSentAtLabel
          ? `Codice OTP inviato il ${otpSentAtLabel}, firma da completare`
          : "Firma non ancora avviata"
        : "Nessun documento contrattuale collegato a questo cliente";

  return (
    <div className={`${styles.contractStatus} ${stateClass[state]}`.trim()}>
      <div className={styles.contractStatusBody}>
        <div className={styles.contractStatusTitle}>
          Contratto
          <BGStatusBadge tone={stateBadgeTone[state]}>
            {stateBadgeLabel[state]}
          </BGStatusBadge>
        </div>

        <div className={styles.contractStatusMeta}>{meta}</div>

        <div className={styles.contractStatusActions}>
          {state === "signed" && pdfUrl ? (
            <BGButton href={pdfUrl} variant="secondary">
              Apri PDF
            </BGButton>
          ) : null}

          {state !== "signed" ? (
            <BGButton href={contractHref} variant="primary">
              {state === "pending" ? "Vai alla firma" : "Genera contratto"}
            </BGButton>
          ) : null}

          {state === "pending" && whatsappHref ? (
            <BGButton href={whatsappHref} variant="secondary">
              Promemoria WhatsApp
            </BGButton>
          ) : null}
        </div>
      </div>
    </div>
  )
}
