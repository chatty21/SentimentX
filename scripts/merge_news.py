#!/usr/bin/env python3
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
import hashlib

DATA_PATH = Path("sp500_indicators.json")  # adjust if needed

# --- tunables ---
KEEP_DAYS = 7                 # only keep articles newer than this many days
MAX_ARTICLES_PER_TICKER = 25  # cap to avoid bloating the JSON
SENTIMENT_POS = 0.25          # thresholds for label mapping
SENTIMENT_NEG = -0.25

def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def _parse_iso(s: str) -> datetime:
    # Allow both "Z" and "+00:00"
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)

def _article_id_from(title: str, url: str, published_at: str) -> str:
    h = hashlib.sha256()
    h.update((title or "").encode())
    h.update((url or "").encode())
    h.update((published_at or "").encode())
    return h.hexdigest()[:16]

def _normalize_article(a: Dict[str, Any]) -> Dict[str, Any]:
    title = a.get("title", "").strip()
    url = a.get("url", "").strip()
    published_at = a.get("published_at")
    aid = a.get("id") or _article_id_from(title, url, published_at or "")

    return {
        "id": aid,
        "title": title,
        "source": a.get("source", ""),
        "url": url,
        "published_at": published_at,              # ISO 8601
        "summary": a.get("summary", ""),
        "tickers": a.get("tickers", []),
        "topics": a.get("topics", []),
        "sentiment_score": float(a.get("sentiment_score", 0)),
        "relevance_score": float(a.get("relevance_score", 0)),
        "impact_score": float(a.get("impact_score", 0)),
    }

def _label_sentiment(avg: float) -> str:
    if avg >= SENTIMENT_POS: return "Positive"
    if avg <= SENTIMENT_NEG: return "Negative"
    return "Neutral"

def _dedupe(existing: List[Dict[str, Any]], incoming: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = {a["id"] for a in existing}
    merged = existing[:]
    for a in incoming:
        if a["id"] not in seen:
            merged.append(a)
            seen.add(a["id"])
    return merged

def _trim_recent(arts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    def is_recent(a):
        try:
            return _parse_iso(a["published_at"]) >= cutoff
        except Exception:
            return True  # if bad timestamp, keep for now
    recent = [a for a in arts if is_recent(a)]
    # newest first
    recent.sort(key=lambda a: a.get("published_at") or "", reverse=True)
    return recent[:MAX_ARTICLES_PER_TICKER]

def merge_news(news_by_ticker: Dict[str, List[Dict[str, Any]]]) -> None:
    if not DATA_PATH.exists():
        raise SystemExit(f"File not found: {DATA_PATH.resolve()}")

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    index = {row["ticker"]: i for i, row in enumerate(data)}

    for ticker, articles in news_by_ticker.items():
        if ticker not in index:
            # silently skip unknown tickers
            continue

        i = index[ticker]
        row = data[i]
        row.setdefault("news_articles", [])
        row.setdefault("news_sentiment", None)
        row.setdefault("last_news_refresh", None)

        incoming = [_normalize_article(a) for a in articles]
        # merge + dedupe
        merged = _dedupe(row["news_articles"], incoming)
        # trim to recent + cap count
        merged = _trim_recent(merged)
        row["news_articles"] = merged

        # compute average sentiment for label (weighted by relevance if present)
        if merged:
            num = 0.0
            den = 0.0
            for a in merged:
                s = a.get("sentiment_score", 0.0)
                w = a.get("relevance_score", 1.0)
                num += s * w
                den += w
            avg = (num / den) if den else 0.0
            row["news_sentiment"] = _label_sentiment(avg)
        else:
            row["news_sentiment"] = "Neutral"

        row["last_news_refresh"] = _iso_now()

    DATA_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"✅ News merged for {len(news_by_ticker)} tickers.")

# ---- Example usage (replace with your real API output) ----
if __name__ == "__main__":
    example_payload = {
        "AAPL": [
            {
                "title": "Apple unveils new AI features at product event",
                "source": "Bloomberg",
                "url": "https://example.com/aapl1",
                "published_at": "2025-08-07T17:00:00Z",
                "summary": "Apple announced on-device models…",
                "tickers": ["AAPL"],
                "topics": ["ai","product"],
                "sentiment_score": 0.58,
                "relevance_score": 0.94,
                "impact_score": 0.71
            },
            {
                "title": "Analyst raises Apple price target",
                "source": "Reuters",
                "url": "https://example.com/aapl2",
                "published_at": "2025-08-07T13:25:00Z",
                "summary": "Target to $245 on stronger services…",
                "tickers": ["AAPL"],
                "topics": ["analyst","price-target"],
                "sentiment_score": 0.35,
                "relevance_score": 0.70,
                "impact_score": 0.40
            }
        ],
        "AMZN": [
            {
                "title": "Amazon to expand healthcare pilot",
                "source": "Reuters",
                "url": "https://example.com/amzn1",
                "published_at": "2025-08-07T13:25:00Z",
                "summary": "Expansion to five new cities…",
                "tickers": ["AMZN"],
                "topics": ["healthcare","expansion"],
                "sentiment_score": 0.22,
                "relevance_score": 0.82,
                "impact_score": 0.40
            }
        ]
    }
    merge_news(example_payload)
    