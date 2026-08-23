# Platinum Page System

Il sistema contiene 40 anteprime di presentazione isolate sotto `/ui-lab/platinum`. Il registry è metadato di UI e non controlla autorizzazioni, middleware o logiche operative.

## Decisioni di consolidamento

- **Documenti e certificato medico**, **Storico cliente** e **Modifica cliente** condividono il modello della Scheda cliente e sono presentati come modalità contestuali, non come nuovi domini operativi.
- **Rinnovo abbonamento**, **Scadenze e rinnovi** e **Quota associativa** riusano il workspace commerciale con viste contestuali.
- **Pagamenti**, **Piano rate annuale**, **Scadenziario rate** e **Ricevute** condividono riepiloghi, timeline e piano rate. Il modello in tre fasi è esclusivamente visuale.
- **Credenziali**, **Badge** e **Mobile Pass** condividono il modello credenziale. Non viene creata alcuna anteprima della route pubblica basata su token.
- **Report**, **KPI e andamento**, **Analisi rinnovi** e **Analisi incassi** condividono il workspace direzionale con filtri e modalità diverse.
- Le route tecniche, API, redirect legacy, placeholder, Customers V2 e superfici pubbliche tokenizzate sono escluse.

Tutti i contenuti usano dati locali inventati e mostrano l’avviso di isolamento. L’integrazione con dati, calcoli, pagamenti, accessi e hardware è deliberatamente rinviata.
