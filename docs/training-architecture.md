# Training architecture — Premium rebuild

## Audit sintetico
- La sidebar Training puntava a rotte non implementate (`/training/dashboard`, `/training/clients`, `/training/workouts`, `/training/checkins`). La nuova navigazione usa solo rotte reali: `/training`, `/training/clients`, `/training/programs`, `/training/sessions`, `/training/library`.
- La dashboard placeholder è stata sostituita da KPI calcolati sui dati restituiti dall'API server `/api/training`.
- Il catalogo canonico è `exercises`. La vecchia tabella `exercises_library` resta fuori dal nuovo flusso applicativo e deve essere migrata lato database con backfill controllato.
- Le mutazioni browser dirette su Supabase sono state rimosse dal nuovo modulo: la UI chiama route handler server e il server usa service role/RPC.
- La creazione programma passa dalla RPC `create_training_program_atomic`, così programma, giorni ed esercizi sono commit/rollback in una singola transazione PostgreSQL.
- Alert/confirm standard sono sostituiti da messaggi inline Premium.

## Architettura definitiva

```text
app/training/* pages
  -> app/components/training/TrainingPremiumClient.tsx
    -> fetch('/api/training')
      -> Supabase server client / RPC
        -> training_programs, training_program_days, training_day_exercises, exercises, workout_sessions
```

## Rotte UI
- `/training`: dashboard premium.
- `/training/clients`: vista clienti/atleti e conteggio programmi.
- `/training/programs`: lista programmi e creazione atomica.
- `/training/programs/[id]`: builder programma.
- `/training/library`: catalogo canonico `exercises`.
- `/training/library/[id]`: dettaglio esercizio.
- `/training/sessions`: sessioni workout.

## API server
- `GET /api/training`: aggrega programmi, clienti, esercizi canonici e sessioni.
- `POST /api/training` con `action=create-program`: chiama `create_training_program_atomic(payload)`.
- `POST /api/training` con `action=save-exercise`: crea un record in `exercises`.
- `POST /api/training` con `action=toggle`: abilita/disabilita solo `training_programs` o `exercises`.

## Database e RLS
La migration `supabase/migrations/202607070001_training_atomic_rpc.sql` definisce una RPC transazionale. Le policy RLS devono consentire la lettura agli utenti autorizzati e demandare le scritture operative al server/RPC, evitando insert multipli dal browser.

## Rollback atteso
Se un giorno o un esercizio del payload non è valido, la RPC solleva eccezione e PostgreSQL annulla l'intera creazione del programma.
