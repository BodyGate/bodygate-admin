# Completamento modulo Clienti Platinum

## Inventario e classificazione

| Route filesystem/manifest | Classificazione | Decisione |
|---|---|---|
| `/customers` | schermata operativa da migrare | Platinum runtime, dati reali e contratto `/api/customers/list` preservati |
| `/customers/new` | schermata operativa da migrare | onboarding Platinum; endpoint, idempotenza, upload e provisioning preservati |
| `/customers/[id]` | schermata operativa da migrare | scheda Platinum completa con sezioni e azioni operative preservate |
| `/customers/[id]/edit` | schermata operativa da migrare | shell, header e form Platinum; query e update Supabase preservati |
| `/customers/[id]/contract` | documento contestuale | verificato, non avvolto in una nuova shell per non alterare firma e flusso OTP |
| `/customers/[id]/contract/print` | stampa da preservare | esclusa dalla riscrittura visuale; layout e CSS di stampa invariati |
| `/customers/[id]/receipt/[receiptId]` | route finanziaria da rinviare | deep link verificato; numerazione, query finanziarie e stampa invariati |
| `/v2/customers` | route esclusa | prototipo Customers V2 espressamente fuori scope |
| `/mobile/[token]`, `/pass/[token]` | route escluse | esperienze pubbliche tokenizzate fuori scope |

## Matrice di parità Platinum reale

| Route | Anteprima approvata | Componenti precedenti | Composizione runtime attuale | Parità | Funzioni mancanti | Intervento |
|---|---|---|---|---|---|---|
| `/customers` | `customers` | pagina + `CustomersTable` monolitico | `BGPageShell`, input/status/empty facade, filtri reali, vista desktop e card mobile; adapter riga realmente eseguito | raggiunta per funzioni esistenti | ordinamento/paginazione non esistevano | nessuna nuova logica introdotta |
| `/customers/new` | `customer-new` | onboarding operativo già custom | header, input/select/button Platinum, sezioni responsive e drawer documenti | raggiunta | nessuna | mantenuto il workflow reale invece della bozza demo |
| `/customers/[id]` | `customer-detail`, `customer-documents`, `customer-history` | scheda premium monolitica | card, status, section header e navigazione Platinum; document drawer, timeline, pagamenti e ricevute reali | raggiunta | nessuna rispetto alla scheda preesistente | facade applicata senza spostare fetch o scritture |
| `/customers/[id]/edit` | `customer-edit` | header inline + form HTML inline | shell/header, campi, select, alert e azioni Platinum | raggiunta | nessuna | form migrato realmente, query/payload invariati |

La preview del Lab è stata usata soltanto come riferimento visuale. Il runtime non importa `preview-content.ts`, registry demo o componenti interni del Lab.

## Completezza e contratti preservati

- **Elenco:** GET reale, filtri server, ricerca, selezione, dettaglio, nuovo cliente, loading, empty, errore e retry restano attivi.
- **Nuovo:** tutti i campi e consensi preesistenti, validazioni, `Idempotency-Key`, `/api/customers/create-platinum`, upload successivi, provisioning Mobile Pass/DNake, prevenzione doppio invio e redirect restano invariati.
- **Scheda:** identità, contatti, stato, abbonamento, quota, certificato, documenti, accessi, pagamenti, ricevute, timeline, note, badge/Mobile Pass e deep link restano collegati alle origini esistenti.
- **Modifica:** SELECT Supabase, precompilazione, payload UPDATE, errori, stato invio, annullamento e redirect restano invariati.
- **Contratto/stampa/ricevuta:** URL, query, layout di stampa, OTP, numerazione e logica finanziaria non sono stati modificati.

## Registro visual QA

Il protocollo visuale usa sessione firmata tramite `createSessionToken`, middleware ordinario, servizi QA locali effimeri e intercettazione delle scritture; storage state e immagini devono restare esclusivamente in `/tmp`. Nessun dato personale o segreto entra nei report.

| Ciclo | Route/viewports/stato | Difetto osservato | Correzione | Esito |
|---|---|---|---|---|
| 1 | quattro route operative a 390×844, 820×1180, 821×1180 e 1440×900 con dataset QA locale | il form modifica conservava controlli HTML inline; onboarding eccedeva il viewport di 13 px a 390 e 70 px nella soglia 821; il primo stub detail era bloccato da CORS | campi/select/alert/pulsanti spostati sui componenti Platinum; adapter riga collegato all'elenco; contenitori e riepilogo onboarding resi shrink-safe | immagini osservate; correzioni applicate, dettaglio da ripetere con CORS locale |
| 2 | onboarding e dettaglio ripetuti a 390×844, 820×1180, 821×1180 e 1440×900; contratto, stampa e deep link ricevuta a 1440×900 | overflow onboarding alla soglia 821 e CORS del servizio QA | griglie a due colonne shrink-safe sotto 1100, colonna singola sotto 720; CORS abilitato soltanto nel servizio effimero `/tmp` | zero overflow e zero errori console/pageerror sulle due schermate ripetute; contratto e stampa osservati invariati; ricevuta senza fixture finanziaria resta non validata, quindi il ciclo integrale non è dichiarato completo |

Il redirect a `/login` non viene considerato una prova visuale. Un ciclo è completo soltanto dopo osservazione delle immagini autenticate con `view_image`, controllo overflow/console/focus e intercettazione delle scritture senza inoltro al backend.

## Certificazione finale del secondo ciclo

Il ciclo definitivo ha verificato **45 combinazioni**: le quattro schermate operative in tutti gli otto viewport richiesti (32), contratto, stampa e ricevuta nei quattro viewport documentali (12), più la stampa con media `print` (1). Le 32 combinazioni operative hanno prodotto zero overflow, zero elementi oltre il viewport, zero `pageerror` e nessun errore applicativo in console. La segnalazione di hydration osservata una volta proveniva dallo stile temporaneo del cursore applicato dal browser di cattura e non dal markup del runtime.

Contratto e stampa conservano intenzionalmente il foglio A4 fisso: nei viewport da 390 e alla soglia 821 la vista schermo è scorrevole orizzontalmente, mentre il media `print` a 1440×900 non presenta overflow e nasconde correttamente i controlli. Questo comportamento preesistente è stato preservato per evitare regressioni del formato documentale.

La ricevuta è stata verificata con fixture esclusivamente effimera in `/tmp`: cliente `qa-customer`, ricevuta `qa-receipt`, numero dimostrativo `QA-2026-000042`, data 3 febbraio 2026, causale QA e totale €123,45. La route, le due copie, il formato del numero, la data, il totale, il pulsante di stampa e il deep link `← Torna al cliente` sono stati osservati. Nessuna RPC, numerazione reale, persistenza o scrittura finanziaria è stata invocata.

Le immagini osservate comprendono tutte le schermate operative a 390×844, 821×1180 e 1440×900, la validazione del nuovo cliente, il cliente con dati parziali e certificato scaduto, contratto, stampa a schermo, stampa con media `print` e ricevuta completa. Tutti i token, fixture, servizi, script, report e screenshot QA sono rimasti fuori dal repository e sono stati rimossi da `/tmp` al termine.
