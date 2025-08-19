// src/lib/news.ts
import { callLLMWithFallback } from "@/lib/llm";

/* ----------------------------- types ----------------------------- */
export type NewsItem = {
  title: string;
  url?: string;
  publishedAt?: string; // ISO
  source?: string;
  description?: string;
};

export type NewsResponse = {
  news_sentiment: string | null; // simple string for UI ("Positive" | "Neutral" | "Negative" | null)
  news_articles: Array<{
    title: string;
    link: string;
    source?: string;
    published?: string;
  }>;
  provider?: string; // which feed produced the items
};

/* ----------------------------- utils ----------------------------- */
const env = (k: string) => process.env[k];

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fromTo(daysBack = 14) {
  const to = new Date();
  const from = new Date(Date.now() - daysBack * 24 * 3600 * 1000);
  return { from: ymd(from), to: ymd(to) };
}

function normUrl(u?: string) {
  try {
    const url = new URL(String(u || ""));
    // strip tracking params to improve de-dup
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "cmpid", "ocid"].forEach((p) =>
      url.searchParams.delete(p)
    );
    return url.toString();
  } catch {
    return (u || "").trim();
  }
}

function dedup(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const key = `${(it.title || "").toLowerCase()}|${normUrl(it.url)}`;
    if (!seen.has(key) && it.title && it.url) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

function simpleSentimentScore(titles: string[]): "Positive" | "Negative" | "Neutral" | null {
  if (!titles.length) return null;
  const pos = /(beats|raised|hikes|upgrade|record|surge|strong|profit|wins|contract|launch|approv)/i;
  const neg = /(misses|cut|guidance cut|downgrade|recall|lawsuit|probe|falls|weak|delay|antitrust)/i;
  let score = 0;
  for (const t of titles) {
    if (pos.test(t)) score += 1;
    if (neg.test(t)) score -= 1;
  }
  if (score > 1) return "Positive";
  if (score < -1) return "Negative";
  return "Neutral";
}

/* ------------------------- primary provider ------------------------- */
/** Finnhub: https://finnhub.io/docs/api/company-news */
export async function fetchLiveNews(ticker: string): Promise<NewsItem[]> {
  const token = env("FINNHUB_API_KEY");
  if (!token) return [];
  const T = (ticker || "").toUpperCase();
  if (!T) return [];

  const { from, to } = fromTo(14);
  const url =
    `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(T)}` +
    `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
    `&token=${encodeURIComponent(token)}`;

  try {
    const r = await fetch(url, { next: { revalidate: 300 } }); // cache 5m
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("[news] Finnhub HTTP", r.status, txt.slice(0, 300));
      return [];
    }
    const arr = await r.json();
    if (!Array.isArray(arr)) return [];

    // Finnhub fields: headline, url, datetime (unix), source, summary
    const items: NewsItem[] = arr
      .map((a: any) => ({
        title: a?.headline || "",
        url: a?.url || "",
        publishedAt: typeof a?.datetime === "number" ? new Date(a.datetime * 1000).toISOString() : undefined,
        source: a?.source || "",
        description: a?.summary || "",
      }))
      .filter((x) => x.title && x.url);

    items.sort(
      (a, b) =>
        (new Date(b.publishedAt || 0).getTime() || 0) -
        (new Date(a.publishedAt || 0).getTime() || 0)
    );
    return items.slice(0, 50);
  } catch (e) {
    console.error("[news] Finnhub fetch failed:", e);
    return [];
  }
}

/* ------------------------- fallbacks (optional) ------------------------- */
/** MarketAux: https://www.marketaux.com/ */
async function fetchMarketAux(ticker: string): Promise<NewsItem[]> {
  const key = env("MARKETAUX_API_KEY");
  if (!key) return [];
  const url =
    `https://api.marketaux.com/v1/news/all?symbols=${encodeURIComponent(ticker)}` +
    `&language=en&filter_entities=true&api_token=${encodeURIComponent(key)}`;

  try {
    const r = await fetch(url, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const j = await r.json();
    const items: NewsItem[] = (j?.data || [])
      .map((a: any) => ({
        title: a?.title || "",
        url: a?.url || "",
        publishedAt: a?.published_at || "",
        source: a?.source || "",
        description: a?.snippet || "",
      }))
      .filter((x: any) => x.title && x.url);
    items.sort((a, b) => (new Date(b.publishedAt || 0).getTime() || 0) - (new Date(a.publishedAt || 0).getTime() || 0));
    return items.slice(0, 50);
  } catch {
    return [];
  }
}

/** NewsAPI.org: https://newsapi.org/ */
async function fetchNewsAPI(ticker: string): Promise<NewsItem[]> {
  const key = env("NEWSAPI_KEY");
  if (!key) return [];
  const { from } = fromTo(14);
  const q = encodeURIComponent(`"${ticker.toUpperCase()}"`);
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&from=${from}&sortBy=publishedAt&pageSize=50&apiKey=${encodeURIComponent(
    key
  )}`;
  try {
    const r = await fetch(url, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const j = await r.json();
    const items: NewsItem[] = (j?.articles || [])
      .map((a: any) => ({
        title: a?.title || "",
        url: a?.url || "",
        publishedAt: a?.publishedAt || "",
        source: a?.source?.name || "",
        description: a?.description || "",
      }))
      .filter((x: any) => x.title && x.url);
    items.sort((a, b) => (new Date(b.publishedAt || 0).getTime() || 0) - (new Date(a.publishedAt || 0).getTime() || 0));
    return items.slice(0, 50);
  } catch {
    return [];
  }
}

/* --------------------- optional LLM re-ranking --------------------- */
export async function pickTopNewsWithLLM(
  ticker: string,
  items: NewsItem[],
  n = 3
): Promise<string[]> {
  const titles = items.map((x) => x.title).filter(Boolean);
  if (!titles.length) return [];

  // If no LLM key is configured, just return the top N by recency.
  if (!env("OPENROUTER_API_KEY")) return titles.slice(0, n);

  const messages = [
    {
      role: "system" as const,
      content:
        "Select the most relevant, non-duplicate headlines for the company. " +
        "Return exactly N titles, one per line, no bullets or numbering. Prefer earnings, guidance, product, legal, M&A, analyst notes.",
    },
    {
      role: "user" as const,
      content: `Ticker: ${ticker}\nN: ${n}\nTitles:\n${titles.join("\n")}`,
    },
  ];

  try {
    const out = await callLLMWithFallback(messages, { maxTokens: 256, temperature: 0.2 });
    const lines = out
      .split("\n")
      .map((s) => s.replace(/^\s*[-•\d.]+\s*/, "").trim())
      .filter(Boolean);

    const chosen: string[] = [];
    for (const l of lines) {
      const match = titles.find((t) => t.toLowerCase() === l.toLowerCase());
      if (match && !chosen.includes(match)) chosen.push(match);
      if (chosen.length >= n) break;
    }
    return chosen.length ? chosen.slice(0, n) : titles.slice(0, n);
  } catch {
    return titles.slice(0, n);
  }
}

/* ------------------------- orchestration ------------------------- */
/** Fetch + rank + shape result that `/api/news` returns */
export async function getNewsForTicker(ticker: string, topN = 3): Promise<NewsResponse> {
  const T = (ticker || "").toUpperCase();

  // 1) Try Finnhub, then fallbacks if empty
  let items = await fetchLiveNews(T);
  let provider = "finnhub";
  if (!items.length) {
    items = await fetchMarketAux(T);
    provider = items.length ? "marketaux" : provider;
  }
  if (!items.length) {
    items = await fetchNewsAPI(T);
    provider = items.length ? "newsapi" : provider;
  }

  // 2) normalize & de-dup
  items = dedup(items);

  // 3) choose top N (LLM if available)
  const chosenTitles = await pickTopNewsWithLLM(T, items, topN);

  // map chosen titles back to items (keeping order)
  const chosenItems: NewsItem[] = [];
  for (const title of chosenTitles) {
    const found = items.find((it) => it.title.toLowerCase() === title.toLowerCase());
    if (found) chosenItems.push(found);
  }
  // if LLM returned nothing usable, fall back to first N
  const finalItems = chosenItems.length ? chosenItems : items.slice(0, topN);

  // 4) quick sentiment estimate for the UI
  const sentiment = simpleSentimentScore(finalItems.map((x) => x.title));

  // 5) shape response for the client (stable keys, always JSON-able)
  return {
    news_sentiment: sentiment,
    news_articles: finalItems.map((x) => ({
      title: x.title,
      link: normUrl(x.url),
      source: x.source,
      published: x.publishedAt,
    })),
    provider,
  };
}