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
  cambiato (HEAD / dimensione / ETag) ogni 1-2 s e scarica solo in quel caso;
  pulizia notturna come sotto.

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

## Pulizia del DNake (manutenzione)

- Soglie: preavviso al 70 %, urgente al 90 % del limite (290816 byte).
- Prima di ogni pulizia: verificare che gli accessi siano gia' su BodyGate
  (ultimo accesso salvato recente), poi svuotare (`scripts/dnake-clear-unlock-logs.ps1`,
  conferma `CANCELLA`), poi controllare la dimensione del file e che il tornello
  legga ancora un badge di prova.
- Frequenza: settimanale o a soglia; mai a tornello in uso.
- Nota: SQLite non rimpicciolisce il file dopo le cancellazioni; se la
  dimensione non scende, serve un ripristino/azzeramento dal pannello (da
  verificare in fase 0).

## Messa in servizio (ordine)

1. Fase 0 completata e riportata.
2. Bridge aggiornato con IP/credenziali configurabili (`BODYGATE_DNAKE_IP`,
   `BODYGATE_DNAKE_USER`, `BODYGATE_DNAKE_PASSWORD`) e limiti
   (`BODYGATE_DNAKE_DB_LIMIT_BYTES`); oggi IP e credenziali sono ancora fissi
   nel codice (`192.168.1.22`, `admin/888888`).
3. Controllo con badge di prova; pulsante di apertura manuale sempre disponibile.
4. Fasi 1-3 e manutenzione.
