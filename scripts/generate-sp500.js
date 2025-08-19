// scripts/generate-sp500.js
// Usage: node scripts/generate-sp500.js
// Outputs:
//   - src/data/sp500Companies.ts
//   - public/data/sp500_companies.json

import fs from "node:fs/promises";
import path from "node:path";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";

function cleanSymbol(s) {
  return String(s || "")
    .trim()
    .replace(/\u200E|\u200F/g, "")         // LRM/RLM
    .replace(/\s+/g, "")
    .toUpperCase();
}
function cleanName(s) {
  return String(s || "")
    .replace(/\[[^\]]*\]/g, "")            // remove footnote refs
    .replace(/\u200E|\u200F/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWikipedia() {
  const res = await fetch(WIKI_URL, { headers: { "user-agent": "sp500-scraper/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // The first table with class "wikitable sortable" contains constituents
  const table = $("table.wikitable.sortable").first();
  if (!table.length) throw new Error("Could not locate S&P 500 table");

  const out = {};
  table.find("tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const symbol = cleanSymbol($(tds[0]).text());
    const name = cleanName($(tds[1]).text());
    if (symbol && name && symbol !== "SYMBOL") out[symbol] = name;
  });
  return out;
}

function toTsModule(map) {
  const entries = Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");

  return `// AUTO-GENERATED FILE. Do not edit by hand.
// Run: \`node scripts/generate-sp500.js\` to refresh.
// Source: ${WIKI_URL}

export const SP500_COMPANIES: Record<string, string> = {
${entries}
};
`;
}

async function main() {
  console.log("Fetching S&P 500 list from Wikipedia…");
  const map = await fetchWikipedia();
  const count = Object.keys(map).length;
  if (count < 450) {
    throw new Error(`Unexpectedly small list (${count}); Wikipedia layout may have changed.`);
  }
  console.log(`Parsed ${count} tickers.`);

  // Write TS module
  const tsPath = path.join(process.cwd(), "src", "data", "sp500Companies.ts");
  await fs.mkdir(path.dirname(tsPath), { recursive: true });
  await fs.writeFile(tsPath, toTsModule(map), "utf8");
  console.log(`✅ Wrote ${tsPath}`);

  // Also a JSON copy (handy for debugging / other uses)
  const jsonPath = path.join(process.cwd(), "public", "data", "sp500_companies.json");
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(map, null, 2), "utf8");
  console.log(`✅ Wrote ${jsonPath}`);
}

main().catch((err) => {
  console.error("❌ Failed:", err?.message || err);
  process.exit(1);
});