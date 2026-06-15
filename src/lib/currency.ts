/**
 * Supported display currencies for the per-user currency preference. Kept in
 * sync with the budget tracker's currency list so a user's default flows
 * through to expense entry.
 */
export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "NZ$" },
  { code: "THB", label: "Thai Baht", symbol: "฿" },
  { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp" },
  { code: "VND", label: "Vietnamese Dong", symbol: "₫" },
  { code: "MXN", label: "Mexican Peso", symbol: "MX$" },
  { code: "MAD", label: "Moroccan Dirham", symbol: "DH" },
  { code: "ISK", label: "Icelandic Króna", symbol: "kr" },
  { code: "PEN", label: "Peruvian Sol", symbol: "S/" },
  { code: "AED", label: "UAE Dirham", symbol: "AED" },
];

const CODES = new Set(CURRENCIES.map((c) => c.code));

export function isValidCurrency(code: string): boolean {
  return CODES.has(code);
}

export function currencyLabel(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

/** Format a number in the user's currency using the platform Intl formatter. */
export function formatCurrency(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "JPY" || code === "IDR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}
