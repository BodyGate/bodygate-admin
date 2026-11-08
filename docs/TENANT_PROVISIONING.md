# Creare una nuova palestra (tenant)

Strumento: `scripts/tenant/provision-tenant.mjs` (`npm run tenant:provision`).
Parte dal modello proposto in `docs/adr/0001-multi-tenancy.md` (un database per
palestra) ma serve anche per creare ambienti di prova e di staging.

## Cosa fa
Su un database PostgreSQL/Supabase **vuoto**:
1. rifiuta di procedere se esiste gia' `public.customers`;
2. applica la baseline (`supabase/baseline/01..05`), crea la sede, le impostazioni
   della quota associativa, l'utente amministratore (password con hash bcrypt) e
   il suo profilo staff **in un'unica transazione**: se qualcosa fallisce non resta
   nulla e il database vuoto si puo' riutilizzare subito;
3. (compreso nel punto 2)
4. verifica 66 tabelle, RLS attiva ovunque, nessun privilegio a `anon` o
   `authenticated`, 1 sede e 1 amministratore;
5. stampa i segreti nuovi per la palestra (`BODYGATE_SESSION_SECRET`,
   `BODYGATE_MACHINE_KEY`) e l'elenco delle variabili da impostare.

Non crea il progetto Supabase ne' il deploy: quelli restano passaggi manuali.

## Uso
```bash
# 1. prova senza modificare nulla
npm run tenant:provision -- --dry-run --name "Palestra Rossi" --admin-email titolare@example.com

# 2. creazione di un centro con due sedi (l'URL non resta nella cronologia della shell)
TENANT_DATABASE_URL='postgresql://...' \
  npm run tenant:provision -- --name "Centro Rossi" \
    --branch-name "Sede Centro" --branch-name "Sede Nord" \
    --admin-email titolare@example.com --admin-name "Mario Rossi"

# Senza --branch-name si crea una sola sede con il nome del centro.

# 3. con i listini di ogni sede (vedi scripts/tenant/listini.example.json)
TENANT_DATABASE_URL='postgresql://...' \
  npm run tenant:provision -- --name "Centro Rossi" \
    --branch-name "Sede Centro" --branch-name "Sede Nord" \
    --admin-email titolare@example.com --plans-file listini.json
```
Se non si passa `--admin-password` (o `TENANT_ADMIN_PASSWORD`) ne viene generata
una da 20 caratteri, mostrata una sola volta. Richiede `psql` installato.

## Listini in fase di installazione (`--plans-file`)
File JSON con due elenchi, entrambi opzionali:
- `plans`: `branch`, `category`, `name`, `price`, `duration_days` obbligatori;
  `description`, `promo_price`, `sort_order` facoltativi. Le categorie si creano da sole,
  **per sede**. La stessa voce puo' esistere in sedi diverse con prezzi diversi.
- `membership_fees`: prezzo e validita' (giorni) della quota associativa di ogni sede;
  senza questa voce restano i valori predefiniti (10 euro, 365 giorni).

Il file e' validato prima di toccare il database (sede esistente, prezzi e durate
sensati, nessun duplicato) e caricato nella **stessa transazione** della baseline: se
qualcosa non va non resta nulla. L'intero file passa come una sola variabile psql, senza
concatenare valori nell'SQL. La verifica finale controlla che i piani creati siano tanti
quanti quelli del file.

## Passi manuali dopo lo script
1. Creare il progetto Supabase **prima** (regione scelta per la palestra) e
   prenderne l'URL del database; abilitare le estensioni `pgcrypto`,
   `uuid-ossp`, `btree_gist` se non lo sono.
2. Creare il deploy dell'app con le variabili stampate dallo script e il dominio
   della palestra.
3. Installare il bridge hardware in sede con la `BODYGATE_MACHINE_KEY` della
   palestra (oggi manuale, vedi `docs/OPERATIONS.md`).
4. Se non si e' usato `--plans-file`, configurare piani e categorie abbonamento dall'app.
5. Accedere come amministratore e verificare Clienti, Pagamenti e Reception.

## Verifica
`tests/tenantProvision.test.mjs`: 8 test sempre attivi (validazione, password e
segreti, SQL senza concatenazioni) e 1 di integrazione (include un guasto simulato a meta' baseline con rollback e nuovo tentativo) che gira se
`TENANT_TEST_DATABASE_URL` punta a un PostgreSQL vuoto con i ruoli
`anon`/`authenticated`/`service_role` e gli schemi `extensions`/`realtime`/`storage`
(su Supabase esistono gia'). Provato su PostgreSQL 16: creazione, dati corretti,
password cifrata, rollback completo dopo un guasto a meta' e rifiuto del lancio su un database non vuoto.

## Limiti noti
- Il cambio password esiste (`/settings/password`, icona della chiave accanto al logout): serve la
  password attuale e la nuova ha almeno 12 caratteri. **Manca il recupero** se si dimentica la
  password (nessun invio di email): oggi lo si fa a mano sul database con un nuovo hash.
- Non c'e' ancora un registro dei tenant ne' un comando che applichi le nuove
  migrazioni a tutti i database: sono i passi successivi dell'ADR.
- Un centro con piu' sedi si crea, ma l'applicazione non sa ancora gestirle davvero
  (sede attiva, accessi per sede, personale per sede): vedi la sezione "Un centro
  con piu' sedi" in `docs/adr/0001-multi-tenancy.md`.
- La matrice ruoli del seed e' quella di produzione (vedi
  `docs/SECURITY_HOTFIX_0_4.md`): rivederla prima di creare account per operatori.
