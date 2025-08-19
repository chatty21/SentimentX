async function handleSend(userText: string) {
  // 1) ask our analyzer for a clean snapshot
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: userText, nTop: 3 }),
  });
  const analysis = await res.json();

  if (analysis?.status !== "ok") {
    // fall back to original behavior
    return sendPlainToLLM(userText);
  }

  // 2) build a compact system+user prompt with actual numbers
  const { ticker, snapshot, news } = analysis;
  const sys = `You are SentimentX, a concise equities assistant. Make a VERDICT in the first line (Bullish/Bearish/Neutral, and optionally timeframe), then 2–4 bullet reasons. Use provided snapshot only; don't invent numbers.`;
  const user = [
    `Ticker: ${ticker}`,
    `Company: ${snapshot.company ?? "-"}`,
    `Sector: ${snapshot.sector ?? "-"}`,
    `Price: ${snapshot.price ?? "-"}`,
    `MA50: ${snapshot.ma50 ?? "-"}`,
    `RSI: ${snapshot.rsi ?? "-"}`,
    `% vs MA50: ${snapshot.pctVsMA50 ?? "-"}`,
    news.length ? `Top headlines:\n- ${news.map((n: any) => n.title).join("\n- ")}` : `Top headlines: (none)`,
    `Task: Give a near-term trading verdict with risks and next checks.`,
  ].join("\n");

  // 3) call your LLM wrapper (OpenRouter) with this structured context
  const reply = await callYourLLM(sys, user); // implement with your existing LLM helper
  appendAssistant(reply);
}

function sendPlainToLLM(userText: string) {
  throw new Error("Function not implemented.");
}
function callYourLLM(sys: string, user: string) {
  throw new Error("Function not implemented.");
}

function appendAssistant(reply: void) {
  throw new Error("Function not implemented.");
}

