# BODYGATE V1 MAP

Documento di mappatura completa della piattaforma **BodyGate V1 locale** (stato attuale repository), creato per fissare la baseline prima di proseguire con sviluppo e stabilizzazione.

---

## 1) Pagine App Router esistenti

> Stato classificato come:
> - **completo**: utilizzabile in produzione locale
> - **parziale**: funziona ma richiede hardening/finiture
> - **da rifare**: base presente ma non pronta per uso robusto

| Percorso | Scopo | Stato |
|---|---|---|
| `/` | Home dashboard generale | parziale |
| `/login` | Accesso operatori | parziale |
| `/reception` | Dashboard reception live accessi + bridge status live (polling 5s) | parziale |
| `/access` | Pannello accessi | parziale |
| `/access-logs` | Storico accessi | parziale |
| `/access-denied` | Vista denial accessi | parziale |
| `/badges` | Gestione badge | parziale |
| `/customers` | Lista clienti CRM | completo |
| `/customers/new` | Nuovo cliente | completo |
| `/customers/[id]` | Dettaglio cliente | completo |
| `/customers/[id]/edit` | Modifica cliente | completo |
| `/customers/[id]/contract` | Contratto cliente | parziale |
| `/subscriptions` | Gestione abbonamenti | completo |
| `/payments` | Pagamenti | parziale |
| `/accounting` | Area contabile | parziale |
| `/analytics` | Dashboard analytics | parziale |
| `/notifications` | Notification center | parziale |
| `/system` | Pannello sistema | parziale |
| `/system/audit` | Audit logs | parziale |
| `/settings` | Hub impostazioni | parziale |
| `/settings/modules` | Abilitazione moduli | parziale |
| `/settings/pricing` | Prezzi/listini | parziale |
| `/settings/permissions` | Permessi ruoli | parziale |
| `/training` | Hub training | parziale |
| `/training/programs` | Programmi allenamento | parziale |
| `/training/programs/[id]` | Dettaglio programma | parziale |
| `/training/workouts/[sessionId]` | Sessione workout live | parziale |
| `/training/library` | Libreria esercizi | parziale |
| `/training/athlete` | Dashboard atleta | parziale |
| `/test-gate` | Pagina test tornello/bridge | parziale |

---

## 2) API Routes esistenti

| Endpoint | Metodo | Input | Output | Tabelle coinvolte | Stato |
|---|---|---|---|---|---|
| `/api/access/check` | `POST` (`GET` info) | `badge`/`badge_code` | `allowed`, `reason`, dati cliente/badge | `customer_badges`, `customers`, `customer_blocks`, `membership_fee_settings`, `customer_membership_fees`, `customer_subscriptions`, `customer_access_logs`, `gym_presence`, `unknown_badge_logs` | **completo** (core accesso reale) |
| `/api/access/log` | `POST` (`GET` info) | payload bridge (badge, door, reader, allowed, open_warning...) | `ok`, `log_id` | `access_logs` | completo |
| `/api/access/stats` | `GET` | nessuno | stats giornaliere accessi | `access_logs` | parziale |
| `/api/bridge/status` | `GET` | nessuno | stato bridge locale (`online`, `connected`, `lastBadge`, `lastBadgeTime`, `processing`, `bridge`) + watchdog (`online/degraded/offline`, processo bridge, `last_error`, `restart_suggested`) | nessuna tabella diretta | completo |
| `/api/turnstile/open` | `POST` | nessuno (inoltro a bridge `/open`) | esito apertura | nessuna tabella diretta | completo |
| `/api/gate/open` | `POST` | richiesta apertura | esito apertura/errore bridge | (indiretta) | parziale |
| `/api/auth/login` | `POST` | `email`, `password` | cookie session + user role | `app_users` | parziale |
| `/api/auth/logout` | `POST` | nessuno | logout cookie | nessuna tabella | completo |
| `/api/contracts/send-otp` | `POST` | dati contratto/cliente | esito invio OTP | (contratti/otp) | parziale |
| `/api/contracts/verify-otp` | `POST` | codice OTP + riferimenti | verifica firma/OTP | (contratti/otp) | parziale |
| `/api/subscriptions/check-expired` | `GET`/job | nessuno | elenco/conta scaduti | `customer_subscriptions` | parziale |
| `/api/customers/[id]/documents/create` | `POST` | metadati documento | record documento | documenti cliente | parziale |
| `/api/customers/[id]/payments/[paymentId]/receipt/create` | `POST` | payload ricevuta | ricevuta creata | pagamenti/ricevute | parziale |
| `/api/customers/list` | `GET` | nessuno | elenco clienti CRM ordinato | `customers` | completo |
| `/api/admin/test` | `GET` | nessuno | health/admin test | nessuna tabella | parziale |

### Note operative API
- `/customers` ora carica i dati tramite API server-side `/api/customers/list` (service role) per evitare risposte vuote dovute a RLS/sessione client anon.
- Il middleware lascia pubblica `/api/access/check` per consentire chiamata bridge locale.
- Le API bridge (`/api/bridge/status`, `/api/turnstile/open`) dipendono da `http://localhost:5050`.

---

## 3) Componenti principali

## Dashboard
- `DashboardHero`, `StatsCards`, `AccessChartPanel`, `LiveActivityFeed`, `PresenceMonitor`, `TurnstilePanel`, `RealtimeStatusBar`, `SystemStatusPanel`, `QuickLinksPanel`, `TodayAccessList`.
- Stato: **parziale** (ricco UI/realtime, da consolidare KPI e coerenza dati).

## Access Control
- `ReceptionPanel`, `ReceptionAccessCard`, `AccessLogsTable`, `SystemLivePanel`.
- Stato: **completo/parziale** (flusso accesso reale ok, monitoraggio da rendere più robusto).

## Customers
- `CustomersTable`, `CustomerForm`, `CustomerDetailPanel`, `CustomerDocumentsPanel`, `CustomerPaymentsPanel`, `CustomerMedicalCertificates`, `CustomerContract`, `CustomerContractActions`, `ContractOtpPanel`.
- Stato: **completo** per gestione base CRM; **parziale** su contratti/automazioni.

## Settings
- `SettingsPageClient`, `ModulesSettingsClient`, `PricingSettingsClient`, `PermissionsSettingsClient`, tabs/settings vari.
- Stato: **parziale**.

## Training
- `TrainingProgramsClient`, `TrainingProgramBuilderClient`, `WorkoutSessionClient`, `ExercisesLibraryClient`, `AthleteDashboardClient`, `TrainingRestTimer`, `ExerciseDetailModal`.
- Stato: **parziale** (feature presenti ma piattaforma da consolidare).

## Notification Center
- `NotificationCenterClient`, `NotificationCard`, `NotificationFilters`, `NotificationStats`.
- Stato: **parziale** (buona base realtime/eventi).

---

## 4) Supabase schema rilevato

## Tabelle usate (rilevate da API e componenti)
- `customer_badges`
- `customers`
- `customer_blocks`
- `membership_fee_settings`
- `customer_membership_fees`
- `customer_subscriptions`
- `customer_access_logs`
- `gym_presence`
- `unknown_badge_logs`
- `access_logs`
- `app_users`
- (area notifiche/training/payments/settings: ulteriori tabelle usate lato client)

## Campi principali (evidenza diretta)
- Access check: `badge_code`, `is_active`, `customer_id`, `branch_id`, `medical_certificate_end_date`, `starts_at`, `ends_at`, `valid_from`, `valid_until`.
- Access logs: `allowed`, `reason`, `door`, `reader`, `event_type`, `open_command_sent`, `open_sdk_result`, `open_warning`, `controller_ip`, `bridge_version`.
- Auth utenti: `email`, `password`, `role`, `active`.

## Relazioni note
- `customer_badges.customer_id -> customers.id`
- `customers.id -> customer_subscriptions.customer_id`
- `customers.id -> customer_membership_fees.customer_id`
- `customers.id -> customer_blocks.customer_id`
- `customers.id -> customer_access_logs.customer_id`
- `customers.branch_id` usato come scope operativo sede.

## Criticità
1. Doppio stream log (`customer_access_logs` e `access_logs`) con possibile divergenza semantica.
2. Uso misto client anon e service role su percorsi critici.
3. Multi-sede non formalizzata come tenancy robusta (branch presente ma non modello multi-tenant completo).

---

## 5) Bridge C#

## Endpoint locali bridge
- `GET /open` → invio comando apertura tornello predefinito (`OpenDoor(DoorIndex)`).
- `GET /open0` → invio `OpenDoor(0)`.
- `GET /open1` → invio `OpenDoor(1)`.
- `GET /openlong0` → invio `OpenDoorLong(0)`.
- `GET /openlong1` → invio `OpenDoorLong(1)`.
- `GET /status` → stato connessione controller + config.
- `GET /health` → health servizio.

## Comandi tornello
- Apertura con `controller.OpenDoor(doorIndex)` o `controller.OpenDoorLong(doorIndex)` tramite endpoint bridge dedicati (`/open0`, `/open1`, `/openlong0`, `/openlong1`).
- Retry “safe”: retry consentito solo quando comando NON inviato; se SDK ritorna `false` ma comando inviato → warning tecnico, stop retry per evitare impulsi multipli.

## Flusso badge
1. Pacchetto TCP della centralina ricevuto su `tcpNet.OnDataEvent`, inoltrato esplicitamente a `controller.HandleMessage` e loggato come RX raw debug.
2. Evento badge SDK su `controller.OnEventHandler`, con log minimo di badge/controller code, reader, door ed event type.
3. Dedup badge (cooldown).
4. Chiamata BodyGate `/api/access/check`.
5. Se `allowed=true` → apertura tornello con `OpenDoor(0)`/`/open0`.
6. Invio log tecnico a `/api/access/log`.

## Dipendenze
- `TcpClass.dll` (integrazione hardware controller TCP).
- .NET 8 (`BodyGateBridge.csproj`).

## Criticità operative
1. IP/porta controller e URL API hardcoded.
2. Bridge locale dipendente da API localhost attiva.
3. Logging file locale da gestire (rotazione/monitor).
4. Single-controller nel processo attuale (non multi-device nativo).

---

## 6) Funzioni già operative (baseline)

- ✅ Accesso reale tornello funzionante (badge reale → comando apertura).
- ✅ Verifica badge via `/api/access/check`.
- ✅ Log accessi tecnici bridge via `/api/access/log`.
- ✅ CRM clienti base operativo.
- ✅ Gestione abbonamenti con controllo validità accesso.
- ✅ Gestione certificato medico con blocco su scadenza/mancanza.
- ✅ Quota associativa (quando richiesta nelle impostazioni sede).

---

## 7) Funzioni incomplete o provvisorie

- Dashboard reception live: **completo V1** con modulo “Access Feed + Presenza Attuale” (card accessi recenti/negati/presenti, badge stato consentito-negato-warning, realtime `customer_access_logs` + `gym_presence` con fallback polling 7s).
- Dashboard reception live: **parziale** (include card stato bridge live/watchdog con refresh manuale + auto refresh 5s; KPI da consolidare).
- Settings: **parziale** (moduli/prezzi/permessi da harden).
- Report/analytics: **parziale**.
- Training platform: **parziale** (molte feature presenti, maturità non finale).
- Receipts: **parziale** (pipeline creazione ricevute da consolidare).
- Contracts/OTP: **parziale**.
- Role permissions: **parziale** (base presente, governance da chiudere).
- Multi sede: **parziale** (branch handling presente ma non architettura completa).

---

## 8) Priorità V1 locale

## Cosa fissare prima (ordine)
1. **Stabilità bridge Windows**: avvio automatico, watchdog, health check operativo.
2. **Stabilità access pipeline**: monitor `/api/access/check` + `/api/access/log` + latenza badge.
3. **Chiarezza logging**: definire fonte ufficiale operativa e dashboard KPI giornaliera.
4. **Reception live**: fallback in caso realtime degradato (refresh/polling).
5. **Hardening auth locale**: policy account/operatori e sessioni.

## Cosa NON toccare ora
- Refactor SaaS/multi-tenant completo.
- Re-architettura training avanzata.
- Refactor massivo componenti UI.

## Cosa sviluppare dopo
1. Consolidamento permessi/ruoli.
2. Stabilizzazione reportistica/analytics.
3. Completamento contratti/ricevute.
4. Evoluzione training integrato.
5. Preparazione graduale multi-sede/multi-device.

---

## Allegato: riferimenti rapidi file chiave

- Access decision engine: `app/api/access/check/route.ts`
- Access technical log API: `app/api/access/log/route.ts`
- Bridge status API: `app/api/bridge/status/route.ts`
- Turnstile open API: `app/api/turnstile/open/route.ts`
- Auth login route: `app/api/auth/login/route.ts`
- Middleware access/public routes: `middleware.ts`
- Bridge C# core: `bridge/bridge-v2/Program.cs`
- Bridge dependency: `bridge/bridge-v2/TcpClass.dll`

## 9) Update 2026-05-27 — Reception Dashboard Live V1

- Pagina `/reception` aggiornata con modulo operativo **Access Feed + Presenza Attuale**.
- Fonti dati primarie: `customer_access_logs`, `gym_presence`, `customers` (join Supabase).
- Eventi mostrati con stato `consentito` / `negato` / `warning` (badge sconosciuto), motivo denial, badge code e timestamp evento.
- Sezione “Presenti ora” mostra ultimo ingresso e permanenza stimata in minuti per clienti `is_inside=true`.
- Realtime attivato su `customer_access_logs` e `gym_presence`; fallback polling automatico ogni 7 secondi per resilienza.
- Nessuna modifica al bridge C# e nessuna modifica a `/api/access/check`.

## 10) Bridge Watchdog V1 (2026-05-27)

- Watchdog base implementato lato `app/api/bridge/status/route.ts` senza toccare il flusso `/api/access/check`.
- Controlli V1: processo `BodyGateAccessBridge.exe` (solo host Windows via `tasklist`), HTTP `GET /status`, HTTP `GET /health`, stato `connected`.
- Stati esposti: `online` (bridge raggiungibile + connected true), `degraded` (bridge raggiungibile ma connected false), `offline` (bridge non raggiungibile / errore).
- Esposto `watchdog.last_error` per operatività reception e `restart_suggested` per futura automazione.
- Auto-restart non attivo in V1 (`auto_restart_enabled=false`) per evitare multiistanza e doppia connessione TCP verso centralina.
- Reception dashboard aggiornata con card Bridge Watchdog e alert visuale degraded/offline con polling ogni 5 secondi.

### Comando Windows consigliato (avvio automatico controllato)
- Esecuzione tramite **Utilità di pianificazione** all'avvio sistema con opzione "se non già in esecuzione" (single instance).
- Comando esempio: `"C:\BodyGate\Bridge\BodyGateAccessBridge.exe"`
- Opzionale script lock file/mutex da introdurre in V2 prima di abilitare auto-restart automatico.
## 11) Access Alert System V1 — Reception (2026-05-27)

- Implementata card **“Alert Reception”** nella pagina `/reception` con severità `info` / `warning` / `critical` e messaggio operativo per front desk.
- Alert coperti in V1: bridge `offline`, bridge `degraded`, badge sconosciuto, negato per abbonamento, negato per certificato medico, negato per quota associativa, cliente bloccato, negati ripetuti stesso badge/cliente.
- Ogni riga alert mostra: tipo, severità, messaggio chiaro, orario, riferimento badge/cliente e azione suggerita.
- Fonti dati usate senza toccare bridge C#: `customer_access_logs`, `access_logs`, `gym_presence`, `customers`, endpoint `/api/bridge/status`.
- Realtime/polling mantenuto: subscription Supabase su log/presenze + polling bridge ogni 5 secondi.
- Nessuna modifica a `/api/access/check`, nessuna modifica al bridge C#, nessuna regressione introdotta al flusso “Nuovo cliente rapido” o Bridge Watchdog V1.

## 12) Reception UX Cleanup V1 (2026-05-27)

- Layout `/reception` riorganizzato per priorità operativa: hero con stato sistema + azioni rapide, prima riga con Bridge/Watchdog + Alert Reception + Presenti Ora, seconda riga con Accessi Recenti + Accessi Negati.
- Migliorata leggibilità dark/premium con microcopy orientato all’operatività reception e riduzione del rumore visivo.
- Polling/realtime esistente mantenuto invariato (bridge polling 5s + subscription Supabase).
- Nessuna modifica al bridge C#, a `/api/access/check` o alle logiche tornello/accesso.

## 13) Customer Timeline V1 (2026-05-27)

- Timeline cliente aggiornata in `app/customers/components/CustomerTimeline.tsx` con aggregazione eventi multi-sorgente.
- Fonti coperte con fallback safe (se tabella assente/campi diversi): `customer_access_logs`, `access_logs` (link via `customer_id` e badge), `customer_subscriptions`, `customer_membership_fees`, `medical_certificates`, `customer_blocks`, `customer_internal_notes`, `payments`, `customer_payments`, `customer_documents`, `documents`, `customer_badges`, `access_credentials`, `customer_timeline` legacy.
- Ordinamento unico dal più recente al più vecchio su timestamp evento.
- Ogni evento espone tipo, titolo, descrizione, data/ora, stato, eventuale importo e colore semantico.
- Nessuna modifica a bridge C# e nessuna modifica a `/api/access/check`.
