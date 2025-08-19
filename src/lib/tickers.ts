// src/lib/tickers.ts
import { SP500_COMPANIES } from "@/data/sp500Companies";

/**
 * Build a case-insensitive lookup from simplified company names → ticker.
 * We normalize names by lowercasing and stripping punctuation & suffixes (inc, corp, plc, co, ltd).
 */
const SUFFIX_RE = /\b(incorporated|inc|corp|corporation|company|co|ltd|plc|lp|llc|holdings?|group|the)\b/g;
const NON_ALNUM = /[^a-z0-9]+/g;

function simplifyName(s: string): string {
  return s
    .toLowerCase()
    .replace(SUFFIX_RE, "")        // strip common suffixes
    .replace(NON_ALNUM, " ")       // normalize punctuation
    .replace(/\s+/g, " ")          // collapse spaces
    .trim();
}

// Build once at module load.
const NAME_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const [ticker, name] of Object.entries(SP500_COMPANIES)) {
    const simp = simplifyName(name);
    if (simp) idx[simp] = ticker;

    // add a short alias if the first word is unique (e.g., "apple", "amazon")
    const first = simp.split(" ")[0];
    if (first && !idx[first]) idx[first] = ticker;
  }

  // Handful of common manual aliases (optional safety net)
  const aliases: Record<string, string> = {
    "google": "GOOGL",        // Alphabet
    "alphabet": "GOOGL",
    "facebook": "META",       // Meta Platforms
    "meta": "META",
    "broadcom": "AVGO",
    "booking": "BKNG",
    "costco": "COST",
    "home depot": "HD",
    "unitedhealth": "UNH",
  };
  for (const [k, v] of Object.entries(aliases)) {
    idx[simplifyName(k)] = v;
  }
  return idx;
})();

/** Strip common decorations users type: $AAPL, spaces, punctuation. */
function normalizeFreeText(input: string): string {
  const s = String(input || "").trim();
  return s.replace(/^\$/, "").trim(); // remove $ prefix
}

/** Return an S&P 500 ticker for a free-text string ("AAPL", "Apple", "Amazon"). */
export function resolveTicker(input: string): string | null {
  if (!input) return null;
  const raw = normalizeFreeText(input);
  const upper = raw.toUpperCase();

  // 1) Exact ticker ONLY if it exists in our universe
  if (/^[A-Z][A-Z.\-]{0,6}$/.test(upper) && SP500_COMPANIES[upper]) {
    return upper;
  }

  // 2) Name-based: try exact simplified name → ticker
  const simp = simplifyName(raw);
  if (simp && NAME_INDEX[simp]) return NAME_INDEX[simp];

  // 3) Starts-with match (e.g., "apple i" → AAPL)
  const starts = Object.keys(NAME_INDEX).find((k) => k.startsWith(simp));
  if (starts) return NAME_INDEX[starts];

  // 4) Includes match (e.g., "apple computer" → AAPL)
  const includes = Object.keys(NAME_INDEX).find((k) => k.includes(simp));
  if (includes) return NAME_INDEX[includes];

  // Not found
  return null;
}