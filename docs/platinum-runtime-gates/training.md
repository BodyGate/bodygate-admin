# Gate D — Training

## Inventario e parità

| Route | Contratti preservati | Presentazione Platinum |
| --- | --- | --- |
| `/training` | Navigazione e riepilogo modulo invariati | Page shell dalla facade |
| `/training/clients` | Relazioni cliente-programma, ricerca e deep link invariati | Page shell dalla facade |
| `/training/library` e `/training/library/[id]` | Identificativi, esercizi, media, form, validazioni e salvataggi invariati | Page shell dalla facade |
| `/training/programs` e `/training/programs/[id]` | Programmi, duplicazioni, cancellazioni, redirect e validazioni invariati | Page shell dalla facade |
| `/training/sessions` | Sessioni, filtri, salvataggi e stati vuoti invariati | Page shell dalla facade |

## Audit prima/dopo

La migrazione conserva query, endpoint, metodi HTTP, payload, permessi, redirect, deep link, side effect e conferme distruttive esistenti. Non sono stati aggiunti polling o subscription realtime. Loading, empty, error, dati parziali e retry restano demandati ai client operativi preesistenti. Rollback: ripristino delle sole importazioni della facade.
