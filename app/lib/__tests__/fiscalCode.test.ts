import assert from "node:assert/strict";
import { generateFiscalCode } from "../fiscalCode";

const maleResult = generateFiscalCode({
  firstName: "Mario",
  lastName: "Rossi",
  gender: "Maschio",
  birthDate: "1980-01-01",
  birthPlace: "Roma",
});
assert.deepEqual(maleResult, { ok: true, fiscalCode: "RSSMRA80A01H501U" });

const femaleResult = generateFiscalCode({
  firstName: "Anna",
  lastName: "Verdi",
  gender: "Femmina",
  birthDate: "1995-06-15",
  birthPlace: "Palermo",
});
assert.equal(femaleResult.ok, true);

const missingGender = generateFiscalCode({
  firstName: "Test",
  lastName: "Utente",
  gender: "Altro",
  birthDate: "1990-03-03",
  birthPlace: "Milano",
});
assert.deepEqual(missingGender, {
  ok: false,
  error: "Seleziona il sesso (Maschio o Femmina) per generare il codice fiscale.",
});

const unknownPlace = generateFiscalCode({
  firstName: "Test",
  lastName: "Utente",
  gender: "Maschio",
  birthDate: "1990-03-03",
  birthPlace: "Comune Inesistente XYZ",
});
assert.equal(unknownPlace.ok, false);

const missingName = generateFiscalCode({
  firstName: "",
  lastName: "",
  gender: "Maschio",
  birthDate: "1990-03-03",
  birthPlace: "Milano",
});
assert.equal(missingName.ok, false);

console.log("fiscalCode tests passed");
