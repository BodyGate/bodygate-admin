# Gate C — Comunicazioni e direzione

## Inventario e parità

| Route | Dati e comportamento preservati | Presentazione Platinum |
| --- | --- | --- |
| `/notifications` | Query, stato letto/non letto, collegamenti, refresh e permessi invariati | Page shell dalla facade pubblica |
| `/analytics` | Aggregazioni, KPI, filtri, date ed export invariati | Page shell e header dalla facade pubblica |

## Audit prima/dopo

La composizione Platinum non altera query, endpoint, metodi, payload, redirect, polling, side effect o azioni. I client continuano a distinguere il valore numerico zero dal dato non disponibile e non sono state inventate metriche. Loading, empty, error, dati parziali e retry conservano il comportamento operativo precedente. Nessuna subscription realtime è stata aggiunta. Rollback: ripristino delle sole importazioni della facade.
