export function sma(values: number[], period: number) {
    if (!Array.isArray(values) || values.length < period) return undefined;
    let sum = 0;
    for (let i = values.length - period; i < values.length; i++) sum += values[i];
    return sum / period;
  }
  
  export function rsi(values: number[], period = 14) {
    if (!Array.isArray(values) || values.length < period + 1) return undefined;
    let gains = 0, losses = 0;
    for (let i = values.length - period; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    const avgG = gains / period;
    const avgL = losses / period;
    if (avgL === 0) return 100;
    const rs = avgG / avgL;
    return 100 - 100 / (1 + rs);
  }