BodyGate Courses Core 1.0

File inclusi:
1. courses-core-1-0-preflight-read-only.sql
2. courses-core-1-0.sql
3. courses-core-1-0-verify-read-only.sql

Ordine:
- eseguire prima il preflight su Supabase;
- applicare la migration solo se preflight_ok = true;
- eseguire la verifica read-only;
- non eseguire ancora RPC manuali su dati reali;
- dopo hotfix_ok = true preparare dry-run con rollback e test concorrenza.

Il modulo non modifica:
- access control;
- Bridge/DNake/KT02.3/tornello;
- Mobile Pass;
- pagamenti/ricevute;
- cash_movements/prima nota.
