# Access-check fast path — test operativo fallito (2026-08-07)

La PR #131 ha superato la build Vercel ma, durante il test sul server BodyGate reale, il tornello non si è aperto. È stato eseguito immediatamente il rollback alla build e alla route precedenti.

Stato: **NON MERGIARE**.

Prossima strategia: mantenere completamente sincrono il flusso operativo esistente, introdurre prima telemetria per singola query e poi ottimizzare esclusivamente le letture indipendenti, senza usare `after()` e senza spostare `customer_access_logs`/`gym_presence` fuori dal percorso attuale fino a validazione separata.
