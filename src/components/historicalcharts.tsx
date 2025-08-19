"use client";
import { useEffect, useMemo, useState } from "react";
import ChartPanel from "@/components/ChartPanel";

type Bar = { t: number; o: number; h: number; l: number; c: number; v?: number };

// If you have legacy OHLC shape on the modal (dates[], open[], high[], low[], close[]),
// this helper converts it to our Bar[]
function fromLegacySeed(seed: any): Bar[] {
  if (!seed) return [];
  // try to detect array-of-objects already shaped as bars
  if (Array.isArray(seed) && seed.length && "t" in seed[0] && "c" in seed[0]) return seed as Bar[];
  // otherwise expect { dates: number[] | string[], open: number[], high: number[], low: number[], close: number[] }
  const { dates, open, high, low, close } = seed || {};
  if (!dates || !open || !high || !low || !close) return [];
  const bars: Bar[] = [];
  for (let i = 0; i < dates.length; i++) {
    const t = typeof dates[i] === "string" ? Date.parse(dates[i]) : Number(dates[i]);
    bars.push({ t, o: +open[i], h: +high[i], l: +low[i], c: +close[i] });
  }
  return bars;
}

export default function HistoricalChart({
  ticker,
  seed,
  days = 365,
}: {
  ticker: string;
  seed?: any;     // legacy payload from modal.stock.ohlc (optional)
  days?: number;  // lookback
}) {
  const [bars, setBars] = useState<Bar[]>(() => fromLegacySeed(seed));
  const [live, setLive] = useState<number | null>(null);

  // Load historical from server (replaces seed once ready)
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch("/api/ohlc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker, days }),
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (alive && Array.isArray(j?.bars)) setBars(j.bars);
    })();
    return () => { alive = false; };
  }, [ticker, days]);

  // Live tail via SSE -> /api/stream/prices
  useEffect(() => {
    const es = new EventSource(`/api/stream/prices?tickers=${encodeURIComponent(ticker)}`);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const p = Number(msg?.prices?.[ticker]);
        if (Number.isFinite(p)) setLive(p);
      } catch {}
    };
    es.onerror = () => { /* silent retry */ };
    return () => es.close();
  }, [ticker]);

  // stitch live price into the last bar
  const displayBars = useMemo(() => {
    if (!bars.length || live == null || !Number.isFinite(live)) return bars;
    const last = bars[bars.length - 1];
    const c = live as number;
    const patched: Bar = { ...last, c, h: Math.max(last.h, c), l: Math.min(last.l, c) };
    const clone = bars.slice();
    clone[clone.length - 1] = patched;
    return clone;
  }, [bars, live]);

  // TODO: render with your real chart library
  return (
    <div className="h-72">
      {/* Replace this with the actual candlestick chart */}
      <pre className="text-xs overflow-auto">
        {ticker} — bars: {displayBars.length}, live: {live ?? "—"}
      </pre>
    </div>
  );
}
