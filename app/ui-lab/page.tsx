import type { Metadata } from "next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react"

import styles from "./ui-lab.module.css"

export const metadata: Metadata = {
  title: "BodyGate UI Lab",
}

const stats = [
  {
    label: "Clienti attivi",
    value: "1.284",
    detail: "+12% mese",
    icon: Users,
  },
  {
    label: "Ingressi oggi",
    value: "342",
    detail: "Picco 18:30",
    icon: ShieldCheck,
  },
  {
    label: "Abbonamenti",
    value: "918",
    detail: "86 in scadenza",
    icon: CalendarClock,
  },
]

const statuses = [
  {
    label: "Attivo",
    className: styles.statusActive,
    icon: CheckCircle2,
  },
  {
    label: "Scaduto",
    className: styles.statusExpired,
    icon: Clock3,
  },
  {
    label: "Bloccato",
    className: styles.statusBlocked,
    icon: LockKeyhole,
  },
  {
    label: "In attesa",
    className: styles.statusPending,
    icon: AlertTriangle,
  },
]

const customers = [
  {
    name: "Alessia Romano",
    plan: "Premium Annuale",
    status: "Attivo",
    lastAccess: "Oggi, 09:42",
    area: "Milano Nord",
  },
  {
    name: "Marco Bellini",
    plan: "Open Mensile",
    status: "In attesa",
    lastAccess: "Ieri, 19:08",
    area: "Torino Centro",
  },
  {
    name: "Giulia Ferri",
    plan: "PT Elite",
    status: "Scaduto",
    lastAccess: "02 lug 2026",
    area: "Roma EUR",
  },
  {
    name: "Davide Conte",
    plan: "Premium Plus",
    status: "Bloccato",
    lastAccess: "28 giu 2026",
    area: "Bologna Fiera",
  },
]

const tabs = ["Dashboard", "Clienti", "Abbonamenti", "Audit"]

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

function statusClassName(status: string) {
  return statuses.find((item) => item.label === status)?.className ?? ""
}

export default function UiLabPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <div>
              <p className={styles.eyebrow}>BodyGate Premium</p>
              <h1 className={styles.title}>UI Lab</h1>
              <p className={styles.subtitle}>
                Libreria visiva isolata per controlli gestionali, stati cliente
                e superfici operative in palette nero, grigio scuro, rosso e
                bianco.
              </p>
            </div>
            <div className={styles.heroActions}>
              <Button className={cx(styles.button, styles.buttonDark)}>
                <Search />
                Cerca cliente
              </Button>
              <Button className={cx(styles.button, styles.buttonRed)}>
                Nuova azione
                <ArrowRight />
              </Button>
            </div>
          </div>

          <div className={styles.tabBar} aria-label="Sezioni UI Lab">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                className={cx(styles.tab, index === 0 && styles.tabActive)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        <section className={styles.statsGrid} aria-label="Statistiche">
          {stats.map((stat) => {
            const Icon = stat.icon

            return (
              <Card key={stat.label} className={styles.statCard}>
                <CardHeader className={styles.statHeader}>
                  <div>
                    <CardDescription className={styles.cardLabel}>
                      {stat.label}
                    </CardDescription>
                    <CardTitle className={styles.statValue}>
                      {stat.value}
                    </CardTitle>
                  </div>
                  <span className={styles.statIcon}>
                    <Icon />
                  </span>
                </CardHeader>
                <CardContent className={styles.statFooter}>
                  <span>{stat.detail}</span>
                  <span className={styles.statSignal} />
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section className={styles.contentGrid}>
          <Card className={styles.panel}>
            <CardHeader className={styles.panelHeader}>
              <div>
                <CardTitle className={styles.panelTitle}>Controlli</CardTitle>
                <CardDescription className={styles.panelDescription}>
                  Bottoni, input, textarea e badge con trattamento BodyGate.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className={styles.panelBody}>
              <div className={styles.buttonRow}>
                <Button className={cx(styles.button, styles.buttonRed)}>
                  Primario
                  <ArrowRight />
                </Button>
                <Button className={cx(styles.button, styles.buttonBlack)}>
                  Secondario
                  <ShieldCheck />
                </Button>
                <Button className={cx(styles.button, styles.buttonDanger)}>
                  Danger
                  <AlertTriangle />
                </Button>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Nome cliente</span>
                  <Input
                    className={styles.input}
                    placeholder="Mario Rossi"
                  />
                </label>
                <label className={styles.field}>
                  <span>Nota operativa</span>
                  <Textarea
                    className={styles.textarea}
                    placeholder="Inserisci una nota di test..."
                  />
                </label>
              </div>

              <div className={styles.statusRow}>
                {statuses.map((status) => {
                  const Icon = status.icon

                  return (
                    <Badge
                      key={status.label}
                      className={cx(styles.statusBadge, status.className)}
                    >
                      <Icon />
                      {status.label}
                    </Badge>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className={styles.panel}>
            <CardHeader className={styles.panelHeader}>
              <div>
                <CardTitle className={styles.panelTitle}>
                  Clienti esempio
                </CardTitle>
                <CardDescription className={styles.panelDescription}>
                  Tabella operativa con righe separate, hover e stati evidenti.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className={styles.tableWrap}>
              <Table className={styles.table}>
                <TableHeader className={styles.tableHeader}>
                  <TableRow className={styles.tableHeaderRow}>
                    <TableHead className={styles.tableHead}>Cliente</TableHead>
                    <TableHead className={styles.tableHead}>Piano</TableHead>
                    <TableHead className={styles.tableHead}>Sede</TableHead>
                    <TableHead className={styles.tableHead}>Stato</TableHead>
                    <TableHead className={cx(styles.tableHead, styles.alignEnd)}>
                      Ultimo accesso
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.name} className={styles.tableRow}>
                      <TableCell className={styles.customerCell}>
                        <span className={styles.avatar}>
                          {customer.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </span>
                        <span>{customer.name}</span>
                      </TableCell>
                      <TableCell className={styles.mutedCell}>
                        {customer.plan}
                      </TableCell>
                      <TableCell className={styles.mutedCell}>
                        {customer.area}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cx(
                            styles.statusBadge,
                            statusClassName(customer.status)
                          )}
                        >
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={cx(styles.mutedCell, styles.alignEnd)}>
                        {customer.lastAccess}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section className={styles.dialogBand}>
          <div>
            <p className={styles.eyebrow}>Modale premium</p>
            <h2 className={styles.sectionTitle}>Conferma operazione</h2>
            <p className={styles.sectionText}>
              Overlay e pannello scuro, bordo sottile, azioni ad alto contrasto.
            </p>
          </div>
          <Dialog>
            <DialogTrigger render={<Button className={cx(styles.button, styles.buttonRed)} />}>
              Apri dialog
            </DialogTrigger>
            <DialogContent className={styles.dialogContent}>
              <DialogHeader className={styles.dialogHeader}>
                <DialogTitle className={styles.dialogTitle}>
                  Conferma operazione
                </DialogTitle>
                <DialogDescription className={styles.dialogDescription}>
                  Controlla il riepilogo prima di applicare una modifica
                  importante al profilo cliente.
                </DialogDescription>
              </DialogHeader>
              <div className={styles.dialogPreview}>
                <span className={styles.dialogPreviewIcon}>
                  <ShieldCheck />
                </span>
                <div>
                  <strong>BodyGate Premium Access</strong>
                  <p>Permesso valido per sede, accessi e report operativi.</p>
                </div>
              </div>
              <DialogFooter className={styles.dialogFooter}>
                <Button className={cx(styles.button, styles.buttonBlack)}>
                  Annulla
                </Button>
                <Button className={cx(styles.button, styles.buttonRed)}>
                  Conferma
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </main>
  )
}
