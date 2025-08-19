// src/lib/recoDisclaimer.ts

export const DISCLAIMER =
  "Disclaimer: Educational only, not investment advice. Markets are risky — do your own research.";

// Lightweight intent detector for “recommendations / allocations / picks”
export function wantsRecommendation(text: string): boolean {
  const t = (text || "").toLowerCase();

  // verbs/asks
  if (/\b(allocate|allocation|distribute|split|deploy|invest|buy|sell|rebalance|hedge|diversify|build|construct|design)\b/i.test(t)) return true;

  // nouns/requests
  if (/\b(recommend(ation)?s?|suggest(ion)?s?|pick(s)?|idea(s)?|watchlist|screen( me)?)\b/i.test(t)) return true;

  // portfolio-ish phrasing
  if (/\b(portfolio|strategy|model|basket|tilt|weights?)\b/i.test(t)) return true;

  // “which stocks / what should I buy / top N”
  if (/\b(which\s+(stock|ticker)s?)\b/i.test(t)) return true;
  if (/\b(what\s+(should|to)\s+i?\s*buy)\b/i.test(t)) return true;
  if (/\btop\s+\d+\b/i.test(t)) return true;

  // split across N stocks
  if (/\b(split|across)\b.*\b(stocks?|tickers?)\b/i.test(t)) return true;

  return false;
}

// Make sure any response to a “wantsRecommendation” prompt ends with a disclaimer
export function appendDisclaimerIfNeeded(reply: string, question: string): string {
  if (!wantsRecommendation(question)) return reply;
  if (/disclaimer|not advice|educational only/i.test(reply)) return reply;
  return `${reply.trim()}\n\n${DISCLAIMER}`;
}