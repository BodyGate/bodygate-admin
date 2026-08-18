export const platinumKpis = [
  { label: "Clienti attivi", value: "1.284", note: "+4,8% questo mese", tone: "positive" },
  { label: "Ingressi oggi", value: "342", note: "Picco previsto alle 18:30", tone: "neutral" },
  { label: "Rinnovi in scadenza", value: "28", note: "7 richiedono attenzione", tone: "neutral" },
  { label: "Tasso di rinnovo", value: "91%", note: "+2,1% rispetto a luglio", tone: "positive" },
] as const

export const platinumCustomers = [
  { initials: "GR", name: "Giulia Romano", email: "giulia.romano@example.test", plan: "Platinum Annuale", status: "Attivo", tone: "success", activity: "Oggi, 09:42" },
  { initials: "LB", name: "Luca Bianchi", email: "luca.bianchi@example.test", plan: "Performance 12", status: "In rinnovo", tone: "warning", activity: "Ieri, 19:08" },
  { initials: "SF", name: "Sara Ferri", email: "sara.ferri@example.test", plan: "Open Mensile", status: "Attivo", tone: "success", activity: "16 ago, 18:21" },
  { initials: "MC", name: "Marco Conti", email: "marco.conti@example.test", plan: "Platinum Annuale", status: "Da contattare", tone: "danger", activity: "12 ago, 07:55" },
] as const
