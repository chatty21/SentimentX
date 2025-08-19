// src/components/Chatbot.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const MODEL_OPTIONS = [
  { id: "google/gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (exp)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
  { id: "mistralai/mistral-large-latest", label: "Mistral Large" },
];

// read a cookie safely on the client
function parseCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[1]) : "";
}

// quick detector for explicit tickers in the message (A–Z, 1–5 chars, optional leading $)
function findExplicitTickers(text: string): string[] {
  return (
    (text.toUpperCase().match(/\$?[A-Z]{1,5}(?:\.[A-Z])?/g) || [])
      .map((t) => t.replace(/^\$/, ""))
  );
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! I’m SentimentX AI. Ask me about any S&P 500 stock—verdict, risks, timing, and likely catalysts.",
    },
  ]);

  // optional: show a small email badge when known
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // remember the last-used ticker from cookie/server responses
  const [lastTicker, setLastTicker] = useState<string>("");

  // model selector
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].id);

  const boxRef = useRef<HTMLDivElement | null>(null);

  // fetch session badge when panel opens (non-blocking)
  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setUserEmail(json?.user?.email ?? null))
      .catch(() => setUserEmail(null));
  }, [open]);

  // read last ticker from cookie once
  useEffect(() => {
    const cookieTicker = parseCookie("sx_last_ticker");
    if (cookieTicker) setLastTicker(cookieTicker.toUpperCase());
  }, []);

  // autoscroll messages
  useEffect(() => {
    if (!boxRef.current) return;
    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [msgs, open]);

  const toggle = () => setOpen((v) => !v);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;

    setMsgs((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);

    try {
      // If the user typed a ticker explicitly, do NOT send lastTickerClient.
      const explicit = findExplicitTickers(question);
      const payload = {
        question,
        lastTickerClient: explicit.length ? null : (lastTicker || null),
        model,
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: json?.error || "Sorry, try again." },
        ]);
      } else {
        if (json?.usedTicker) setLastTicker(String(json.usedTicker).toUpperCase());
        setMsgs((m) => [...m, { role: "assistant", content: json.reply }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Network error. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={toggle}
        aria-label="Open chatbot"
        className={[
          "fixed bottom-5 right-5 z-[60]",
          "rounded-full shadow-[0_0_30px_rgba(0,0,0,0.4)] border border-blue-400/30",
          "bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500",
          "hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400",
          "text-white px-6 py-4 transition-all duration-300 ease-out hover:translate-y-[-2px]",
          "focus:outline-none focus:ring-2 focus:ring-blue-400/60",
        ].join(" ")}
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex h-3 w-3 rounded-full bg-white/90 animate-pulse" />
          <span className="font-semibold">
            {open ? "Close SentimentX" : "Ask SentimentX"}
          </span>
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[61] w-[400px] max-w-[95vw] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="text-sm font-semibold">
              SentimentX AI{" "}
              {userEmail ? <span className="text-zinc-500 font-normal">• {userEmail}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="text-[11px] bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                title="Choose model"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-zinc-400">Beta</span>
            </div>
          </div>

          {/* messages */}
          <div ref={boxRef} className="h-80 overflow-y-auto p-3 space-y-2">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`text-sm ${m.role === "user" ? "text-zinc-100" : "text-zinc-300"}`}
              >
                <span
                  className={`inline-block px-3 py-2 rounded-lg ${
                    m.role === "user"
                      ? "bg-blue-600/20 border border-blue-700"
                      : "bg-zinc-900 border border-zinc-800"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-blue-400 hover:text-blue-300"
                          />
                        ),
                        p: (props) => <p className="mb-1" {...props} />,
                        ul: (props) => <ul className="list-disc pl-5 my-1" {...props} />,
                        ol: (props) => <ol className="list-decimal pl-5 my-1" {...props} />,
                        li: (props) => <li className="my-0.5" {...props} />,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </span>
              </div>
            ))}
            {busy && <div className="text-xs text-zinc-500">Thinking…</div>}
          </div>

          {/* input row */}
          <div className="p-3 border-t border-zinc-800 space-y-2">
            {lastTicker ? (
              <div className="text-[10px] text-zinc-500">
                Context: last ticker{" "}
                <span className="text-zinc-300 font-medium">{lastTicker}</span>
              </div>
            ) : null}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder='Ask e.g. “Will AAPL pull back this month?”'
                className="flex-1 px-3 py-2 text-sm rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="px-3 py-2 text-sm rounded-md border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <div className="text-[10px] text-zinc-500">No guarantees; info only.</div>
          </div>
        </div>
      )}
    </>
  );
}