// src/lib/useIntraday.ts
"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r)));

export function useIntraday(ticker: string, minutes = 90, refreshMs = 5000) {
  const key = ticker ? `/api/ohlc?ticker=${encodeURIComponent(ticker)}&minutes=${minutes}` : null;
  const { data, error, isValidating } = useSWR(key, fetcher, {
    refreshInterval: refreshMs, // poll ~5s
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  return {
    data, // { t[], o[], h[], l[], c[], provider, points, ... }
    loading: !error && !data,
    error,
    refreshing: isValidating,
  };
}