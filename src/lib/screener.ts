import { hasPositiveCatalyst, type Headline } from "./catalyst";

export type ScreenRow = {
  ticker: string;
  close?: number;
  rsi?: number;        // 14-day RSI
  volAvg20?: number;   // 20-day average volume (shares)
  vol5d?: number;      // last 5 trading days total (or avg) volume
};

/**
 * Find tickers with:
 *  - RSI in [rsiMin, rsiMax]
 *  - recent volume spike (vol5d / volAvg20 >= volSpike)
 *  - at least one “positive catalyst” headline in the last `days`
 */
export function screenRSIVolumeCatalyst(
  rows: ScreenRow[],
  newsMap: Record<string, Headline[]>,
  opts: { rsiMin?: number; rsiMax?: number; volSpike?: number; days?: number; limit?: number } = {}
) {
  const rsiMin   = opts.rsiMin   ?? 30;
  const rsiMax   = opts.rsiMax   ?? 45;
  const volSpike = opts.volSpike ?? 1.25;
  const days     = opts.days     ?? 30;
  const limit    = opts.limit    ?? 4;

  const sinceISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const filtered = (rows || []).filter(r => {
    const okRSI =
      typeof r.rsi === "number" && Number.isFinite(r.rsi) && r.rsi >= rsiMin && r.rsi <= rsiMax;

    const okVol =
      typeof r.vol5d === "number" && typeof r.volAvg20 === "number" &&
      r.volAvg20 > 0 && r.vol5d / r.volAvg20 >= volSpike;

    const heads = newsMap?.[r.ticker] ?? [];
    const okCat = hasPositiveCatalyst(heads, sinceISO);

    return okRSI && okVol && okCat;
  });

  // Lightweight score: bigger volume spike + RSI close to 40 ranks higher
  const scored = filtered
    .map(r => {
      const spike = r.volAvg20 && r.vol5d ? r.vol5d / r.volAvg20 : 1;
      const rsiPenalty = Math.abs((r.rsi ?? 40) - 40) / 50; // smaller is better
      return { r, score: spike - rsiPenalty };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.r);

  return scored;
}