# BodyGate Platinum UI Foundation

BodyGate usa una sola fondazione UI: **tokens → primitives → components → patterns → pages**. Nuovi stili locali o design system paralleli sono vietati.

## Principi

- Operational first: ogni schermata mostra stato, attenzione richiesta e prossima azione.
- One primary action: una sola azione primaria per area operativa.
- Truthful status: non mostrare “Operativo” se i dati non sono disponibili; usare “Da verificare”.
- Tablet first-class: navigazione drawer in portrait, rail compatta in landscape.
- Zero dead UI: azioni non disponibili disabilitate con spiegazione.
- Nessun dettaglio tecnico grezzo alla reception.

## Token

I token ufficiali sono definiti in `app/components/ui/bodygate-ui.css` con prefisso `--bg-*`: canvas, shell, superfici, testo, brand, danger separato dal brand, success/warning/info, bordi, spacing, radius, control heights, shadow, z-index, motion e page width.

## Action hierarchy

1. Primaria: operazione più probabile e sicura.
2. Secondaria: navigazione o azione reversibile.
3. Ghost: supporto o approfondimento.
4. Danger: solo per azioni distruttive o sensibili, mai per enfasi brand.

## Responsive

- 0–599: mobile service, righe operative compatte.
- 600–899: tablet portrait, navigazione drawer e contenuti full width.
- 900–1199: tablet landscape/compact, rail laterale.
- 1200–1599: desktop.
- 1600+: workstation.

## Accessibilità

Usare `focus-visible`, target minimi 44px nei flussi operativi, `aria-label` quando manca testo visibile, Escape per overlay, blocco scroll nei drawer, supporto `prefers-reduced-motion` e zoom utente. Il viewport non deve bloccare lo zoom.

## Content design

Vocabolario UI: Cliente, Abbonamento, Quota associativa, Certificato medico, Pagamento, Ricevuta, Credenziale, Accesso, Sede, Documento. Evitare “Customers”, “Subscription” e “upload” quando “Carica” è più chiaro.

## Stati

Ogni area asincrona deve distinguere loading iniziale, refresh, success, empty, partial, recoverable error, fatal error, offline e permission denied. Durante il refresh mantenere i dati precedenti.

## Pattern form

Mostrare error summary, focus sul primo errore, prevenire doppio submit, proteggere modifiche non salvate nei form lunghi e non bloccare l’utente dopo salvataggio riuscito.

## Pattern lista

Mostrare numero risultati, filtri, reset, paginazione e empty state con prossima azione. Su tablet usare colonne essenziali e dettaglio espandibile/drawer, non solo `overflow-x:auto`.

## Pattern workflow

Per onboarding, rinnovo, documenti, badge e pagamenti usare step reali, successi parziali espliciti e azioni di recupero. La readiness è rappresentazione visuale dei dati disponibili e non sostituisce `/api/access/check`.
