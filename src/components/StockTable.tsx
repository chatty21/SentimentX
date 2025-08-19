// src/components/StockTable.tsx
"use client";

import { useMemo } from "react";
import { useLivePrices } from "./useLivePrices";

/* ------------ types used by the dashboard ------------ */
export type Row = {
  ticker: string;
  company?: string;
  sector?: string;
  close?: number;
  ma_50?: number;
  rsi?: number;
  pct_vs_ma50?: number;
  _livePrice?: number | null;
};

/* -------------------- small utils -------------------- */
const fmt2 = (n?: number) => (Number.isFinite(n) ? (n as number).toFixed(2) : "—");
const fmtPct = (n?: number) => (Number.isFinite(n) ? `${(n as number).toFixed(2)}%` : "—");
function calcSentiment(rsi?: number, pctVsMA50?: number) {
  if (!Number.isFinite(rsi) || !Number.isFinite(pctVsMA50)) return "Neutral";
  if ((rsi as number) < 35 && (pctVsMA50 as number) < -3) return "Buy";
  if ((rsi as number) > 65 && (pctVsMA50 as number) > 3) return "Sell";
  return "Hold";
}

/* -------------------- header -------------------- */
function InformationCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.25 11.25v5.25m0-8.25h.008v.008H11.25zm9 3.75a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

type HeaderDef = { label: string; info?: string; className?: string };

const TABLE_HEADERS: HeaderDef[] = [
  { label: "Ticker",     info: "Stock symbol." },
  { label: "Company",    info: "Full company name." },
  { label: "Sector",     info: "Industry sector the company operates in." },
  { label: "Close",      info: "Last traded price for the stock.", className: "text-right" },
  { label: "MA 50",      info: "50-day simple moving average (last 50 closes).", className: "text-right" },
  { label: "RSI",        info: "Relative Strength Index (0–100). <30 oversold, >70 overbought.", className: "text-right" },
  { label: "% vs MA50",  info: "Percentage difference between current price and MA50.", className: "text-right" },
  { label: "Sentiment",  info: "Quick Buy/Hold/Sell based on rules (RSI & distance to MA50)." },
  { label: "Action",     info: "Open curated news and charts." },
];

export function StockTableHeader() {
  return (
    <thead className="bg-zinc-900 text-zinc-300">
      <tr>
        {TABLE_HEADERS.map((h) => (
          <th key={h.label} className={`px-3 py-2 text-left font-medium border-b border-zinc-800 ${h.className || ""}`}>
            <div className="flex items-center gap-1">
              <span>{h.label}</span>
              {h.info ? (
                <div className="relative group cursor-pointer">
                  <InformationCircleIcon className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
                  <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block">
                    <div className="max-w-[18rem] rounded-md border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 shadow-xl">
                      {h.info}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}

/* -------------------- body (live-price aware) -------------------- */
export function StockTableBody({
  rows,
  onNews,
  onChart,
}: {
  rows: Row[];
  onNews?: (row: Row) => void;
  onChart?: (row: Row) => void;
}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  // 1) derive tickers for polling
  const tickers = useMemo(
    () => safeRows.map((r) => (r.ticker || "").toUpperCase()).filter(Boolean),
    [safeRows]
  );

  // 2) fetch live prices
  const { prices, isLoading } = useLivePrices(tickers, 8000);

  // 3) merge live -> display rows (with sanity filter)
  const displayRows = useMemo(() => {
    return safeRows.map((r) => {
      const t = (r.ticker || "").toUpperCase();
      const live = (prices as Record<string, number | undefined>)[t];

      const hasSaneLive =
        Number.isFinite(live) &&
        (live as number) > 0 &&
        (!Number.isFinite(r.close)
          ? true
          : (live as number) > (r.close as number) * 0.2 &&
            (live as number) < (r.close as number) * 5);

      const price = hasSaneLive ? (live as number) : (r.close ?? NaN);

      const pctVsMA50 =
        Number.isFinite(price) && Number.isFinite(r.ma_50)
          ? ((price - (r.ma_50 as number)) / (r.ma_50 as number)) * 100
          : r.pct_vs_ma50;

      return {
        ...r,
        _livePrice: hasSaneLive ? (live as number) : null,
        close: price,
        pct_vs_ma50: pctVsMA50,
      };
    });
  }, [safeRows, prices]);

  if (!displayRows.length) {
    return (
      <tr>
        <td colSpan={9} className="p-6 text-center text-zinc-400">No results.</td>
      </tr>
    );
  }

  return (
    <>
      {displayRows.map((r) => (
        <tr key={r.ticker} className="hover:bg-zinc-900/40">
          <td className="px-3 py-2 font-semibold">{r.ticker}</td>
          <td className="px-3 py-2 text-zinc-300">{r.company ?? "-"}</td>
          <td className="px-3 py-2 text-zinc-300">{r.sector ?? "Unknown"}</td>

          {/* Close (live-aware) */}
          <td className="px-3 py-2 text-right tabular-nums">
            {fmt2(r.close)}
            {r._livePrice ? (
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
            ) : null}
          </td>

          {/* MA50 */}
          <td className="px-3 py-2 text-right tabular-nums">{fmt2(r.ma_50)}</td>

          {/* RSI */}
          <td className="px-3 py-2 text-right tabular-nums">{fmt2(r.rsi)}</td>

          {/* % vs MA50 */}
          <td
            className={`px-3 py-2 text-right tabular-nums ${
              (r.pct_vs_ma50 ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {fmtPct(r.pct_vs_ma50)}
          </td>

          {/* Sentiment */}
          <td className="px-3 py-2">
            <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-200">
              {calcSentiment(r.rsi, r.pct_vs_ma50)}
            </span>
          </td>

          {/* Action */}
          <td className="px-3 py-2">
            <div className="flex gap-2">
              <button
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                onClick={() => onNews?.(r)}
              >
                News
              </button>
              <button
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                onClick={() => onChart?.(r)}
              >
                Chart
              </button>
            </div>
          </td>
        </tr>
      ))}

      {/* Optional loading row */}
      {isLoading ? (
        <tr>
          <td colSpan={9} className="px-3 py-2 text-xs text-zinc-400">
            Updating live quotes…
          </td>
        </tr>
      ) : null}
    </>
  );
}