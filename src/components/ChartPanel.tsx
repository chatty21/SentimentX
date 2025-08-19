'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  type ISeriesApi,
  type IChartApi,
  type UTCTimestamp,
  type CandlestickData,
} from 'lightweight-charts';

/** Ensure `addCandlestickSeries` is available on the chart */
type ChartApiCandles = IChartApi & {
  addCandlestickSeries: (options?: any) => ISeriesApi<'Candlestick'>;
};

type Candle = {
  time: number; // seconds since epoch (server may also send ms; we normalize below)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type Res = '1m' | '30m' | '1h' | '3h' | '1d' | '7d' | '1mo';

const RES_OPTS: Res[] = ['1m', '30m', '1h', '3h', '1d', '7d', '1mo'];

type Props = {
  ticker: string;
  defaultRes?: Res;
};

/** Helpers */
function toUtcTs(secOrMs: number): UTCTimestamp {
  const sec = secOrMs > 10_000_000_000 ? Math.floor(secOrMs / 1000) : secOrMs;
  return sec as UTCTimestamp;
}

/** Aggregate candles into coarser buckets. `bucketSec` = 60 for 1m, 1800 for 30m, etc. */
function aggregateCandles(candles: Candle[], bucketSec: number): Candle[] {
  if (!candles.length) return [];
  const out: Record<number, Candle> = {};
  for (const c of candles) {
    const sec = c.time > 10_000_000_000 ? Math.floor(c.time / 1000) : c.time;
    const bucket = Math.floor(sec / bucketSec) * bucketSec;
    const prev = out[bucket];
    if (!prev) {
      out[bucket] = { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 };
    } else {
      prev.high = Math.max(prev.high, c.high);
      prev.low = Math.min(prev.low, c.low);
      prev.close = c.close;
      prev.volume = (prev.volume ?? 0) + (c.volume ?? 0);
    }
  }
  return Object.values(out).sort((a, b) => a.time - b.time);
}

/** Decide if a res is intraday (built from 1m) or daily (built from 1d) */
function isIntraday(res: Res) {
  return res === '1m' || res === '30m' || res === '1h' || res === '3h';
}
function bucketSeconds(res: Res): number {
  switch (res) {
    case '1m': return 60;
    case '30m': return 30 * 60;
    case '1h': return 60 * 60;
    case '3h': return 3 * 60 * 60;
    case '1d': return 24 * 60 * 60;
    case '7d': return 7 * 24 * 60 * 60;
    case '1mo': return 30 * 24 * 60 * 60; // simple 30d month for aggregation
  }
}

export default function ChartPanel({ ticker, defaultRes = '1m' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const chartRef = useRef<ChartApiCandles | null>(null);

  const [res, setRes] = useState<Res>(defaultRes);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /** Build request URL. We only have 1m + 1d from the API; coarser frames are aggregated client-side. */
  const url = useMemo(() => {
    if (!ticker) return '';
    if (isIntraday(res)) {
      // Pull enough 1m candles to aggregate into coarser intraday frames
      // 1m = last ~6 hours; 30m ≈ 5 days; 1h ≈ 15 days; 3h ≈ 60 days
      let minutes = 6 * 60;
      if (res === '30m') minutes = 5 * 24 * 60;
      if (res === '1h') minutes = 15 * 24 * 60;
      if (res === '3h') minutes = 60 * 24 * 60;
      return `/api/ohlc?t=${encodeURIComponent(ticker)}&minutes=${minutes}`;
    } else {
      // Daily candles: expand window so 7d/1mo aggregations show years of history
      let days = 365; // ~1y for 1d
      if (res === '7d') days = 3 * 365;   // ~3y of dailies -> weekly buckets
      if (res === '1mo') days = 10 * 365; // ~10y of dailies -> monthly buckets
      return `/api/ohlc?t=${encodeURIComponent(ticker)}&days=${days}`;
    }
  }, [ticker, res]);

  /** Create chart once */
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0a0a0b' }, textColor: '#d4d4d8' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        rightOffset: 6,
        secondsVisible: isIntraday(res) && res === '1m',
        timeVisible: true,
      },
      crosshair: { mode: 1 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, pinch: true, mouseWheel: true },
      width: containerRef.current.clientWidth,
      height: 560,
    }) as ChartApiCandles;

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fetch & render when ticker/res changes */
  useEffect(() => {
    let abort = false;
    async function go() {
      if (!url || !seriesRef.current) return;
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(url, { cache: 'no-store' });
        const j = await r.json();
        if (abort) return;

        if (!r.ok) {
          setErr(j?.error || 'request_failed');
          setSource(null);
          seriesRef.current.setData([]);
          return;
        }

        const raw: Candle[] = Array.isArray(j?.candles) ? j.candles : [];
        setSource(j?.source || null);

        if (raw.length === 0) {
          setErr('no_data');
          seriesRef.current.setData([]);
          return;
        }

        // Aggregate if needed
        let cooked: Candle[] = raw;
        if (isIntraday(res)) {
          const bucket = bucketSeconds(res); // 1m/30m/1h/3h
          cooked = aggregateCandles(raw, bucket);
        } else if (res === '7d' || res === '1mo') {
          const bucket = bucketSeconds(res); // 7d/30d
          cooked = aggregateCandles(raw, bucket);
        }

        const data: CandlestickData<UTCTimestamp>[] = cooked.map((c) => ({
          time: toUtcTs(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        seriesRef.current.setData(data);
        chartRef.current?.timeScale().fitContent();
      } catch (e: any) {
        if (!abort) {
          setErr(e?.message || 'load_failed');
          seriesRef.current?.setData([]);
          setSource(null);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }
    go();
    return () => {
      abort = true;
    };
  }, [url, res]);

  /** Update secondsVisible toggling when switching between 1m and others */
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      timeScale: { secondsVisible: isIntraday(res) && res === '1m' },
    });
  }, [res]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="text-sm text-zinc-300">
          <span className="font-semibold">{ticker}</span>
          <span className="ml-2 text-zinc-500">— {res} candles</span>
          {source && (
            <span className="ml-3 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
              src: {source}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {RES_OPTS.map((r) => (
            <button
              key={r}
              className={`px-2 py-1 text-xs rounded border ${
                res === r
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                  : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => setRes(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="w-full h-[560px] md:h-[640px] rounded-xl border border-zinc-800 bg-zinc-900/60"
        style={{ maxHeight: '80vh' }}
      />

      {/* States */}
      <div className="mt-2 text-xs text-zinc-500 px-1">
        {loading && 'Loading…'}
        {!loading && err === 'no_data' && 'No data for this symbol/timeframe.'}
        {!loading && err && err !== 'no_data' && `Error: ${err}`}
      </div>
    </div>
  );
}