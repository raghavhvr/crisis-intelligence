# Crisis Pulse — MENA Media & Search Dashboard

Auto-refreshing consumer signal dashboard for GroupM MENA crisis monitoring.
Pulls Google Trends data daily via GitHub Actions. No backend server required.

## Architecture

```
GitHub Actions (cron: daily 09:00 GST)
    └── scripts/collect.py          ← pulls pytrends for 4 markets × 5 signals
            └── public/pulse_data.json  ← committed to repo

StackBlitz / Vercel (frontend)
    └── src/App.tsx                 ← reads pulse_data.json on page load
```

## Setup (one time)

### 1. Create this repo on GitHub
Upload all files maintaining this structure:
```
.github/workflows/daily-refresh.yml
scripts/collect.py
public/pulse_data.json
src/App.tsx
```

### 2. Update the data URL in App.tsx
On line 10, replace:
```js
const REPO_RAW_URL = "https://raw.githubusercontent.com/YOUR_USERNAME/crisis-pulse/main/public/pulse_data.json";
```
With your actual GitHub username and repo name.

### 3. Enable GitHub Actions
Go to your repo → Actions tab → enable workflows if prompted.
The workflow runs daily at 05:00 UTC (09:00 GST) automatically.

To trigger a manual run: Actions → "Crisis Pulse — Daily Data Refresh" → "Run workflow"

### 4. Deploy frontend on StackBlitz or Vercel
- **StackBlitz**: paste App.tsx contents into src/App.tsx, run `npm install recharts`
- **Vercel**: connect GitHub repo, auto-deploys on every commit (including daily data pushes)

## Signals tracked

| Signal | Keyword | What it measures |
|--------|---------|-----------------|
| Gaming | "gaming" | Escapism / entertainment shift |
| Wellness | "wellness" | Anxiety / self-care signal |
| News | "news" | Crisis awareness monitoring |
| Cheap | "cheap" | Price sensitivity indicator |
| Delivery | "delivery" | Retail avoidance signal |

## Markets
UAE (AE) · KSA (SA) · Kuwait (KW) · Qatar (QA)

## Cost
**Zero.** GitHub Actions free tier gives 2,000 minutes/month.
The daily script runs in under 3 minutes.
