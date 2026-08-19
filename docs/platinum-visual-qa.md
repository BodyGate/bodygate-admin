# Platinum Page System — Visual QA

Data: 19 agosto 2026. L’accesso è stato ottenuto con una sessione locale temporanea firmata tramite `createSessionToken`, validata dal middleware contro un servizio locale effimero che esponeva esclusivamente l’utente QA. Sessione, servizio, script, report e immagini erano confinati in `/tmp`; nessun bypass o cambiamento al runtime è stato introdotto.

## Matrice e controlli

Il ciclo 1 ha raggiunto 40 schermate in otto processi separati per dominio, con 200 combinazioni viewport e 340 screenshot. Tutte le schermate sono state verificate a 390×844, 820×1180, 821×1180 e 1440×900. Dashboard, Reception, Elenco clienti, Scheda cliente, Nuovo cliente, Pagamenti, Piano rate annuale, Controllo accessi, Report e Impostazioni sono state verificate anche a 375×812, 768×1024, 1024×768 e 1920×1080, con immagini above-fold/full-page e immagini degli stati interattivi.

Il ciclo 2 ha ripetuto le 200 combinazioni sulle 40 schermate e rigenerato 220 screenshot strategici. Totale dei due cicli: **400 controlli viewport e 560 screenshot**.

In ogni combinazione sono stati controllati URL, titolo, assenza di redirect, breakpoint della navigazione, overflow del documento, elementi oltre viewport, avviso demo, main visibile, console, `pageerror` e richieste browser verso API operative o Supabase. Sulle schermate strategiche sono stati inoltre verificati focus visibile, tastiera, Escape, ritorno focus, tooltip, touch target, drawer mobile, dialog, detail drawer e stati loading/empty/error.

## Osservazione immagini

| Schermata | Viewport/stati osservati nei contact sheet | Ciclo 1 | Ciclo 2 |
| --- | --- | --- | --- |
| Dashboard | 8 viewport; fold/full; menu, dialog, drawer, loading, empty, error | Conforme; metriche generiche rilevate | Conforme dopo correzione |
| Reception | 8 viewport e stati strategici | Conforme | Conforme |
| Elenco clienti | 8 viewport e stati strategici | Conforme | Conforme |
| Scheda cliente | 8 viewport e stati strategici | Saldo privo di unità coerente | Conforme dopo correzione |
| Nuovo cliente | 8 viewport e stati strategici | Conforme | Conforme |
| Pagamenti | 8 viewport e stati strategici | Incasso privo di formato monetario | Conforme dopo correzione |
| Piano rate annuale | 8 viewport e stati strategici | Valori metrici generici | Conforme: € 1.200 / € 650 / € 550 |
| Controllo accessi | 8 viewport e stati strategici | Conforme | Conforme |
| Report | 8 viewport e stati strategici | Conforme | Conforme |
| Impostazioni | 8 viewport e stati strategici | Conforme | Conforme |
| Commerciale | mobile 390×844 e desktop 1440×900 per le cinque schermate | Conforme | Controlli programmatici conformi |
| Servizi | mobile 390×844 e desktop 1440×900 per le cinque schermate | Conforme | Controlli programmatici conformi |

I contact sheet contenevano tutte le immagini strategiche del relativo ciclo e sono stati aperti con `view_image`. Non sono stati rilevati testi tagliati, sovrapposizioni della navigazione o regressioni responsive nel secondo ciclo.

## Difetti e correzioni

- Il controllo qualitativo iniziale ha rilevato contenuti e azioni troppo generici: è stato aggiunto un dataset di presentazione specifico per ciascuna delle 40 schermate.
- Drawer mobile e detail drawer non garantivano Escape e ritorno focus: sono stati aggiunti gestione tastiera, focus iniziale e ripristino del trigger.
- Il controllo notifiche non esponeva un tooltip verificabile: è stato aggiunto un tooltip accessibile su hover/focus.
- Il primo ciclo ha evidenziato valori metrici senza unità appropriate in viste economiche e temporali: sono stati introdotti importi, percentuali e orari coerenti.
- Due segnalazioni automatiche non erano difetti dell’applicazione: il pulsante dei Next.js Dev Tools è stato escluso dal controllo touch target e gli elementi interni a una tabella mobile scrollabile dal controllo delle aree oltre viewport. Il documento non presentava overflow.

Entrambi i riepiloghi finali riportavano zero errori console, zero `pageerror`, zero richieste browser a API operative o Supabase e zero finding residui.
