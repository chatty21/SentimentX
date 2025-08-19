"use client";

import useSWR from "swr";

type Candle = { t: number; c: number; h?: number; l?: number; o?: number; v?: number };
type Resp = { candles: Record<string, Candle[]>; asOf: number };

async function postJson<T>(url: string, payload: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`fetch_failed_${r.status}`);
  return r.json();
}

export function useLiveTechnicals(tickers: string[], days = 60, refreshMs = 60000) {
  const list = Array.isArray(tickers)
    ? [...new Set(tickers.map(t => (t || "").toUpperCase()).filter(Boolean))].sort()
    : [];
  const key = list.length ? `/api/ohlc?tickers=${encodeURIComponent(list.join(","))}&d=${days}` : null;

  const { data, error, isLoading } = useSWR<Resp>(
    key,
    async () => postJson<Resp>("/api/ohlc", { tickers: list, days }),
    {
      refreshInterval: refreshMs,
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: Math.max(2000, Math.floor(refreshMs / 2)),
    }
  );

  const map: Record<string, { ma50?: number; rsi14?: number; close?: number }> = {};
  const candles = (data?.candles || {}) as Record<string, Candle[]>;

  Object.keys(candles).forEach((T) => {
    const c = candles[T] || [];
    if (!c.length) return;
    const closes = c.map(pt => pt.c).filter(Number.isFinite);
    const close = closes.at(-1);
    const ma50 = closes.length >= 50
      ? closes.slice(-50).reduce((s, v) => s + v, 0) / 50
      : undefined;
    const rsi14 = calcRSI(closes, 14);
    map[T] = { ma50, rsi14, close };
  });

  return { data: map, asOf: data?.asOf ?? null, error, isLoading };
}

function calcRSI(closes: number[], period = 14): number | undefined {
  if (!closes || closes.length <= period) return undefined;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gains += ch; else losses -= ch;
  }
  let avgG = gains / period;
  let avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(ch, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-ch, 0)) / period;
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}