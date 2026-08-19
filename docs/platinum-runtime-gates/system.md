# Gate E — Impostazioni e sistema

## Inventario e parità

| Route | Contratti preservati | Presentazione Platinum |
| --- | --- | --- |
| `/settings` e `/settings/permissions` | Configurazioni, ruoli, permessi e salvataggi invariati | Page shell dalla facade |
| `/system`, `/system/audit`, `/system/staff` | Audit, gestione staff, ruoli e azioni amministrative invariati | Shell, header, card e azioni dalla facade |
| `/login` | Autenticazione, sessione, cookie e redirect invariati | Composizione pubblica esistente, senza bypass |
| `/access-denied` | Messaggio, stato e navigazione di rientro invariati | Composizione Platinum dalla facade |

## Audit prima/dopo

Middleware, autenticazione, cookie, endpoint, metodi, payload, query, permessi, ruoli, logout, redirect, deep link, side effect e azioni distruttive non sono stati modificati. Loading, empty, error e retry restano quelli dei client operativi. Rollback: ripristino delle sole importazioni della facade.

`/settings/modules` resta un placeholder governato: non è stato trasformato in funzione operativa e non viene aggiunto alla navigazione standard.
