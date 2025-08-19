// src/data/sp500_indicators.ts
// Loader for your root-level sp500_indicators.json with optional history.

type HistBar = { close?: number } & Record<string, unknown>;

export type IndicatorRow = {
  ticker: string;
  close?: number;
  // If your JSON carries history, expose it like this:
  historical?: HistBar[];
} & Record<string, unknown>;

let CACHE: Record<string, IndicatorRow> | null = null;

async function buildCache(): Promise<Record<string, IndicatorRow>> {
  if (CACHE) return CACHE;

  // The JSON file is at the REPO ROOT (../../../.. from here).
  // Using Next’s JSON import (tsconfig resolveJsonModule should be true).
  const raw: any = (await import("../../sp500_indicators.json")).default;

  const byTicker: Record<string, IndicatorRow> = {};

  if (Array.isArray(raw)) {
    for (const r of raw) {
      const t = String(r?.ticker ?? r?.Ticker ?? "").toUpperCase();
      if (!t) continue;
      byTicker[t] = {
        ticker: t,
        close: typeof r?.close === "number" ? r.close : undefined,
        historical: Array.isArray(r?.historical) ? (r.historical as HistBar[]) : undefined,
        ...r,
      };
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const t = k.toUpperCase();
      const r = v as any;
      byTicker[t] = {
        ticker: t,
        close: typeof r?.close === "number" ? r.close : undefined,
        historical: Array.isArray(r?.historical) ? (r.historical as HistBar[]) : undefined,
        ...r,
      };
    }
  }

  CACHE = byTicker;
  return CACHE;
}

/** One row for a ticker (case-insensitive). */
export async function loadIndicatorsFor(ticker: string): Promise<IndicatorRow | null> {
  const map = await buildCache();
  return map[ticker.toUpperCase()] ?? null;
}