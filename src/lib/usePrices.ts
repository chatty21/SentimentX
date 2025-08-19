"use client";

import useSWR from "swr";

type PricesResp = {
  prices: Record<string, number>;
  asOf: number;          // epoch ms
  source: string;        // first provider attempted
  filled: number;        // # tickers priced
  errors: Record<string, string>;
};

const fetcher = (url: string, body: any) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  }).then(async (r) => (r.ok ? (r.json() as Promise<PricesResp>) : Promise.reject(await r.json())));

export function usePrices(tickers: string[], refreshMs = 4000) {
  const key = tickers?.length ? ["/api/prices", { tickers }] : null;
  const { data, error, isValidating, mutate } = useSWR<PricesResp>(key, fetcher, {
    refreshInterval: refreshMs, // keep it lightweight; your API caches for 4s
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  });
  return {
    prices: data?.prices ?? {},
    asOf: data?.asOf ?? 0,
    source: data?.source ?? "",
    filled: data?.filled ?? 0,
    errors: data?.errors ?? {},
    loading: !data && !error,
    error,
    mutate,
  };
}