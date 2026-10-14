// Rounds a monetary amount to 2 decimals using its decimal representation,
// so that values like 1.005 or 2.675 round half-up (1.01, 2.68) instead of
// being skewed by binary floating point as with Number.prototype.toFixed.
export function roundMoney(amount: number) {
  const text = String(amount);

  // Exponent notation (very large/small numbers): fall back to toFixed.
  if (text.includes("e") || text.includes("E")) {
    return Number(amount.toFixed(2));
  }

  const sign = amount < 0 ? -1 : 1;
  const rounded = Number(`${Math.round(Number(`${Math.abs(amount)}e2`))}e-2`);

  return sign * rounded;
}
