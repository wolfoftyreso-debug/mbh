/** Financial values are integers in minor units with an explicit currency. */
export type Money = { amountMinor: number; currency: string };

const ZERO_DECIMAL = new Set(["JPY", "KRW", "ISK", "CLP", "VND"]);

export function minorUnitsPerMajor(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
}

export function formatMoney(amountMinor: number, currency: string, locale = "sv-SE"): string {
  const divisor = minorUnitsPerMajor(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: divisor === 1 ? 0 : 2,
    maximumFractionDigits: divisor === 1 ? 0 : 2,
  }).format(amountMinor / divisor);
}

export function toMinor(major: number | string, currency: string): number {
  const n = typeof major === "string" ? Number(major.replace(",", ".")) : major;
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount");
  return Math.round(n * minorUnitsPerMajor(currency));
}

export function toMajor(amountMinor: number, currency: string): number {
  return amountMinor / minorUnitsPerMajor(currency);
}

/** Platform commission computed in basis points, rounded half up, never floats in storage. */
export function platformFee(amountMinor: number, commissionBps: number): number {
  return Math.round((amountMinor * commissionBps) / 10000);
}

export function assertSameCurrency(a: string, b: string): void {
  if (a.toUpperCase() !== b.toUpperCase()) throw new Error(`Currency mismatch: ${a} vs ${b}`);
}
