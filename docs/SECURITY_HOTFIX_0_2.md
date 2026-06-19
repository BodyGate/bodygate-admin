# BodyGate HOTFIX 0.2 — rinnovi atomici e idempotenti

## Scopo

La HOTFIX 0.2 elimina il rischio di doppio rinnovo osservato nel caso Matteo
Ragonese, senza modificare ricevute storiche o dati reali.

Il flusso precedente eseguiva separatamente:

1. numerazione ricevuta;
2. disattivazione abbonamenti;
3. inserimento abbonamento;
4. `customer_payments`;
5. `payments`;
6. timeline;
7. ricevuta.

Un retry o un secondo invio poteva quindi creare un secondo flusso completo.

## Nuova garanzia

La route `/api/customers/renew-subscription` delega tutto alla RPC
`renew_subscription_atomic_v1`.

La RPC:

- lavora in una sola transazione PostgreSQL;
- usa una chiave di idempotenza;
- serializza rinnovi identici e rinnovi dello stesso cliente;
- riusa il risultato precedente per la stessa chiave;
- blocca richieste identiche ripetute entro dieci minuti anche con chiavi diverse;
- genera il numero ricevuta dentro la stessa transazione;
- annulla anche l'incremento del contatore se una fase fallisce;
- crea un solo abbonamento, un solo `customer_payment`, un solo `payment`,
  una sola timeline e una sola ricevuta.

## Compatibilità UI

La UI esistente disabilita già il pulsante mentre `renewalSaving` è attivo e
mostra “Rinnovo in corso…”. La protezione autorevole è ora server/database,
quindi resta efficace anche in caso di retry, timeout, doppio invio o più
istanze Vercel.

I client aggiornati possono inviare:

```http
Idempotency-Key: <chiave 16-180 caratteri>
```

oppure `idempotency_key` / `operation_id` nel JSON.

I client legacy senza chiave ricevono una chiave server e sono comunque
protetti dalla finestra antifrode di dieci minuti basata sull'hash della richiesta.

## Sicurezza

- RPC `SECURITY DEFINER` con `search_path = public, pg_temp`;
- `EXECUTE` soltanto a `service_role`;
- tabella tecnica con RLS attiva;
- nessun accesso per `anon` o `authenticated`;
- `service_role` ha soltanto lettura diretta della tabella;
- nessuna riapertura dei privilegi chiusi dalla HOTFIX 0.1.

## File

- `app/api/customers/renew-subscription/route.ts`
- `scripts/sql/security-hotfix-0-2-subscription-renewal.sql`
- `scripts/sql/security-hotfix-0-2-backup-read-only.sql`
- `scripts/sql/security-hotfix-0-2-verify-read-only.sql`
- `scripts/sql/security-hotfix-0-2-rollback.sql`

## Ordine di rilascio

1. merge della PR;
2. backup metadata read-only;
3. applicazione migration;
4. verifica `hotfix_ok = true`;
5. smoke test applicativo;
6. nessuna rettifica Matteo in questa fase.

Durante la breve finestra tra deploy applicativo e migration, la route risponde
con `503 HOTFIX_0_2_MIGRATION_REQUIRED` invece di usare il vecchio flusso non
atomico.

## QA richiesto

- build Next.js;
- typecheck;
- SQL review;
- verifica privilegi;
- primo rinnovo reale controllato;
- retry con stessa chiave: stessi ID e stessa ricevuta;
- retry con chiave diversa ma payload identico entro dieci minuti: replay;
- stessa chiave con payload diverso: `409`;
- nessun consumo manuale della RPC ricevute.

## Fuori perimetro

Non sono modificati:

- Matteo Ragonese;
- ricevute già emesse;
- numerazione storica;
- layout A4;
- access control;
- Mobile Pass;
- Bridge;
- DNake;
- KT02.3;
- tornello;
- `cash_movements`;
- prima nota.
