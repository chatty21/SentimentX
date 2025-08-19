// src/lib/forecast.ts

export function parseHorizonDays(text: string): number {
    // Try `X week(s)`, `X month(s)`, `X day(s)`
    const t = text.toLowerCase();
  
    const mW = t.match(/(\d+)\s*week/);
    if (mW) return Math.max(1, Number(mW[1]) * 5); // ~5 trading days per week
  
    const mM = t.match(/(\d+)\s*month/);
    if (mM) return Math.max(1, Number(mM[1]) * 21); // ~21 trading days per month
  
    const mD = t.match(/(\d+)\s*day/);
    if (mD) return Math.max(1, Number(mD[1]));
  
    // soft default if user didn’t say; keep small
    return 10; // ~2 trading weeks
  }
  
  export type Forecast = {
    horizonDays: number;
    start: number;
    median: number;
    p10: number;
    p90: number;
  };
  
  function percentile(vals: number[], p: number): number {
    if (!vals.length) return NaN;
    const i = (vals.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    if (lo === hi) return vals[lo];
    return vals[lo] * (hi - i) + vals[hi] * (i - lo);
  }
  
  /**
   * Very rough GBM Monte Carlo using daily log-returns from recent closes.
   * - `closes` should be ascending by time (oldest -> newest).
   * - Returns median and p10/p90 envelope for horizon.
   */
  export function roughForecast(closes: number[], horizonDays: number): Forecast | null {
    if (!Array.isArray(closes) || closes.length < 20) return null;
    const clean = closes.filter((x) => Number.isFinite(x));
    if (clean.length < 20) return null;
  
    // daily log-returns
    const rets: number[] = [];
    for (let i = 1; i < clean.length; i++) {
      const r = Math.log(clean[i] / clean[i - 1]);
      if (Number.isFinite(r)) rets.push(r);
    }
    if (rets.length < 10) return null;
  
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance =
      rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, rets.length - 1);
    const sigma = Math.sqrt(Math.max(variance, 0));
    const mu = mean; // simple; drift ~ mean of log returns
  
    const S0 = clean[clean.length - 1];
    const steps = Math.max(1, Math.floor(horizonDays));
    const paths = 2000; // modest to keep it quick
  
    const terminal: number[] = new Array(paths);
    for (let p = 0; p < paths; p++) {
      let S = S0;
      for (let d = 0; d < steps; d++) {
        // GBM step: S_t+1 = S_t * exp( (mu - 0.5*sigma^2) + sigma * z )
        const z = boxMuller(); // ~N(0,1)
        S = S * Math.exp((mu - 0.5 * sigma * sigma) + sigma * z);
      }
      terminal[p] = S;
    }
    terminal.sort((a, b) => a - b);
  
    return {
      horizonDays: steps,
      start: S0,
      median: percentile(terminal, 0.5),
      p10: percentile(terminal, 0.1),
      p90: percentile(terminal, 0.9),
    };
  }
  
  export function formatForecastLine(ticker: string, f: Forecast): string {
    const toUsd = (x: number) => (Number.isFinite(x) ? `$${x.toFixed(2)}` : "N/A");
    return `Rough estimate for ${ticker} in ~${f.horizonDays} trading days: median ${toUsd(
      f.median
    )} (p10–p90: ${toUsd(f.p10)}–${toUsd(f.p90)}).`;
  }
  
  // simple normal(0,1)
  function boxMuller(): number {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }