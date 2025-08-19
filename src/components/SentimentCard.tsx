'use client';
import { useEffect, useState } from 'react';

type NewsArticle = { title: string; link: string; source?: string; published?: string };

export default function SentimentCard({ ticker }: { ticker: string }) {
  const [sentiment, setSentiment] = useState<string>('—');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;

    const safeParseJson = async (res: Response) => {
      if (!res.ok) return { news_sentiment: null, news_articles: [] as NewsArticle[] };
      const txt = await res.text();
      if (!txt) return { news_sentiment: null, news_articles: [] as NewsArticle[] };
      try { return JSON.parse(txt); } catch { return { news_sentiment: null, news_articles: [] as NewsArticle[] }; }
    };

    const go = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/news?t=${encodeURIComponent(ticker)}`, { cache: 'no-store' });
        const json = await safeParseJson(res);
        setSentiment(json?.news_sentiment ?? '—');
        setArticles(Array.isArray(json?.news_articles) ? json.news_articles : []);
      } catch (e) {
        console.warn('news fetch failed:', e);
        setSentiment('—');
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    go();
  }, [ticker]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="text-sm font-medium text-zinc-200">News sentiment</div>
      {loading ? (
        <div className="text-sm text-zinc-500 mt-1">Loading…</div>
      ) : (
        <>
          <div className="text-sm text-zinc-100 mt-1">{sentiment}</div>
          {articles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {articles.slice(0, 3).map((a, i) => (
                <li key={i} className="text-sm">
                  <a href={a.link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                    {a.title}
                  </a>
                  {a.source && <span className="text-zinc-500 ml-2">• {a.source}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}