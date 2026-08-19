/** Presentation-only registry for the isolated Platinum Lab. It is not an authorization model. */
export const PLATINUM_SCREEN_DOMAINS = ["operations", "customers", "commercial", "administration", "access", "services", "direction", "system"] as const
export type PlatinumScreenDomain = (typeof PLATINUM_SCREEN_DOMAINS)[number]
export type PlatinumScreen = {
  id: string; label: string; description: string; domain: PlatinumScreenDomain; targetRoute: string
  prototypePath: `/ui-lab/platinum/screens/${string}`; navigationGroup: string; priority: "primary" | "secondary" | "contextual"
  audience: "operator" | "administrator" | "staff"; status: "ready" | "review"; dataMode: "local-demo"
  risk: "low" | "medium" | "high" | "critical"; requiredStates: readonly ["loading", "empty", "populated", "error"]
  notes: string
}
const states = ["loading", "empty", "populated", "error"] as const
const screen = (id: string, label: string, description: string, domain: PlatinumScreenDomain, targetRoute: string, navigationGroup: string, priority: PlatinumScreen["priority"] = "secondary", audience: PlatinumScreen["audience"] = "operator", risk: PlatinumScreen["risk"] = "high", notes = "Anteprima autonoma; integrazione operativa rinviata."): PlatinumScreen => ({ id, label, description, domain, targetRoute, prototypePath: `/ui-lab/platinum/screens/${id}`, navigationGroup, priority, audience, status: "ready", dataMode: "local-demo", risk, requiredStates: states, notes })
export const PLATINUM_SCREENS = [
  screen("dashboard", "Dashboard", "Priorità, indicatori e attività del club in un colpo d’occhio.", "operations", "/", "Operatività", "primary"),
  screen("reception", "Reception", "Accoglienza rapida, ricerca cliente e prossimi ingressi.", "operations", "/reception", "Operatività", "primary", "operator", "critical"),
  screen("notifications", "Notifiche e scadenze", "Scadenze ordinate per urgenza e responsabilità.", "operations", "/notifications", "Operatività"),
  screen("activity-center", "Centro attività operative", "Coda unificata delle attività giornaliere.", "operations", "/reception", "Operatività", "contextual"),
  screen("customers", "Elenco clienti", "Ricerca, filtri e stato sintetico del portafoglio clienti.", "customers", "/customers", "Clienti", "primary", "operator", "critical"),
  screen("customer-new", "Nuovo cliente", "Onboarding guidato con dati anagrafici e consensi.", "customers", "/customers/new", "Clienti", "contextual", "operator", "critical"),
  screen("customer-detail", "Scheda cliente", "Identità, abbonamento, accessi e situazione amministrativa.", "customers", "/customers/[id]", "Clienti", "contextual", "operator", "critical"),
  screen("customer-edit", "Modifica cliente", "Aggiornamento controllato dei dati del cliente.", "customers", "/customers/[id]/edit", "Clienti", "contextual", "operator", "critical"),
  screen("customer-documents", "Documenti e certificato medico", "Documenti, validità e adempimenti sanitari.", "customers", "/customers/[id]", "Clienti", "contextual", "operator", "critical"),
  screen("customer-history", "Storico cliente", "Timeline consolidata di eventi, note e variazioni.", "customers", "/customers/[id]", "Clienti", "contextual", "operator", "high"),
  screen("subscriptions", "Abbonamenti", "Stato e gestione visuale degli abbonamenti.", "commercial", "/subscriptions", "Abbonamenti e commerciale", "primary", "operator", "critical"),
  screen("subscription-renewal", "Rinnovo abbonamento", "Percorso contestuale per proposta e conferma rinnovo.", "commercial", "/subscriptions", "Abbonamenti e commerciale", "contextual", "operator", "critical"),
  screen("plans", "Piani e listino", "Catalogo piani, durata e condizioni commerciali.", "commercial", "/subscriptions/plans", "Abbonamenti e commerciale", "secondary", "administrator", "critical"),
  screen("renewal-deadlines", "Scadenze e rinnovi", "Pipeline delle scadenze con priorità di contatto.", "commercial", "/subscriptions", "Abbonamenti e commerciale"),
  screen("membership-fee", "Quota associativa", "Stato della quota e prossime azioni amministrative.", "commercial", "/payments", "Abbonamenti e commerciale", "contextual", "operator", "critical"),
  screen("payments", "Pagamenti", "Incassi, residui e registrazioni dimostrative.", "administration", "/payments", "Amministrazione", "primary", "operator", "critical"),
  screen("annual-installments", "Piano rate annuale", "Piano visuale in tre fasi: acconto, secondo acconto e saldo.", "administration", "/payments", "Amministrazione", "contextual", "operator", "critical"),
  screen("installment-deadlines", "Scadenziario rate", "Scadenze, ritardi e pagamenti parziali da verificare.", "administration", "/payments", "Amministrazione", "contextual", "operator", "critical"),
  screen("receipts", "Ricevute", "Riepilogo ricevute e collegamento visuale agli incassi.", "administration", "/payments", "Amministrazione", "contextual", "operator", "critical"),
  screen("accounting", "Contabilità", "Movimenti e quadratura amministrativa dimostrativa.", "administration", "/accounting", "Amministrazione", "primary", "administrator", "critical"),
  screen("movement-detail", "Dettaglio movimento", "Contesto, cronologia e documenti di un movimento.", "administration", "/accounting", "Amministrazione", "contextual", "administrator", "critical"),
  screen("access-control", "Controllo accessi", "Verifica visuale dell’idoneità all’accesso.", "access", "/access-control", "Accessi", "primary", "operator", "critical"),
  screen("access-log", "Registro ingressi", "Cronologia consultabile degli ingressi dimostrativi.", "access", "/access-logs", "Accessi", "secondary", "operator", "critical"),
  screen("credentials", "Credenziali", "Panoramica delle credenziali senza dati o token reali.", "access", "/badges", "Accessi", "secondary", "operator", "critical"),
  screen("badges", "Badge", "Stato visuale dei supporti fisici dimostrativi.", "access", "/badges", "Accessi", "contextual", "operator", "critical"),
  screen("mobile-pass", "Mobile Pass", "Anteprima amministrativa della credenziale mobile, senza token.", "access", "/badges", "Accessi", "contextual", "operator", "critical", "Consolidata con Credenziali e Badge; nessuna anteprima della route pubblica tokenizzata."),
  screen("courses", "Corsi", "Calendario corsi, capienza e stato delle sessioni.", "services", "/training", "Servizi", "primary", "staff", "medium"),
  screen("course-detail", "Dettaglio corso", "Partecipanti, calendario e informazioni del corso.", "services", "/training/programs/[id]", "Servizi", "contextual", "staff", "medium"),
  screen("workouts", "Allenamenti", "Programmi e sessioni di allenamento pianificate.", "services", "/training/sessions", "Servizi", "secondary", "staff", "medium"),
  screen("athletes", "Atleti", "Vista degli atleti e dei rispettivi percorsi.", "services", "/training/clients", "Servizi", "secondary", "staff", "high"),
  screen("pilates-bookings", "Pilates Reformer e prenotazioni", "Agenda, posti disponibili e lista d’attesa.", "services", "/training", "Servizi", "secondary", "staff", "medium"),
  screen("reports", "Report", "Libreria dei report gestionali disponibili.", "direction", "/analytics", "Direzione", "primary", "administrator", "medium"),
  screen("kpi-trends", "KPI e andamento", "Indicatori direzionali e trend temporali.", "direction", "/analytics", "Direzione", "secondary", "administrator", "medium"),
  screen("renewal-analysis", "Analisi rinnovi", "Tasso, valore e motivazioni dei rinnovi.", "direction", "/analytics", "Direzione", "secondary", "administrator", "medium"),
  screen("revenue-analysis", "Analisi incassi", "Andamento degli incassi e composizione dimostrativa.", "direction", "/analytics", "Direzione", "secondary", "administrator", "high"),
  screen("staff", "Staff", "Elenco operatori e stato dei profili.", "system", "/system/staff", "Sistema", "primary", "administrator", "critical"),
  screen("operator-profile", "Profilo operatore", "Identità professionale e preferenze visuali.", "system", "/system/staff", "Sistema", "contextual", "administrator", "high"),
  screen("configuration", "Configurazione", "Configurazioni funzionali organizzate per area.", "system", "/settings", "Sistema", "primary", "administrator", "critical"),
  screen("system-status", "Stato sistema", "Disponibilità visuale dei moduli, senza diagnostica tecnica.", "system", "/system", "Sistema", "secondary", "administrator", "critical"),
  screen("settings", "Impostazioni", "Preferenze e parametri amministrativi del club.", "system", "/settings", "Sistema", "primary", "administrator", "critical"),
] as const satisfies readonly PlatinumScreen[]
export type PlatinumScreenId = (typeof PLATINUM_SCREENS)[number]["id"]
export function getPlatinumScreen(id: string) { return PLATINUM_SCREENS.find((item) => item.id === id) }
