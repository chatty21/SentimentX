// src/lib/llm.ts
export type Msg = { role: "system" | "user" | "assistant"; content: string };

type LLMOpts = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function env(name: string, required = false): string | undefined {
  const v = process.env[name];
  if (required && !v) console.error(`[llm] Missing env ${name}`);
  return v;
}

function normalizeModel(input?: string): string | undefined {
  const m = (input || "").trim();
  const map: Record<string, string> = {
    "google/gemini-2.0-flash-exp": "openrouter/auto",
    "openai/gpt-4o-mini": "openai/gpt-4o-mini",
    "meta-llama/llama-3.1-70b-instruct": "meta-llama/llama-3.1-70b-instruct",
    "mistralai/mistral-large-latest": "openrouter/auto",
    "google/gemini-1.5-flash": "google/gemini-1.5-flash",
    "google/gemini-1.5-flash-8b": "google/gemini-1.5-flash-8b",
  };
  if (m && map[m]) return map[m];
  if (m) return m;
  return undefined;
}

async function callOpenRouterOnce(
  model: string,
  messages: Msg[],
  opts: LLMOpts
): Promise<string> {
  const apiKey = env("OPENROUTER_API_KEY", true);
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const site = env("OPENROUTER_SITE_URL") || "http://localhost:3000";
  const app = env("OPENROUTER_APP_NAME") || "SentimentX";

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000);

  try {
    const resp = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": site,
        "X-Title": app,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 400,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} for model ${model}: ${txt.slice(0, 300)}`);
    }

    const json = await resp.json().catch(() => ({}));
    const content =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.delta?.content ??
      "";

    if (!content || typeof content !== "string") {
      throw new Error("No content in response");
    }
    return content.trim();
  } finally {
    clearTimeout(to);
  }
}

export async function callLLMWithFallback(
  messages: Msg[],
  opts: LLMOpts = {}
): Promise<string> {
  const requested = normalizeModel(opts.model);
  const fallbacks: string[] = [
    ...(requested ? [requested] : []),
    "openrouter/auto",
    "google/gemini-1.5-flash",
    "openai/gpt-4o-mini",
    "meta-llama/llama-3.1-70b-instruct",
  ];

  const tried = new Set<string>();
  let lastErr: any = null;

  for (const model of fallbacks) {
    if (!model || tried.has(model)) continue;
    tried.add(model);
    try {
      return await callOpenRouterOnce(model, messages, opts);
    } catch (e) {
      lastErr = e;
      // continue
    }
  }
  throw new Error(`[llm] All models failed. Last error: ${lastErr?.message || lastErr}`);
}