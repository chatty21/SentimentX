import { NextResponse } from "next/server";

// ---------- helpers ----------
function env(name: string) {
  return process.env[name] || "";
}
function toDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
function toUnixMs(d: Date) {
  return d.getTime();
}
function toUnixSec(d: Date) {
  return Math.floor(d.getTime() / 1000);
}
function asc<T>(a: T, b: T, get: (x: T) => number) {
  const av = get(a);
  const bv = get(b);
  return av - bv;
}
type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ---------- Providers ----------
async function polygonCandles(
  T: string,
  interval: "1m" | "1d",
  minutes?: number,
  days?: number
): Promise<{ candles: Candle[]; source: string } | null> {
  const POLY = env("POLYGON_API_KEY");
  if (!POLY) return null;

  const now = new Date();
  let from: Date;

  if (interval === "1m") {
    const m = Math.min(Math.max((minutes || 60), 1), 60 * 7); // up to last 7 hours
    from = new Date(Date.now() - m * 60 * 1000);
  } else {
    const d = Math.min(Math.max((days || 180), 1), 1825);
    from = toDateDaysAgo(d);
  }

  const aggUnit = interval === "1m" ? "minute" : "day";
  // Polygon accepts either UNIX timestamp (ms) or YYYY-MM-DD for daily agg. Use date strings for daily to avoid parsing issues.
  const pathFrom = interval === "1m" ? String(toUnixMs(from)) : from.toISOString().slice(0, 10);
  const pathTo = interval === "1m" ? String(toUnixMs(now)) : now.toISOString().slice(0, 10);

  const url =
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(T)}/range/1/${aggUnit}/` +
    `${pathFrom}/${pathTo}?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(POLY)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    return null; // allow fallback
  }
  const j = await r.json();
  const rows = Array.isArray(j?.results) ? j.results : [];
  const candles: Candle[] = rows
    .map((x: any): Candle => ({
      time: typeof x?.t === "number" ? Math.floor(x.t / 1000) : Math.floor(Date.parse(x?.timestamp ?? x?.t ?? 0) / 1000),
      open: Number(x?.o),
      high: Number(x?.h),
      low: Number(x?.l),
      close: Number(x?.c),
      volume: Number(x?.v ?? 0),
    }))
    .filter((c: Candle) => Number.isFinite(c.time) && Number.isFinite(c.open));
  return { candles, source: "polygon" };
}

async function twelveDataCandles(
  T: string,
  interval: "1m" | "1d",
  minutes?: number,
  days?: number
): Promise<{ candles: Candle[]; source: string } | null> {
  const TD = env("TWELVEDATA_API_KEY");
  if (!TD) return null;

  const tdInterval = interval === "1m" ? "1min" : "1day";
  // outputsize limit on free plan is 5000, be conservative
  const outputsize =
    interval === "1m"
      ? Math.min(Math.max((minutes || 240), 1), 5000)
      : Math.min(Math.max((days || 180), 1), 5000);

  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(T)}` +
    `&interval=${tdInterval}&outputsize=${outputsize}&format=JSON&apikey=${encodeURIComponent(TD)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;

  const j = await r.json();
  if (!Array.isArray(j?.values)) return null;

  // TwelveData returns most-recent first; convert to ascending seconds
  const candles: Candle[] = j.values
    .map((row: any) => ({
      time: Math.floor(Date.parse(row?.datetime) / 1000),
      open: Number(row?.open),
      high: Number(row?.high),
      low: Number(row?.low),
      close: Number(row?.close),
      volume: Number(row?.volume ?? 0),
    }))
    .filter((c: Candle) => Number.isFinite(c.time) && Number.isFinite(c.open))
    .reverse();

  return { candles, source: "twelvedata" };
}

async function alphaVantageDaily(
  T: string,
  days?: number
): Promise<{ candles: Candle[]; source: string } | null> {
  const AV = env("ALPHA_VANTAGE_API_KEY");
  if (!AV) return null;

  const full = (days || 0) > 100 ? "full" : "compact";
  const avUrl =
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(T)}` +
    `&outputsize=${full}&apikey=${encodeURIComponent(AV)}`;

  const rr = await fetch(avUrl, { cache: "no-store" });
  if (!rr.ok) return null;

  const jj = await rr.json();
  const series = jj?.["Time Series (Daily)"] || {};
  const entries = Object.entries(series) as [string, any][];
  entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const limit = Math.min(Math.max(days || 180, 1), 1825);
  const sliced = entries.slice(-limit);
  const candles: Candle[] = sliced
    .map(([date, ohlc]) => ({
      time: Math.floor(Date.parse(date) / 1000),
      open: Number(ohlc?.["1. open"]),
      high: Number(ohlc?.["2. high"]),
      low: Number(ohlc?.["3. low"]),
      close: Number(ohlc?.["4. close"]),
      volume: Number(ohlc?.["5. volume"] ?? 0),
    }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open));

  return { candles, source: "alphavantage" };
}

// ---------- Route ----------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tRaw = searchParams.get("t") || searchParams.get("ticker") || "";
    const T = String(tRaw).trim().toUpperCase();
    const minutes = Number(searchParams.get("minutes") || "");
    const days = Number(searchParams.get("days") || "");

    if (!T) {
      return NextResponse.json({ error: "ticker_required" }, { status: 400 });
    }

    const interval: "1m" | "1d" =
      Number.isFinite(minutes) && minutes > 0 ? "1m" : "1d";

    // Try providers in order: Polygon -> TwelveData -> AlphaVantage (daily only)
    let result:
      | { candles: Candle[]; source: string }
      | null = null;

    // 1) Polygon
    result = await polygonCandles(T, interval, minutes, days);

    // 2) TwelveData
    if (!result || result.candles.length === 0) {
      result = await twelveDataCandles(T, interval, minutes, days);
    }

    // 3) Alpha Vantage (daily only)
    if ((!result || result.candles.length === 0) && interval === "1d") {
      result = await alphaVantageDaily(T, days);
    }

    // If everything failed
    if (!result || result.candles.length === 0) {
      return NextResponse.json(
        { candles: [], source: "none", interval, error: "no_data" },
        { status: 200 }
      );
    }

    // Ensure ascending time order (seconds)
    result.candles.sort((a, b) => a.time - b.time);

    return NextResponse.json({
      candles: result.candles,
      source: result.source,
      interval,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "ohlc_failed" }, { status: 500 });
  }
}