# Gate B — Accessi operativi

## Inventario e parità

| Route | Contratti preservati | Presentazione Platinum |
| --- | --- | --- |
| `/access-control` | Stato Bridge/dispositivi, credenziali, polling, endpoint e permessi invariati | Shell, header, card e badge dalla facade |
| `/access-logs` | Log accessi, presenze, filtri e refresh invariati | Shell e header dalla facade |
| `/badges` | Badge, QR, Mobile Pass, filtri e azioni invariati | Shell e header dalla facade |
| `/access-control/credentials-audit` | Audit credenziali e autorizzazioni invariati | Composizione non invasiva con card e pulsanti Platinum |
| `/access-control/debug` | Diagnostica, endpoint e stato dispositivi invariati | Composizione non invasiva con card e pulsanti Platinum |

## Audit prima/dopo

Non sono stati modificati query, metodi HTTP, payload, polling, redirect, deep link, side effect o azioni distruttive. Loading, empty, error e retry restano quelli dei client operativi. Il rollback ripristina le sole importazioni della facade.

Sono protetti e non toccati `/access`, `/access/check`, gli endpoint access/DNake/Bridge, il comando di apertura, la decisione di accesso, i controller e il tornello.
