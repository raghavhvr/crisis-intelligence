"""
Crisis Pulse — Data Collector
==============================
Runs daily via Windows Task Scheduler or GitHub Actions.
On partial failures (429s), merges live data with last
successful pull rather than falling back to stale hardcoded data.
"""

import json
import time
import logging
import random
from pathlib import Path
from datetime import datetime

from pytrends.request import TrendReq

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

MARKETS: dict[str, str] = {
    "AE": "UAE",
    "SA": "KSA",
    "KW": "Kuwait",
    "QA": "Qatar",
}

SIGNALS: dict[str, str] = {
    "gaming":   "gaming",
    "wellness": "wellness",
    "news":     "news",
    "cheap":    "cheap",
    "delivery": "delivery",
}

SLEEP_BETWEEN_CALLS   = 30
SLEEP_BETWEEN_MARKETS = 60
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "pulse_data.json"


# ── Load last good data ───────────────────────────────────────────────────────

def load_existing() -> dict:
    """Load current pulse_data.json as baseline. Returns empty dict if not found."""
    try:
        if OUTPUT_PATH.exists():
            data = json.loads(OUTPUT_PATH.read_text())
            if data.get("markets") and data.get("fetched_at") != "fallback":
                logger.info(f"📂 Loaded existing data from {data.get('fetched_at','unknown')}")
                return data
    except Exception as e:
        logger.warning(f"Could not load existing data: {e}")
    return {}


# ── Puller ────────────────────────────────────────────────────────────────────

def pull(client: TrendReq, keyword: str, geo: str) -> tuple[list[float], list[str]]:
    """Pull 7-day daily interest for one keyword/geo."""
    try:
        client.build_payload([keyword], timeframe="now 7-d", geo=geo)
        df = client.interest_over_time()
        if df.empty:
            return [], []
        daily  = df[[keyword]].resample("D").mean().round(1)
        values = daily[keyword].tolist()
        dates  = [d.strftime("%b %d") for d in daily.index]
        return values, dates
    except Exception as e:
        logger.warning(f"  ✗ [{geo}][{keyword}]: {e}")
        return [], []


# ── Collector ─────────────────────────────────────────────────────────────────

def collect() -> dict:
    client   = TrendReq(hl="en-US", tz=180, timeout=(15, 30))
    existing = load_existing()

    result: dict = {
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "dates": existing.get("dates", []),
        "markets": {},
        "live_signals": 0,
        "fallback_signals": 0,
    }

    # Pre-fill all markets with yesterday's data as baseline
    for market_name in MARKETS.values():
        result["markets"][market_name] = dict(
            existing.get("markets", {}).get(market_name, {})
        )

    dates_set = bool(result["dates"])

    for geo_code, market_name in MARKETS.items():
        logger.info(f"📍 {market_name} ({geo_code})")

        for signal_key, keyword in SIGNALS.items():
            sleep_time = SLEEP_BETWEEN_CALLS + random.uniform(2, 8)
            logger.info(f"  Sleeping {sleep_time:.0f}s → [{signal_key}]...")
            time.sleep(sleep_time)

            values, dates = pull(client, keyword, geo_code)

            if values:
                result["markets"][market_name][signal_key] = values
                result["live_signals"] += 1
                logger.info(f"  ✓ {signal_key}: {values[-1]} (LIVE)")
                if not dates_set and dates:
                    result["dates"] = dates
                    dates_set = True
            else:
                if result["markets"][market_name].get(signal_key):
                    result["fallback_signals"] += 1
                    logger.warning(f"  ⚠ {signal_key}: keeping previous pull")
                else:
                    result["fallback_signals"] += 1
                    logger.warning(f"  ✗ {signal_key}: no data available")

        time.sleep(SLEEP_BETWEEN_MARKETS)

    total = result["live_signals"] + result["fallback_signals"]
    logger.info(f"\n✅ Done — {result['live_signals']}/{total} live, {result['fallback_signals']}/{total} from previous pull")
    return result


# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("  Crisis Pulse — Daily Collector")
    logger.info(f"  {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    logger.info("=" * 50)

    try:
        data = collect()
    except Exception as e:
        logger.error(f"Collection failed: {e}")
        existing = load_existing()
        if existing:
            existing["fetched_at"] = datetime.utcnow().isoformat() + "Z"
            existing["error"] = str(e)
            data = existing
            logger.info("Total failure — kept existing data with updated timestamp")
        else:
            raise

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, indent=2))
    logger.info(f"📄 Written → {OUTPUT_PATH}")
    logger.info(f"   Live: {data.get('live_signals','?')} | Previous: {data.get('fallback_signals','?')}")