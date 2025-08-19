// src/components/NewsPanel.tsx
"use client";

import { useCompanyNews } from "@/lib/useCompanyNews";

export default function NewsPanel({ ticker }: { ticker: string }) {
  const { items, isLoading, error } = useCompanyNews(ticker, 15);

  if (isLoading) return <div className="p-4 text-sm text-zinc-400">Loading latest headlines…</div>;
  if (error)     return <div className="p-4 text-sm text-red-400">Couldn’t load headlines.</div>;
  if (!items.length) return <div className="p-4 text-sm text-zinc-400">No fresh headlines.</div>;

  return (
    <div className="space-y-2 p-3 text-sm">
      {items.map((n: any, i: number) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-zinc-500">{i + 1}.</span>
          <a
            href={n.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-400 hover:text-blue-300"
          >
            {n.title}
          </a>
          <span className="ml-2 text-[11px] text-zinc-500">
            {n.source}{n.date ? ` • ${new Date(n.date).toLocaleDateString()}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}