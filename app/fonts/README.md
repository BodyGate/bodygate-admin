# Font del progetto

I font sono **inclusi nel repository**: la build e il sito non scaricano nulla da
Google ne' da altri servizi.

| File | Font | Uso | Licenza |
|---|---|---|---|
| `PlusJakartaSans-latin-wght.woff2` | Plus Jakarta Sans (variabile, 200-800) | titoli (`--font-display`) | SIL OFL 1.1 (`OFL-PlusJakartaSans.txt`) |
| `PublicSans-latin-wght.woff2` | Public Sans (variabile, 100-900) | testo (`--font-body`) | SIL OFL 1.1 (`OFL-PublicSans.txt`) |

Sono i file `latin` dei pacchetti `@fontsource-variable/plus-jakarta-sans` e
`@fontsource-variable/public-sans` 5.3.0, gli stessi caratteri usati prima da
`next/font/google` (sottoinsieme `latin`, che copre le lettere accentate
italiane). La licenza OFL consente l'uso e la ridistribuzione, anche
commerciale, a condizione di conservare il testo della licenza accanto ai file.

Per usare un font proprietario del marchio: sostituire il file qui, aggiornare
`app/layout.tsx` (`localFont({ src: ... })`) e mettere la sua licenza in questa
cartella.
