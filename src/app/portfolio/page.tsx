"use client";
import { useEffect, useMemo, useState } from "react";

type ApiPosition = {
  ticker: string;
  shares: number;
  avgCost: number | null;
  price: number | null; // current
  marketValue: number | null;
  unrealizedPL: number | null;
  unrealizedPLPct: number | null;
};

type ApiResponse = {
  positions: ApiPosition[];
  cash?: number | null;
  equity?: number | null;
  total?: number | null;
  limit?: number | null;
  error?: string;
};

type Row = {
  ticker: string;
  shares: number;
  avgPrice: number;     // normalized for UI
  currentPrice: number; // normalized for UI
  value: number;        // currentPrice * shares
  cost: number;         // avgPrice   * shares
  pl: number;           // value - cost
  plPct: number;        // pl / cost
};

const fmt = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `$${n.toFixed(2)}`;

const fmtPct = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${n.toFixed(2)}%`;

export default function PortfolioPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cash, setCash] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(10000);
  const [serverEquity, setServerEquity] = useState<number | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // trade form
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/portfolio", { credentials: "include", cache: "no-store" });
      if (r.status === 401) {
        setError("Please log in to view your demo portfolio.");
        setRows([]);
        setCash(null);
        setServerEquity(null);
        setServerTotal(null);
        setLimit(10000);
        return;
      }
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(txt || `HTTP ${r.status}`);
      }
      const j: ApiResponse = await r.json();

      const normalized: Row[] = (j.positions || []).map((p) => {
        const avg = p.avgCost ?? 0;
        const price = p.price ?? 0;
        const value = price * p.shares;
        const cost = avg * p.shares;
        const pl = p.unrealizedPL ?? (value - cost);
        const plPct = p.unrealizedPLPct ?? (cost > 0 ? (pl / cost) * 100 : 0);
        return {
          ticker: p.ticker,
          shares: p.shares,
          avgPrice: avg,
          currentPrice: price,
          value,
          cost,
          pl,
          plPct,
        };
      });

      setRows(normalized);
      setCash(j.cash ?? null);
      setServerEquity(j.equity ?? null);
      setServerTotal(j.total ?? null);
      setLimit(j.limit ?? 10000);
    } catch (e: any) {
      setError(e?.message || "Failed to load portfolio");
      setRows([]);
      setCash(null);
      setServerEquity(null);
      setServerTotal(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const equity = rows.reduce((s, r) => s + r.value, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const pl = equity - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;

    // Prefer server numbers; fall back to sandbox math.
    const cashEff =
      cash != null ? cash : Math.max(0, (limit ?? 10000) - cost);
    const totalEff =
      serverTotal != null ? serverTotal : cashEff + equity;

    return {
      equity: serverEquity != null ? serverEquity : equity,
      cost,
      pl,
      plPct,
      cash: cashEff,
      total: totalEff,
    };
  }, [rows, cash, serverEquity, serverTotal, limit]);

  async function act(kind: "buy" | "sell" | "reset") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        kind === "reset"
          ? { action: "reset" }
          : { action: kind, ticker, shares: Math.max(1, Math.floor(Number(shares) || 0)) };

      const r = await fetch("/api/portfolio", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(txt || `HTTP ${r.status}`);
      }
      const j: ApiResponse = await r.json();
      // Refresh from server response
      // Reuse same mapping as load():
      const normalized: Row[] = (j.positions || []).map((p) => {
        const avg = p.avgCost ?? 0;
        const price = p.price ?? 0;
        const value = price * p.shares;
        const cost = avg * p.shares;
        const pl = p.unrealizedPL ?? (value - cost);
        const plPct = p.unrealizedPLPct ?? (cost > 0 ? (pl / cost) * 100 : 0);
        return {
          ticker: p.ticker,
          shares: p.shares,
          avgPrice: avg,
          currentPrice: price,
          value,
          cost,
          pl,
          plPct,
        };
      });

      setRows(normalized);
      setCash(j.cash ?? null);
      setServerEquity(j.equity ?? null);
      setServerTotal(j.total ?? null);
      setLimit(j.limit ?? 10000);
      if (kind !== "reset") setTicker(""); // clear ticker after trade
    } catch (e: any) {
      setError(e?.message || "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white p-6">Loading portfolio…</div>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">My Demo Portfolio</h1>
          <p className="text-sm text-zinc-400">
            Simulated balance with a ${limit ?? 10000} limit. Logged-in users are saved to Supabase.
          </p>
        </header>

        {error && (
          <div className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-rose-200">
            {error}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label="Total Value" value={fmt(metrics.total)} />
          <KPI label="Cash" value={fmt(metrics.cash)} />
          <KPI label="Equity Value" value={fmt(metrics.equity)} />
          <KPI
            label="Unrealized P/L"
            value={`${fmt(metrics.pl)} (${fmtPct(metrics.plPct)})`}
            accent={metrics.pl >= 0 ? "up" : "down"}
          />
        </div>

        {/* Trade box */}
        <div className="rounded-xl border border-zinc-800 p-4 bg-zinc-900/40">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="block text-xs text-zinc-400 mb-1">Ticker</label>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g., AAPL"
                className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Shares</label>
              <input
                type="number"
                min={1}
                value={shares}
                onChange={(e) => setShares(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                className="w-28 px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800"
              />
            </div>
            <button
              onClick={() => act("buy")}
              disabled={busy || !ticker}
              className="px-3 py-2 rounded-md border border-emerald-700 text-emerald-300 hover:bg-emerald-700/10 disabled:opacity-50"
            >
              Buy
            </button>
            <button
              onClick={() => act("sell")}
              disabled={busy || !ticker}
              className="px-3 py-2 rounded-md border border-rose-700 text-rose-300 hover:bg-rose-700/10 disabled:opacity-50"
            >
              Sell
            </button>
            <button
              onClick={() => act("reset")}
              disabled={busy}
              className="px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800"
            >
              Reset
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Prices come from your <code>/api/prices</code>. Buys reduce cash; sells increase it.
          </p>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-right">Shares</th>
                <th className="px-4 py-3 text-right">Avg. Price</th>
                <th className="px-4 py-3 text-right">Current</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                    No positions yet. Use the trade box above to simulate a buy.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.ticker} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-3">{p.ticker}</td>
                    <td className="px-4 py-3 text-right">{p.shares}</td>
                    <td className="px-4 py-3 text-right">{fmt(p.avgPrice)}</td>
                    <td className="px-4 py-3 text-right">{fmt(p.currentPrice)}</td>
                    <td className="px-4 py-3 text-right">{fmt(p.cost)}</td>
                    <td className="px-4 py-3 text-right">{fmt(p.value)}</td>
                    <td className={`px-4 py-3 text-right ${p.pl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmt(p.pl)} ({fmtPct(p.plPct)})
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-zinc-900/50">
                <tr>
                  <td className="px-4 py-3 font-medium">Totals</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right">{fmt(metrics.cost)}</td>
                  <td className="px-4 py-3 text-right">{fmt(metrics.equity)}</td>
                  <td className={`px-4 py-3 text-right ${metrics.pl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fmt(metrics.pl)} ({fmtPct(metrics.plPct)})
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </main>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" }) {
  const accentCls =
    accent === "up"
      ? "text-emerald-300"
      : accent === "down"
      ? "text-rose-300"
      : "text-zinc-200";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${accentCls}`}>{value}</div>
    </div>
  );
}