# BodyGate HOTFIX 0.4 — chiusura accesso diretto anon/authenticated

## Scopo

Eliminare la lettura pubblica dei dati dello schema `public` tramite la chiave
anon di Supabase, che e' incorporata nel bundle del browser
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Problema (verificato il 2026-11-08 sul database di produzione)

Con il solo ruolo `anon` erano leggibili, senza alcun login:

| Tabella | Righe leggibili |
|---|---|
| `customers` | 1.784 (tutte) |
| `customer_subscriptions` | 2.310 |
| `customer_membership_fees` | 2.352 |
| `customer_access_logs` | 3.996 |

`customers` contiene codice fiscale, contatti, indirizzo, documento
d'identita', consensi privacy e stato del certificato medico (dato sanitario,
GDPR art. 9). La causa erano policy `Allow anon read ...` con `using (true)` e
`GRANT SELECT` a `anon`. In piu', `anon` e `authenticated` avevano su ogni
tabella i privilegi `TRUNCATE`, `TRIGGER`, `REFERENCES`, e 53 policy di SELECT
aperte `to authenticated` (sfruttabili se la registrazione Supabase Auth fosse
abilitata).

## Perche' la correzione non rompe nulla

- Tutte le letture/scritture applicative passano da API server con service
  role, che bypassa le RLS.
- Il solo uso browser della chiave anon e' il Realtime
  (`app/lib/supabaseClient.ts`). La publication `supabase_realtime` contiene
  solo `access_logs`, tabella che `anon` gia' non leggeva: le sottoscrizioni a
  `customers`, `payments`, `audit_logs` ecc. non ricevevano eventi gia' prima.
  I componenti ricaricano comunque i dati via `fetch` alle API.
- Bucket storage (`customer-photos`, `documents`, `medical-certificates`):
  privati, nessuna policy storage. Invariati.

## Cosa fa la migrazione

`supabase/migrations/20261108120000_revoke_anon_authenticated_public_access_v1.sql`

1. Snapshot di policy e grant in `archive.security_hardening_20261108_*`.
2. Elimina le 53 policy di SELECT con `using (true)` per anon/authenticated.
3. `REVOKE ALL` su tutte le tabelle e sequenze di `public` da anon e
   authenticated.
4. `ALTER DEFAULT PRIVILEGES` perche' le nuove tabelle non siano piu'
   accessibili a quei ruoli.
5. Revoca `EXECUTE` su `nextval_dnake_user_id()`.

## Verifica eseguita

- `anon` su `customers`: `permission denied`.
- `authenticated` su `payments`: `permission denied`.
- `service_role`: legge ancora 1.784 clienti, 2.310 abbonamenti, 3.996 log.
- Advisor di sicurezza Supabase: nessun WARN residuo (solo INFO
  "RLS enabled, no policy", che qui e' il deny-all voluto).
- Policy: 78 -> 25 (restano le `No direct ... = false` e quella condizionata
  della libreria esercizi, priva di grant).

## Rollback

`scripts/sql/security-hardening-1-0-rollback.sql` ripristina grant e policy
dallo snapshot. Riapre l'esposizione: usarlo solo in emergenza.

## Da fare dopo (non incluso)

- Valutare con il DPO/consulente privacy se l'esposizione pregressa richieda
  valutazione come violazione di dati personali (GDPR art. 33-34); controllare
  i log API di Supabase per accessi anonimi anomali.
- Valutare se ruotare la chiave anon (non indispensabile ora che non da' piu'
  accesso a dati).
- ~~Reintrodurre aggiornamenti live con un canale Realtime *broadcast* privo di
  dati personali~~ **Fatto** (migrazione `20261108130000_live_change_signals_v1`
  e `app/lib/liveChanges.ts`): un trigger per statement su 10 tabelle invia
  `{ "table": "<nome>" }` sul canale `bodygate-live`; i 6 componenti live
  ricaricano i dati dalle API autenticate (debounce 400 ms). Il canale e'
  pubblico: chi ha la chiave anon vede solo che una tabella e' cambiata, e
  potrebbe inviare segnali falsi (effetto: ricarichi extra, limitati dal
  debounce). Per un canale privato serve Supabase Auth o un JWT firmato.
- Impostare `BODYGATE_MACHINE_AUTH_MODE=enforce` in produzione.
- Decidere la conservazione dello schema `archive` (backup con PII).

## RBAC: i permessi sono (quasi) solo cosmetici — finding aperto

Verificato nel codice il 2026-11-08:

- Il middleware (`proxy.ts`) controlla solo che esista una sessione valida.
- Delle 90 route in `app/api`, solo 2 importano gli helper di
  `app/lib/server/auth.ts`; nessuna usa un controllo di permesso lato server.
- I permessi (`PermissionGuard`, `useCurrentPermissions`, `Sidebar`) sono
  applicati nel browser. Chiunque abbia una sessione puo' chiamare direttamente
  le API, ad esempio `POST /api/staff/permissions-matrix` (assegna permessi ai
  ruoli) o le route di creazione staff e pagamenti.
- La matrice in produzione e' sbilanciata: `trainer` e `reception` hanno
  `manage_staff` e `manage_modules`; `manager` ha solo i permessi dei corsi;
  `commerciale` non ne ha nessuno.

Conseguenza: oggi un istruttore o un receptionist puo' concedersi qualsiasi
permesso. Per un prodotto venduto a piu' palestre e' un blocco.

Correzione prevista (vedi anche `app/lib/server/auth.ts`): guardia
`requirePermission(...)` lato server sulle route sensibili, poi revisione della
matrice ruoli. La modifica dei dati in produzione va concordata con chi usa
il sistema in reception, per non togliere operativita' per sbaglio.

### Stato RBAC (aggiornamento)

**Fatto:** guardia lato server `withPermission(...)` (`app/lib/server/auth.ts`,
logica in `app/lib/auth/permissions.ts`, 6 test) applicata alle route di
gestione staff e impostazioni, con il permesso `manage_staff` (lo stesso gia'
richiesto dalle rispettive pagine): `staff/create`, `staff/update`,
`staff/assign-dnake-qr`, `staff/list`, `staff/permissions-matrix` (GET e POST),
`settings/membership-fee` (POST), `settings/subscription-plans` (POST, PATCH).
Senza sessione risponde 401, senza permesso 403; l'amministratore passa sempre.
Il comportamento per gli utenti attuali non cambia: il login usa `app_users`
(1 account) e il ruolo admin bypassa il controllo.

**Esteso a tutte le route operative (79 file di route su 90):** pagamenti, clienti, accessi, corsi, analytics, notifiche, training, contabilita', abbonamenti, dnake, apertura varchi, audit. Ogni handler usa `withPermission(...)` con il permesso gia' previsto dalla matrice (`view_customers`, `edit_customers`, `manage_payments`, `manage_access`, `view_access_logs`, `view_analytics`, `view_dashboard`, `view_notifications`, `view_courses`, `manage_courses`, `manage_course_bookings`, `manage_training`, `view_payments`, `manage_staff`). Restano senza guardia di permesso, per scelta e con test (`tests/apiGuardCoverage.test.mjs`): le route hardware con autenticazione macchina (`access/check`, `access/log`, `dnake/event`), `bridge/status`, `health`, `auth/*`, `admin/test`, `settings/branches`, `customers/ensure-digital-pass` e due letture di listini (`membership-fee` GET, `subscription-plans` GET). Il test fallisce se si aggiunge una route senza guardia o senza eccezione dichiarata.

**Attenzione prima di creare account personali:** la guardia applica la matrice cosi' com'e'. Oggi l'unico login e' `admin` (bypass), quindi nulla cambia; ma un account `manager` (solo permessi corsi) o `commerciale` (nessuno) non vedrebbe clienti o pagamenti. Rivedere la matrice prima di attivarli. Ogni richiesta guardata aggiunge 2 query (sessione e profilo staff): accettabile oggi, da mettere in cache con piu' traffico.

**Ancora aperto:** il login usa un solo account in `app_users`: senza account personali
non c'e' tracciabilita' per operatore (`audit_logs.user_email` e' sempre lo
stesso) e la matrice ruoli non ha effetto pratico. Da risolvere prima di
vendere a piu' palestre.

## Valutazione privacy: cosa i log permettono di dire

Controllati i log dell'API Supabase (query al 2026-11-08): sono disponibili solo
8 richieste edge (una raffica del 2026-11-07 ~20:06 UTC), tutte con ruolo
`service_role` e user agent `node`, cioe' il server dell'app. **Nessuna richiesta
con ruolo `anon`** nella finestra disponibile. Il campione e' troppo piccolo e
recente per escludere accessi passati: la valutazione sull'esposizione storica
(GDPR art. 33-34) resta da fare con un consulente privacy, partendo dal fatto che
i dati erano leggibili senza login da quando esistono le policy `Allow anon read`
(la migrazione `narrow_anon_authenticated_select_to_realtime_tables` e'
del 2026-08-31).
