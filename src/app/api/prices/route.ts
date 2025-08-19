// src/app/api/prices/route.ts
import { NextResponse } from "next/server";

/**
 * Request:  { tickers: string[] }
 * Response: {
 *   prices: Record<string, number>;
 *   asOf: number;                   // epoch ms (added)
 *   source: string;                 // first provider attempted
 *   filled: number;                 // # of tickers resolved
 *   errors: Record<string, string>; // per-ticker notes
 * }
 *
 * Provider order:
 *  1) PRICES_PROVIDER (polygon | iex | finnhub | alphavantage)
 *  2) Remaining providers with keys, in that priority
 */

type Provider = "polygon" | "iex" | "finnhub" | "alphavantage";

const ENV = {
  PREFERRED: (process.env.PRICES_PROVIDER || "").toLowerCase() as Provider | "",
  POLYGON_KEY: process.env.POLYGON_API_KEY || "",
  IEX_KEY: process.env.IEX_CLOUD_API_KEY || "",
  FINNHUB_KEY: process.env.FINNHUB_API_KEY || "",
  AV_KEY: process.env.ALPHA_VANTAGE_API_KEY || "",
};

const hasProvider = {
  polygon: !!ENV.POLYGON_KEY,
  iex: !!ENV.IEX_KEY,
  finnhub: !!ENV.FINNHUB_KEY,
  alphavantage: !!ENV.AV_KEY,
};

const ORDER: Provider[] = ["polygon", "iex", "finnhub", "alphavantage"];

function providerOrder(): Provider[] {
  const prefer = ENV.PREFERRED && ORDER.includes(ENV.PREFERRED) ? [ENV.PREFERRED] : [];
  const rest = ORDER.filter((p) => p !== ENV.PREFERRED);
  return [...prefer, ...rest].filter((p) => hasProvider[p]);
}

function normTicker(t: string) {
  return String(t || "").trim().toUpperCase();
}

function round2(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
}

/* -----------------------------
 * Tiny in-memory response cache
 * ----------------------------- */
type CacheEntry = {
  key: string;
  asOf: number;
  exp: number;
  payload: {
    prices: Record<string, number>;
    source: string;
    filled: number;
    errors: Record<string, string>;
  };
};
const G: any = globalThis as any;
G.__PRICE_CACHE__ = G.__PRICE_CACHE__ || new Map<string, CacheEntry>();
const TTL_MS = 4000; // 4s is plenty for dev/preview; adjust if you want

/* ============================================================
   Individual provider fetchers (each returns partial results)
   ============================================================ */

async function fetchPolygon(tickers: string[]) {
  // Try last trade; if forbidden, fall back to previous close.
  const out: Record<string, number> = {};
  const errs: Record<string, string> = {};

  // 1) last trade (one-by-one; dev friendly)
  await Promise.allSettled(
    tickers.map(async (t) => {
      try {
        const r = await fetch(
          `https://api.polygon.io/v2/last/trade/${encodeURIComponent(t)}?apiKey=${ENV.POLYGON_KEY}`,
          { cache: "no-store" }
        );
        if (r.ok) {
          const j = await r.json();
          const p = round2(j?.results?.p);
          if (p !== undefined) out[t] = p;
          else errs[t] = "polygon: no last trade";
        } else {
          errs[t] = `polygon: ${r.status}`;
        }
      } catch (e: any) {
        errs[t] = `polygon: ${e?.message || "network_error"}`;
      }
    })
  );

  // 2) previous close (only for tickers still missing)
  const missing = tickers.filter((t) => out[t] === undefined);
  await Promise.allSettled(
    missing.map(async (t) => {
      try {
        const r = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(t)}/prev?adjusted=true&apiKey=${ENV.POLYGON_KEY}`,
          { cache: "no-store" }
        );
        if (r.ok) {
          const j = await r.json();
          const c = j?.results?.[0]?.c;
          const p = round2(c);
          if (p !== undefined) {
            out[t] = p;
            delete errs[t];
          } else {
            errs[t] = "polygon: no prev close";
          }
        } else {
          errs[t] = `polygon prev: ${r.status}`;
        }
      } catch (e: any) {
        errs[t] = `polygon prev: ${e?.message || "network_error"}`;
      }
    })
  );

  return { prices: out, errors: errs };
}

async function fetchIEX(tickers: string[]) {
  const out: Record<string, number> = {};
  const errs: Record<string, string> = {};
  try {
    const url = `https://cloud.iexapis.com/stable/stock/market/batch?symbols=${encodeURIComponent(
      tickers.join(",")
    )}&types=quote&token=${ENV.IEX_KEY}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`iex: http ${r.status}`);
    const j = await r.json();
    for (const t of tickers) {
      const q = j?.[t]?.quote;
      const p = round2(q?.latestPrice ?? q?.iexRealtimePrice ?? q?.delayedPrice);
      if (p !== undefined) out[t] = p;
      else errs[t] = "iex: no price";
    }
  } catch (e: any) {
    for (const t of tickers) errs[t] = `iex: ${e?.message || "error"}`;
  }
  return { prices: out, errors: errs };
}

async function fetchFinnhub(tickers: string[]) {
  const out: Record<string, number> = {};
  const errs: Record<string, string> = {};
  await Promise.allSettled(
    tickers.map(async (t) => {
      try {
        const r = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t)}&token=${ENV.FINNHUB_KEY}`,
          { cache: "no-store" }
        );
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = await r.json(); // { c: current, pc: prev close }
        const p = round2(j?.c ?? j?.pc);
        if (p !== undefined) out[t] = p;
        else errs[t] = "finnhub: no price";
      } catch (e: any) {
        errs[t] = `finnhub: ${e?.message || "error"}`;
      }
    })
  );
  return { prices: out, errors: errs };
}

async function fetchAlphaVantage(tickers: string[]) {
  const out: Record<string, number> = {};
  const errs: Record<string, string> = {};
  for (const t of tickers) {
    try {
      const r = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
          t
        )}&apikey=${ENV.AV_KEY}`,
        { cache: "no-store" }
      );
      if (!r.ok) throw new Error(`http ${r.status}`);
      const j = await r.json();
      const raw =
        j?.["Global Quote"]?.["05. price"] ?? j?.["Global Quote"]?.["08. previous close"];
      const p = round2(Number(raw));
      if (p !== undefined) out[t] = p;
      else errs[t] = "alphavantage: no price";
      await new Promise((res) => setTimeout(res, 250)); // be nice to free tier
    } catch (e: any) {
      errs[t] = `alphavantage: ${e?.message || "error"}`;
    }
  }
  return { prices: out, errors: errs };
}

/* ==========================================
   Resolve: try providers until filled/done
   ========================================== */

async function resolvePrices(tickersRaw: string[]) {
  const tickers = Array.from(new Set(tickersRaw.map(normTicker).filter(Boolean)));
  const prices: Record<string, number> = {};
  const errors: Record<string, string> = {};

  const chain = providerOrder();
  if (chain.length === 0) {
    throw new Error(
      "No price provider configured. Set PRICES_PROVIDER and the matching API key in .env.local"
    );
  }

  for (const provider of chain) {
    const remaining = tickers.filter((t) => prices[t] === undefined);
    if (!remaining.length) break;

    let res:
      | { prices: Record<string, number>; errors: Record<string, string> }
      | undefined;

    if (provider === "polygon") res = await fetchPolygon(remaining);
    else if (provider === "iex") res = await fetchIEX(remaining);
    else if (provider === "finnhub") res = await fetchFinnhub(remaining);
    else if (provider === "alphavantage") res = await fetchAlphaVantage(remaining);

    if (res) {
      Object.assign(prices, res.prices);
      Object.assign(errors, res.errors);
    }
  }

  const filled = Object.keys(prices).length;
  const source = chain[0];
  return { prices, source, filled, errors };
}

/* ------------- Route handlers ------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tickers = Array.isArray(body?.tickers) ? body.tickers : [];
    if (!tickers.length) {
      return NextResponse.json({ error: "tickers[] required" }, { status: 400 });
    }

    // cache key = sorted, uppercased tickers joined by ","
    const key = Array.from(new Set(tickers.map(normTicker))).sort().join(",");
    const now = Date.now();

    const cached: CacheEntry | undefined = G.__PRICE_CACHE__.get(key);
    if (cached && cached.exp > now) {
      return NextResponse.json({ ...cached.payload, asOf: cached.asOf }, { status: 200 });
    }

    const { prices, source, filled, errors } = await resolvePrices(tickers);

    const payload = { prices, source, filled, errors };
    const entry: CacheEntry = { key, asOf: now, exp: now + TTL_MS, payload };
    G.__PRICE_CACHE__.set(key, entry);

    return NextResponse.json({ ...payload, asOf: now }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "prices_failed" }, { status: 500 });
  }
}

export async function GET() {
  // simple health ping
  return NextResponse.json({
    ok: true,
    providerOrder: providerOrder(),
    configured: {
      polygon: hasProvider.polygon,
      iex: hasProvider.iex,
      finnhub: hasProvider.finnhub,
      alphavantage: hasProvider.alphavantage,
    },
    cacheTtlMs: TTL_MS,
  });
}
export { resolvePrices };