# Knowledge base BodyGate

> Mantenuta dagli agenti automatici del progetto. Sezione tecnica e di business a cura dell'agente "Autoapprendimento" (aggiornamento incrementale quotidiano); sezione "Playbook" a cura dell'agente "Automiglioramento" (settimanale). Studio iniziale completo: 2026-09-29.

---

## Architettura e convenzioni tecniche

### Stack e stato del progetto
Next.js 16.2.4, React 19.2.4, TypeScript 5, Supabase JS 2.105.3, Tailwind CSS 4. `package.json` è ancora `0.1.0`, ma il progetto è una **piattaforma operativa reale** in produzione per Body Energy ASD (palestra a Palermo, con hardware di controllo accessi fisico collegato), attualmente in un percorso di industrializzazione chiamato "Platinum" (vedi sotto).

### Documentazione esistente — affidabilità
Il repo ha moltissima documentazione, ma di qualità/attualità molto disomogenea:
- **Fonte più autorevole e recente**: `docs/platinum/PHASE_0_AUDIT_2026-08-06.md` (audit di baseline: maturità moduli, rischi critici, invarianti protetti), `docs/platinum/BACKLOG_V1.md` (roadmap verso 1.0.0), `docs/platinum/DEFINITION_OF_DONE.md`.
- **Obsoleti/da trattare con cautela**: `docs/BODYGATE_V1_MAP.md` (superato, precede sicurezza/atomicità/corsi/training/digital-pass), `bodygate-map.txt` (albero cartelle di una versione precedente, manca `access-control/`, `courses/`), `README.md` (visione "Enterprise Fitness Operating System" — trattarlo come marketing, non come verità operativa: il Phase 0 Audit nota che non descrive setup produzione/release/recovery reali), `docs/COMMAND_MAP.md` (contiene endpoint **aspirazionali** mai implementati, es. `/api/access/open`).
- **File vuoti (0 byte)**, documentazione pianificata mai scritta: `docs/ACCESS_ENGINE.md`, `docs/DATABASE.md`, `docs/HARDWARE.md`, `docs/ROADMAP.md`, `docs/TRAINING_ENGINE.md`.
- **Operatività reale**: `docs/OPERATIONS.md` — deploy **doppio**: Vercel (prod remota) + PC reception locale in LAN (necessario per comunicare con l'hardware del tornello), script PowerShell (`deploy-bodygate.ps1`, `start-bodygate.ps1`, `bodygate-watchdog.ps1` con alert Telegram). `/api/health` espone `commit`/`commit_short` (da `.build-commit`, non da git live) per confrontare le due istanze.
- **Governance route**: `architecture/route-manifest.mts` (inventario tipizzato di tutte le route reali, validato da `npm run qa:routes`) + `docs/ROUTE_GOVERNANCE.md`.
- **Registro deprecazioni**: `architecture/deprecation-registry.mts` + `docs/deprecation-evidence-registry.md` — regola generale: nessuna evidenza statica autorizza rimozione runtime, serve evidenza di produzione (min. 30 giorni con un ciclo di fatturazione; 90 giorni + validazione dispositivi per route pubbliche/token).

### Aree funzionali del prodotto (sotto `app/`)
| Area | Route principali | Note |
|---|---|---|
| Dashboard | `/` | KPI operativi, polling 30s su `/api/dashboard/overview` |
| Access Control | `/access-control`, `/access-logs`, `/badges`, `/test-gate` | Pipeline reale: DNake reader → Bridge .NET 8 locale → `POST /api/access/check` → comando KT02.3 → turnstile → `POST /api/access/log`. `/access` e `/test-gate` sono **protected-do-not-touch** |
| Customers/CRM | `/customers`, `/customers/[id]`, `/customers/new`, `/contract`, `/contract/print`, `/receipt/[receiptId]` | Modulo "operational and mature" ma con debito tecnico noto |
| Customers V2 | `/v2/customers` | Prototipo separato, API/componenti propri, fuori scope refactor Platinum |
| Subscriptions | `/subscriptions`, `/subscriptions/plans` | Piani/pricing server-authoritative |
| Payments/Accounting | `/payments`, `/accounting` | **Invariante**: nessuna scrittura automatica in `cash_movements`/prima nota |
| Courses | `/courses/{admin,bookings,calendar,payments}` | RLS, vincoli overlap sala/istruttore, RPC atomiche per booking |
| Training | `/training`, `/training/{clients,programs,library,sessions}` | Catalogo canonico `exercises`, RPC atomica `create_training_program_atomic`, nessuna scrittura diretta browser→Supabase |
| Pass pubblici | `/pass/[token]`, `/mobile/[token]`, `/staff-mobile/[token]` | Pubbliche, token-scoped, **protected-do-not-touch** (token già distribuiti) |
| Staff/System | `/system`, `/system/audit`, `/system/staff` | RBAC lato server |
| Settings | `/settings`, `/settings/{modules,permissions,pricing}` | `/settings/modules` è placeholder |
| Reception | `/reception` | Realtime su `customer_access_logs`/`gym_presence`, fallback polling 5-7s |
| Notifications, Analytics | `/notifications`, `/analytics` | — |
| Login | `/login` | Unica pagina pubblica area operatori |
| UI Lab | `/ui-lab`, `/ui-lab/platinum` | Laboratorio interno; `/ui-lab/platinum` = 40 preview con dati demo, **da mantenere come riferimento design**, non è runtime operativo |

### Convenzioni architetturali
- **Supabase — due pattern**: (1) client **anon** (`app/lib/supabaseClient.ts`) usato da ~36 componenti client-side per query dirette — **problema di sicurezza P0 aperto** (policy RLS `anon SELECT USING (true)` su tabelle base incluse `medical_certificates`, `payments`, `access_credentials`, `staff_users`); (2) client **service-role** creato inline nelle API routes/server components per bypassare RLS nei flussi autoritativi. Pattern ricorrente: server component async che fa `await params` e query Supabase dirette con service-role senza passare da un'API route (es. `app/customers/[id]/contract/print/page.tsx`).
- Non esiste Supabase Auth: la sessione è un sistema **HMAC custom** (`app/lib/auth/session.ts`, cookie `bodygate_session`), non collegato a RLS per-utente.
- **API routes**: pattern comune `export const dynamic = "force-dynamic"; export const runtime = "nodejs";`, validazione regex esplicita, header `Idempotency-Key` per operazioni critiche, operazioni economiche implementate come **RPC Postgres atomiche** invece di sequenze insert/update applicative.
- Esistono coppie di endpoint con intento sovrapposto non ancora unificate: `/api/customers/create` vs `create-platinum`; due famiglie API per certificato medico (`[id]/medical-certificate` PATCH vs `update-medical-certificate` POST).
- **Machine-auth graduale** (`off`/`observe`/`enforce`, env `BODYGATE_MACHINE_AUTH_MODE`) su endpoint hardware (`/api/access/check`, `/api/access/log`, `/api/dnake/event`), header `x-bodygate-machine-key`.

### Breaking change Next.js (confermate nel codice reale, v16.2.4)
1. **`middleware.ts` → `proxy.ts`**: il middleware globale è rinominato `proxy.ts`, esporta `export async function proxy(request)` invece di `middleware()`, stesso `config.matcher`.
2. **`params` asincrono** nelle route dinamiche: `{ params }: { params: Promise<{ id: string }> }`, richiede `await params`.
3. `node_modules/next/dist/docs/` è la fonte da consultare prima di scrivere codice nuovo (per verificare altre differenze) — **non installato in ambienti sandbox senza `npm install`**.
- Raccomandazione: non assumere che conoscenza pregressa di Next.js standard (middleware.ts, params sincrono) valga qui.

### Design system — quattro pattern coesistenti (non solo i due dichiarati da AGENTS.md!)
1. **`components/bodygate-ui`** — sistema canonico Platinum, l'unico da usare per nuove schermate. Nucleo realmente diffuso in produzione: `BGPageShell` (~36 file, contenitore quasi universale), `BGButton` (~25), `BGPageHeader` (~22), `BGCard` (~20), `BGStatusBadge` (~19), `BGEmptyState` (~16), `BGInput`/`BGSelect` (~12/9), `BGStatCard` (~8). `BGStatGrid` (nuovo, #213): primitivo per la griglia di KPI che ospita i `BGStatCard` — usarlo al posto di `style={{display:"grid"...}}` ad-hoc. `BGContractStatus` risulta **definito ma con 0 usi rilevati** fuori da bodygate-ui — probabile componente da collegare a `CustomerDetailsClient.tsx`. `PlatinumComponents.tsx` (batch export: BGAlert, BGSearch, BGFilters, BGTimeline, BGReceiptSummary, ecc.) sono componenti-vetrina usati **solo nella galleria `/ui-lab/platinum`**, non in produzione.
2. **`components/ui`** (shadcn) — quasi completamente isolato: usato solo da `app/ui-lab/page.tsx` (pagina-vetrina che dimostra cosa NON riusare) e internamente da `BGDialog.tsx`. Morto in produzione ma da non estendere.
3. **`app/components/ui/`** — ⚠️ **sistema "ombra" non documentato in AGENTS.md**: duplica i nomi BG* (BGCard, BGButton, BGPageHeader, ecc.) con implementazione visiva diversa (bordi 26-30px, glassmorphism, **CSS hardcoded senza custom property**). Usato SOLO da `app/components/AccessLogsTable.tsx` e `app/components/payments/PaymentsClient.tsx` → le pagine **Log Accessi** e **Pagamenti** hanno un look&feel visivamente diverso dal resto dell'app. Il suo CSS (`app/components/ui/bodygate-ui.css`, 29KB) è importato **globalmente** in `app/layout.tsx` su ogni pagina, in parallelo al modulo CSS del sistema canonico → rischio di collisione di stile.
4. **`app/components/bodygate-v2/`** — redesign scuro/glassmorphism **abbandonato**, sostanzialmente dead code: CSS mai importato, componenti mai renderizzati (`app/v2/customers/page.tsx` importa solo un *type* da lì, il resto della pagina usa già bodygate-ui). Alcune regole `.bg2-*` con `!important` sono finite comunque in coda a `app/globals.css` senza mai essere attivate.
- Regola esplicita in AGENTS.md: "non introdurre un quinto design system" — di fatto ce ne sono già 4.
- Migrazione a Platinum dichiaratamente **solo visuale/facade**: nessuna logica, endpoint o query cambia durante un refactor UI.

### Aree meno conformi alla convenzione UI (stili inline)
~27% dei file `.tsx` sotto `app/` (35 su ~132) contiene `style={{...}}`, 253 occorrenze totali. Top offender: `app/courses/components/*Client.tsx` (tutte e 4, ~99 occorrenze — area di gran lunga più non conforme), `app/customers/[id]/CustomerDetailsClient.tsx` (29), `app/customers/components/Sidebar.tsx` (18), `app/components/ReceptionDashboard.tsx` (15), ~~`app/components/BadgesTable.tsx` (15)~~ (migrata a bodygate-ui in #213: ora usa BGStatCard/BGStatGrid/BGSection/BGTable/BGStatusBadge/BGEmptyState/BGInput/BGButton, zero stili inline). Pattern tipico: si usa già `BGCard` come base ma si aggiunge layout ad-hoc via `style={{display:"flex"/"grid", gap, gridTemplateColumns}}` — sintomo che **manca un primitivo di layout** (`BGStack`/`BGGrid`/`BGRow`) in bodygate-ui. Aree già pulite: `training/`, `access-control/`, `settings/`.

### Design token
Palette base **coerente** tra `app/globals.css` (`--accent #5b3df5` viola, `--accent-2 #c04bd6` magenta, superfici chiare, bordi `#e7e8ee`) e `components/bodygate-ui/platinum-tokens.css` (stessi hex, prefisso parallelo `--platinum-*`). L'incoerenza reale è di **forma** (raggio bordi, hardcoded hex vs CSS var) nel sistema ombra `app/components/ui/bodygate-ui.css`, più la palette scura estranea di `bodygate-v2.css` (morta). Font: `Plus_Jakarta_Sans` (display/titoli) + `Public_Sans` (body), da Google Fonts via `app/layout.tsx`.

### Stato "Platinum" — invarianti protetti (non toccare senza motivo forte)
1. Semantica decisione accesso (`/api/access/check`).
2. Flusso comando DNake/Bridge/KT02.3/turnstile.
3. Mobile Pass e Digital Pass unificato.
4. Numerazione annuale progressiva ricevute.
5. Layout stampa ricevuta A4.
6. Operazioni economiche atomiche (rinnovo/onboarding/quota).
7. Relazioni pagamento-ricevuta stabilite.
8. Esclusione di `cash_movements`/prima nota dai flussi di rinnovo attuali.

### Rischi critici aperti (audit Phase 0)
- **P0**: launcher Windows non certificato al 100%, nessun runbook di disaster recovery completo, repository pubblico con codice proprietario/hardware (da valutare privacy), sessione dipendente da eccezioni HTTP su LAN, machine-auth abilitabile prima che il Bridge invii la chiave.
- **P1**: `npm run lint` fallisce repo-wide (esiste `.lint-baseline.json`), build/test spesso dipendenti da env fittizie, log multipli (`access_logs` vs `customer_access_logs` vs `gym_presence`) potenzialmente divergenti senza fonte canonica.

---

## Regole di business (Body Energy ASD)

### Modello dati — tabelle principali
- **`customers`** — anagrafica cliente, con **due flag di attivazione ridondanti** (`active`, `is_active`) più uno stato testuale `status`, tenuti sincronizzati manualmente da ogni RPC.
- **`branches`** — sedi operative.
- **`membership_fee_settings`** — quota associativa per sede (`price`, `validity_days`, `required_for_access`), una sola riga attiva per sede.
- **`subscription_plans`** — piani abbonamento; solo un set whitelisted di nomi è ammesso (vedi sotto).
- **`customer_membership_fees`**, **`customer_subscriptions`** — quote e abbonamenti attivati.
- **`customer_payments`** (vista "cliente"/CRM) e **`payments`** (vista "contabile" parallela) — **doppia scrittura intenzionale** ad ogni operazione finanziaria, riconciliate solo euristicamente a posteriori (vedi sotto).
- **`customer_receipts`** — ricevute non fiscali, `receipt_components` (jsonb) con voci analitiche.
- **`customer_documents`** — contratti/firma OTP (diversa da `documents`, usata per l'archiviazione PDF stampata via Puppeteer — non collegate da FK).
- **`access_credentials`** (+ `customer_badges`, `staff_access_credentials` come fallback legacy) — badge/credenziali.
- **`medical_certificates`**, **`customer_timeline`**, **`customer_blocks`**.
- **`bodygate_atomic_operations`** / **`subscription_renewal_operations`** — registri di idempotenza per le RPC atomiche, solo `service_role`, RLS attiva, nessun grant pubblico.
- **Staff**: `app_users` (login) → `staff_users` → `staff_roles` ↔ (N:M) `staff_permissions` via `staff_role_permissions`; `staff_access_credentials` per il badge fisico dello staff.

### Whitelist piani abbonamento (ripetuta in 3 punti del codice — se cambia va aggiornata ovunque)
`Mensile, Trimestrale, Semestrale, Annuale, Annuale ridotto Lun Mer Ven, Annuale ridotto Mar Gio Sab, Mensile Ridotto Lunedi-Mercoledi-Venerdi, Mensile Ridotto Martedi-Giovedi-Sabato, Pilates`. Fuori whitelist → errore `BODYGATE_VALIDATION_PLAN_NOT_ALLOWED`.

### Onboarding Platinum (`create_platinum_atomic_v1`)
Transazione singola Postgres, idempotente (doppio `pg_advisory_xact_lock` su `request_hash` e `fiscal_code`, replay entro 10 minuti). Blocca su: stesso codice fiscale già esistente, badge/controller già assegnato altrove (4 controlli distinti). Calcolo quota: `round(coalesce(settings.price, payload.membership_amount, 10), 2)`, validità default 365gg. Calcolo abbonamento: `round(coalesce(nullif(plan.promo_price,0), plan.price), 2)`. Il **cliente nasce sempre non attivo** (`is_active=false`, `contract_status='pending_signature'`): l'attivazione avviene solo dopo la firma OTP se tutti i requisiti sono soddisfatti.

### Rinnovo quota associativa
Stesso pattern idempotenza. Anti-duplicato su stesso `customer_id+valid_from+valid_until` o ricevuta già emessa per lo stesso anno (bypassabile con `p_allow_duplicate`). **Genera anche un nuovo contratto da firmare** ad ogni rinnovo (non solo all'onboarding). **Non tocca `customers.is_active`**.

### Rinnovo abbonamento — HOTFIX 0.3 (bug reale corretto in produzione)
Disattiva gli abbonamenti precedenti (logica differente se `start_date` è oggi/passata vs futura/programmata). **Bug storico**: `renew_subscription_atomic_v1` aggiornava solo `customer_subscriptions.is_active` ma mai `customers.is_active`, mentre `/api/access/check` nega l'accesso appena `customer.is_active===false` **prima di ogni altro controllo** — un cliente rinnovato e pagato restava bloccato al tornello. Fix (`security-hotfix-0-3`): dopo il rinnovo, se il cliente non è attivo lo riattiva (`is_active=true, active=true`, `status: onboarding→active`), con evento timeline "Cliente riattivato". **Lezione**: ogni volta che si tocca lo stato attivazione cliente, verificare `is_active` E `active` E `status` insieme — sono tre segnali ridondanti che possono disallinearsi.

### Badge RFID
Prezzo fisso 5€ (`BODY_ENERGY_BADGE_FEE`). Modalità: `not_included`, `charged` (richiede prova di consegna), `complimentary` (richiede motivazione obbligatoria per audit).

### Job di scadenza abbonamenti
UPDATE massivo giornaliero: `subscription_expiry < now()` → `subscription_status='expired', active=false`. **Non tocca `is_active`** — incoerenza potenziale nota con il gate fisico.

### Contratti e firma OTP
Ciclo: `generated → pending_otp → signed`. OTP a 6 cifre, validità 10 minuti; ogni rigenerazione resetta il rate-limit di verifica. Non invia SMS reali: apre un link `wa.me` precompilato per invio manuale via WhatsApp Business. Verifica: rate limit 10 tentativi/15 min per documento. **Attivazione automatica del cliente** dopo firma richiede TUTTI veri: pagamento ok, quota valida, abbonamento attivo e valido, credenziale badge attiva, nessun blocco attivo — altrimenti resta `access_pending` con evento timeline che elenca i requisiti mancanti. **Anti ri-firma (#214)**: `POST /api/contracts/verify-otp` aggiorna il documento solo se `status` è null o diverso da `signed` (update condizionale con `.select("id")`); se nessuna riga viene aggiornata risponde **409 "Documento già firmato."**. Così un OTP ancora valido (10 min) non sovrascrive la traccia di audit della firma (`signed_at`/`signed_ip`/`signed_user_agent`), non riesegue la logica di attivazione (es. riattivare un cliente disattivato dopo la firma) ed è sicuro contro verifiche concorrenti.

### Ricevute e pagamenti
Numerazione centralizzata via RPC `next_bodygate_receipt_number_v2()` (solo `service_role`); se fallisce, l'intera transazione viene annullata (nessuna scrittura parziale). Ogni ricevuta ha **doppia copia** (COPIA CLIENTE / COPIA PALESTRA) stampata su un solo foglio A4 con linea di taglio — vedi anche il fix del "foglio bianco extra" già applicato (PR #185, `app/components/AppShell.tsx` + `app/globals.css`: `min-height:100vh` non neutralizzato in stampa causava una pagina vuota). Nota legale fissa in ogni ricevuta: *"Somma non soggetta ad IVA ai sensi del quarto comma dell'Art.10 del D.P.R. 633/72"*. Il **doppio registro pagamenti** (`customer_payments` + `payments`) viene riconciliato solo euristicamente a posteriori in `operational-overview` (per stesso giorno/importo/descrizione) — è una fonte nota di possibile disallineamento, monitorata ma non garantita. Annullamento pagamento: non cancella nulla fisicamente, solo `status='cancelled'` + nota; non tocca ricevute/abbonamenti/prima nota.

### Permessi e sicurezza
Ruoli amministrativi (`admin, administrator, owner, proprietario, super_admin, amministrazione, amministratore`) **bypassano ogni controllo permesso**. Per gli altri, permessi granulari via `staff_role_permissions`. Permessi effettivamente cablati nel codice: `view_payments`, `manage_staff`, `manage_payments` — il resto delle voci di menu è visibile a chiunque sia autenticato. Il gate fisico (tornello) è **indipendente** dal sistema permessi staff: per i soci, l'ordine di controllo esatto (testato, non riordinare senza aggiornare i test) è: sede assegnata → nessun blocco attivo → certificato medico valido → quota associativa (se richiesta dalla sede) → abbonamento valido → accesso consentito. `customer.is_active===false` viene intercettato ancora prima, a livello di route.

---

## Playbook per gli agenti BodyGate

_Sezione a cura dell'agente "Automiglioramento" (aggiornamento settimanale). Vuota al primo popolamento — verrà riempita dopo la prima settimana di attività degli agenti "Cura Grafica UI" e "Cura Logiche di Business", con pattern di errore ricorrenti da evitare._
