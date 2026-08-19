# Gate A — Commerciale e amministrazione economica

## Inventario e parità

| Route | Sorgenti e contratti preservati | Autorizzazione / navigazione | Presentazione Platinum |
| --- | --- | --- | --- |
| `/subscriptions` | Query Supabase per clienti, abbonamenti e piani; nessun payload o side effect modificato | Deep link cliente e stato accesso invariati | Page shell, header, KPI, filtri, tabella e stati vuoti tramite facade |
| `/subscriptions/plans` | CRUD piani e validazioni esistenti | Visibilità e redirect invariati | Composizione Platinum e conferme esistenti |
| `/settings/pricing` | Quote associative e prezzi letti/salvati dalle procedure esistenti | Governance impostazioni invariata | Page shell Platinum |
| `/payments` | Pagamenti, ricevute, storni/rimborsi, intervalli, export e stampa invariati | Permesso storico `view_payments` invariato | Page shell Platinum attorno al client operativo |
| `/accounting` | Aggregazioni, movimenti, filtri temporali ed export invariati | Redirect e deep link invariati | Page shell Platinum attorno al client operativo |

## Audit prima/dopo

La migrazione è esclusivamente presentazionale: query, RPC, endpoint, metodi HTTP, payload, idempotenza, numerazione ricevute, transazioni e azioni distruttive restano nei componenti operativi preesistenti. Loading, empty, error e retry restano gestiti dagli stessi client, ora composti mediante la facade pubblica `components/bodygate-ui`.

Non risultano polling o subscription realtime aggiunti. Il rollback consiste nel ripristino delle sole importazioni/composizioni della facade. Il piano annuale in tre rate, le scadenze, l'enforcement e gli access check sono esplicitamente rinviati a una successiva attività backend.
