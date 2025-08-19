// src/components/marketdashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import LayoutContainer from "@/components/LayoutContainer";
import StockChart from "@/components/StockChart";
import HistoricalChart from "@/components/historicalcharts";
import SectorFilter from "@/components/SectorFilter";
import SentimentCard from "@/components/SentimentCard";
import ChartPanel from "@/components/ChartPanel";
import { useCompanyNews } from "@/lib/useCompanyNews";

// ⬇️ Use the table you already created (named exports)
import { StockTableHeader, StockTableBody, Row as TableRow } from "@/components/StockTable";

import { SP500_COMPANIES } from "@/data/sp500Companies";
import Chatbot from "@/components/Chatbot";

/* ---------------- types ---------------- */
type OHLC = { open: number[]; high: number[]; low: number[]; close: number[]; dates: string[] };
type NewsArticle = { title: string; link: string; source?: string; published?: string };

type StockRow = {
  ticker: string;
  company?: string;
  sector?: string;
  close: number;
  ma_50?: number;
  rsi?: number;
  mse_50?: number | null;
  price_change_pct?: number | null;
  technical_sentiment?: "Bullish" | "Bearish" | "Neutral";
  recommendation?: "Buy" | "Sell" | "Hold" | "Strong Buy" | "Strong Sell";
  historical?: number[];
  ohlc?: OHLC;
  news_sentiment?: string | null;
  news_articles?: NewsArticle[];
};

type ModalState = { open: false } | { open: true; mode: "news" | "chart"; stock: StockRow };
type AnyRow = Record<string, any>;

const PAGE_SIZE = 20;

/* ---------------- normalization ---------------- */
function normalizeRow(r: any): StockRow {
  const ticker = String(r.ticker ?? r.symbol ?? r.Ticker ?? "").toUpperCase();
  const close = Number(r.close ?? r.price ?? r.last ?? 0);

  const companyFromData =
    r.company2 ?? r.name ?? r.company_name ?? r.Company ?? r.longName ?? r.fullName ?? null;

  const sectorFromData =
    r.sector ?? r.sector2 ?? r.Sector ?? r.industry ?? r.industryGroup ?? null;

  const cleanCompany =
    companyFromData ??
    (r.company && String(r.company).toUpperCase() !== ticker ? r.company : null);

  return {
    ticker,
    close,
    company: cleanCompany ?? "-",
    sector: sectorFromData ?? "Unknown",
    ma_50: r.ma_50,
    rsi: r.rsi,
    price_change_pct: r.price_change_pct,
    technical_sentiment: r.technical_sentiment,
    recommendation: r.recommendation,
    historical: r.historical,
    ohlc: r.ohlc,
    news_sentiment: r.news_sentiment,
    news_articles: r.news_articles,
    mse_50: r.mse_50,
  };
}

/* ---------------- page shell ---------------- */
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1c] to-[#05070d] text-white">
      <section className="pt-16 pb-10">
        <LayoutContainer>
          <p className="text-xs tracking-[0.2em] text-zinc-400 mb-3">DASHBOARD</p>
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight">Market overview</h1>
          <p className="mt-4 text-lg text-zinc-300 max-w-3xl">
            Live sentiment and technicals across the S&amp;P 500. Filter by sector, scan movers, and
            dive into news and charts without leaving the page.
          </p>
        </LayoutContainer>
      </section>

      <section className="pb-16">
        <LayoutContainer>
          <MarketDashboard />
        </LayoutContainer>
      </section>

      {/* keep your original floating chatbot UI; see ClientChatbot.tsx below */}
      <Chatbot />
    </div>
  );
}

/* ---------------- dashboard ---------------- */
function MarketDashboard() {
  const [data, setData] = useState<StockRow[]>([]);
  const [sector, setSector] = useState("All");
  const [view, setView] = useState<"all" | "gainers" | "losers">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // indicators json
        const raw = await fetch("/data/sp500_indicators.json", { cache: "no-store" }).then(r => r.json());
        const rows: StockRow[] = (raw as AnyRow[]).map(normalizeRow);

        // ticker -> company map, API or fallback
        let map: Record<string, string> = {};
        try {
          const res = await fetch("/api/sp500", { cache: "reload" });
          map = res.ok ? await res.json() : SP500_COMPANIES;
        } catch {
          map = SP500_COMPANIES;
        }

        // merge names
        const merged = rows.map(r => {
          const fromMap = map[r.ticker] ?? map[r.ticker.replace(/\s+/g, "")] ?? null;
          return { ...r, company: (r.company && r.company !== "-") ? r.company : (fromMap ?? "-") };
        });

        if (alive) setData(merged);
      } catch (err) {
        console.error("Failed to load data:", err);
        if (alive) setData([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const sectors = useMemo(() => {
    const s = new Set<string>(["All"]);
    data.forEach((d) => s.add(d.sector || "Unknown"));
    return Array.from(s);
  }, [data]);

  const filtered = useMemo(() => {
    let arr = data.slice();
    if (sector !== "All") arr = arr.filter((d) => (d.sector || "Unknown") === sector);

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(
        (d) => d.ticker.toLowerCase().includes(q) || (d.company || "").toLowerCase().includes(q)
      );
    }

    if (view === "gainers") {
      arr.sort((a, b) => (b.price_change_pct ?? -Infinity) - (a.price_change_pct ?? -Infinity));
    } else if (view === "losers") {
      arr.sort((a, b) => (a.price_change_pct ?? Infinity) - (b.price_change_pct ?? Infinity));
    } else {
      arr.sort((a, b) => a.ticker.localeCompare(b.ticker));
    }
    return arr;
  }, [data, sector, view, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [sector, view, query]);

  const openNews = (stock: StockRow) => setModal({ open: true, mode: "news", stock });
  const openChart = async (stock: StockRow) => {
    // open immediately so the modal appears
    setModal({ open: true, mode: "chart", stock });

    // if candles already exist, nothing else to do
    if (stock.ohlc?.dates?.length) return;

    try {
      const res = await fetch(`/api/ohlc?t=${encodeURIComponent(stock.ticker)}&days=180`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({} as any));
      if (j?.ohlc?.dates?.length) {
        // only update if the same stock modal is still open
        setModal((m) =>
          m.open && m.mode === "chart" && m.stock.ticker === stock.ticker
            ? {
                ...m,
                stock: {
                  ...m.stock,
                  ohlc: j.ohlc,
                  historical: Array.isArray(j.close) && j.close.length ? j.close : m.stock.historical,
                },
              }
            : m
        );
      }
    } catch {
      // silently ignore; right-side line chart still shows
    }
  };
  const closeModal = () => setModal({ open: false });

  // TableRow → StockRow for callbacks
  const handleNews = (r: TableRow) => {
    const full = pageData.find(p => p.ticker === r.ticker);
    openNews(
      full ?? ({
        ticker: r.ticker,
        company: r.company ?? "-",
        sector: r.sector ?? "Unknown",
        close: r.close ?? 0,
        ma_50: r.ma_50,
        rsi: r.rsi,
        price_change_pct: r.pct_vs_ma50,
      } as StockRow)
    );
  };
  const handleChart = (r: TableRow) => {
    const full = pageData.find(p => p.ticker === r.ticker);
    openChart(
      full ?? ({
        ticker: r.ticker,
        company: r.company ?? "-",
        sector: r.sector ?? "Unknown",
        close: r.close ?? 0,
        ma_50: r.ma_50,
        rsi: r.rsi,
        price_change_pct: r.pct_vs_ma50,
      } as StockRow)
    );
  };

  return (
    <div className="space-y-6">
      <TickerStrip rows={data} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <SectorFilter sectors={sectors} selected={sector} onChange={setSector} />
        <div className="inline-flex rounded-md overflow-hidden border border-zinc-800">
          <button
            className={`px-3 py-2 text-sm ${view === "all" ? "bg-zinc-800 text-white" : "bg-zinc-900 hover:bg-zinc-800"}`}
            onClick={() => setView("all")}
          >
            All
          </button>
          <button
            className={`px-3 py-2 text-sm ${view === "gainers" ? "bg-emerald-700 text-white" : "bg-zinc-900 hover:bg-zinc-800"}`}
            onClick={() => setView("gainers")}
          >
            Gainers
          </button>
          <button
            className={`px-3 py-2 text-sm ${view === "losers" ? "bg-rose-700 text-white" : "bg-zinc-900 hover:bg-zinc-800"}`}
            onClick={() => setView("losers")}
          >
            Losers
          </button>
        </div>

        <div className="ml-auto">
          <input
            placeholder="Search ticker or company"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-3 py-2 text-sm rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500"
          />
        </div>
      </div>

      {/* Table (SSR-safe) */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 shadow-2xl">
        <table className="w-full text-sm">
          <StockTableHeader />
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-zinc-400">Loading data…</td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-zinc-400">No results.</td>
              </tr>
            ) : (
              <StockTableBody
                rows={pageData.map<TableRow>((s) => ({
                  ticker: s.ticker,
                  company: s.company ?? "-",
                  sector: s.sector ?? "Unknown",
                  close: s.close,
                  ma_50: s.ma_50,
                  rsi: s.rsi,
                  pct_vs_ma50:
                    Number.isFinite(s.close) &&
                    Number.isFinite(s.ma_50) &&
                    (s.ma_50 as number) !== 0
                      ? (((s.close as number) - (s.ma_50 as number)) / (s.ma_50 as number)) * 100
                      : s.price_change_pct ?? undefined,
                }))}
                onNews={handleNews}
                onChart={handleChart}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            className="px-3 py-2 text-sm rounded border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Prev
          </button>
          <span className="text-sm text-zinc-400">Page {page} of {totalPages}</span>
          <button
            className="px-3 py-2 text-sm rounded border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <Modal
          onClose={closeModal}
          title={modal.mode === "news" ? `${modal.stock.ticker} — News` : `${modal.stock.ticker} — Chart`}
        >
          {modal.mode === "news" ? (
            <NewsPanel stock={modal.stock} onBack={closeModal} />
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden p-0">
              <ChartPanel ticker={modal.stock.ticker} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---------------- ticker/news helpers & tiny modal ---------------- */
function TickerStrip({ rows }: { rows: StockRow[] }) {
  const items = useMemo(() => {
    return rows
      .map((r) => {
        const closes = r.historical?.length ? r.historical : r.ohlc?.close?.length ? r.ohlc.close : [];
        let last = r.close;
        let prev: number | undefined;

        if (closes.length >= 2) {
          last = closes[closes.length - 1];
          prev = closes[closes.length - 2];
        }

        let chgPct: number | null = null;
        if (typeof last === "number" && typeof prev === "number" && prev !== 0) {
          chgPct = (last / prev - 1) * 100;
        } else if (typeof r.price_change_pct === "number") {
          chgPct = r.price_change_pct;
        }

        return { ticker: r.ticker, last, chgPct };
      })
      .filter((x) => typeof x.last === "number" && Number.isFinite(x.last))
      .slice(0, 120);
  }, [rows]);

  if (!items.length) return null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-zinc-800 shadow-xl">
      <div className="whitespace-nowrap will-change-transform" style={{ animation: "tickerMove 40s linear infinite" }}>
        {[...items, ...items].map((it, i) => {
          const color =
            it.chgPct == null
              ? "text-zinc-300"
              : it.chgPct > 0
              ? "text-emerald-400"
              : it.chgPct < 0
              ? "text-rose-400"
              : "text-zinc-300";
          const sign = it.chgPct == null ? "" : it.chgPct > 0 ? "+" : "";
          return (
            <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="font-semibold text-zinc-200">{it.ticker}</span>
              <span className="text-zinc-300">{fmtNum(it.last)}</span>
              <span className={`${color}`}>{it.chgPct == null ? "" : `${sign}${it.chgPct.toFixed(2)}%`}</span>
              <span className="text-zinc-700">|</span>
            </span>
          );
        })}
      </div>
      <style jsx>{`
        @keyframes tickerMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function NewsPanel({ stock, onBack }: { stock: StockRow; onBack: () => void }) {
  const { items, isLoading, error } = useCompanyNews(stock.ticker, 15);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="px-2 py-1 text-sm rounded border border-zinc-700 hover:bg-zinc-800">← Back</button>
        <span className="text-sm text-zinc-400">
          {(stock.company ?? stock.ticker)} {stock.sector ? `• ${stock.sector}` : ""}
        </span>
      </div>

      {/* sentiment summary stays */}
      <SentimentCard ticker={stock.ticker} />

      <div className="rounded-lg border border-zinc-800">
        <h4 className="text-sm font-medium text-zinc-200 p-3 pb-0">Headlines (live)</h4>
        {isLoading ? (
          <div className="p-3 text-sm text-zinc-400">Loading latest headlines…</div>
        ) : error ? (
          <div className="p-3 text-sm text-red-400">Couldn’t load headlines.</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-zinc-400">No fresh headlines.</div>
        ) : (
          <ul className="space-y-2 p-3">
            {items.slice(0, 12).map((n: any, i: number) => (
              <li key={i} className="text-sm">
                <a className="text-blue-400 hover:underline" href={n.url || "#"} target="_blank" rel="noreferrer">
                  {n.title}
                </a>
                <span className="ml-2 text-zinc-500">
                  {n.source ? `(${n.source})` : ""}{n.date ? ` • ${new Date(n.date).toLocaleDateString()}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* helpers */
function fmtNum(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return typeof n === "number" ? n.toFixed(2) : String(n);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-7xl mx-auto rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <button onClick={onClose} className="px-2 py-1 text-sm rounded border border-zinc-700 hover:bg-zinc-800">← Back</button>
            <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
            <button onClick={onClose} className="px-2 py-1 text-sm rounded border border-zinc-700 hover:bg-zinc-800">Close</button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}