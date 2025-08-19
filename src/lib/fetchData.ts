// src/lib/fetchData.ts
import fs from "node:fs/promises";
import path from "node:path";

export type IndicatorRow = {
  ticker: string;
  company?: string;
  sector?: string;
  close?: number;
  rsi?: number;
  ma_50?: number;
  ma_200?: number;
  price_change_pct?: number | null;
  technical_sentiment?: "Bullish" | "Bearish" | "Neutral";
  news_sentiment?: string | null;
};

export async function loadDataset(): Promise<IndicatorRow[]> {
  try {
    const p = path.join(process.cwd(), "data", "sp500_indicators.json");
    const raw = await fs.readFile(p, "utf-8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}