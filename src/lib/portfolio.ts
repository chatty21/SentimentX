// src/lib/portfolio.ts
// Sector-aware portfolio builder with progressive fallbacks and safety guards.
// Works even when strict filters produce too few matches.

export type DatasetRow = {
    ticker: string;
    sector?: string;
  
    // price fields (any one may exist)
    close?: number;
    price?: number;
    last?: number;
  
    // optional fundamentals / signals (use whatever your dataset provides)
    dividend_yield?: number;
    dividendYield?: number;
    dy?: number;
  
    market_cap?: number;
    marketCap?: number;
    market_capitalization?: number;
  
    rsi?: number;
    high52?: number;
    "52w_high"?: number;
  };
  
  export type BuildOpts = {
    amount: number;               // total dollars to allocate
    n: number;                    // total positions desired
    tilt?: "dividend" | "growth" | "balanced";
  
    // Base screening floors (optional)
    minDividendYield?: number;    // e.g., 4
    minMarketCap?: number;        // e.g., 10_000_000_000
  
    // Quality/safety knobs
    minPrice?: number;            // e.g., 5 to avoid penny-like artifacts
    include?: string[];           // force-include tickers if they pass price checks
    exclude?: string[];           // hard exclude list
  
    // Fallback tuning (optional)
    relaxYieldTo?: number;        // default 2.0
    relaxYieldStep?: number;      // default 0.5
    relaxCapTo?: number;          // default 5_000_000_000
    relaxCapFactor?: number;      // default 0.8
  };
  
  export type SectorWeights = Record<string, number>; // e.g. { "Information Technology": 0.5, Utilities: 0.5 }
  
  export type Allocation = {
    ticker: string;
    dollars: number;
    estShares?: number;
    notes?: string;
    sector?: string;
  };
  
  // ------------------ utils ------------------
  
  function cleanTicker(t: string) {
    return (t || "").toUpperCase().trim();
  }
  
  function num(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  
  function getPrice(r: DatasetRow): number | null {
    return num(r.close ?? r.price ?? r.last);
  }
  
  function getYield(r: DatasetRow): number | null {
    return num(r.dividend_yield ?? r.dividendYield ?? r.dy);
  }
  
  function getMktCap(r: DatasetRow): number | null {
    return num(r.market_cap ?? r.marketCap ?? r.market_capitalization);
  }
  
  function uniqByTicker<T extends { ticker: string }>(arr: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of arr) {
      const t = cleanTicker(x.ticker);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ ...x, ticker: t });
    }
    return out;
  }
  
  function sectorOf(r: DatasetRow) {
    return (r.sector || "Unknown").trim();
  }
  
  function sharesFrom(dollars?: number, price?: number): number | undefined {
    if (!dollars || !price || !Number.isFinite(price) || price <= 0) return undefined;
    return +(dollars / price).toFixed(4);
  }
  
  function formatCap(v: number) {
    if (v >= 1e12) return (v / 1e12).toFixed(2) + "T";
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    return v.toFixed(0);
  }
  
  function yieldNote(r: DatasetRow): string | undefined {
    const y = getYield(r);
    const m = getMktCap(r);
    const parts: string[] = [];
    if (y != null) parts.push(`Yield ${y.toFixed(2)}%`);
    if (m != null) parts.push(`MktCap $${formatCap(m)}`);
    return parts.length ? parts.join(", ") : undefined;
  }
  
  // ------------------ screeners & rankers ------------------
  
  type Screen = {
    minYield?: number;
    minMktCap?: number;
  
    // extra controls
    minPrice?: number;
    include?: string[];
    exclude?: string[];
  };
  
  function screenRows(rows: DatasetRow[], sc: Screen): DatasetRow[] {
    const minY = sc.minYield ?? -Infinity;
    const minC = sc.minMktCap ?? -Infinity;
    const minP = sc.minPrice ?? 0;
    const include = new Set((sc.include || []).map(cleanTicker));
    const exclude = new Set((sc.exclude || []).map(cleanTicker));
  
    return rows.filter((r) => {
      const t = cleanTicker(r.ticker);
      if (!t || exclude.has(t)) return false;
  
      const px = getPrice(r);
      if (px == null || !Number.isFinite(px) || px <= 0 || px < minP) return false;
  
      const y = getYield(r);
      const mc = getMktCap(r);
  
      if (y != null && y < minY) return false;
      if (mc != null && mc < minC) return false;
  
      // include-list does not bypass quality floors; it’s informational.
      // If you want “include” to hard-force names, you could treat them separately upstream.
      return true;
    });
  }
  
  // Dividend-oriented ranking: higher yield, then larger cap, then cheaper price
  function rankForDividend(a: DatasetRow, b: DatasetRow): number {
    const ay = getYield(a) ?? -Infinity;
    const by = getYield(b) ?? -Infinity;
    if (by !== ay) return by - ay;
  
    const am = getMktCap(a) ?? -Infinity;
    const bm = getMktCap(b) ?? -Infinity;
    if (bm !== am) return bm - am;
  
    const ap = getPrice(a) ?? Infinity;
    const bp = getPrice(b) ?? Infinity;
    return ap - bp;
  }
  
  // ------------------ progressive fallback for a sector ------------------
  
  type FallbackTuning = {
    relaxYieldTo?: number;   // default 2.0
    relaxYieldStep?: number; // default 0.5
    relaxCapTo?: number;     // default 5B
    relaxCapFactor?: number; // default 0.8
  };
  
  function fillSectorWithFallback(
    sectorRows: DatasetRow[],
    strict: Screen & FallbackTuning,
    targetN: number
  ): DatasetRow[] {
    const relaxYieldTo   = strict.relaxYieldTo   ?? 2.0;
    const relaxYieldStep = strict.relaxYieldStep ?? 0.5;
    const relaxCapTo     = strict.relaxCapTo     ?? 5_000_000_000;
    const relaxCapFactor = strict.relaxCapFactor ?? 0.8;
  
    // 1) strict
    let pool = screenRows(sectorRows, strict).sort(rankForDividend);
    if (pool.length >= targetN) return pool.slice(0, targetN);
  
    // 2) relax yield floor gradually
    let minY = strict.minYield ?? 0;
    while (pool.length < targetN && minY > relaxYieldTo) {
      minY = Math.max(relaxYieldTo, minY - relaxYieldStep);
      pool = screenRows(sectorRows, { ...strict, minYield: minY }).sort(rankForDividend);
      if (pool.length >= targetN) return pool.slice(0, targetN);
    }
  
    // 3) relax market cap floor gradually
    let minC = strict.minMktCap ?? 0;
    while (pool.length < targetN && minC > relaxCapTo) {
      minC = Math.max(relaxCapTo, Math.floor(minC * relaxCapFactor));
      pool = screenRows(sectorRows, { ...strict, minYield: minY, minMktCap: minC }).sort(rankForDividend);
      if (pool.length >= targetN) return pool.slice(0, targetN);
    }
  
    // 4) last resort: ignore floors, take best dividend rankers w/ price guard
    pool = sectorRows
      .filter((r) => {
        const px = getPrice(r);
        return px != null && Number.isFinite(px) && px > 0 && px >= (strict.minPrice ?? 0);
      })
      .sort(rankForDividend);
  
    return pool.slice(0, Math.min(targetN, pool.length));
  }
  
  // ------------------ public APIs ------------------
  
  /** Legacy equal-weight (no sector targeting). */
  export function buildPortfolio(rows: DatasetRow[], opts: BuildOpts): Allocation[] {
    const { amount, n, minDividendYield, minMarketCap } = opts;
    const strict: Screen = {
      minYield: minDividendYield,
      minMktCap: minMarketCap,
      minPrice: opts.minPrice ?? 0,
      include: opts.include,
      exclude: opts.exclude,
    };
  
    const pool = screenRows(uniqByTicker(rows), strict).sort(rankForDividend);
    const picks = pool.slice(0, Math.min(n, pool.length));
    if (picks.length === 0) return [];
  
    const perName = amount / picks.length;
    return picks.map((r) => {
      const px = getPrice(r) ?? 0;
      return {
        ticker: r.ticker,
        sector: r.sector,
        dollars: perName,
        estShares: sharesFrom(perName, px),
        notes: yieldNote(r),
      };
    });
  }
  
  /** Normalize weights to sum to 1 (if possible). */
  function normalizeWeights(w: SectorWeights): SectorWeights {
    const entries = Object.entries(w);
    const sum = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
    if (sum <= 0) return w;
    const out: SectorWeights = {};
    for (const [k, v] of entries) out[k] = (Number(v) || 0) / sum;
    return out;
  }
  
  /** Sector-balanced builder with robust fallbacks. */
  export function buildPortfolioSectorBalanced(
    rows: DatasetRow[],
    opts: BuildOpts,
    sectorWeights: SectorWeights
  ): Allocation[] {
    const weights = normalizeWeights(sectorWeights);
    const base = uniqByTicker(rows);
    const sectors = Object.entries(weights).filter(([, w]) => w > 0);
    if (sectors.length === 0) return [];
  
    const totalSlots = Math.max(1, opts.n);
  
    // Deterministic slot split: floor + distribute largest fractional remainders
    const desired = sectors.map(([sec, w]) => ({ sector: sec, exact: totalSlots * w }));
    const floorSlots = desired.map((d) => ({
      sector: d.sector,
      slots: Math.floor(d.exact),
      frac: d.exact - Math.floor(d.exact),
    }));
    let used = floorSlots.reduce((s, x) => s + x.slots, 0);
    floorSlots.sort((a, b) => b.frac - a.frac || a.sector.localeCompare(b.sector));
    for (let i = 0; used < totalSlots && i < floorSlots.length; i++, used++) floorSlots[i].slots++;
  
    const strict: Screen & FallbackTuning = {
      minYield: opts.minDividendYield,
      minMktCap: opts.minMarketCap,
      minPrice: opts.minPrice ?? 0,
      include: opts.include,
      exclude: opts.exclude,
      relaxYieldTo: opts.relaxYieldTo,
      relaxYieldStep: opts.relaxYieldStep,
      relaxCapTo: opts.relaxCapTo,
      relaxCapFactor: opts.relaxCapFactor,
    };
  
    const chosen: DatasetRow[] = [];
    for (const { sector, slots } of floorSlots) {
      if (slots <= 0) continue;
      const sectorRows = base.filter((r) => sectorOf(r) === sector);
      const fill = fillSectorWithFallback(sectorRows, strict, slots);
      chosen.push(...fill);
    }
  
    // Backfill if short (e.g., not enough names overall)
    const deficit = totalSlots - chosen.length;
    if (deficit > 0) {
      const chosenTickers = new Set(chosen.map((r) => r.ticker));
      const rest = screenRows(
        base.filter((r) => !chosenTickers.has(r.ticker)),
        strict
      )
        .sort(rankForDividend)
        .slice(0, deficit);
      chosen.push(...rest);
    }
  
    if (!chosen.length) return [];
  
    // Allocate dollars per sector bucket, then equal weight inside the bucket
    const allocations: Allocation[] = [];
    for (const { sector, slots } of floorSlots) {
      if (slots <= 0) continue;
      const names = chosen.filter((r) => sectorOf(r) === sector).slice(0, slots);
      if (!names.length) continue;
      const sectorDollars = opts.amount * (weights[sector] ?? 0);
      const perName = sectorDollars / names.length;
  
      for (const r of names) {
        const px = getPrice(r) ?? 0;
        allocations.push({
          ticker: r.ticker,
          sector,
          dollars: perName,
          estShares: sharesFrom(perName, px),
          notes: yieldNote(r),
        });
      }
    }
  
    // Pad if still short (rare edge case)
    if (allocations.length < totalSlots) {
      const chosenTickers = new Set(allocations.map((a) => a.ticker));
      const remaining = chosen.filter((r) => !chosenTickers.has(r.ticker));
      const perName = opts.amount / totalSlots;
      for (const r of remaining) {
        if (allocations.length >= totalSlots) break;
        const px = getPrice(r) ?? 0;
        allocations.push({
          ticker: r.ticker,
          sector: sectorOf(r),
          dollars: perName,
          estShares: sharesFrom(perName, px),
          notes: yieldNote(r),
        });
      }
    }
  
    return allocations.slice(0, totalSlots);
  }
  
  // ------------------ formatting helpers ------------------
  
  /** Pretty print allocations for the chatbot. */
  export function formatAllocationsForChat(
    header: string,
    allocations: Allocation[]
  ): string {
    if (!allocations.length) return `${header}\n\nNo qualifying names found.`;
  
    const lines = allocations.map((a) =>
      `• ${a.ticker}${a.sector ? ` (${a.sector})` : ""} — $${a.dollars.toFixed(2)}`
      + (a.estShares ? ` (~${a.estShares} sh est)` : ``)
      + (a.notes ? ` | ${a.notes}` : ``)
    );
    const total = allocations.reduce((s, x) => s + (x.dollars || 0), 0);
    return `${header}\n\n${lines.join("\n")}\n\nTotal: $${total.toFixed(2)}`;
  }