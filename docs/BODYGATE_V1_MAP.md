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
| `/reception` | Dashboard reception live accessi | parziale |
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
| `/api/access/check` | `POST` (`GET` info) | `badge`/`badge_code` | `allowed`, `reason`, dati cliente/badge | `access_credentials`, `customers`, `customer_blocks`, `membership_fee_settings`, `customer_membership_fees`, `customer_subscriptions`, `customer_access_logs`, `gym_presence`, `unknown_badge_logs` | **completo** (core accesso reale) |
| `/api/access/log` | `POST` (`GET` info) | payload bridge (badge, door, reader, allowed, open_warning...) | `ok`, `log_id` | `access_logs` | completo |
| `/api/access/stats` | `GET` | nessuno | stats giornaliere accessi | `access_logs` | parziale |
| `/api/bridge/status` | `GET` | nessuno | stato bridge locale (`online`, `bridge`) | nessuna tabella diretta | completo |
| `/api/turnstile/open` | `POST` | nessuno (inoltro a bridge `/open`) | esito apertura | nessuna tabella diretta | completo |
| `/api/gate/open` | `POST` | richiesta apertura | esito apertura/errore bridge | (indiretta) | parziale |
| `/api/auth/login` | `POST` | `email`, `password` | cookie session + user role | `app_users` | parziale |
| `/api/auth/logout` | `POST` | nessuno | logout cookie | nessuna tabella | completo |
| `/api/contracts/send-otp` | `POST` | dati contratto/cliente | esito invio OTP | (contratti/otp) | parziale |
| `/api/contracts/verify-otp` | `POST` | codice OTP + riferimenti | verifica firma/OTP | (contratti/otp) | parziale |
| `/api/subscriptions/check-expired` | `GET`/job | nessuno | elenco/conta scaduti | `customer_subscriptions` | parziale |
| `/api/customers/[id]/documents/create` | `POST` | metadati documento | record documento | documenti cliente | parziale |
| `/api/customers/[id]/payments/[paymentId]/receipt/create` | `POST` | payload ricevuta | ricevuta creata | pagamenti/ricevute | parziale |
| `/api/admin/test` | `GET` | nessuno | health/admin test | nessuna tabella | parziale |

### Note operative API
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
- `access_credentials`
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
- Access check: `code`, `controller_code`, `status`, `customer_id`, `branch_id`, `medical_certificate_end_date`, `starts_at`, `ends_at`, `valid_from`, `valid_until`.
- Access logs: `allowed`, `reason`, `door`, `reader`, `event_type`, `open_command_sent`, `open_sdk_result`, `open_warning`, `controller_ip`, `bridge_version`.
- Auth utenti: `email`, `password`, `role`, `active`.

## Relazioni note
- `access_credentials.customer_id -> customers.id`
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
- `GET /open` → invio comando apertura tornello.
- `GET /status` → stato connessione controller + config.
- `GET /health` → health servizio.

## Comandi tornello
- Apertura con `controller.OpenDoor(DoorIndex)`.
- Retry “safe”: retry consentito solo quando comando NON inviato; se SDK ritorna `false` ma comando inviato → warning tecnico, stop retry per evitare impulsi multipli.

## Flusso badge
1. Evento badge da centralina TCP.
2. Dedup badge (cooldown).
3. Chiamata BodyGate `/api/access/check`.
4. Se `allowed=true` → apertura tornello.
5. Invio log tecnico a `/api/access/log`.

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

- Dashboard reception live: **parziale** (stabilità realtime/KPI da consolidare).
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
