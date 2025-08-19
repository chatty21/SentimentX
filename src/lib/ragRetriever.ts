/* src/lib/ragRetriever.ts
   Live-first RAG helpers for prices/technicals via Finnhub, with
   graceful fallback to your local dataset.

   Public API:
   - getQuickStats(ticker)
   - retrievePriceFeatures(ticker)
   - getRecentCloses(ticker)
*/

type MATrend = "up" | "down" | "flat";

export type QuickStats = {
  price?: number;
  high52?: number;
  rsi?: number;
  ma50?: number;
  pctVsMA50?: number;
  maTrend?: MATrend; // derived from recent momentum / MA50 slope
};

type IndicatorRowRaw = {
  ticker: string;

  // possible variants coming from different pipelines
  price?: number;
  close?: number;

  high52?: number;

  // RSI variants
  rsi?: number;

  // MA50 variants
  ma50?: number;
  ma_50?: number;

  // % vs MA50 variants
  pctVsMA50?: number;
  pct_vs_ma50?: number;

  // optional extras
  company?: string;
  sector?: string;

  // historical closes (can be array of numbers or array of {close})
  historical?: Array<{ close: number }> | number[];

  // optional OHLC container (we only need close[])
  ohlc?: { close?: number[] };
};

type IndicatorRow = {
  ticker: string;
  price?: number;
  high52?: number;
  rsi?: number;
  ma50?: number;
  pctVsMA50?: number;
  company?: string;
  sector?: string;
  historical?: number[]; // oldest → newest
};

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";

/* ------------------------------------------------------------------ */
/* Small caches                                                        */
/* ------------------------------------------------------------------ */

const quoteCache = new Map<string, { t: number; data: { price?: number } }>();   // TTL ~60s
const metricCache = new Map<string, { t: number; data: { high52?: number } }>(); // TTL ~6h
const candleCache = new Map<string, { t: number; data: number[] }>();            // TTL ~2h
const datasetCache = new Map<string, { t: number; rows: IndicatorRow[] }>();     // TTL ~10m

const now = () => Date.now();
const TTL_QUOTE  = 60 * 1000;             // 60s
const TTL_METRIC = 6 * 60 * 60 * 1000;    // 6h
const TTL_CANDLE = 2 * 60 * 60 * 1000;    // 2h
const TTL_DATASET = 10 * 60 * 1000;       // 10m

const norm = (t: string) => (t || "").trim().toUpperCase();

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

const num = (v: any) =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

function toAscending(closes: number[]): number[] {
  if (closes.length >= 2 && closes[0] > closes[closes.length - 1]) {
    return closes.slice().reverse();
  }
  return closes;
}

function sma(values: number[], n: number): number | undefined {
  if (!Array.isArray(values) || values.length < n) return undefined;
  const slice = values.slice(values.length - n);
  const s = slice.reduce((a, b) => a + b, 0);
  return s / n;
}

function rsiFromCloses(values: number[], n = 14): number | undefined {
  if (!Array.isArray(values) || values.length <= n) return undefined;
  const closes = values.slice(-1 - n); // n+1 points
  let gains = 0, losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff; // diff < 0 => add absolute
  }
  const avgGain = gains / n;
  const avgLoss = losses / n;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Number.isFinite(rsi) ? rsi : undefined;
}

function momentumPct(values: number[], lookback = 15): number | undefined {
  if (!Array.isArray(values) || values.length < lookback + 1) return undefined;
  const a = values[values.length - (lookback + 1)];
  const b = values[values.length - 1];
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return undefined;
  return ((b / a) - 1) * 100;
}

function trendFromMomentum(mom?: number, pctVsMA50?: number): MATrend {
  if (typeof mom === "number") {
    if (mom > 0.5) return "up";
    if (mom < -0.5) return "down";
  }
  if (typeof pctVsMA50 === "number") {
    if (pctVsMA50 > 0.5) return "up";
    if (pctVsMA50 < -0.5) return "down";
  }
  return "flat";
}

/* ------------------------------------------------------------------ */
/* Local dataset loaders (module import → public JSON fallback)        */
/* ------------------------------------------------------------------ */

function normalizeRow(raw: IndicatorRowRaw): IndicatorRow {
  const t = norm(raw?.ticker || "");
  const histArr: number[] = (() => {
    if (Array.isArray(raw?.historical) && raw.historical.length) {
      if (typeof (raw.historical as any[])[0] === "number") {
        return toAscending((raw.historical as number[]).filter(Number.isFinite));
      }
      return toAscending(
        (raw.historical as Array<{ close: number }>)
          .map((h) => Number(h?.close))
          .filter(Number.isFinite)
      );
    }
    if (Array.isArray(raw?.ohlc?.close) && raw.ohlc!.close!.length) {
      return toAscending(raw.ohlc!.close!.map(Number).filter(Number.isFinite));
    }
    return [];
  })();

  const ma50 = num(raw.ma50 ?? raw.ma_50);
  const price = num(raw.price ?? raw.close);
  const rsi = num(raw.rsi);
  const pctVsMA50 = num(raw.pctVsMA50 ?? raw.pct_vs_ma50);

  return {
    ticker: t,
    price,
    high52: num(raw.high52),
    rsi,
    ma50,
    pctVsMA50,
    company: raw.company,
    sector: raw.sector,
    historical: histArr,
  };
}

async function loadDatasetModule(): Promise<IndicatorRow[] | null> {
  try {
    const mod = await import("@/data/sp500_indicators");
    const arr = (mod as any).SP500_INDICATORS as IndicatorRowRaw[] | undefined;
    if (Array.isArray(arr) && arr.length) {
      return arr.map(normalizeRow);
    }
    const fn = (mod as any).loadIndicatorsFor as
      | ((tick: string) => Promise<IndicatorRowRaw | null> | IndicatorRowRaw | null)
      | undefined;
    if (typeof fn === "function") {
      // If only a function is exported, we cannot bulk load; return null to allow JSON fallback.
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

async function loadDatasetJson(): Promise<IndicatorRow[] | null> {
  const key = "public_json";
  const hit = datasetCache.get(key);
  if (hit && now() - hit.t < TTL_DATASET) return hit.rows;

  try {
    // Server-side fetch from the public file (works locally and in prod)
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";
    const res = await fetch(`${base}/data/sp500_indicators.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const arr = (await res.json()) as IndicatorRowRaw[];
    const rows = Array.isArray(arr) ? arr.map(normalizeRow) : [];
    datasetCache.set(key, { t: now(), rows });
    return rows;
  } catch {
    return null;
  }
}

async function loadRow(ticker: string): Promise<IndicatorRow | null> {
  const T = norm(ticker);

  // 1) Try module (fastest when available)
  const modRows = await loadDatasetModule();
  if (Array.isArray(modRows) && modRows.length) {
    const hit = modRows.find((r) => r.ticker === T);
    if (hit) return hit;
  }

  // 2) Try JSON (public/data)
  const jsonRows = await loadDatasetJson();
  if (Array.isArray(jsonRows) && jsonRows.length) {
    const hit = jsonRows.find((r) => r.ticker === T);
    if (hit) return hit;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Finnhub helpers                                                     */
/* ------------------------------------------------------------------ */

async function finnhubGet<T>(url: string): Promise<T | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(
      `${url}${url.includes("?") ? "&" : "?"}token=${FINNHUB_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    if (json && typeof json === "object" && json.s === "no_data") return null;
    return json as T;
  } catch {
    return null;
  }
}

async function getLiveQuote(ticker: string): Promise<{ price?: number } | null> {
  const t = norm(ticker);
  const hit = quoteCache.get(t);
  if (hit && now() - hit.t < TTL_QUOTE) return hit.data;

  type Quote = { c?: number };
  const q = await finnhubGet<Quote>(`https://finnhub.io/api/v1/quote?symbol=${t}`);
  const data = q?.c && Number.isFinite(q.c) ? { price: Number(q.c) } : { price: undefined };

  quoteCache.set(t, { t: now(), data });
  return data;
}

async function getLiveMetrics(ticker: string): Promise<{ high52?: number } | null> {
  const t = norm(ticker);
  const hit = metricCache.get(t);
  if (hit && now() - hit.t < TTL_METRIC) return hit.data;

  type MetricResp = { metric?: Record<string, number> };
  const m = await finnhubGet<MetricResp>(
    `https://finnhub.io/api/v1/stock/metric?symbol=${t}&metric=all`
  );

  const high52 = (m?.metric?.["52WeekHigh"] as number | undefined);
  const data = { high52: Number.isFinite(high52!) ? Number(high52) : undefined };
  metricCache.set(t, { t: now(), data });
  return data;
}

async function getLiveCloses(ticker: string): Promise<number[] | null> {
  const t = norm(ticker);
  const hit = candleCache.get(t);
  if (hit && now() - hit.t < TTL_CANDLE) return hit.data;

  const toSec = Math.floor(Date.now() / 1000);
  const fromSec = toSec - 400 * 24 * 60 * 60; // ~400 days
  type Candle = { c?: number[]; t?: number[]; s?: string };
  const c = await finnhubGet<Candle>(
    `https://finnhub.io/api/v1/stock/candle?symbol=${t}&resolution=D&from=${fromSec}&to=${toSec}`
  );
  if (!c?.c || !Array.isArray(c.c) || c.c.length === 0) return null;
  const closes = c.c.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  const last252 = closes.slice(-252); // ~1y
  candleCache.set(t, { t: now(), data: last252 });
  return last252;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getQuickStats(ticker: string): Promise<QuickStats> {
  const t = norm(ticker);

  // Start from local dataset (normalized)
  const row = await loadRow(t);

  // Try live overlays in parallel
  const [liveQ, liveM, liveCloses] = await Promise.all([
    getLiveQuote(t),
    getLiveMetrics(t),
    getLiveCloses(t),
  ]);

  // Construct a working set of closes (live preferred → local)
  const closes: number[] = Array.isArray(liveCloses) && liveCloses.length
    ? liveCloses
    : (row?.historical ?? []);

  // Derive missing stats if we have closes
  const derivedMA50 = row?.ma50 ?? (closes.length >= 50 ? sma(closes, 50) : undefined);
  const derivedRSI  = row?.rsi  ?? (closes.length >= 15 ? rsiFromCloses(closes, 14) : undefined);

  // Prefer live price; else dataset price/close
  const price = num(liveQ?.price) ?? num(row?.price) ?? num((row as any)?.close);
  const high52 = num(liveM?.high52) ?? num(row?.high52);

  // Recompute % vs MA50 when possible (using **live** price)
  const pctVsMA50 = (() => {
    if (typeof price === "number" && typeof derivedMA50 === "number" && derivedMA50 !== 0) {
      return ((price / derivedMA50) - 1) * 100;
    }
    return num(row?.pctVsMA50);
  })();

  // Momentum-based trend (fallback to %vsMA50)
  const mom = momentumPct(closes, 15);
  const maTrend = trendFromMomentum(mom, typeof pctVsMA50 === "number" ? pctVsMA50 : undefined);

  return {
    price: num(price),
    high52: num(high52),
    rsi: num(derivedRSI),
    ma50: num(derivedMA50),
    pctVsMA50: num(pctVsMA50),
    maTrend,
  };
}

/** One-line technical summary for the LLM (no MA200). */
export async function retrievePriceFeatures(ticker: string): Promise<string> {
  const qs = await getQuickStats(ticker);

  const to2 = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : undefined;

  const parts: string[] = [];
  const p = to2(qs.price); if (p) parts.push(`price ${p}`);
  const h = to2(qs.high52); if (h) parts.push(`52wHigh ${h}`);
  const r = to2(qs.rsi); if (r) parts.push(`RSI ${r}`);
  const m = to2(qs.ma50); if (m) parts.push(`MA50 ${m}`);
  const v = to2(qs.pctVsMA50); if (v) parts.push(`%vsMA50 ${v}`);
  if (qs.maTrend) parts.push(`trend ${qs.maTrend}`);

  if (!parts.length) return "No technical features available.";
  return parts.join(", ");
}

/** Recent closing prices (oldest → newest). Prefer live candles; fall back to local. */
export async function getRecentCloses(ticker: string): Promise<number[]> {
  const t = norm(ticker);

  // Live first
  const live = await getLiveCloses(t);
  if (Array.isArray(live) && live.length) return live;

  // Fallback to local row (normalized)
  const row = await loadRow(t);
  if (!row) return [];

  if (Array.isArray(row.historical) && row.historical.length) {
    return row.historical.slice(-252);
  }

  if (typeof row.price === "number" && Number.isFinite(row.price)) {
    return [row.price];
  }

  return [];
}