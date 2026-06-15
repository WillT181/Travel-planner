"use client";

import { useEffect, useState } from "react";

/**
 * Supported currencies for expense entry. Kept deliberately small but covers
 * the seed destinations. Add more as needed.
 */
export const CURRENCIES = [
  "GBP",
  "USD",
  "EUR",
  "JPY",
  "THB",
  "AUD",
  "NZD",
  "CAD",
  "CHF",
  "MXN",
  "MAD",
  "ISK",
  "IDR",
  "PEN",
  "VND",
  "AED",
] as const;

export type Currency = (typeof CURRENCIES)[number];

/**
 * Static fallback rates expressed as **GBP per 1 unit of the currency**.
 * Used when the live FX endpoint is unreachable (e.g. offline / blocked).
 * Approximate — refreshed live by useFxRates when possible.
 */
export const STATIC_GBP_PER_UNIT: Record<string, number> = {
  GBP: 1,
  USD: 0.79,
  EUR: 0.85,
  JPY: 0.0053,
  THB: 0.022,
  AUD: 0.52,
  NZD: 0.48,
  CAD: 0.58,
  CHF: 0.88,
  MXN: 0.046,
  MAD: 0.079,
  ISK: 0.0057,
  IDR: 0.00005,
  PEN: 0.21,
  VND: 0.000031,
  AED: 0.215,
};

export function convertToGbp(
  amount: number,
  currency: string,
  ratesGbpPerUnit: Record<string, number> = STATIC_GBP_PER_UNIT
): number {
  const rate = ratesGbpPerUnit[currency] ?? STATIC_GBP_PER_UNIT[currency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

interface FxState {
  /** GBP per 1 unit of each currency. */
  rates: Record<string, number>;
  /** "live" once a network fetch has succeeded, otherwise "static". */
  source: "static" | "live";
}

/**
 * Returns live FX rates (GBP per unit) from the free, key-less open.er-api.com
 * endpoint, falling back to the static table when the request fails. Starts
 * with the static table so conversions are instant before the fetch resolves.
 */
export function useFxRates(): FxState {
  const [state, setState] = useState<FxState>({
    rates: STATIC_GBP_PER_UNIT,
    source: "static",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/GBP");
        if (!res.ok) return;
        const json = (await res.json()) as {
          rates?: Record<string, number>;
        };
        if (!json.rates || !active) return;
        // json.rates[CUR] = units of CUR per 1 GBP → invert for GBP per unit.
        const rates: Record<string, number> = { GBP: 1 };
        for (const cur of CURRENCIES) {
          const perGbp = json.rates[cur];
          if (perGbp && perGbp > 0) rates[cur] = 1 / perGbp;
          else rates[cur] = STATIC_GBP_PER_UNIT[cur] ?? 1;
        }
        setState({ rates, source: "live" });
      } catch {
        // Keep static fallback.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
