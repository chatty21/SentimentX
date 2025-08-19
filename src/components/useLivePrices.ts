"use client";

import useSWR from "swr";

type PriceResp = {
  prices: Record<string, number>;
  asOf: number;            // epoch ms
};

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

/**
 * Reliable live-price polling with a STABLE SWR key and sensible retry/refresh.
 */
export function useLivePrices(
  tickers: string[],
  refreshMs = 8000
): { prices: Record<string, number>; asOf: number | null; isLoading: boolean; error?: any } {
  const list = Array.isArray(tickers)
    ? [...new Set(tickers.map(t => (t || "").toUpperCase()).filter(Boolean))].sort()
    : [];

  const key = list.length ? `/api/prices?tickers=${encodeURIComponent(list.join(","))}` : null;

  const { data, error, isLoading } = useSWR<PriceResp>(
    key,
    async () => postJson<PriceResp>("/api/prices", { tickers: list }),
    {
      refreshInterval: refreshMs,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      keepPreviousData: true,
      errorRetryCount: 3,
      errorRetryInterval: 4000,
      dedupingInterval: Math.max(1000, Math.floor(refreshMs / 2)),
    }
  );

  return {
    prices: data?.prices ?? {},
    asOf: data?.asOf ?? null,
    isLoading: !!key && (isLoading && !data),
    error,
  };
}