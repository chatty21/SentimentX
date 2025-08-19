// Simple “is this a bullish catalyst?” helper used by the screener.

export type Headline = {
    title: string;
    published?: string;   // ISO string
    source?: string;
  };
  
  const POSITIVE_RX =
    /(beats|beat|tops|raises|hikes|boosts|upgrades?|price target (raised|hiked)|guidance (raised|reaffirmed)|record|all-time high|partnership|contract|approval|launch|rollout|expands?)/i;
  
  export function hasPositiveCatalyst(headlines: Headline[], sinceISO: string): boolean {
    if (!Array.isArray(headlines) || !headlines.length) return false;
    const since = Date.parse(sinceISO || "") || 0;
    for (const h of headlines) {
      const t = (h?.title || "").trim();
      if (!t) continue;
      const ts = Date.parse(h?.published || "") || 0;
      if (since && ts && ts < since) continue;
      if (POSITIVE_RX.test(t)) return true;
    }
    return false;
  }