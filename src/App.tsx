import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

const DATA_URL = "/pulse_data.json";

const SIGNAL_META: Record<string, { label: string; color: string; icon: string }> = {
  gaming:   { label: "Gaming",   color: "#00f5d4", icon: "◈" },
  wellness: { label: "Wellness", color: "#f72585", icon: "◉" },
  news:     { label: "News",     color: "#fee440", icon: "◎" },
  cheap:    { label: "Price Sensitivity", color: "#fb8500", icon: "◇" },
  delivery: { label: "Delivery", color: "#8338ec", icon: "◐" },
};

const MARKET_FLAGS: Record<string, string> = {
  UAE: "🇦🇪", KSA: "🇸🇦", Kuwait: "🇰🇼", Qatar: "🇶🇦",
};

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function WoWBadge({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null;
  const prev = values[values.length - 2];
  const curr = values[values.length - 1];
  if (!prev) return null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (Math.abs(pct) < 2) return <span className="badge neutral">→ flat</span>;
  return (
    <span className={`badge ${pct > 0 ? "up" : "down"}`}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-box">
      <div className="tooltip-label">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMarket, setActiveMarket] = useState("UAE");
  const [activeSignal, setActiveSignal] = useState("gaming");

  useEffect(() => {
    fetch(DATA_URL)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div className="error-screen">
      <div className="error-icon">⚠</div>
      <div className="error-title">Could not load pulse data</div>
      <div className="error-sub">HTTP {error}</div>
      <button onClick={() => window.location.reload()} className="retry-btn">Retry</button>
    </div>
  );

  if (!data) return (
    <div className="loading-screen">
      <div className="spinner" />
      <div className="loading-text">Loading latest pulse data…</div>
    </div>
  );

  const markets   = data.markets || {};
  const global    = data.global  || {};
  const rss       = global.rss_trends || {};
  const twitch    = global.twitch || {};
  const wiki      = global.wikipedia || {};
  const newsapi   = data.news_volumes?.newsapi || {};
  const guardian  = data.news_volumes?.guardian || {};
  const dates     = data.dates || [];
  const sources   = data.sources_live || [];

  // Signal trend data for active market
  const signalChartData = dates.map((d: string, i: number) => {
    const row: any = { date: d };
    Object.keys(SIGNAL_META).forEach(sig => {
      row[sig] = markets[activeMarket]?.[sig]?.[i] ?? null;
    });
    return row;
  });

  // Wikipedia trend for active signal
  const wikiChartData = dates.map((d: string, i: number) => ({
    date: d,
    value: wiki[activeSignal]?.[i] ?? null,
  }));

  // News volume comparison
  const newsChartData = Object.keys(SIGNAL_META).map(sig => ({
    name: SIGNAL_META[sig].label,
    newsapi: newsapi[sig] || 0,
    guardian: guardian[sig] || 0,
    color: SIGNAL_META[sig].color,
  }));

  // Crisis/sport breakdown across markets
  const moodData = Object.keys(MARKET_FLAGS).map(m => ({
    market: m,
    sport: rss[m]?.sport_entertainment_pct || 0,
    crisis: rss[m]?.crisis_pct || 0,
    other: Math.max(0, 100 - (rss[m]?.sport_entertainment_pct || 0) - (rss[m]?.crisis_pct || 0)),
  }));

  const fetchedAt = new Date(data.fetched_at);
  const timeAgo = Math.round((Date.now() - fetchedAt.getTime()) / 60000);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:       #080c10;
          --surface:  #0d1117;
          --surface2: #111820;
          --border:   #1e2a35;
          --text:     #c9d4dc;
          --muted:    #4a5e6d;
          --cyan:     #00f5d4;
          --pink:     #f72585;
          --yellow:   #fee440;
          --orange:   #fb8500;
          --purple:   #8338ec;
          --mono:     'Space Mono', monospace;
          --sans:     'DM Sans', sans-serif;
        }

        body { background: var(--bg); color: var(--text); font-family: var(--sans); min-height: 100vh; }

        /* ── Header ── */
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 28px; border-bottom: 1px solid var(--border);
          background: var(--surface); position: sticky; top: 0; z-index: 100;
        }
        .header-left { display: flex; align-items: center; gap: 14px; }
        .pulse-dot {
          width: 10px; height: 10px; border-radius: 50%; background: var(--cyan);
          box-shadow: 0 0 8px var(--cyan);
          animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%,100% { box-shadow: 0 0 6px var(--cyan); opacity: 1; }
          50%      { box-shadow: 0 0 18px var(--cyan); opacity: 0.7; }
        }
        .header-title { font-family: var(--mono); font-size: 14px; letter-spacing: 3px; color: #fff; }
        .header-sub { font-size: 11px; color: var(--muted); letter-spacing: 1px; margin-top: 2px; }
        .header-meta { display: flex; align-items: center; gap: 16px; }
        .source-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip {
          font-family: var(--mono); font-size: 9px; letter-spacing: 1px;
          padding: 3px 8px; border-radius: 3px; border: 1px solid;
        }
        .chip.live   { border-color: var(--cyan); color: var(--cyan); background: rgba(0,245,212,.06); }
        .chip.dead   { border-color: var(--muted); color: var(--muted); }
        .ts { font-family: var(--mono); font-size: 10px; color: var(--muted); }

        /* ── Layout ── */
        .main { padding: 24px 28px; display: flex; flex-direction: column; gap: 24px; max-width: 1400px; margin: 0 auto; }

        /* ── Section titles ── */
        .section-title {
          font-family: var(--mono); font-size: 10px; letter-spacing: 2px;
          color: var(--muted); text-transform: uppercase; margin-bottom: 14px;
          display: flex; align-items: center; gap: 10px;
        }
        .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

        /* ── Cards ── */
        .card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 8px; padding: 20px;
        }
        .card-sm { padding: 16px; }

        /* ── Market selector ── */
        .market-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .market-tab {
          font-family: var(--mono); font-size: 11px; letter-spacing: 1px;
          padding: 7px 16px; border-radius: 4px; border: 1px solid var(--border);
          background: transparent; color: var(--muted); cursor: pointer;
          transition: all .15s;
        }
        .market-tab:hover { border-color: var(--cyan); color: var(--text); }
        .market-tab.active { border-color: var(--cyan); color: var(--cyan); background: rgba(0,245,212,.08); }

        /* ── Signal tabs ── */
        .signal-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .signal-tab {
          font-size: 11px; padding: 5px 12px; border-radius: 4px;
          border: 1px solid var(--border); background: transparent;
          color: var(--muted); cursor: pointer; transition: all .15s;
        }
        .signal-tab.active { background: rgba(255,255,255,.06); color: #fff; border-color: #fff3; }

        /* ── Badges ── */
        .badge { font-family: var(--mono); font-size: 10px; padding: 2px 7px; border-radius: 3px; margin-left: 8px; }
        .badge.up     { background: rgba(0,245,212,.12); color: var(--cyan); }
        .badge.down   { background: rgba(247,37,133,.12); color: var(--pink); }
        .badge.neutral{ background: rgba(255,255,255,.05); color: var(--muted); }

        /* ── KPI row ── */
        .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        .kpi-card {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 6px; padding: 14px 16px;
          border-left: 3px solid;
        }
        .kpi-icon { font-size: 16px; margin-bottom: 6px; }
        .kpi-val  { font-family: var(--mono); font-size: 22px; color: #fff; line-height: 1; }
        .kpi-label{ font-size: 10px; color: var(--muted); margin-top: 5px; letter-spacing: .5px; }

        /* ── Market RSS cards ── */
        .market-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .market-card {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 6px; padding: 16px;
        }
        .market-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .market-flag { font-size: 18px; }
        .market-name { font-family: var(--mono); font-size: 12px; color: #fff; }
        .mood-bar { display: flex; height: 4px; border-radius: 2px; overflow: hidden; margin-bottom: 10px; gap: 1px; }
        .mood-seg { border-radius: 1px; transition: width .3s; }
        .mood-labels { display: flex; justify-content: space-between; font-size: 9px; color: var(--muted); margin-bottom: 10px; }
        .topic-list { display: flex; flex-direction: column; gap: 4px; }
        .topic-item {
          font-size: 10px; color: var(--text); padding: 3px 0;
          border-bottom: 1px solid var(--border); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .topic-num { color: var(--muted); margin-right: 6px; font-family: var(--mono); }

        /* ── Charts ── */
        .chart-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .chart-title { font-family: var(--mono); font-size: 11px; color: var(--text); margin-bottom: 16px; }
        .chart-subtitle { font-size: 10px; color: var(--muted); margin-left: 8px; }

        /* ── Twitch panel ── */
        .twitch-grid { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: center; }
        .twitch-stat { text-align: center; padding: 0 24px; border-right: 1px solid var(--border); }
        .twitch-viewers { font-family: var(--mono); font-size: 36px; color: var(--cyan); line-height: 1; }
        .twitch-label { font-size: 10px; color: var(--muted); margin-top: 4px; letter-spacing: 1px; }
        .game-bars { display: flex; flex-direction: column; gap: 10px; }
        .game-row { display: flex; align-items: center; gap: 12px; }
        .game-name { font-size: 11px; color: var(--text); width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .game-bar-wrap { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
        .game-bar-fill { height: 100%; border-radius: 3px; background: var(--cyan); transition: width .6s; }
        .game-viewers { font-family: var(--mono); font-size: 10px; color: var(--muted); width: 50px; text-align: right; }

        /* ── Tooltip ── */
        .tooltip-box {
          background: #0d1520; border: 1px solid var(--border); border-radius: 6px;
          padding: 10px 14px; font-size: 11px; line-height: 1.8;
        }
        .tooltip-label { font-family: var(--mono); color: var(--muted); font-size: 10px; margin-bottom: 4px; }

        /* ── Loading / Error ── */
        .loading-screen, .error-screen {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100vh; gap: 16px;
        }
        .spinner {
          width: 32px; height: 32px; border: 2px solid var(--border);
          border-top-color: var(--cyan); border-radius: 50%;
          animation: spin .8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text { font-family: var(--mono); font-size: 12px; color: var(--muted); }
        .error-icon  { font-size: 32px; }
        .error-title { font-family: var(--mono); font-size: 14px; color: var(--pink); }
        .error-sub   { font-size: 11px; color: var(--muted); }
        .retry-btn {
          margin-top: 8px; padding: 8px 20px; border: 1px solid var(--cyan);
          background: transparent; color: var(--cyan); font-family: var(--mono);
          font-size: 11px; border-radius: 4px; cursor: pointer;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 900px)  { .market-grid { grid-template-columns: 1fr 1fr; } .chart-grid-2 { grid-template-columns: 1fr; } }
        @media (max-width: 600px)  { .kpi-grid { grid-template-columns: 1fr 1fr; } .market-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <div className="pulse-dot" />
          <div>
            <div className="header-title">CRISIS PULSE</div>
            <div className="header-sub">— Media &amp; Search Intelligence · MENA</div>
          </div>
        </div>
        <div className="header-meta">
          <div className="source-chips">
            {["wikipedia","google_rss","newsapi","guardian","twitch"].map(s => (
              <span key={s} className={`chip ${sources.includes(s) ? "live" : "dead"}`}>
                {s.replace("_"," ")}
              </span>
            ))}
          </div>
          <div className="ts">
            {timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo/60)}h ago`}
          </div>
        </div>
      </header>

      <main className="main">

        {/* ── KPI Row ── */}
        <div>
          <div className="section-title">signal snapshot · latest values</div>
          <div className="kpi-grid">
            {Object.entries(SIGNAL_META).map(([key, meta]) => {
              const vals = markets[activeMarket]?.[key] || [];
              return (
                <div key={key} className="kpi-card" style={{ borderLeftColor: meta.color }}>
                  <div className="kpi-icon" style={{ color: meta.color }}>{meta.icon}</div>
                  <div className="kpi-val">
                    {vals.length ? vals[vals.length - 1] : "—"}
                    <WoWBadge values={vals} />
                  </div>
                  <div className="kpi-label">{meta.label} · {activeMarket}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Market Trending Topics ── */}
        <div>
          <div className="section-title">trending topics · google rss · today</div>
          <div className="market-grid">
            {Object.keys(MARKET_FLAGS).map(market => {
              const r = rss[market] || {};
              const sport  = r.sport_entertainment_pct || 0;
              const crisis = r.crisis_pct || 0;
              const other  = Math.max(0, 100 - sport - crisis);
              return (
                <div key={market} className="market-card">
                  <div className="market-card-header">
                    <span className="market-flag">{MARKET_FLAGS[market]}</span>
                    <span className="market-name">{market}</span>
                  </div>
                  <div className="mood-bar">
                    <div className="mood-seg" style={{ width: `${sport}%`,  background: "#00f5d4" }} />
                    <div className="mood-seg" style={{ width: `${crisis}%`, background: "#f72585" }} />
                    <div className="mood-seg" style={{ width: `${other}%`,  background: "#1e2a35" }} />
                  </div>
                  <div className="mood-labels">
                    <span style={{ color: "#00f5d4" }}>◈ Sport/Entertain {sport}%</span>
                    <span style={{ color: "#f72585" }}>◈ Crisis {crisis}%</span>
                  </div>
                  <div className="topic-list">
                    {(r.top_topics || []).slice(0, 5).map((t: string, i: number) => (
                      <div key={i} className="topic-item">
                        <span className="topic-num">{i + 1}.</span>{t}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Signal Trends + Wikipedia ── */}
        <div>
          <div className="section-title">behavioral trends · wikipedia pageviews (normalised 0–100)</div>
          <div className="market-tabs">
            {Object.keys(MARKET_FLAGS).map(m => (
              <button key={m} className={`market-tab ${activeMarket === m ? "active" : ""}`}
                onClick={() => setActiveMarket(m)}>
                {MARKET_FLAGS[m]} {m}
              </button>
            ))}
          </div>
          <div className="chart-grid-2">
            {/* All signals for active market */}
            <div className="card">
              <div className="chart-title">
                All Signals · {activeMarket}
                <span className="chart-subtitle">Wikipedia interest index</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={signalChartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#4a5e6d" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#4a5e6d" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  {Object.entries(SIGNAL_META).map(([key, meta]) => (
                    <Line key={key} type="monotone" dataKey={key} name={meta.label}
                      stroke={meta.color} strokeWidth={2} dot={false}
                      connectNulls activeDot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Single signal deep-dive */}
            <div className="card">
              <div className="signal-tabs">
                {Object.entries(SIGNAL_META).map(([key, meta]) => (
                  <button key={key} className={`signal-tab ${activeSignal === key ? "active" : ""}`}
                    style={activeSignal === key ? { borderColor: meta.color, color: meta.color } : {}}
                    onClick={() => setActiveSignal(key)}>
                    {meta.icon} {meta.label}
                  </button>
                ))}
              </div>
              <div className="chart-title">
                {SIGNAL_META[activeSignal].label} · Wikipedia Global
                <span className="chart-subtitle">7-day trend</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={wikiChartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#4a5e6d" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#4a5e6d" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="value" name={SIGNAL_META[activeSignal].label}
                    stroke={SIGNAL_META[activeSignal].color} strokeWidth={2.5}
                    dot={{ r: 3, fill: SIGNAL_META[activeSignal].color }}
                    connectNulls activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── News Volume ── */}
        <div>
          <div className="section-title">news volume · last 7 days · newsapi + guardian</div>
          <div className="card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={newsChartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#4a5e6d" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#4a5e6d" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="newsapi" name="NewsAPI" radius={[3,3,0,0]}>
                  {newsChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Bar>
                <Bar dataKey="guardian" name="Guardian" radius={[3,3,0,0]}>
                  {newsChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.4} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 20, marginTop: 12, justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: "#4a5e6d" }}>
                <span style={{ display: "inline-block", width: 10, height: 10, background: "#fff", opacity: .8, borderRadius: 2, marginRight: 5 }} />
                Solid = NewsAPI · Faded = Guardian
              </span>
            </div>
          </div>
        </div>

        {/* ── Twitch Gaming ── */}
        <div>
          <div className="section-title">live gaming · twitch · right now</div>
          <div className="card">
            <div className="twitch-grid">
              <div className="twitch-stat">
                <div className="twitch-viewers">{fmt(twitch.total_viewers || 0)}</div>
                <div className="twitch-label">LIVE VIEWERS</div>
              </div>
              <div className="game-bars">
                {(twitch.top_games || []).map((g: any, i: number) => {
                  const max = twitch.top_games?.[0]?.viewers || 1;
                  return (
                    <div key={i} className="game-row">
                      <div className="game-name">{g.name}</div>
                      <div className="game-bar-wrap">
                        <div className="game-bar-fill"
                          style={{ width: `${(g.viewers / max) * 100}%`,
                            background: i === 0 ? "var(--cyan)" : i === 1 ? "var(--purple)" : "var(--muted)" }} />
                      </div>
                      <div className="game-viewers">{fmt(g.viewers)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", padding: "12px 0 24px", fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "1px" }}>
          CRISIS PULSE · GROUPM MENA · DATA REFRESHED DAILY 09:00 GST
        </div>

      </main>
    </>
  );
}