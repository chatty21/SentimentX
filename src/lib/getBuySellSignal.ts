// src/lib/getBuySellSignal.ts

/**
 * Looser Buy/Hold/Sell signal based on RSI and distance from MA50.
 * - Backward-compatible: keeps the old 4-arg signature (RSI, avg50, avg200, price),
 *   but ignores avg200 internally.
 * - Thresholds are intentionally soft so results vary more across the tape.
 *
 * Returns: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | "N/A"
 */
export function getBuySellSignal(
  RSI?: number | null,
  avg50?: number | null,
  _avg200?: number | null, // kept for compatibility; no longer used
  price?: number | null
): string {
  // Need at least RSI, MA50, and price to produce a signal
  const has =
    typeof RSI === "number" &&
    Number.isFinite(RSI) &&
    typeof avg50 === "number" &&
    Number.isFinite(avg50) &&
    typeof price === "number" &&
    Number.isFinite(price) &&
    avg50 !== 0;

  if (!has) return "N/A";

  const rsi = RSI as number;
  const ma50 = avg50 as number;
  const p = price as number;

  // % distance from MA50
  const distPct = ((p / ma50) - 1) * 100;

  /* ------------------------------------------------------------------
     Heuristics (looser than before):
     - Strong Buy: clearly oversold + trading meaningfully above MA50
     - Strong Sell: clearly overbought + trading meaningfully below MA50
     - Buy/Sell: softer edges around MA50 and RSI mid-zones
     ------------------------------------------------------------------ */

  // Strong signals
  if (rsi <= 35 && distPct >= 2) return "Strong Buy";
  if (rsi >= 65 && distPct <= -2) return "Strong Sell";

  // Moderate signals
  if ((rsi < 50 && distPct > 0.5) || (rsi <= 42 && distPct >= 0)) return "Buy";
  if ((rsi > 55 && distPct < -0.5) || (rsi >= 58 && distPct <= 0)) return "Sell";

  return "Hold";
}