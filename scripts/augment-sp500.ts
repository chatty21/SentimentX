// scripts/augment-sp500.ts
// Run:  npx ts-node scripts/augment-sp500.ts
// Reads:  data/sp500_indicators.json
// Writes: data/sp500_indicators.json  (overwrites with augmented rows)

import fs from "node:fs/promises";
import path from "node:path";

type Row = {
  ticker: string;
  close?: number | null;

  // existing fields you already have
  rsi?: number | null;
  ma_50?: number | null;
  ma_200?: number | null;
  price_change_pct?: number | null;
  sector?: string | null;

  // newly augmented
  dividendYield?: number | null;
  payoutRatio?: number | null;
  epsGrowth?: number | null;
  revenueGrowth?: number | null;
};

// tiny helpers
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nz = (v: unknown, fallback: number | null = null): number | null =>
  isNum(v) ? v : fallback;

async function readIndicators(): Promise<Row[]> {
  const p = path.join(process.cwd(), "data", "sp500_indicators.json");
  const raw = await fs.readFile(p, "utf-8").catch(() => "[]");
  const arr = JSON.parse(raw);
  return Array.isArray(arr) ? arr : [];
}

async function writeIndicators(rows: Row[]) {
  const p = path.join(process.cwd(), "data", "sp500_indicators.json");
  await fs.writeFile(p, JSON.stringify(rows, null, 2), "utf-8");
}

/**
 * Pretend fetcher — replace this with your real fundamentals call(s).
 * Keep all fields optional; return numbers where you can, null otherwise.
 */
async function fetchFundamentals(ticker: string): Promise<{
  price?: number | null;
  lastDiv?: number | null;          // trailing 12M dividend per share
  payoutRatio?: number | null;      // %
  epsGrowth?: number | null;        // YoY %
  revenueGrowth?: number | null;    // YoY %
}> {
  // TODO: wire to your data provider(s). This stub returns nothing (nulls),
  // which still exercises the type-safe merging.
  return {
    price: null,
    lastDiv: null,
    payoutRatio: null,
    epsGrowth: null,
    revenueGrowth: null,
  };
}

async function augmentOne(base: Row): Promise<Row> {
  try {
    const f = await fetchFundamentals(base.ticker);

    // prefer your dataset’s close; fall back to fetched price
    const price = nz(base.close, null) ?? nz(f.price, null);

    // If we have lastDiv and price, compute a trailing dividend yield
    const dividendYield = isNum(f.lastDiv) && isNum(price) && price > 0
      ? (f.lastDiv / price) * 100
      : null;

    const payoutRatio = nz(f.payoutRatio, null); // %
    const epsGrowth = nz(f.epsGrowth, null);     // %
    const revenueGrowth = nz(f.revenueGrowth, null); // %

    return {
      ...base,
      dividendYield: isNum(dividendYield) ? dividendYield : null,
      payoutRatio: isNum(payoutRatio) ? payoutRatio : null,
      epsGrowth: isNum(epsGrowth) ? epsGrowth : null,
      revenueGrowth: isNum(revenueGrowth) ? revenueGrowth : null,
    };
  } catch {
    return { ...base, dividendYield: null, payoutRatio: null, epsGrowth: null, revenueGrowth: null };
  }
}

async function main() {
  const rows = await readIndicators();
  if (!rows.length) {
    console.error("No rows in data/sp500_indicators.json");
    return;
  }

  const out: Row[] = [];
  for (const r of rows) {
    out.push(await augmentOne(r));
  }
  await writeIndicators(out);
  console.log(`✅ Augmented ${out.length} rows → data/sp500_indicators.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});