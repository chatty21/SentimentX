export type NewsArticle = {
  title: string;
  link: string;
  source?: string;
  published?: string;
};

export type OHLC = {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  dates: string[];
};

export type StockIndicator = {
  ticker: string;
  company?: string;  // made optional
  sector?: string;   // made optional
  close: number;
  ma_50: number;
  ma_200: number;
  rsi: number;
  mse_50: number | null;
  price_change_pct: number | null;
  technical_sentiment: "Bullish" | "Bearish" | "Neutral";
  recommendation: "Buy" | "Sell" | "Hold";
  historical?: number[];
  ohlc?: OHLC;
  news_sentiment?: string | null;
  news_articles?: NewsArticle[];
};