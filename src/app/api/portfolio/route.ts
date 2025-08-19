// src/app/api/portfolio/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTicker } from "@/lib/tickers";
import fs from "node:fs/promises";
import path from "node:path";

/* ------------------------------- types -------------------------------- */
type PriceMap = Record<string, number>;

type DBPortfolio = {
  user_key: string; // email for now
  cash: number;
  updated_at?: string;
};

type DBPosition = {
  id?: string;
  user_key: string; // email for now
  ticker: string;
  shares: number;
  avg_price: number;
  updated_at?: string;
};

type OutPosition = {
  ticker: string;
  shares: number;
  avgCost: number | null;
  price: number | null;
  marketValue: number | null;
  unrealizedPL: number | null;
  unrealizedPLPct: number | null;
};

const MAX_CASH = 10_000;

/* ----------------------------- utilities ------------------------------ */
function originFromReq(req: Request) {
  try {
    return new URL(req.url).origin;
  } catch {
    return (
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000"
    );
  }
}

async function pricesFor(base: string, tickers: string[]): Promise<PriceMap> {
  const list = (tickers || []).map((t) => String(t || "").toUpperCase().trim());
  if (!list.length) return {};
  const r = await fetch(`${base}/api/prices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tickers: list }),
    cache: "no-store",
  });
  if (!r.ok) return {};
  const j = (await r.json().catch(() => ({}))) as { prices?: PriceMap };
  return j?.prices ?? {};
}

/** Read indicators dataset (fallback prices) into a { TICKER: close } map */
async function loadIndicatorCloseMap(base: string): Promise<Record<string, number>> {
  // Prefer FS (fast in Node), fallback to HTTP
  try {
    const p = path.join(process.cwd(), "public", "data", "sp500_indicators.json");
    const txt = await fs.readFile(p, "utf-8");
    const arr = JSON.parse(txt) as Array<{ ticker?: string; close?: number }>;
    const out: Record<string, number> = {};
    for (const row of arr) {
      const t = String(row.ticker || "").toUpperCase();
      if (t && Number.isFinite(row.close)) out[t] = Number(row.close);
    }
    return out;
  } catch {
    try {
      const r = await fetch(`${base}/data/sp500_indicators.json`, { cache: "no-store" });
      const arr = (await r.json()) as Array<{ ticker?: string; close?: number }>;
      const out: Record<string, number> = {};
      for (const row of arr) {
        const t = String(row.ticker || "").toUpperCase();
        if (t && Number.isFinite(row.close)) out[t] = Number(row.close);
      }
      return out;
    } catch {
      return {};
    }
  }
}

async function ensurePortfolio(userKey: string): Promise<DBPortfolio> {
  const { data, error } = await supabaseAdmin
    .from("demo_portfolio_cash")
    .upsert({ user_key: userKey }, { onConflict: "user_key" })
    .select()
    .single<DBPortfolio>();
  if (error) throw error;
  return data;
}

async function getPositions(userKey: string): Promise<DBPosition[]> {
  const { data, error } = await supabaseAdmin
    .from("demo_portfolio_positions")
    .select("*")
    .eq("user_key", userKey)
    .returns<DBPosition[]>();
  if (error) throw error;
  return data || [];
}

function toUsd(n: number | null | undefined) {
  return n == null || Number.isNaN(n) ? null : +Number(n).toFixed(2);
}

/* -------------------------------- GET --------------------------------- */
export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { data: sessData, error: sessErr } = await (await supabase).auth.getSession();
  if (sessErr || !sessData.session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userEmail = sessData.session.user.email!;
  if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensurePortfolio(userEmail);
  const rows = await getPositions(userEmail);

  const base = originFromReq(req);
  const tickers = rows.map((r) => r.ticker.toUpperCase());
  const [livePrices, fallbackMap] = await Promise.all([
    pricesFor(base, tickers),
    loadIndicatorCloseMap(base),
  ]);

  const priceFor = (t: string): number | null => {
    const T = t.toUpperCase();
    const live = Number(livePrices[T]);
    if (Number.isFinite(live) && live > 0) return live;
    const fb = Number(fallbackMap[T]);
    return Number.isFinite(fb) && fb > 0 ? fb : null;
  };

  const positions: OutPosition[] = rows.map((r: DBPosition) => {
    const price = priceFor(r.ticker);
    const mv = price != null ? price * r.shares : null;
    const pl = price != null ? (price - r.avg_price) * r.shares : null;
    const plPct =
      price != null && r.avg_price > 0
        ? ((price - r.avg_price) / r.avg_price) * 100
        : null;
    return {
      ticker: r.ticker,
      shares: r.shares,
      avgCost: toUsd(r.avg_price),
      price: price == null ? null : toUsd(price)!,
      marketValue: mv == null ? null : toUsd(mv),
      unrealizedPL: pl == null ? null : toUsd(pl),
      unrealizedPLPct: plPct == null ? null : toUsd(plPct),
    };
  });

  // cash
  const { data: pf, error: e2 } = await supabaseAdmin
    .from("demo_portfolio_cash")
    .select("cash")
    .eq("user_key", userEmail)
    .single<Pick<DBPortfolio, "cash">>();
  if (e2) throw e2;

  const equity = positions.reduce((s, p) => s + (p.marketValue ?? 0), 0);
  const cash = Number((pf as any)?.cash ?? MAX_CASH);
  const total = +(cash + equity).toFixed(2);

  return NextResponse.json({
    cash: toUsd(cash),
    equity: toUsd(equity),
    total,
    positions,
    limit: MAX_CASH,
  });
}

/* -------------------------------- POST -------------------------------- */
export async function POST(req: Request) {
  // ✅ get the cookie snapshot for this request
  const cookieStore = await cookies();
  // 1) Get the server supabase client (await!)
  const supabase = supabaseServer();

  // 2) Read the current user from Supabase session cookie
  const {
    data: { user },
    error,
  } = await (await supabase).auth.getUser();

  if (error || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = user.email;

  // 3) The rest of your logic stays the same
  const base = originFromReq(req);
  const body = (await req.json().catch(() => ({}))) as any;
  const action = String(body?.action || "").toLowerCase(); // buy | sell | reset
  let ticker = String(body?.ticker || "").trim();
  const shares = Math.floor(Math.max(0, Number(body?.shares || 0)));

  await ensurePortfolio(userEmail);

  if (action === "reset") {
    const del = await supabaseAdmin
      .from("demo_portfolio_positions")
      .delete()
      .eq("user_key", userEmail);
    if (del.error) throw del.error;
    const upd = await supabaseAdmin
      .from("demo_portfolio_cash")
      .update({ cash: MAX_CASH, updated_at: new Date().toISOString() })
      .eq("user_key", userEmail);
    if (upd.error) throw upd.error;
    return await GET(req);
  }

  if (!["buy", "sell"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (shares <= 0) {
    return NextResponse.json({ error: "Shares must be > 0" }, { status: 400 });
  }

  // Resolve ticker from free text (e.g., "Amazon" -> "AMZN")
  const resolved = resolveTicker(ticker);
  ticker = (resolved || ticker).toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z][A-Z.\-]{0,6}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  // Live price with dataset fallback
  const [liveMap, fbMap] = await Promise.all([
    pricesFor(base, [ticker]),
    loadIndicatorCloseMap(base),
  ]);
  const live = Number(liveMap[ticker]);
  const price =
    Number.isFinite(live) && live > 0
      ? live
      : Number.isFinite((fbMap as any)[ticker])
      ? Number((fbMap as any)[ticker])
      : NaN;

  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "No live price for ticker" }, { status: 400 });
  }

  // Fetch current cash + position
  const { data: pfRow, error: pfErr } = await supabaseAdmin
    .from("demo_portfolio_cash")
    .select("cash")
    .eq("user_key", userEmail)
    .single<Pick<DBPortfolio, "cash">>();
  if (pfErr) throw pfErr;
  let cash = Number((pfRow as any)?.cash ?? MAX_CASH);

  const { data: posRow } = await supabaseAdmin
    .from("demo_portfolio_positions")
    .select("*")
    .eq("user_key", userEmail)
    .eq("ticker", ticker)
    .maybeSingle<DBPosition>();

  const existingShares = Number(posRow?.shares || 0);
  const existingAvg = Number(posRow?.avg_price || 0);

  if (action === "buy") {
    const cost = shares * price;
    if (cost > cash + 1e-6) {
      return NextResponse.json({ error: "Insufficient cash" }, { status: 400 });
    }
    const newShares = existingShares + shares;
    const newAvg =
      newShares === 0
        ? 0
        : (existingAvg * existingShares + price * shares) / newShares;

    const up = await supabaseAdmin
      .from("demo_portfolio_positions")
      .upsert(
        { user_key: userEmail, ticker, shares: newShares, avg_price: newAvg },
        { onConflict: "user_key,ticker" }
      )
      .select();
    if (up.error) throw up.error;

    cash = cash - cost;
    const upd = await supabaseAdmin
      .from("demo_portfolio_cash")
      .update({ cash, updated_at: new Date().toISOString() })
      .eq("user_key", userEmail);
    if (upd.error) throw upd.error;
  } else {
    // SELL
    if (shares > existingShares) {
      return NextResponse.json({ error: "Not enough shares to sell" }, { status: 400 });
    }
    const proceeds = shares * price;
    const newShares = existingShares - shares;

    if (newShares === 0) {
      const del = await supabaseAdmin
        .from("demo_portfolio_positions")
        .delete()
        .eq("user_key", userEmail)
        .eq("ticker", ticker);
      if (del.error) throw del.error;
    } else {
      const updPos = await supabaseAdmin
        .from("demo_portfolio_positions")
        .update({ shares: newShares }) // keep avg_price
        .eq("user_key", userEmail)
        .eq("ticker", ticker);
      if (updPos.error) throw updPos.error;
    }

    cash = cash + proceeds;
    const upd = await supabaseAdmin
      .from("demo_portfolio_cash")
      .update({ cash, updated_at: new Date().toISOString() })
      .eq("user_key", userEmail);
    if (upd.error) throw upd.error;
  }

  return await GET(req);
}