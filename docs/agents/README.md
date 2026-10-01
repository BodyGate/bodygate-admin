# Agenti automatici BodyGate — pannello di controllo

Questo file è il punto unico di riferimento per i 4 agenti automatici che lavorano su questo repository. Non esiste (al momento) un "progetto" a livello di piattaforma che li raggruppi visivamente nell'interfaccia di claude.ai/Claude Code — questo documento ne fa le veci: è la fonte di verità su cosa fa ciascuno, quando gira e dove trovare il suo lavoro.

Tutti e quattro sono configurati come **Routine schedulate** (non sessioni sempre attive in senso stretto — la piattaforma non supporta un vero processo continuo, solo controlli periodici). Ognuno lavora **sempre su un proprio branch** e **apre solo pull request**: nessuno fa merge o push diretto su `main`, la decisione finale resta sempre a un umano.

## I 4 agenti

| # | Nome | Ruolo | Frequenza | Prefisso branch |
|---|---|---|---|---|
| 1 | **BodyGate: Autoapprendimento (Knowledge Curator)** | Mantiene `docs/agents/bodygate-knowledge-base.md` (architettura tecnica + regole di business) aggiornata con le novità da `main` | Ogni giorno, 02:17 UTC | `agents/knowledge/<data>` |
| 2 | **BodyGate: Cura Grafica UI** | Migra un'area alla volta ai componenti `components/bodygate-ui`, riduce gli stili inline ad-hoc, uniforma i sistemi UI "ombra" | Ogni 6 ore | `agents/ui/<data-ora>` |
| 3 | **BodyGate: Cura Logiche di Business** | Cerca bug concreti in abbonamenti/quote/contratti/ricevute/pagamenti; conservativo sui fix incerti (annota invece di indovinare) | Ogni 6 ore | `agents/logic/<data-ora>` |
| 4 | **BodyGate: Automiglioramento Settimanale** | Rivede l'operato degli altri 3 (PR, review, pattern di errore), aggiorna la sezione "Playbook" della knowledge base, segnala dipendenze da controllare | Ogni settimana, domenica 03:42 UTC | `agents/meta/<data>` |

## Dove vedere cosa stanno facendo

- **Lavoro in corso/completato**: pull request su [BodyGate/bodygate-admin](https://github.com/BodyGate/bodygate-admin/pulls) aperte da uno dei branch `agents/knowledge/*`, `agents/ui/*`, `agents/logic/*`, `agents/meta/*`.
- **Conoscenza accumulata**: [`docs/agents/bodygate-knowledge-base.md`](./bodygate-knowledge-base.md) — architettura, regole di business, e (dalla prima settimana di attività) il playbook con gli errori da evitare.
- **Configurazione/schedulazione**: le Routine sono gestite lato piattaforma (claude.ai), non nel repository — per modificare frequenza o contenuto bisogna passare dalla sessione Claude Code che le ha create.

## Guardrail comuni (validi per tutti e 4)

- Mai push diretto su `main`, mai merge automatico, mai force-push.
- Ogni PR è piccola e mirata a un solo problema/area — niente refactoring a tappeto in un colpo solo.
- Nessuno tocca il dominio di un altro (grafica non tocca logica di business, logica non tocca stile).
- Sulle operazioni che toccano soldi/contratti (agente "Cura Logiche di Business"), un dubbio non certo diventa un'annotazione nella PR, mai un fix indovinato.
- Se un agente non trova nulla di valido da proporre in un'esecuzione, non apre PR vuote o cosmetiche — resta silenzioso fino al giro successivo.

## Note tecniche

Gli strumenti GitHub (`mcp__github__*`) non sono sempre caricati di default nelle sessioni lanciate dalle Routine: ogni agente ha istruzioni per caricarli esplicitamente via `ToolSearch` prima di usarli, con un fallback (push del branch + nota finale) se risultassero comunque non disponibili, così il lavoro resta comunque visibile su GitHub anche senza PR aperta automaticamente.
