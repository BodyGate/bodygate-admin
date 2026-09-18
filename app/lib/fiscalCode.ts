import { calcolaDaComune } from "codice-fiscale-it";

const genderMap: Record<string, "M" | "F"> = {
  maschio: "M",
  femmina: "F",
};

export type GenerateFiscalCodeInput = {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  birthPlace: string;
};

export type GenerateFiscalCodeResult =
  | { ok: true; fiscalCode: string }
  | { ok: false; error: string };

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;

  return { year, month, day };
}

export function generateFiscalCode(input: GenerateFiscalCodeInput): GenerateFiscalCodeResult {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const birthPlace = input.birthPlace.trim();

  if (!firstName || !lastName) {
    return { ok: false, error: "Inserisci nome e cognome per generare il codice fiscale." };
  }

  const sesso = genderMap[input.gender.trim().toLowerCase()];
  if (!sesso) {
    return { ok: false, error: "Seleziona il sesso (Maschio o Femmina) per generare il codice fiscale." };
  }

  const date = parseIsoDate(input.birthDate);
  if (!date) {
    return { ok: false, error: "Inserisci una data di nascita valida per generare il codice fiscale." };
  }

  if (!birthPlace) {
    return { ok: false, error: "Inserisci il luogo di nascita per generare il codice fiscale." };
  }

  const fiscalCode = calcolaDaComune({
    cognome: lastName,
    nome: firstName,
    sesso,
    giorno: date.day,
    mese: date.month,
    anno: date.year,
    comune: birthPlace,
  });

  if (!fiscalCode) {
    return {
      ok: false,
      error: `Comune di nascita "${birthPlace}" non riconosciuto. Verifica che il nome sia scritto esattamente come da anagrafe.`,
    };
  }

  return { ok: true, fiscalCode };
}
