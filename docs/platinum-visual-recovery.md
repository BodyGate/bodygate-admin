# Platinum Visual Recovery — Gate 1

Data di certificazione: 19 agosto 2026. Baseline: `293f7254c624d00d331a659dd73cdddfa3824fd0` sul branch locale `work`, inizialmente pulito.

## Causa e golden master

La divergenza era strutturale: il runtime montava correttamente `PlatinumAppShell`, ma la shell distingueva Lab e runtime tramite un booleano e rendeva navigazioni, footer e intestazioni differenti. La Dashboard manteneva inoltre il precedente Command Center (hero dominante, sei KPI nella stessa griglia e CSS globale autonomo) dentro la nuova cornice. La route `/ui-lab/platinum` è rimasta la golden master vincolante e non è stata alterata nei contenuti o nei dati dimostrativi.

## Architettura condivisa

`PlatinumAppShell` è ora la singola composizione per `mode: "lab" | "runtime"`. Brand, sede, stato sistema, operatore, navigazione, azioni header e contenuto sono configurabili senza duplicare markup. Entrambe le modalità condividono brand, sidebar, gruppi, icone Lucide, topbar, profilo, drawer e bottom navigation. Il runtime continua a usare la configurazione `PLATINUM_NAVIGATION`, il permesso `view_payments` e il logout reale; il Lab usa esclusivamente registry e dati dimostrativi.

## Prima e dopo

| Area | Prima | Dopo |
| --- | --- | --- |
| Brand | copia compressa e sottotitolo incoerente | marchio `BG`, `BodyGate` e `PLATINUM` su righe e proporzioni stabili |
| Navigazione | elenco piatto, privo di gerarchia visiva | gruppi nominati, icone, stato attivo e figli collassabili |
| Profilo | logout isolato | profilo fissato in basso con avatar `BG`, operatore, ruolo e logout integrato |
| Topbar | metadati incompleti | titolo, sede veritiera/fallback, stato prudente, notifiche e avatar |
| Hero | titolo legacy dominante | eyebrow, saluto controllato, descrizione breve e azioni responsive |
| KPI | sei card compresse | quattro KPI primari; indicatori rimanenti in pannelli secondari |
| Workspace | Command Center autonomo | pannello ampio per attività, colonna priorità/azioni e sezioni secondarie |

## Dati e funzioni preservati

Sono invariati `GET /api/dashboard/overview`, polling a 30 secondi, refresh manuale, Bridge, tutti i KPI, accessi, accessi negati, blocchi, incassi, alert, certificati e scadenze. I dati assenti restano distinti dallo zero reale. Sono altresì preservati navigazione notifiche, `view_payments`, sessione, ruoli, redirect, middleware e `POST /api/auth/logout`. La QA ha intercettato la sola lettura Dashboard con fixture sanitizzate e non ha inviato scritture.

KPI primari: clienti attivi, ingressi oggi, priorità aperte e incassi oggi. KPI secondari: accessi negati, blocchi attivi, stato Bridge e incassi mensili; le liste mantengono accessi, scadenze abbonamenti e certificati.

## Visual QA comparativa

La QA ha usato `createSessionToken("qa-user", "admin")`, middleware ordinario, servizio Supabase-compatible effimero read-only su `/tmp`, fixture sanificate e Chromium Playwright. Tutti i token, script, log, screenshot e report sono rimasti in `/tmp`. Per ogni viewport sono stati acquisiti `/ui-lab/platinum` a sinistra e `/` a destra dalla stessa build locale; i sedici contact sheet e i due mosaici di ciclo sono stati osservati con `view_image`.

| Viewport | Esito osservato |
| --- | --- |
| 375×812, 390×844 | bottom navigation a cinque destinazioni, hero e azioni impilate, KPI singoli, nessun overflow |
| 768×1024, 820×1180 | solo navigazione mobile; tabelle con scorrimento interno; nessun elemento off-viewport |
| 821×1180 | passaggio netto alla sola sidebar desktop |
| 1024×768 | sidebar, topbar e profilo coerenti; workspace in colonna per mantenere leggibilità |
| 1440×900, 1920×1080 | quattro KPI in riga, workspace principale/laterale e densità Foundation |

### Ciclo 1

I contact sheet hanno confermato la correzione dei finding iniziali: brand non compresso, gerarchia e icone presenti, hero non dominante, quattro KPI, importi non spezzati, profilo e topbar comuni. Il controllo programmatico ha rilevato zero overflow orizzontali, zero errori console, zero `pageerror`, zero redirect inattesi e zero richieste di scrittura. La differenza di lunghezza della pagina Lab dipende dal catalogo ufficiale delle anteprime, mentre il runtime mostra dati operativi: la griglia esterna, le proporzioni e i breakpoint restano comuni.

### Ciclo 2 e certificazione

L’intera matrice è stata riacquisita e riosservata. Non sono ricomparsi finding bloccanti: 820 usa esclusivamente bottom navigation e drawer, 821 esclusivamente sidebar; logo, topbar e profilo restano stabili; nessun importo va a capo e la Dashboard non appare più come Command Center legacy. Le differenze residue sono intenzionali e limitate a contenuto, voci disponibili e lunghezza dei dataset Lab/runtime.

## Audit e rollback

Nessun file sotto `app/api`, middleware, autenticazione, database, pagamenti, Bridge, protocolli accesso o Customers V2 è stato modificato; non sono state aggiunte dipendenze né eliminati file. Non sono state eseguite scritture reali, merge o modifiche a `main`. Non era disponibile una preview Vercel; la preview locale è stata eseguita sulla porta effimera `3100`.

Rollback: applicare il revert, in ordine inverso, dei tre commit del gate. Il rollback ripristina shell e Dashboard precedenti senza migrazioni, modifiche dati o variazioni dei contratti API.
