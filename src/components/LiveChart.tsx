"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chart as ChartJS, TimeScale, LinearScale, Tooltip, Legend, Filler } from "chart.js";
import "chartjs-adapter-date-fns";
import { Chart } from "react-chartjs-2";

ChartJS.register(TimeScale, LinearScale, Tooltip, Legend, Filler);

type Candle = {
  time: number;      // seconds or ms epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Interval = "1m" | "5m" | "1d";

export default function LiveChart({ ticker }: { ticker: string }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setInterval] = useState<Interval>("1d");
  const [source, setSource] = useState<string>("");
  const loadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    const safeParse = async (res: Response) => {
      if (!res.ok) return null;
      const txt = await res.text();
      if (!txt) return null;
      try { return JSON.parse(txt); } catch { return null; }
    };

    (async () => {
      try {
        // Prefer daily data (reliable on free tiers). If your /api/ohlc supports intraday,
        // you can switch to minutes=90.
        const qs = new URLSearchParams({ t: ticker, days: "180" }).toString();
        const r = await fetch(`/api/ohlc?${qs}`, { cache: "no-store", signal: ctrl.signal });
        if (!mounted) return;

        const j = await safeParse(r);
        if (!mounted) return;

        setCandles(Array.isArray(j?.candles) ? j!.candles : []);
        setInterval((j?.interval as Interval) || "1d");
        setSource(j?.source || "");
      } catch (e) {
        if (mounted) {
          console.warn("[LiveChart] fetch failed:", e);
          setCandles([]);
          setInterval("1d");
          setSource("error");
        }
      } finally {
        loadedRef.current = true;
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [ticker]);

  const normalized = useMemo(() => {
    // ensure Chart.js receives ms epochs
    return candles.map(c => ({
      ...c,
      time: c.time < 1e12 ? c.time * 1000 : c.time,
    }));
  }, [candles]);

  const xUnit = interval === "1d" ? "day" : "minute";

  if (!normalized.length) {
    return (
      <div className="h-64 w-full grid place-items-center text-sm text-zinc-500">
        {loadedRef.current ? "No data for this symbol/timeframe." : "Loading chart…"}
      </div>
    );
  }

  const data = {
    labels: normalized.map(c => c.time),
    datasets: [
      {
        type: "line" as const,
        label: "Closing Price",
        data: normalized.map(c => c.close),
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    scales: {
      x: {
        type: "time",
        time: { unit: xUnit },
        grid: { display: false },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.08)" },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
  };

  return (
    <div className="h-64 w-full">
      <div className="mb-2 text-xs text-zinc-400">
        {ticker} — {interval}
        {interval !== "1d" ? (
          <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5">intraday</span>
        ) : null}
        <span className="ml-2 text-[10px] opacity-60">src: {source || "—"}</span>
      </div>
      <Chart type="line" data={data as any} options={options as any} />
    </div>
  );
}