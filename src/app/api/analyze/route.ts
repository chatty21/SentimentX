// src/app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { resolveTicker } from "@/lib/tickers";
import { fetchLiveNews, pickTopNewsWithLLM } from "@/lib/news";
import fs from "node:fs/promises";
import path from "node:path";

/** Build an absolute origin from the incoming request */
function originFromReq(req: Request) {
  // Next gives us a full URL here; safest way to get origin:
  try {
    const url = new URL(req.url);
    return url.origin;
  } catch {
    // Final fallback to env if needed
    return process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  }
}

/** JSON POST fetcher to your existing price route (absolute URL) */
async function pricesFor(base: string, tickers: string[]) {
  try {
    const r = await fetch(`${base}/api/prices`, {
      method: "POST",
      body: JSON.stringify({ tickers }),
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return {};
    const j = await r.json().catch(() => ({}));
    return j?.prices ?? {};
  } catch {
    return {};
  }
}

/** Pull MA50/RSI from indicators; prefer FS read (fast, reliable), fallback to HTTP */
async function loadIndicators(base: string) {
  // 1) Try reading from the filesystem
  try {
    const p = path.join(process.cwd(), "public", "data", "sp500_indicators.json");
    const txt = await fs.readFile(p, "utf-8");
    const arr = JSON.parse(txt);
    const map: Record<string, any> = {};
    for (const row of arr) {
      const t = String(row.ticker || row.symbol || "").toUpperCase();
      if (t) map[t] = row;
    }
    return map;
  } catch {
    // 2) Fallback to HTTP (works locally & when deployed)
    try {
      const r = await fetch(`${base}/data/sp500_indicators.json`, { cache: "no-store" });
      const arr = await r.json();
      const map: Record<string, any> = {};
      for (const row of arr) {
        const t = String(row.ticker || row.symbol || "").toUpperCase();
        if (t) map[t] = row;
      }
      return map;
    } catch {
      return {};
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const q: string = body?.query ?? "";
    let nTop: number = Number.isFinite(body?.nTop) ? Number(body.nTop) : 3;
    // Clamp to a small, safe range
    nTop = Math.max(1, Math.min(5, Math.floor(nTop)));

    const ticker = resolveTicker(q);
    if (!ticker) {
      return NextResponse.json({
        status: "need_ticker",
        message: "Please provide a valid S&P 500 ticker or company name.",
      });
    }

    const base = originFromReq(req);

    const [indicators, livePrices, newsRaw] = await Promise.all([
      loadIndicators(base),
      pricesFor(base, [ticker]),
      fetchLiveNews(ticker),
    ]);

    const row = indicators[ticker] ?? {};
    // If neither live nor dataset 'close' is usable, fall back to last historical close if present
    const hist = Array.isArray(row?.historical) ? row.historical : [];
    let lastHist: number | null = null;
    if (hist.length) {
      const last = Number(hist[hist.length - 1]);
      if (Number.isFinite(last)) lastHist = last;
    }
    const live = Number(livePrices[ticker]);
    const datasetClose = Number(row.close);
    const price =
      Number.isFinite(live) ? live :
      Number.isFinite(datasetClose) ? datasetClose :
      lastHist !== null ? lastHist : null;

    const ma50 = Number.isFinite(Number(row.ma_50)) ? Number(row.ma_50) : null;
    const rsi = Number.isFinite(Number(row.rsi)) ? Number(row.rsi) : null;

    const pctVsMA50 =
      price != null && ma50 != null && ma50 !== 0
        ? ((price - ma50) / ma50) * 100
        : typeof row.pct_vs_ma50 === "number"
        ? row.pct_vs_ma50
        : null;

    // Top headlines (LLM reranker if available)
    let titles: string[] = [];
    try {
      titles = await pickTopNewsWithLLM(ticker, newsRaw, nTop);
    } catch {
      titles = [];
    }

    // Select items deterministically. If LLM returns titles, match by case-insensitive title;
    // otherwise just take the first N items from the raw list.
    let selected = [] as typeof newsRaw;
    if (titles.length) {
      const lower = new Set(titles.map((s) => s.toLowerCase()));
      selected = newsRaw
        .filter((x) => typeof x?.title === "string" && lower.has(x.title.toLowerCase()))
        .slice(0, nTop);
    } else {
      selected = newsRaw.slice(0, nTop);
    }

    const news = selected.map((x) => ({
      title: x.title,
      link: x.url,
      source: x.source,
      published: x.publishedAt,
    }));

    return NextResponse.json({
      status: "ok",
      ticker,
      snapshot: {
        price: price == null ? null : Number(price.toFixed(2)),
        ma50: ma50 == null ? null : Number(ma50.toFixed(2)),
        rsi: rsi == null ? null : Number(rsi.toFixed(2)),
        pctVsMA50: pctVsMA50 == null || Number.isNaN(pctVsMA50) ? null : Number(pctVsMA50.toFixed(2)),
        sector: row.sector ?? null,
        company: row.company ?? null,
        high52: typeof row.high_52 === "number" ? Number(row.high_52) :
                typeof row.high52 === "number" ? Number(row.high52) : null,
        ma200: typeof row.ma_200 === "number" ? Number(row.ma_200) : null,
      },
      news,
    });
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", error: e?.message || "analyze_failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}