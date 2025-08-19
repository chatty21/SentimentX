// src/lib/useTickerCompanyMap.ts
import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Client hook to load a ticker -> company map (cached for 1h). */
export function useTickerCompanyMap() {
  const { data, error, isLoading } = useSWR<Record<string, string>>(
    "/api/companies/sp500",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60 * 60 * 1000 }
  );
  return { map: data || {}, isLoading, error };
}