#!/usr/bin/env python3
import json
from pathlib import Path
from datetime import datetime, timezone

DATA_PATH = Path("sp500_indicators.json")  # adjust if yours lives elsewhere
BACKUP_PATH = DATA_PATH.with_suffix(".pre_news_backup.json")

def main():
    if not DATA_PATH.exists():
        raise SystemExit(f"File not found: {DATA_PATH.resolve()}")

    raw = DATA_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)

    # backup original file
    BACKUP_PATH.write_text(raw, encoding="utf-8")

    changed = 0
    for row in data:
        # add fields if missing
        if "news_articles" not in row:
            row["news_articles"] = []
            changed += 1
        if "news_sentiment" not in row:
            row["news_sentiment"] = None
            changed += 1
        if "last_news_refresh" not in row:
            row["last_news_refresh"] = None
            changed += 1

    # stamp the file-wide migration time on each row's last_news_refresh if empty
    stamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for row in data:
        if not row["last_news_refresh"]:
            row["last_news_refresh"] = stamp

    DATA_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"✅ Migration done. Updated {changed} fields across {len(data)} tickers.")
    print(f"Backup saved to: {BACKUP_PATH}")

if __name__ == "__main__":
    main()