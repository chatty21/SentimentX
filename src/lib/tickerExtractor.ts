import { SP500_COMPANIES } from "@/data/sp500Companies";

const EXTRA_TICKERS = ["SPY", "QQQ", "DIA"];
const TICKERS_SET = new Set<string>([...Object.keys(SP500_COMPANIES), ...EXTRA_TICKERS]);

const MANUAL_ALIASES: Record<string, string[]> = {
  google: ["GOOGL", "GOOG"],
  alphabet: ["GOOGL", "GOOG"],
  meta: ["META"], facebook: ["META"],
  nvidia: ["NVDA"], amd: ["AMD"],
  microsoft: ["MSFT"], apple: ["AAPL"], tesla: ["TSLA"],
  berkshire: ["BRK.B", "BRK.A"], "berkshire hathaway": ["BRK.B", "BRK.A"],
  unitedhealth: ["UNH"], unitedhealthcare: ["UNH"],
  jpmorgan: ["JPM"], "jp morgan": ["JPM"],
  morganstanley: ["MS"], broadcom: ["AVGO"], costco: ["COST"],
  exxon: ["XOM"], chevron: ["CVX"], ibm: ["IBM"],
  disney: ["DIS"], netflix: ["NFLX"], adobe: ["ADBE"],
  salesforce: ["CRM"], pepsico: ["PEP"], cocacola: ["KO"], "coca cola": ["KO"],
  mcdonalds: ["MCD"], "mcdonald's": ["MCD"],
};

function norm(s: string) {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s\.]/g, " ").replace(/\s+/g, " ").trim();
}

const NAME_TO_TICKER = (() => {
  const map = new Map<string, string[]>();
  for (const [t, company] of Object.entries(SP500_COMPANIES)) {
    const n = norm(company);
    (map.get(n) ?? map.set(n, []).get(n)!).push(t);
    const lite = n.replace(/\b(incorporated|inc|corp(oration)?|company|co|plc|ltd|limited)\b/g, "").replace(/\s+/g, " ").trim();
    if (lite && lite !== n) (map.get(lite) ?? map.set(lite, []).get(lite)!).push(t);
  }
  for (const [alias, list] of Object.entries(MANUAL_ALIASES)) {
    const n = norm(alias);
    (map.get(n) ?? map.set(n, []).get(n)!).push(...list.filter((x) => !map.get(n)!.includes(x)));
  }
  return map;
})();

function tokenize(text: string) {
  const cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[“”‘’]/g, "'");
  return cleaned.split(/[\s,;:\/()\[\]{}|]+/).filter(Boolean);
}

function fuzzyCompanyScore(q: string, name: string): number {
  if (q === name) return 1;
  if (name.includes(q)) return 0.85;
  if (q.includes(name)) return 0.75;
  const qa = new Set(q.split(" ").filter(Boolean));
  const na = new Set(name.split(" ").filter(Boolean));
  let hit = 0; qa.forEach((w) => na.has(w) && hit++);
  const denom = Math.max(1, Math.min(qa.size, na.size));
  return (hit / denom) * 0.7;
}

export type ExtractResult = {
  bestTicker: string | null;
  allTickers: string[];
  matchedBy: "symbol" | "company" | "alias" | "cookie" | "clientHint" | null;
  confidence: 0 | 0.25 | 0.5 | 0.75 | 1;
  reason?: string;
};

export function extractTickersRich(
  text: string,
  opts?: { lastCookieTicker?: string | null; lastClientTicker?: string | null; preferLatest?: boolean }
): ExtractResult {
  const preferLatest = opts?.preferLatest !== false;

  const tokens = tokenize(text);
  const symbols: string[] = [];
  for (const raw of tokens) {
    const core = raw.replace(/^[\$#]/, "").replace(/[?!\.,]+$/g, "");
    if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(core)) {
      const up = core.toUpperCase();
      if (TICKERS_SET.has(up)) symbols.push(up);
    }
  }
  const ordered = preferLatest ? symbols : [...symbols].reverse();
  const uniqSymbols = Array.from(new Set(ordered));
  if (uniqSymbols.length) {
    const best = preferLatest ? uniqSymbols[uniqSymbols.length - 1] : uniqSymbols[0];
    return { bestTicker: best, allTickers: uniqSymbols, matchedBy: "symbol", confidence: 1, reason: "Explicit ticker in text." };
  }

  const low = norm(text);
  const words = low.split(" ").filter(Boolean);
  const mentions: Array<{ name: string; tickers: string[]; score: number }> = [];
  for (let span = Math.min(5, words.length); span >= 1; span--) {
    for (let i = 0; i + span <= words.length; i++) {
      const phrase = words.slice(i, i + span).join(" ").trim();
      if (phrase.length < 3) continue;
      const direct = NAME_TO_TICKER.get(phrase);
      if (direct?.length) { mentions.push({ name: phrase, tickers: direct, score: 0.9 }); continue; }
      for (const [name, list] of NAME_TO_TICKER) {
        const sc = fuzzyCompanyScore(phrase, name);
        if (sc >= 0.82) { mentions.push({ name: phrase, tickers: list, score: sc }); break; }
      }
    }
  }
  if (mentions.length) {
    mentions.sort((a, b) => b.score - a.score);
    const list = mentions[0].tickers.filter((t) => TICKERS_SET.has(t));
    if (list.length) {
      return { bestTicker: list[0], allTickers: list, matchedBy: "company", confidence: mentions[0].score >= 0.9 ? 0.75 : 0.5, reason: `Resolved company “${mentions[0].name}”.` };
    }
  }

  const fb = [opts?.lastCookieTicker?.toUpperCase(), opts?.lastClientTicker?.toUpperCase()]
    .filter(Boolean)
    .find((t) => TICKERS_SET.has(t!));
  if (fb) return { bestTicker: fb, allTickers: [fb], matchedBy: opts?.lastCookieTicker?.toUpperCase() === fb ? "cookie" : "clientHint", confidence: 0.25, reason: "Fallback to prior context." };

  return { bestTicker: null, allTickers: [], matchedBy: null, confidence: 0, reason: "No ticker found." };
}