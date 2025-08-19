export type SentimentData = {
  ticker: string;
  company: string;
  sector: string;
  close: number;
  ma_50: number;
  ma_200: number;
  rsi: number;
  mse_50: number | null;
  price_change_pct: number | null;
  technical_sentiment: "Bullish" | "Bearish" | "Neutral";
  recommendation: "Buy" | "Sell" | "Hold";
  historical?: number[];
  news_sentiment?: string | null;
  news_articles?: {
    title: string;
    link: string;
    source?: string;
    published?: string;
  }[];
};