# Lettura badge DNake: progetto di ripristino e messa in servizio

Stato: bozza per approvazione, 19 ottobre 2026. Proprietario: gestione BodyGate.

## 1. Obiettivo e requisiti

Rimettere in servizio il DNake in modo che il tornello legga i badge in modo
stabile nel tempo, senza interventi manuali.

| Requisito | Valore da rispettare | Come si verifica |
|---|---|---|
| Velocita' di apertura | badge -> tornello aperto, p95 < 1 s e non peggio dell'attuale | timestamp a ogni passo, misurati prima e dopo |
| Carico sul DNake | nessun download completo continuo; file sempre sotto il 70 % del limite | dimensione file nei log del bridge |
| Registro storico | tutti gli accessi su BodyGate; il DNake e' solo un buffer | confronto giornaliero DNake/BodyGate |
| Continuita' | se qualcosa si ferma: avviso in dashboard e Telegram/ntfy, apertura manuale sempre disponibile | prova di guasto simulata |
| Sicurezza | niente password predefinite, chiave dedicata per gli eventi, segreti non nei log | revisione a fine fase |

## 2. Cosa e' accaduto (verificato)

- Dall'8 ottobre 2026 i badge non vengono letti.
- Causa: il server web del DNake consegna `unlock_sql.db` troncato a 290816 byte
  quando il file e' piu' grande (era 318464); SQLite lo giudica corrotto.
- Il bridge scaricava il file intero ogni 100 ms e i registri non venivano mai
  potati. "Elimina tutto" dal pannello rispondeva "riuscito" ma il file non
  si riduceva.
- Il bridge risultava "online" perche' rispondeva anche senza leggere badge.

## 3. Decisione di progetto

1. **BodyGate e' il registro**; il DNake e' un buffer di breve durata.
2. **Il DNake pota da solo i suoi log** con la funzione nativa (manuale AC02:
   Accesso > Controllo accessi > Tipo di archiviazione log > elimina vecchi log
   periodicamente, 10-86400 min). Nessuno script di cancellazione notturno
   come meccanismo principale.
3. **Il bridge non scarica piu' il file di continuo**: controllo leggero della
   dimensione/ETag (HEAD) ogni 200-300 ms, scarico solo se cambia.
4. **Evento HTTP del DNake: opzione, non base.** Si adotta solo se la prova
   dimostra che arriva con il numero badge. Fino ad allora non e' nel percorso
   critico.
5. **Allarmi sulla salute reale** (non solo "il bridge risponde").

Quello che NON si fa: affidare l'apertura a una funzione non provata.

## 4. Ipotesi da provare (non ancora verificate)

| # | Ipotesi | Se falsa |
|---|---|---|
| H1 | L'eliminazione periodica dei log riduce davvero il file `unlock_sql.db` | riavvio programmato o azzeramento dal pannello; in ultimo, script con login API (formato login ancora ignoto) |
| H2 | Il file risponde a HEAD con una dimensione/ETag affidabile | controllo ogni 1 s con download breve; rivedere la latenza |
| H3 | L'Evento HTTP contiene il numero badge | resta il solo controllo del file |
| H4 | Numero badge stabile con le impostazioni di lettura fissate (modalita', ordine, formato) | riallineare i badge dei clienti |
| H5 | Autenticazione intervallo a 0 non blocca passaggi ripetuti | regolare |
| H6 | Il firmware nuovo non ha il limite di 284 KB | il limite resta: i log restano piccoli comunque |

## 5. Piano a fasi con criteri

Ogni fase ha un'uscita verificabile e un rientro. Non si passa alla successiva
senza il criterio soddisfatto.

**Fase 0 - Prove sul DNake nuovo (192.168.1.58), fuori produzione**
- Fare: H1-H5; cambiare password; annotare firmware; esportare configurazione;
  NTP e fuso orario.
- Uscita: tabella delle ipotesi compilata con esito e prova (dimensioni file,
  screenshot, log).
- Rientro: nulla da ripristinare, il DNake non e' in produzione.

**Fase 1 - Bridge e server (senza toccare il tornello)**
- Bridge: IP/credenziali da variabili d'ambiente; limite e soglia unica al 70 %;
  controllo leggero; log giornaliero della dimensione.
- Server: `/api/dnake/event` con chiave dedicata, anti-doppione, segreti
  oscurati; allarme se non arrivano eventi.
- Uscita: test automatici verdi; misura della latenza di riferimento sul
  sistema attuale.
- Rientro: versione precedente del bridge (V3.9.4) conservata.

**Fase 2 - Una settimana in parallelo**
- Il DNake nuovo e' collegato in sola lettura; si confrontano ogni giorno i
  suoi registri con BodyGate.
- Uscita: zero badge persi, latenza nel requisito, file del DNake sotto la
  soglia dopo la potatura.

**Fase 3 - Passaggio**
- Spostare il bridge sul DNake nuovo con apertura manuale presidiata per 48 ore.
- Uscita: 48 ore senza avvisi; confronto registri a zero differenze.
- Rientro: ripristino configurazione precedente e apertura manuale.

## 6. Monitoraggio e manutenzione

- Cruscotto reception: livelli ok / preavviso / critico (`bridgeHealth.ts`).
- Soglia unica al 70 % del limite (290816 byte): segnala che la potatura non funziona; il polling fermo resta l'allarme critico.
- Controllo mensile: dimensione file, ora del DNake, avvisi dell'ultimo mese.
- Aggiornamenti firmware: solo dopo prova su banco e ripetizione della fase 0.
- Backup della configurazione del DNake dopo ogni modifica.

## 7. Rischi

| Rischio | Probabilita' | Impatto | Mitigazione |
|---|---|---|---|
| File del DNake supera il limite | media | tornello fermo | potatura nativa + soglie + avviso |
| Pulizia non riduce il file | media | tornello fermo a distanza | prova H1 prima del passaggio |
| Aggiornamento firmware cambia il comportamento | media | blocco | firmware fissato, prova su banco |
| Credenziali predefinite | alta | accesso non autorizzato | cambio in fase 0 |
| Latenza di apertura peggiora | bassa | disagio clienti | misura e rientro |
| Bridge "online" ma cieco | gia' accaduto | tornello fermo | allarme su salute reale |

## 8. Stato lavori

Fatti: bridge V3.9.4 con lettura parziale e allarmi; auto-riparazione;
avviso in dashboard; script di pulizia e documentazione operativa.

Da fare: fase 0 sul DNake nuovo; configurazione del bridge; rafforzamento
`/api/dnake/event`; misura della latenza; pulizia sul PC (regola firewall
`test-dnake-8089`, cartelle temporanee, password del portale cloud).

## 9. Riferimenti

- Manuale DNAKE AC02 V2.0: pagina Web > Accesso > Controllo accessi (tipo di
  archiviazione dei log, modalita' lettura carta, autenticazione intervallo),
  Avanzate > Evento HTTP, Sistema (backup, firmware, riavvio).
- `docs/OPERATIONS.md`: auto-riparazione, database troncato, svuotamento log.
