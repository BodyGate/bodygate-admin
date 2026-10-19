# DNake: rimessa in servizio e alleggerimento del meccanismo

Causa del blocco di ottobre 2026: il bridge scaricava ogni 100 ms l'intero file
`/data/unlock_sql.db` del DNake (centinaia di KB, mai potato). Oltre ~284 KB
(290816 byte) il mini_httpd del DNake lo consegna troncato, SQLite lo vede
"malformed" e nessun badge viene piu' letto. Il DNake non e' un database server:
va tenuto **piccolo** e **poco interrogato**. BodyGate e' il registro storico.

## Principi

1. **BodyGate e' il sistema di registro** (`customer_access_logs`, `access_logs`,
   `unknown_badge_logs`). Il registro del DNake serve solo a far funzionare il
   tornello e puo' essere svuotato senza perdere storico.
2. **Il DNake non si interroga piu' del necessario**: niente download completo
   ogni 100 ms. Meta' del carico sparisce con l'evento push (fase 3) o, nel
   frattempo, con polling rado.
3. **Nessun cambio in produzione senza prova**: ogni fase ha un criterio di
   accettazione e un rientro (rollback) immediato.
4. **Soglie e allarmi prima del blocco**: avviso al 70 % del limite, urgente al
   90 %, critico se il polling si ferma (gia' in `bridgeHealth.ts` e dashboard).

## Fase 0 - Prove sul DNake nuovo (192.168.1.58), ancora vuoto, senza toccare la produzione

Da eseguire e annotare l'esito (si/no) di ciascuna:

- [ ] Cambiare subito le password predefinite (Sistema e Web) e annotarle in un
      posto sicuro; non lasciare `888888` / `123456`.
- [ ] Annotare versione firmware e **bloccare gli aggiornamenti**: ogni update
      va provato prima su banco (vedi fase 0 punto finale).
- [ ] Pagina "Evento HTTP": impostare l'URL di *Valid Card* verso un ricevitore
      di prova (PC reception, porta libera) e passare un badge: **il payload
      contiene il numero del badge?** (si/no; nome del parametro).
- [ ] Idem per *Invalid Card* e *Valid/Invalid Code*, *QR*.
- [ ] Il DNake attende la risposta HTTP? Quanto timeout? (rispondere in < 1 s)
- [ ] Svuotare i registri dal pannello e verificare **dimensione del file**
      `unlock_sql.db` prima/dopo (HEAD o download): scende davvero?
- [ ] Esportare la configurazione (backup) e conservarla.
- [ ] Orario/NTP corretto (i log hanno data e ora del DNake).
- [ ] Dopo gli aggiornamenti firmware: ripetere i test sopra prima di produrre.

Esito decide il piano:

- **Il payload contiene il badge** -> piano A (evento push, fasi 1-3).
- **Non lo contiene** -> piano B: il bridge controlla solo se il file e'
  cambiato (HEAD / dimensione / ETag) ogni 200-300 ms e scarica solo in quel caso
  (mai 1-2 s: aggiungerebbe attesa a ogni apertura);
  pulizia notturna come sotto.

## Dal manuale DNAKE AC02 V2.0 (dnake-global.com)

- Accesso > Controllo accessi > "Tipo di archiviazione log": sovrascrittura
  circolare / **elimina vecchi log periodicamente (10-86400 min)** / elimina
  log in un orario specificato. Il DNake sa potare da solo i propri log.
- Capacita' dichiarata: 100000 log; la sovrascrittura circolare scatta solo li',
  molto oltre il limite di ~284 KB: NON basta. Usare l'eliminazione periodica.
- "Autenticazione intervallo": un utente apre una sola volta per periodo (0-65535).
- "Modalita' lettura carta" (default / numero completo), "ordine" (normale /
  invertito), "visualizzazione" (esadecimale / decimale): cambiano il numero
  badge visto da BodyGate -> fissarli e provare prima di importare i clienti.
- Evento HTTP (Avanzate 6.1): "il dispositivo invia l'URL corrispondente quando
  si verifica uno degli eventi"; il manuale NON documenta i parametri.
- Sistema: backup/ripristino, aggiornamento firmware, ripristino di fabbrica,
  riavvio, cattura pacchetti/log. Password web predefinita 123456.

## Velocita' di apertura (vincolo, non optional)

- Obiettivo: badge -> tornello aperto, p95 < 1 s e non peggio dell'attuale.
  Misurare PRIMA il riferimento sul sistema attuale (timestamp: lettura badge,
  risposta di /api/access/check, chiamata /open0) e rimisurare a ogni fase.
- Il DNake riceve risposta subito; l'apertura e' asincrona.
- L'apertura non aspetta i salvataggi: prima decisione e /open0, poi log.
- Se la verifica su Supabase pesa, cache locale degli abbonamenti attivi.
- Se gli eventi non arrivano, il polling veloce riprende da solo (rientro).
- Fase 0: verificare se il DNake nuovo puo' aprire da solo per i badge in
  memoria (piu' veloce) e se e' compatibile con il controllo scadenze.

## Fase 1 - Rafforzare il server BodyGate (nessun impatto sul DNake)

- `/api/dnake/event`: chiave dedicata nell'URL (distinta da
  `x-bodygate-machine-key`, che il DNake non sa inviare), segreti oscurati nei
  log, anti-doppione per badge (~3 s), limite di frequenza per chiave e non per IP.
- Rispondere al DNake subito; elaborare l'apertura senza attese lunghe.
- Heartbeat dell'ultimo evento + allarme "nessun evento da 90 min in orario di
  apertura".
- Modalita' ombra: registrare gli eventi ma non aprire.

## Fase 2 - Una settimana in ombra

Polling attuale (rado) e push insieme: confrontare ogni badge. Criterio: 0
badge persi dal push, latenza < 1 s, nessun errore sul DNake.

## Fase 3 - Passaggio

Attivare l'apertura da evento, lasciare il polling come rientro (flag), pulizia
automatica (sotto), verificare 48 ore con controllo manuale in reception.

## Pulizia notturna del DNake

BodyGate e' il registro: il DNake si svuota ogni notte (palestra chiusa) e
resta di circa un giorno di eventi, molto sotto il limite.

1. Solo i registri accessi: utenti, badge e configurazione non si toccano
   (mai ripristino di fabbrica).
2. Riconciliazione PRIMA di cancellare: ogni riga del registro DNake deve
   essere gia' su BodyGate; le mancanti si importano. Se non si riesce, NON si
   cancella e parte un avviso.
3. Verifica DOPO: dimensione del file scesa, polling sano. Altrimenti avviso
   prima dell'apertura mattutina.
4. Ripetizione e avviso in caso di errore; soglie 70 %/90 % restano come rete
   di sicurezza durante il giorno.
5. Prerequisito fase 0: la cancellazione deve ridurre davvero il file (sul
   vecchio DNake la tabella non si riduceva). Se no: riavvio programmato o
   azzeramento da pannello. Procedura: `scripts/dnake-clear-unlock-logs.ps1`
   (conferma `CANCELLA`), poi controllo manuale con un badge.
6. SQLite non rimpicciolisce il file dopo le cancellazioni: verificare.

## Messa in servizio (ordine)

1. Fase 0 completata e riportata.
2. Bridge aggiornato con IP/credenziali configurabili (`BODYGATE_DNAKE_IP`,
   `BODYGATE_DNAKE_USER`, `BODYGATE_DNAKE_PASSWORD`) e limiti
   (`BODYGATE_DNAKE_DB_LIMIT_BYTES`); oggi IP e credenziali sono ancora fissi
   nel codice (`192.168.1.22`, `admin/888888`).
3. Controllo con badge di prova; pulsante di apertura manuale sempre disponibile.
4. Fasi 1-3 e manutenzione.

## Appunti: tutte le modifiche da fare (stato al 19 ottobre 2026)

Legenda: [x] fatto e inviato, [ ] da fare.

### Fatto
- [x] Bridge V3.9.4: lettura parziale del file troncato, allarmi, backoff, uscita se il polling si blocca.
- [x] Auto-riparazione: watchdog, launcher che non si ferma se manca l'exe/chiave.
- [x] Dashboard reception: avviso "Lettura badge ferma" / "Preavviso registro DNake" (`bridgeHealth.ts`, 9 test).
- [x] Script `dnake-clear-unlock-logs.ps1` (con `-Diagnose`) e documentazione in `OPERATIONS.md`.
- [x] Questo runbook e la sintesi del manuale DNAKE.

### Sul DNake nuovo (192.168.1.58), prima della messa in servizio
- [ ] Cambiare password Sistema e Web (predefinite `888888` / `123456`).
- [ ] Annotare firmware, bloccare aggiornamenti, esportare la configurazione.
- [ ] Controllo accessi > Logs Storage Type: **elimina vecchi log periodicamente** (es. 1440 min) e verificare che il file scenda.
- [ ] Authentication Interval a 0 o pochi secondi.
- [ ] Fissare modalita'/ordine/formato del numero carta e provare con un badge.
- [ ] NTP e fuso orario corretti.
- [ ] Prova Evento HTTP: arriva? contiene il numero badge? timeout?

### Bridge
- [ ] IP/credenziali DNake e tornello da variabili d'ambiente (oggi fissi: 192.168.1.22, admin/888888).
- [ ] `BODYGATE_DNAKE_DB_LIMIT_BYTES`, soglie 70 % / 90 %, log giornaliero della dimensione.
- [ ] Controllo leggero (HEAD ogni 200-300 ms, scarico solo se cambia) al posto del download ogni 100 ms.
- [ ] Compilare, testare, aggiornare i pattern degli script build/verify e gli hash.

### Server BodyGate
- [ ] `/api/dnake/event`: chiave dedicata, segreti oscurati nei log, anti-doppione per badge (~3 s), limite per chiave.
- [ ] Allarme "nessun evento da 90 minuti in orario di apertura".
- [ ] Misurare la latenza badge -> apertura (riferimento oggi, p95 < 1 s) e rimisurare a ogni fase.
- [ ] Modalita' ombra e una settimana di confronto prima del passaggio.

### Pulizia sul PC e sicurezza
- [ ] Rimuovere la regola firewall `test-dnake-8089` e fermare il ricevitore di prova.
- [ ] Cambiare la password del portale cloud DNAKE (esposta in chat).
- [ ] Rimuovere cartelle temporanee `sqlite-test` / `dnake-js`.
