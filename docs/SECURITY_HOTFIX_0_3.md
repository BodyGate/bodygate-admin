# BodyGate HOTFIX 0.3 — riattivazione cliente al rinnovo abbonamento

## Scopo

La HOTFIX 0.3 elimina un bug per cui un cliente disattivato restava bloccato
al varco ("Cliente non attivo") anche dopo aver pagato un rinnovo valido,
finché qualcuno non lo riattivava a mano da "Modifica cliente".

## Caso reale

Cliente Fabio Ciaramitaro (badge 292002): abbonamento, certificato medico e
quota associativa tutti validi, ma scheda cliente con "Non può entrare" /
"Cliente disattivo". Timeline: rinnovo pagato il 17/09/2026 alle 17:34:13
(abbonamento marcato `ATTIVO`), ma un tentativo di accesso un minuto dopo
(17:35:01) è stato negato con motivo "Cliente non attivo". Anche i tentativi
di firma contratto successivi (17:42–17:43) segnalavano "pagamento mancante"
pur essendo il pagamento già registrato.

## Causa

`app/api/access/check/route.ts` nega l'accesso con `reason: "Cliente non
attivo"` se `customers.is_active === false`, un controllo che avviene prima
di qualsiasi verifica su abbonamento/quota/certificato (riga ~435). La RPC
`renew_subscription_atomic_v1` (HOTFIX 0.2), in fase di rinnovo, aggiornava
solo `customer_subscriptions.is_active`, mai `customers.is_active` — quindi
un cliente disattivato (es. dopo una lunga scadenza, o disattivazione
manuale) restava bloccato indipendentemente da quanti rinnovi pagasse.

## Fix

`renew_subscription_atomic_v1` (ridefinita via `create or replace function`,
stessa firma) ora, subito dopo aver creato il nuovo abbonamento, verifica se
il cliente non è `is_active`/`active` e in quel caso lo riattiva:

- `customers.is_active = true`
- `customers.active = true`
- `customers.status`: `onboarding` → `active` (altri valori invariati)
- riga in `customer_timeline` ("Cliente riattivato") per tracciabilità

Nessuna altra parte della funzione è cambiata (pagamento, ricevuta,
idempotenza, numerazione, locking).

## Correzione dati una tantum

Il cliente Fabio Ciaramitaro (id `c28b3d99-599e-4fbe-9c47-4f3007ada137`) è
stato riattivato manualmente in produzione il 17/09/2026, perché il suo
rinnovo era avvenuto prima del deploy di questa hotfix e quindi non ne ha
beneficiato retroattivamente.

## Verifica eseguita

- Migration applicata al progetto Supabase live (`ldaptjbodqvtdzbrfsii`);
- controllo advisory di sicurezza post-migration: nessun nuovo finding
  introdotto rispetto a prima (i finding esistenti — RLS senza policy su
  tabelle di archivio/appoggio, `nextval_dnake_user_id` eseguibile da
  `authenticated` — sono preesistenti e non collegati a questa funzione);
- verifica visiva in scheda cliente: badge passati da "Non può entrare /
  Cliente disattivo" a "Può entrare / Attivo / Cliente attivo".

Non è stato eseguito un rinnovo di test reale per non generare pagamenti e
ricevute fittizie sui dati di produzione: la correzione logica è stata
verificata leggendo il piano di esecuzione della funzione e confermando lo
stato finale del cliente già corretto manualmente.

## File

- `scripts/sql/security-hotfix-0-3-reactivate-customer-on-renewal.sql`

## Fuori perimetro

Non toccati da questa hotfix:

- l'incongruenza codice fiscale/nome sul profilo di Fabio Ciaramitaro
  (`CRMFBA95E66G273W` codifica sesso femminile nel giorno di nascita,
  cliente di nome Fabio, campo "Sesso" vuoto) — segnalata, non corretta:
  serve sapere quale dato è quello corretto;
- access control, Mobile Pass, Bridge, hardware;
- ricevute e numerazione storica.
