import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, RadarChart,
  Radar, PolarGrid, PolarAngleAxis
} from "recharts";

const DATA_URL    = "/pulse_data.json";
const CONFIG_URL  = "/signals_config.json";
const HISTORY_URL = "/pulse_history.json";
const GH_OWNER    = "raghavhvr";
const GH_REPO     = "crisis-pulse";
const GH_PATH     = "public/signals_config.json";

const MARKET_FLAGS: Record<string,string> = {
  UAE:"🇦🇪", KSA:"🇸🇦", Kuwait:"🇰🇼", Qatar:"🇶🇦"
};

function fmt(n:number){ return n>=1000?`${(n/1000).toFixed(1)}K`:String(n); }

const CustomTooltip = ({active,payload,label}:any) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"#080e14",border:"1px solid #1e2d3d",borderRadius:6,padding:"10px 14px",fontSize:11,lineHeight:1.9}}>
      <div style={{fontFamily:"'DM Mono',monospace",color:"#4a6070",fontSize:10,marginBottom:4}}>{label}</div>
      {payload.map((p:any)=>(
        <div key={p.name} style={{color:p.color}}>
          <span style={{color:"#4a6070"}}>{p.name}: </span><strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── Ramadan banner ────────────────────────────────────────────────────────────
function RamadanBanner({endDate}:{endDate:string}){
  const days = Math.max(0,Math.ceil((new Date(endDate).getTime()-Date.now())/(86400000)));
  return (
    <div className="ramadan-banner">
      <span className="ramadan-moon">☽</span>
      <span className="ramadan-text">Ramadan Mode Active</span>
      <span className="ramadan-sub">Signals adjusted for Ramadan consumption patterns · {days} days remaining</span>
    </div>
  );
}

// ── Category score card ───────────────────────────────────────────────────────
function CategoryCard({
  cat, catKey, signals, markets, activeMarket, isActive, onClick,
  newsapi, guardian, rss
}:{
  cat:any, catKey:string, signals:Record<string,any>,
  markets:any, activeMarket:string, isActive:boolean, onClick:()=>void,
  newsapi:any, guardian:any, rss:any
}){
  const catSignals = Object.keys(signals).filter(k=>signals[k].category===catKey);

  // News volume: per-market from NewsAPI geo-filtered queries
  const newsVolumes = catSignals.map(k=>(newsapi[k]||0)+(guardian[k]||0));
  const newsTotal   = newsVolumes.reduce((a,b)=>a+b,0);
  const newsMax     = Math.max(...newsVolumes,1);

  // Normalise news total to 0-99 score (log scale so large values don't dominate)
  const newsScore = newsTotal > 0
    ? Math.min(99, Math.round(Math.log(newsTotal+1)/Math.log(5000)*99))
    : 0;

  // Wikipedia: global index as secondary context
  const wikiValues = catSignals.map(k=>{
    const v = markets[activeMarket]?.[k];
    return Array.isArray(v) ? v[v.length-1] : null;
  }).filter(v=>v!==null) as number[];
  const wikiAvg = wikiValues.length
    ? Math.round(wikiValues.reduce((a,b)=>a+b,0)/wikiValues.length)
    : null;

  // RSS market signal
  const rssMarket = rss[activeMarket]||{};
  let rssSignal = 0;
  if(catKey==="crisis_awareness") rssSignal = rssMarket.crisis_pct||0;
  else if(catKey==="escapism")    rssSignal = rssMarket.sport_entertainment_pct||0;
  else rssSignal = Math.round(((rssMarket.sport_entertainment_pct||0)+(rssMarket.crisis_pct||0))/2);

  // Primary display score = news volume (market-specific) + rss modifier
  const hasNewsData = newsTotal > 0;
  const displayScore = hasNewsData
    ? Math.min(99, Math.round(newsScore * 0.7 + rssSignal * 0.3))
    : (wikiAvg ?? 0);

  // Sparkline: per-signal news volumes (market-specific bars)
  const hasRealData = hasNewsData || (wikiValues.length > 0);
  const sparkData = hasNewsData
    ? catSignals.map(k=>{
        const v = (newsapi[k]||0)+(guardian[k]||0);
        return Math.round((v/newsMax)*90)+5;
      })
    : Array.from({length:8},(_,i)=>20+i*2); // placeholder
  const sparkMax = Math.max(...sparkData,1);
  const trend = sparkData.length>=2 ? sparkData[sparkData.length-1]-sparkData[0] : 0;

  return (
    <div className={`cat-card ${isActive?"active":""}`}
      style={{"--cat-color":cat.color} as any}
      onClick={onClick}>
      <div className="cat-card-header">
        <span className="cat-icon">{cat.icon}</span>
        <div className="cat-meta">
          <div className="cat-label">{cat.label}</div>
          <div className="cat-sig-count">{catSignals.length} signals
            {!hasRealData && <span style={{color:"var(--muted)",marginLeft:6,fontSize:8}}>· pending run</span>}
          </div>
        </div>
        <div className="cat-score-wrap">
          <div className="cat-score" style={{opacity:hasRealData?1:0.4}}>{displayScore}</div>
          <div className={`cat-trend ${trend>0?"up":trend<0?"down":"flat"}`}>
            {trend>0?"▲":trend<0?"▼":"→"} {Math.abs(Math.round(trend))}
          </div>
        </div>
      </div>
      {/* RSS market bar — this DOES differ per market */}
      {rssSignal > 0 && (
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontFamily:"var(--sans)",fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.5)"}}>
              {catKey==="crisis_awareness"?"CRISIS SIGNAL":catKey==="escapism"?"SPORT/ENT SIGNAL":"RSS SIGNAL"} · {activeMarket}
            </span>
            <span style={{fontFamily:"var(--sans)",fontSize:10,fontWeight:700,color:cat.color}}>{rssSignal}%</span>
          </div>
          <div style={{height:3,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${rssSignal}%`,background:cat.color,
              borderRadius:2,transition:"width .4s"}}/>
          </div>
        </div>
      )}
      <div className="cat-sparkline">
        {sparkData.map((v,i)=>(
          <div key={i} className="spark-bar"
            style={{height:`${Math.round((v/sparkMax)*28)+2}px`,background:cat.color,
              opacity:hasRealData?(i===sparkData.length-1?1:0.35+i*0.08):0.2}} />
        ))}
      </div>
      <div className="cat-hypothesis">{cat.hypothesis}</div>
    </div>
  );
}

// ── Signal row (expandable detail) ────────────────────────────────────────────
function SignalRow({sigKey,sig,markets,activeMarket,dates,newsapi,guardian,newsapiAllMarkets}:{
  sigKey:string,sig:any,markets:any,activeMarket:string,
  dates:string[],newsapi:any,guardian:any,newsapiAllMarkets:any
}){
  // Wiki data (global — same across markets, used as baseline trend shape)
  const wikiVals = markets[activeMarket]?.[sigKey]||[];

  // Per-market news volume — this IS market-specific
  const newsVol   = (newsapi[sigKey]||0) + (guardian[sigKey]||0);
  const guardianV = guardian[sigKey]||0;

  // Use news volume as the primary market-specific index (normalised to 0-100)
  // Compute max across all markets for this signal to normalise
  const allMarkets = ["UAE","KSA","Kuwait","Qatar"];
  const allVols = allMarkets.map(m=>{
    const na = newsapiAllMarkets?.[m]?.[sigKey]||0;
    return na + guardianV; // guardian is global so same, but na differs
  });
  const maxVol = Math.max(...allVols, 1);
  const normVol = Math.round((newsVol / maxVol) * 100);

  // Trend: compare to other markets (are we above/below average?)
  const avgVol = allVols.reduce((a,b)=>a+b,0)/allVols.length;
  const pct = avgVol > 0 ? Math.round(((newsVol - avgVol)/avgVol)*100) : 0;

  // Sparkline: use wiki shape if available (shows 7-day trend), else flat
  const hasWiki = wikiVals.length > 0;
  const chartData = hasWiki
    ? dates.map((d:string,i:number)=>({date:d,value:wikiVals[i]??null}))
    : dates.map((d:string)=>({date:d,value:normVol}));

  return (
    <div className="signal-row">
      <div className="signal-row-left">
        <div className="signal-dot" style={{background:sig.color||"#4a6070"}} />
        <div className="signal-name">{sig.label}</div>
      </div>
      <div className="signal-sparkline-wrap">
        <ResponsiveContainer width={120} height={28}>
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="value" stroke={sig.color||"#4a6070"}
              strokeWidth={1.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="signal-row-right">
        <div className="signal-val">{normVol}</div>
        <div className={`signal-pct ${pct>0?"up":pct<0?"down":"flat"}`}
          title={`vs market avg ${Math.round(avgVol)} articles`}>
          {pct>0?"▲":pct<0?"▼":"→"}{Math.abs(pct)}%
        </div>
        <div className="signal-news">{fmt(newsVol)} art.</div>
      </div>
    </div>
  );
}

// ── Settings panel ────────────────────────────────────────────────────────────
function SettingsPanel({config,onClose,onSave}:{config:any,onClose:()=>void,onSave:(c:any)=>Promise<void>}){
  const [draft,setDraft]     = useState(()=>JSON.parse(JSON.stringify(config)));
  const [pat,setPat]         = useState(()=>localStorage.getItem("gh_pat")||"");
  const [saving,setSaving]   = useState(false);
  const [msg,setMsg]         = useState("");

  function toggle(catKey:string,sigKey:string,field:string,val:string){
    setDraft((d:any)=>({...d,categories:{...d.categories,[catKey]:{...d.categories[catKey],
      signals:{...d.categories[catKey].signals,[sigKey]:{...d.categories[catKey].signals[sigKey],[field]:val}}}}}));
  }

  async function handleSave(){
    if(!pat){setMsg("⚠ Enter GitHub PAT");return;}
    localStorage.setItem("gh_pat",pat);
    setSaving(true); setMsg("");
    try {
      await onSave({...draft,last_updated:new Date().toISOString(),updated_by:"dashboard"});
      setMsg("✓ Saved — takes effect on next collector run");
    } catch(e:any){ setMsg(`✗ ${e.message}`); }
    setSaving(false);
  }

  return (
    <div className="overlay" onClick={e=>{if((e.target as any).classList.contains("overlay"))onClose();}}>
      <div className="settings-panel">
        <div className="sp-header">
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:2}}>⚙ SIGNAL CONFIGURATION</span>
          <button className="sp-close" onClick={onClose}>✕</button>
        </div>
        <div className="sp-body">
          <div className="sp-pat-row">
            <label className="sp-label">GitHub PAT (repo:write)</label>
            <input type="password" className="sp-input" value={pat}
              placeholder="ghp_xxxxxxxxxxxx"
              onChange={e=>setPat(e.target.value)} />
          </div>

          <div className="sp-divider"/>
          {Object.entries(draft.categories).map(([catKey,cat]:any)=>(
            <div key={catKey} className="sp-cat">
              <div className="sp-cat-header" style={{borderLeftColor:cat.color}}>
                {cat.icon} {cat.label}
                {cat.ramadan_only&&<span className="sp-ramadan-badge">☽ Ramadan only</span>}
              </div>
              {Object.entries(cat.signals).map(([sigKey,sig]:any)=>(
                <div key={sigKey} className="sp-sig-row">
                  <div className="sp-sig-name">{sig.label}</div>
                  <div className="sp-fields">
                    <div className="sp-field-group">
                      <label className="sp-field-label">Wikipedia</label>
                      <input className="sp-input sm" value={sig.wiki}
                        onChange={e=>toggle(catKey,sigKey,"wiki",e.target.value)} />
                    </div>
                    <div className="sp-field-group">
                      <label className="sp-field-label">NewsAPI</label>
                      <input className="sp-input sm" value={sig.news}
                        onChange={e=>toggle(catKey,sigKey,"news",e.target.value)} />
                    </div>
                    <div className="sp-field-group">
                      <label className="sp-field-label">Guardian</label>
                      <input className="sp-input sm" value={sig.guardian}
                        onChange={e=>toggle(catKey,sigKey,"guardian",e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sp-footer">
          {msg&&<div className={`sp-msg ${msg.startsWith("✓")?"ok":"err"}`}>{msg}</div>}
          <button className="sp-cancel" onClick={onClose}>Cancel</button>
          <button className="sp-save" onClick={handleSave} disabled={saving}>
            {saving?"Saving…":"Save to GitHub"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
