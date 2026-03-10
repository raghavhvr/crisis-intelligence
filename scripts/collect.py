"""
Crisis Pulse — Data Collector
==============================
Runs inside GitHub Actions daily. Pulls Google Trends data
for MENA markets and writes output to public/pulse_data.json.

GitHub's IP range is not blocked by Google Trends (unlike
cloud hosting providers like Render/Heroku/AWS).
"""

import json
import time
import logging
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

SLEEP_BETWEEN_CALLS   = 10   # seconds between pytrends requests
SLEEP_BETWEEN_MARKETS = 20   # seconds between markets
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "pulse_data.json"

# ── Fallback data (used if a pull fails completely) ───────────────────────────

FALLBACK: dict = {
    "fetched_at": "fallback",
    "dates": ["Mar 03","Mar 04","Mar 05","Mar 06","Mar 07","Mar 08","Mar 09","Mar 10"],
    "markets": {
        "UAE":    {"gaming":[39,41,42,54,48,48,48,46],"wellness":[41,35,30,39,34,30,43,46],"news":[51,40,40,33,49,33,30,34],"cheap":[59,64,64,76,79,72,78,79],"delivery":[54,57,56,67,65,69,64,65]},
        "KSA":    {"gaming":[40,45,48,53,56,49,46,61],"wellness":[38,33,32,40,36,32,42,44],"news":[48,39,39,32,46,31,29,33],"cheap":[29,34,37,42,49,42,45,49],"delivery":[48,52,51,61,58,63,58,59]},
        "Kuwait": {"gaming":[28,31,34,38,40,35,33,44],"wellness":[29,25,24,31,28,25,32,34],"news":[37,30,30,25,36,24,22,26],"cheap":[22,27,29,33,37,32,36,38],"delivery":[38,42,41,49,47,50,46,47]},
        "Qatar":  {"gaming":[22,11,20,35,32,27,28,26],"wellness":[28,24,23,30,28,25,31,34],"news":[44,35,36,29,42,28,26,30],"cheap":[22,27,29,33,37,32,36,38],"delivery":[38,42,41,49,47,50,46,47]},
    }
}

# ── Puller ────────────────────────────────────────────────────────────────────

def pull(client: TrendReq, keyword: str, geo: str) -> tuple[list[float], list[str]]:
    """Pull 7-day daily interest for one keyword/geo. Returns (values, dates)."""
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


def collect() -> dict:
    client = TrendReq(hl="en-US", tz=180, timeout=(15, 30))
    result: dict = {
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "dates": [],
        "markets": {},
    }
    dates_set = False
    success_count = 0

    for geo_code, market_name in MARKETS.items():
        logger.info(f"📍 {market_name} ({geo_code})")
        result["markets"][market_name] = {}

        for signal_key, keyword in SIGNALS.items():
            time.sleep(SLEEP_BETWEEN_CALLS)
            values, dates = pull(client, keyword, geo_code)

            if values:
                result["markets"][market_name][signal_key] = values
                success_count += 1
                logger.info(f"  ✓ {signal_key}: {values[-1]} (latest)")
                if not dates_set and dates:
                    result["dates"] = dates
                    dates_set = True
            else:
                # Use fallback values for this signal
                fallback_vals = FALLBACK["markets"].get(market_name, {}).get(signal_key, [])
                result["markets"][market_name][signal_key] = fallback_vals
                logger.warning(f"  ⚠ {signal_key}: using fallback data")

        time.sleep(SLEEP_BETWEEN_MARKETS)

    if not result["dates"]:
        result["dates"] = FALLBACK["dates"]

    logger.info(f"\n✅ Collection complete — {success_count}/{len(MARKETS)*len(SIGNALS)} signals live")
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
        logger.error(f"Collection failed entirely: {e} — writing fallback")
        data = FALLBACK
        data["fetched_at"] = datetime.utcnow().isoformat() + "Z"
        data["fallback"] = True

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, indent=2))
    logger.info(f"📄 Written to {OUTPUT_PATH}")
