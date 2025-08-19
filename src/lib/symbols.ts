// src/lib/symbols.ts
import fs from "node:fs/promises";
import path from "node:path";

export type SymbolRow = {
  ticker: string;
  company?: string;
  sector?: string;
};

let cache: { byTicker: Map<string, SymbolRow>; byName: Map<string, string> } | null = null;

function norm(s?: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9 &]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadSymbols(): Promise<{
  byTicker: Map<string, SymbolRow>;
  byName: Map<string, string>;
}> {
  if (cache) return cache;

  const file = path.join(process.cwd(), "data", "sp500_indicators.json");
  let rows: any[] = [];
  try {
    const raw = await fs.readFile(file, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) rows = arr;
  } catch {
    // ignore; empty dataset fallback
  }

  const byTicker = new Map<string, SymbolRow>();
  const byName = new Map<string, string>();

  for (const r of rows) {
    const t = String(r.ticker || "").toUpperCase();
    if (!t) continue;
    const company = String(r.company || "");
    const sector = r.sector ? String(r.sector) : undefined;
    byTicker.set(t, { ticker: t, company, sector });
    if (company) byName.set(norm(company), t);
  }

  // Common overrides/aliases (helps when dataset names differ from colloquial forms)
  const manual: [string, string][] = [
    ["apple", "AAPL"],
    ["microsoft", "MSFT"],
    ["google", "GOOGL"],
    ["alphabet", "GOOGL"],
    ["amazon", "AMZN"],
    ["nvidia", "NVDA"],
    ["meta", "META"],
    ["facebook", "META"],
    ["tesla", "TSLA"],
    ["berkshire", "BRK.B"],
    ["costco", "COST"],
  ];
  for (const [name, tk] of manual) {
    if (!byName.has(name)) byName.set(name, tk);
  }

  cache = { byTicker, byName };
  return cache!;
}

export async function findTickerFromText(text: string): Promise<string | null> {
  const { byTicker, byName } = await loadSymbols();
  const upper = text.toUpperCase();

  // 1) Direct ticker match (2–5 letters or formats like BRK.B)
  const direct = upper.match(/\b[A-Z]{2,5}(?:\.[A-Z])?\b/);
  if (direct) {
    const t = direct[0];
    if (byTicker.has(t)) return t;
  }

  // 2) Company name mention
  const n = text.toLowerCase();

  // Exact normalized name
  const exact = byName.get(n.trim());
  if (exact) return exact;

  // “includes” scan
  for (const [name, tk] of byName.entries()) {
    if (name && n.includes(name)) return tk;
  }

  // 3) Simple “stock of X” pattern
  const m = n.match(/\b(?:stock|shares|equity|company)\s+of\s+([a-z0-9 .&'-]{2,})/i);
  if (m) {
    const guess = m[1].trim();
    const gNorm = guess.toLowerCase();
    const fromGuess = byName.get(gNorm);
    if (fromGuess) return fromGuess;
  }

  return null;
}