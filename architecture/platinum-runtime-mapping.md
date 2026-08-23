# Platinum runtime batch 1 — mappatura operativa

## Dashboard `/`

| Funzione esistente | Componente legacy | Componente Platinum | Dato in ingresso | Azione in uscita | Comportamento preservato | Test |
|---|---|---|---|---|---|---|
| Overview/KPI | `app/page.tsx` | facade `BGStatCard` | `GET /api/dashboard/overview` | nessuna | endpoint, no-store, polling 30 s | contratto fetch e adapter |
| Stato Bridge | badge pagina | facade `BGStatusBadge` | `overview.bridge` | retry overview | nessun fallback dimostrativo | null/offline |
| Accessi recenti | lista inline | facade `BGCard`/`BGEmptyState` | `latest_access` | deep link esistenti | esito, persona, motivo e orario | record incompleto |
| Incassi/scadenze/alert | card inline | facade card/stat | `kpis`, `alerts` | link operativi esistenti | valori restituiti dall'API; valori assenti non diventano zero | dati parziali |

Caricamento ed errore sono gestiti localmente; il retry richiama la stessa `GET`. Il refresh automatico resta a 30 secondi. L'autenticazione è quella globale. L'API aggrega Supabase e lo stato Bridge; la pagina non scrive dati. Il solo side effect è il timer, cancellato allo smontaggio.

## Reception `/reception`

| Funzione esistente | Componente legacy | Componente Platinum | Dato in ingresso | Azione in uscita | Comportamento preservato | Test |
|---|---|---|---|---|---|---|
| Monitor accessi/ricerca | `ReceptionDashboard` | facade card/input/status | query Supabase esistenti | selezione/deep link cliente | ricerca e identificazione senza scritture | adapter incompleti |
| Stato cliente | liste reception | stato Platinum | clienti, abbonamenti, certificati | apertura scheda cliente | stato restituito, mai inventato | null/undefined |
| Stato Bridge | `BridgeStatusCard` | badge/alert Platinum | `GET /api/bridge/status` | retry | polling 5 s e offline esplicito | contratto endpoint |
| Refresh realtime | channel Supabase | invariato | cinque tabelle esistenti | ricaricamento query | stessi canali e query | nessuna nuova fetch/scrittura |
| Storico essenziale | liste accessi | card/lista Platinum | `customer_access_logs` | `/access-logs`, `/customers/:id` | esito, motivo e ora | empty/error |

Le query leggono `customers`, `customer_access_logs`, `customer_subscriptions` e `gym_presence`; il componente non esegue mutazioni. Gli errori Bridge sono visibili. Gli errori delle query Supabase, prima ignorati, sono ora rappresentati senza sostituire i dati con demo. Permessi, autenticazione e side effect realtime restano globali e invariati.

## Confini

Gli adapter in `architecture/platinum-runtime-adapters.ts` trasformano soltanto dati in view model: non importano client, non effettuano fetch, non autorizzano accessi e non producono valori economici o operativi mancanti.

## Audit prima/dopo

| Funzione | Implementazione precedente | Implementazione runtime | Endpoint/sorgente | Metodo | Side effect | Esito |
|---|---|---|---|---|---|---|
| Sessione | middleware e cookie `bodygate_session` | invariata; shell solo dopo il ramo pubblico | middleware + `/api/auth/me` | GET | validazione utente attivo | Preservata |
| Permesso incassi | `Sidebar` disabilitava Incassi senza `view_payments` | `PlatinumAppShell` riceve lo stesso esito da `useCurrentPermissions` | `/api/auth/me` | GET | cache permessi esistente | Ripristinata |
| Logout | pulsante Sidebar | pulsante shell Platinum | `/api/auth/logout` | POST, payload assente | cookie eliminato e redirect `/login` | Preservata |
| Notifiche | link `/notifications` | icona shell verso `/notifications` | nessuno | navigazione | cambio route | Preservata |
| Dashboard | fetch pagina | fetch pagina + adapter | `/api/dashboard/overview` | GET, `no-store` | polling 30 s | Preservata |
| Bridge Dashboard | incluso nell'overview | incluso nell'overview | `/api/dashboard/overview` | GET | nessuno aggiuntivo | Preservata |
| Reception dati | cinque query Supabase | stesse cinque query | `customers`, `customer_access_logs`, `customer_subscriptions`, `gym_presence` | GET | aggiornamento stato UI | Preservata |
| Bridge Reception | polling fetch | polling fetch | `/api/bridge/status` | GET, `no-store` | polling 5 s | Preservata |
| Realtime Reception | cinque subscription | invariate | canale `reception_dashboard_live` | WebSocket | refresh sulle variazioni | Preservata |
| Ricerca/selezione | dati già caricati non ordinati per il flusso Platinum | filtro locale, selezione e deep link | nessun endpoint aggiuntivo | nessuno | solo stato UI | Preservata/riordinata |

`AppShell` continua a escludere Lab, login, mobile pass, staff mobile e pagine di stampa prima di montare hook o shell operativi. Non contiene stato Bridge: il precedente header mostrava una costante `OPERATIVO`, mentre lo stato reale resta nelle due pagine operative. Il nuovo header usa quindi il valore veritiero `Da verificare` e non sostituisce né elimina una lettura Bridge.

## QA runtime autenticata

Il 19 agosto 2026 sono stati completati due cicli integrali su Dashboard e Reception a 375×812, 390×844, 768×1024, 820×1180, 821×1180, 1024×768, 1440×900 e 1920×1080. L'autenticazione ha usato un token temporaneo creato da `createSessionToken`, normalmente validato dal middleware contro un servizio locale effimero che esponeva unicamente l'utente QA. Token, storage, servizio, script, report e immagini sono rimasti in `/tmp`; nessun bypass è stato introdotto.

Per ciascuno dei 16 controlli route/viewport per ciclo sono stati verificati route finale, shell, breakpoint 820/821, overflow, contenuti above-fold, target della navigazione, console e `pageerror`. Sono stati inoltre osservati direttamente screenshot fold/full-page, drawer mobile, loading, errore, dati parziali, ricerca senza risultati e cliente selezionato.

| Ciclo | Combinazioni | Console error | `pageerror` | Finding finali | Polling Dashboard | Interazioni |
|---|---:|---:|---:|---:|---|---|
| 1 | 16 | 0 | 0 | 0 | 2 richieste in oltre 30 s | conformi |
| 2 | 16 | 0 | 0 | 0 | 2 richieste in oltre 30 s | conformi |

Il primo audit visivo ha rilevato overflow nella griglia Reception tra mobile e il primo pixel desktop e testo dei KPI parziali eccessivamente grande. Sono stati corretti il collasso responsive delle griglie, i vincoli `min-width` e la tipografia dello stato mancante. I due cicli finali, eseguiti integralmente dopo le correzioni, non hanno rilevato regressioni.

La registrazione di rete finale contiene soltanto richieste GET di lettura verso `/api/dashboard/overview`, `/api/bridge/status`, `/api/auth/me` e le quattro sorgenti Supabase elencate; l'unica POST è il logout già esistente, senza payload. Non risultano richieste demo, import del Lab, scritture economiche, operazioni di accesso o comandi hardware.
