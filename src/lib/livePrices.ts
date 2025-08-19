// A tiny wrapper with pluggable providers + in-memory cache.
// Works with Polygon, IEX Cloud, AlphaVantage, Tiingo, or your own feed.

type Quote = { t: string; p: number }; // ticker, price
type Provider = "polygon" | "iex" | "alpha" | "mock";

const CACHE_TTL_MS = 7_000; // 7s to avoid hammering
const cache = new Map<string, { at: number; data: Record<string, number> }>();

const env = {
  // Accept several aliases so dev/prod configs "just work"
  PROVIDER: ((process.env.PRICES_PROVIDER ||
              process.env.PRICE_PROVIDER ||
              process.env.NEXT_PUBLIC_PRICES_PROVIDER ||
              "").toLowerCase() as Provider) || "mock",
  POLYGON_KEY:
    process.env.POLYGON_API_KEY ||
    process.env.POLYGON_KEY ||
    process.env.NEXT_PUBLIC_POLYGON_API_KEY ||
    "",
  IEX_KEY:
    process.env.IEX_CLOUD_API_KEY ||
    process.env.IEX_KEY ||
    process.env.NEXT_PUBLIC_IEX_CLOUD_API_KEY ||
    "",
  ALPHA_KEY:
    process.env.ALPHA_VANTAGE_API_KEY ||
    process.env.ALPHA_VANTAGE_KEY ||
    process.env.ALPHA_KEY ||
    process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY ||
    "",
};

function now() { return Date.now(); }
function splitBatches<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

/** Normalize any provider → { [ticker]: price } */
async function fetchFromPolygon(tickers: string[]): Promise<Record<string, number>> {
  // /v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,MSFT
  const base = "https://api.polygon.io";
  const byBatch = await Promise.all(
    splitBatches(tickers, 50).map(async batch => {
      const url = `${base}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${batch.join(",")}&apiKey=${env.POLYGON_KEY}`;
      const r = await fetch(url, { next: { revalidate: 0 } });
      if (!r.ok) return {};
      const j: any = await r.json();
      const map: Record<string, number> = {};
      for (const s of j.tickers ?? []) {
        const t = String(s.ticker || "").toUpperCase();
        const p = Number(s.lastTrade?.p ?? s.daily?.close ?? s.min?.c ?? NaN);
        if (Number.isFinite(p)) map[t] = p;
      }
      return map;
    })
  );
  return Object.assign({}, ...byBatch);
}

async function fetchFromIEX(tickers: string[]): Promise<Record<string, number>> {
  // /stable/stock/market/batch?symbols=AAPL,MSFT&types=quote
  const base = "https://cloud.iexapis.com";
  const byBatch = await Promise.all(
    splitBatches(tickers, 100).map(async batch => {
      const url = `${base}/stable/stock/market/batch?symbols=${batch.join(",")}&types=quote&token=${env.IEX_KEY}`;
      const r = await fetch(url, { next: { revalidate: 0 } });
      if (!r.ok) return {};
      const j: any = await r.json();
      const map: Record<string, number> = {};
      for (const [sym, obj] of Object.entries<any>(j)) {
        const p = Number(obj?.quote?.iexRealtimePrice ?? obj?.quote?.latestPrice ?? NaN);
        if (Number.isFinite(p)) map[sym.toUpperCase()] = p;
      }
      return map;
    })
  );
  return Object.assign({}, ...byBatch);
}

async function fetchFromAlpha(tickers: string[]): Promise<Record<string, number>> {
  // AlphaVantage has poor batch support; fetch individually (slow, but OK for ≤20)
  const base = "https://www.alphavantage.co/query";
  const results = await Promise.all(
    tickers.map(async t => {
      const url = `${base}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(t)}&apikey=${env.ALPHA_KEY}`;
      const r = await fetch(url, { next: { revalidate: 0 } });
      if (!r.ok) return null;
      const j: any = await r.json();
      const p = Number(j?.["Global Quote"]?.["05. price"] ?? j?.["Global Quote"]?.["08. previous close"] ?? NaN);
      if (!Number.isFinite(p)) return null;
      // Be polite with the free tier
      await sleep(250);
      return { [t]: p };
    })
  );
  return Object.assign({}, ...results.filter(Boolean));
}

// For local/dev without a key
async function fetchMock(tickers: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of tickers) out[t] = 100 + (t.charCodeAt(0) % 30); // deterministic-ish
  return out;
}

async function fetchProvider(tickers: string[]) {
  switch (env.PROVIDER) {
    case "polygon": return fetchFromPolygon(tickers);
    case "iex":     return fetchFromIEX(tickers);
    case "alpha":   return fetchFromAlpha(tickers);
    default:        return fetchMock(tickers);
  }
}

/** Public: fetch live prices with cache */
export async function getLivePrices(tickers: string[]): Promise<Record<string, number>> {
  const key = tickers.map(t => t.toUpperCase()).sort().join(",");
  const hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_TTL_MS) return hit.data;

  const data = await fetchProvider(tickers.map(t => t.toUpperCase()));
  cache.set(key, { at: now(), data });
  return data;
}