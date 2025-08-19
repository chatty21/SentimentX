// src/lib/useCompanyNews.ts
"use client";
import useSWR from "swr";

type NewsItem = { title: string; url?: string; source?: string; date?: string };

const fetcher = (url: string) => fetch(url).then(r => (r.ok ? r.json() : Promise.reject()));

export function useCompanyNews(ticker: string, days = 10) {
  const key = ticker ? `/api/news?symbol=${encodeURIComponent(ticker)}&days=${days}` : null;
  const { data, error, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60_000, // refresh every minute
  });

  return {
    items: (data?.items as NewsItem[]) ?? [],
    isLoading,
    error,
  };
}