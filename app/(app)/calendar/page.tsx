"use client";
import { useEffect, useState } from "react";
import { Bell, X, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";

const CAL_API = "https://quantsignal-api.onrender.com/api/v1";

function calFormatDate(e: any) {
  return [e.date_display, e.time_display].filter(Boolean).join(" · ");
}
const impactColor = (i: string) => i === "High" ? "#ff4466" : i === "Medium" ? "#f59e0b" : "rgba(255,255,255,0.2)";
const impactDot   = (i: string) => i === "High" ? "🔴" : i === "Medium" ? "🟡" : "⚪";

const SPOTLIGHT_KEYWORDS = ["NFP","Non-Farm","FOMC","GDP","CPI","PCE","Fed","Interest Rate","Unemployment","Retail Sales","PMI"];

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [calError, setCalError]     = useState("");
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [filter, setFilter]         = useState<"ALL"|"High"|"Medium">("ALL");
  const [infoEvent, setInfoEvent]   = useState<any | null>(null);
  const [infoText, setInfoText]     = useState("");
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoProgress, setInfoProgress] = useState(0);
  const [reminderEvent, setReminderEvent] = useState<any | null>(null);
  const [email, setEmail]           = useState("");
  const [reminderStatus, setReminderStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [now, setNow]               = useState(() => new Date());

  const loadEvents = () => {
    fetch(`${CAL_API}/calendar/events`)
      .then(r => r.json())
      .then(d => { setEvents([...(d.upcoming||[]), ...(d.past||[])]); setLoading(false); })
      .catch(() => { setCalError("Failed to load"); setLoading(false); });
  };

  const isMarketHours = () => {
    const n = new Date();
    const h = n.getUTCHours() * 60 + n.getUTCMinutes();
    return n.getUTCDay() >= 1 && n.getUTCDay() <= 5 && h >= 780 && h <= 1260;
  };

  useEffect(() => {
    loadEvents();
    const iv = setInterval(loadEvents, 30 * 60 * 1000);
    const actualsIv = setInterval(() => { if (isMarketHours()) loadEvents(); }, 5 * 60 * 1000);
    return () => { clearInterval(iv); clearInterval(actualsIv); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const getCountdown = (event: any): string => {
    try {
      const timeStr = event.time_display || "";
      const match = timeStr.match(/(\d+):(\d+)(am|pm)/i);
      if (!match) return "";
      let h = parseInt(match[1]); const m = parseInt(match[2]); const ampm = match[3].toLowerCase();
      if (ampm === "pm" && h !== 12) h += 12;
      if (ampm === "am" && h === 12) h = 0;
      const eventDate = new Date(now);
      eventDate.setHours(h, m, 0, 0);
      const diff = eventDate.getTime() - now.getTime();
      if (diff < 0) return "PAST";
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (hrs > 48) return "";
      if (hrs > 0) return `in ${hrs}h ${mins}m`;
      if (mins > 0) return `in ${mins}m`;
      return "NOW";
    } catch { return ""; }
  };

  // ── Date classification ──────────────────────────────────────────
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const twoDaysAgo    = new Date(todayMidnight.getTime() - 2 * 24 * 60 * 60 * 1000);

  const isPastDate = (dateLabel: string) => {
    // dateLabel is like "Wed Apr 29" — parse day/month/year
    try {
      const parsed = new Date(dateLabel + " " + now.getFullYear());
      return parsed < todayMidnight;
    } catch { return false; }
  };

  const isWithin2Days = (dateLabel: string) => {
    try {
      const parsed = new Date(dateLabel + " " + now.getFullYear());
      return parsed >= twoDaysAgo && parsed < todayMidnight;
    } catch { return false; }
  };

  const filtered = events.filter(e => filter === "ALL" || e.impact === filter);

  // Spotlight: upcoming high-impact events only (not past)
  const spotlightEvents = events
    .filter(e => e.impact === "High"
      && SPOTLIGHT_KEYWORDS.some(k => e.title?.includes(k))
      && !isPastDate(e.date_display || ""))
    .slice(0, 3);

  // Group by date
  const groups: Record<string, any[]> = {};
  filtered.forEach(e => {
    const k = e.date_display || "Other";
    if (!groups[k]) groups[k] = [];
    groups[k].push(e);
  });

  // Split groups: upcoming (today+future) vs past (last 2 days only)
  const upcomingGroups: [string, any[]][] = [];
  const pastGroups:     [string, any[]][] = [];

  Object.entries(groups).forEach(([dateLabel, dayEvents]) => {
    if (isPastDate(dateLabel)) {
      if (isWithin2Days(dateLabel)) pastGroups.push([dateLabel, dayEvents]);
      // silently drop anything older than 2 days
    } else {
      upcomingGroups.push([dateLabel, dayEvents]);
    }
  });

  // Sort upcoming chronologically (earliest first), past reverse-chron (most recent first)
  const sortGroups = (a: [string, any[]], b: [string, any[]]) => {
    const da = new Date(a[0] + " " + now.getFullYear());
    const db = new Date(b[0] + " " + now.getFullYear());
    return da.getTime() - db.getTime();
  };
  upcomingGroups.sort(sortGroups);
  pastGroups.sort((a, b) => sortGroups(b, a)); // reverse for past

  const todayDay = now.getDate().toString();

  const openInfo = async (ev: React.MouseEvent, event: any) => {
    ev.stopPropagation();
    setInfoEvent(event);
    setInfoText("");
    setInfoLoading(true);
    setInfoProgress(0);
    const progIv = setInterval(() => setInfoProgress(p => p < 85 ? p + Math.random() * 7 : p), 350);
    const assets = (event.affected_assets||[]).join(", ") || "major markets";
    const prompt = [
      "You are a professional trading analyst. Analyze this economic event for trading implications.",
      "Event: " + event.title,
      "Forecast: " + (event.forecast ?? "N/A"),
      "Previous: " + (event.previous ?? "N/A"),
      "Actual: " + (event.actual ?? "Not released yet"),
      "Affected assets: " + assets,
      "",
      "Respond in this EXACT format:",
      "VERDICT: [one sentence - bullish/bearish/neutral impact and why]",
      "BEAT: [if actual beats forecast - specific reaction + trade for " + assets + "]",
      "MISS: [if actual misses forecast - specific reaction + trade]",
      "INLINE: [if in-line - expected muted move]",
      "TIMEFRAME: [how long will this impact last]",
      "CONFIDENCE: [LOW / MEDIUM / HIGH]",
      "RISK: [one sentence - key risk to this playbook]",
    ].join("\n");
    try {
      const res = await fetch(`${CAL_API}/chat`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({symbol:"GENERIC", message:prompt, history:[]}) });
      if (!res.body) throw new Error();
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const {value, done} = await reader.read(); if (done) break;
        buf += dec.decode(value, {stream:true});
        const lines = buf.split("\n"); buf = lines.pop()||"";
        for (const l of lines) { if (l.trim().startsWith("data: ")) { try { const d=JSON.parse(l.trim().slice(6)); if(d.type==="token") setInfoText(t=>t+d.content); else if(d.type==="error") setInfoText("⚠️ "+d.message); } catch{} } }
      }
    } catch { setInfoText("Could not load. Try again."); }
    clearInterval(progIv);
    setInfoProgress(100);
    setTimeout(() => setInfoProgress(0), 600);
    setInfoLoading(false);
  };

  const submitReminder = async () => {
    if (!email.includes("@")) return;
    setReminderStatus("loading");
    try {
      const r = await fetch(`${CAL_API}/calendar/remind`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, event_id: reminderEvent.title+reminderEvent.date, event_name: reminderEvent.title, event_time: reminderEvent.date||new Date().toISOString(), impact: reminderEvent.impact }) });
      if (r.ok) { setReminderStatus("success"); setSubscribed(s=>new Set([...s,reminderEvent.title])); setTimeout(()=>{setReminderEvent(null);setReminderStatus("idle");},1800); }
      else setReminderStatus("error");
    } catch { setReminderStatus("error"); }
  };

  const ActualBadge = ({ event }: { event: any }) => {
    if (!event.actual) return null;
    const actual = parseFloat(event.actual);
    const forecast = parseFloat(event.forecast);
    const beat = !isNaN(actual) && !isNaN(forecast) ? actual > forecast : null;
    return (
      <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:4,
        background: beat === true ? "rgba(0,255,136,0.12)" : beat === false ? "rgba(255,68,102,0.12)" : "rgba(255,255,255,0.08)",
        color: beat === true ? "#00ff88" : beat === false ? "#ff4466" : "#fff",
        border: `1px solid ${beat === true ? "rgba(0,255,136,0.25)" : beat === false ? "rgba(255,68,102,0.25)" : "rgba(255,255,255,0.1)"}`,
      }}>
        A: {event.actual} {beat === true ? "▲" : beat === false ? "▼" : ""}
      </span>
    );
  };

  const SpotlightCard = ({ event }: { event: any }) => {
    const cd = getCountdown(event);
    const hasActual = !!event.actual;
    const actual = parseFloat(event.actual);
    const forecast = parseFloat(event.forecast);
    const beat = hasActual && !isNaN(actual) && !isNaN(forecast) ? actual > forecast : null;
    const relatedSignals = event.affected_assets || [];
    return (
      <div style={{ flex:"1 1 240px", minWidth:0, background:"rgba(255,68,102,0.04)", border:"1px solid rgba(255,68,102,0.2)", borderRadius:12, padding:"16px 18px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#ff4466,transparent)" }}/>
        <div style={{ fontSize:9, color:"#ff4466", fontWeight:700, letterSpacing:"0.12em", marginBottom:6 }}>🔴 HIGH IMPACT</div>
        <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:4, lineHeight:1.3 }}>{event.title}</div>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", marginBottom:12 }}>
          {event.flag} {event.country} · {calFormatDate(event)}
          {cd && cd !== "PAST" && <span style={{ color:"#f59e0b", fontWeight:700, marginLeft:6 }}>{cd}</span>}
        </div>
        <div style={{ display:"flex", gap:16, marginBottom:12 }}>
          {event.forecast && <div><div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", marginBottom:2 }}>FORECAST</div><div style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.7)" }}>{event.forecast}</div></div>}
          {event.previous && <div><div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", marginBottom:2 }}>PREVIOUS</div><div style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.5)" }}>{event.previous}</div></div>}
          {event.actual && <div><div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", marginBottom:2 }}>ACTUAL</div><div style={{ fontSize:13, fontWeight:700, color: beat===true?"#00ff88":beat===false?"#ff4466":"#fff" }}>{event.actual} {beat===true?"▲ BEAT":beat===false?"▼ MISS":""}</div></div>}
        </div>
        {relatedSignals.length > 0 && (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
            {relatedSignals.slice(0,4).map((s: string) => (
              <button key={s} onClick={() => router.push(`/research?symbol=${s}`)} style={{ fontSize:9, padding:"2px 8px", background:"rgba(0,170,255,0.08)", border:"1px solid rgba(0,170,255,0.15)", borderRadius:4, color:"#00aaff", cursor:"pointer", fontFamily:"var(--font-mono)" }}>{s} →</button>
            ))}
          </div>
        )}
        <button onClick={(e) => openInfo(e, event)} style={{ width:"100%", padding:"7px", background:"rgba(255,68,102,0.1)", border:"1px solid rgba(255,68,102,0.2)", borderRadius:7, fontSize:10, color:"#ff4466", fontWeight:700, cursor:"pointer", fontFamily:"var(--font-mono)" }}>AI PLAYBOOK ▸</button>
      </div>
    );
  };

  const DayGroup = ({ dateLabel, dayEvents, isPast }: { dateLabel: string; dayEvents: any[]; isPast: boolean }) => {
    const isToday = dateLabel.split(" ")[2] === todayDay;
    return (
      <div style={{ marginBottom:28, opacity: isPast ? 0.6 : 1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color: isToday?"#00ff88": isPast?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.3)" }}>
            {isToday && <span style={{ marginRight:6 }}>●</span>}{dateLabel.toUpperCase()}{isToday && " — TODAY"}
          </span>
          <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.05)" }}/>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.2)" }}>{dayEvents.length}</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {dayEvents.map((event, i) => {
            const key = dateLabel+i;
            const isOpen = expanded === key;
            const cd = getCountdown(event);
            const relatedSignals = event.affected_assets || [];
            return (
              <div key={key} style={{ borderRadius:8, border:`1px solid ${isOpen?impactColor(event.impact)+"55":"rgba(255,255,255,0.06)"}`, background:isOpen?"rgba(255,255,255,0.02)":"transparent", overflow:"hidden", transition:"border-color 0.15s" }}>
                <div onClick={()=>setExpanded(isOpen?null:key)} style={{ display:"flex", alignItems:"center", padding:"10px 14px", cursor:"pointer", gap:10, flexWrap:"wrap" }}>
                  <span style={{ fontSize:12 }}>{event.flag||"🌐"}</span>
                  <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontSize:12, fontWeight:isToday?600:500, color:isToday?"#fff":"#e2e8f0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{event.title}</div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:1, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                      <span>{event.time_display}{event.country?` · ${event.country}`:""}</span>
                      {cd && cd !== "PAST" && <span style={{ color:cd==="NOW"?"#00ff88":"#f59e0b", fontWeight:700 }}>{cd}</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, flexWrap:"wrap" }}>
                    <ActualBadge event={event} />
                    <span style={{ fontSize:9, color:impactColor(event.impact) }}>{impactDot(event.impact)} {event.impact}</span>
                    {!event.actual && event.forecast && <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>F {event.forecast}</span>}
                    {event.previous && <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)" }}>P {event.previous}</span>}
                    <button onClick={e=>openInfo(e,event)} style={{ padding:"3px 8px", background:"rgba(0,170,255,0.08)", border:"1px solid rgba(0,170,255,0.15)", borderRadius:5, cursor:"pointer", fontSize:9, color:"#00aaff", fontFamily:"var(--font-mono)", whiteSpace:"nowrap" }}>AI ▸</button>
                    <button onClick={e=>{e.stopPropagation();setReminderEvent(event);setReminderStatus("idle");}} style={{ padding:"3px 6px", background:"transparent", border:"1px solid rgba(255,255,255,0.08)", borderRadius:5, cursor:"pointer" }}>
                      <Bell size={9} color={subscribed.has(event.title)?"#00ff88":"rgba(255,255,255,0.3)"} />
                    </button>
                    {isOpen?<ChevronUp size={11} color="rgba(255,255,255,0.3)"/>:<ChevronDown size={11} color="rgba(255,255,255,0.2)"/>}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding:"0 14px 14px", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
                      <div style={{ padding:"10px 12px", background:"rgba(0,255,136,0.04)", border:"1px solid rgba(0,255,136,0.1)", borderRadius:6 }}>
                        <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:4 }}>🟢 BEAT</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", lineHeight:1.6 }}>{event.bullish_scenario||"Better than expected → positive reaction"}</div>
                      </div>
                      <div style={{ padding:"10px 12px", background:"rgba(255,68,102,0.04)", border:"1px solid rgba(255,68,102,0.1)", borderRadius:6 }}>
                        <div style={{ fontSize:9, color:"#ff4466", fontWeight:700, marginBottom:4 }}>🔴 MISS</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", lineHeight:1.6 }}>{event.bearish_scenario||"Worse than expected → negative reaction"}</div>
                      </div>
                    </div>
                    {relatedSignals.length > 0 && (
                      <div style={{ marginTop:10 }}>
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginBottom:6 }}>AFFECTED SIGNALS</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {relatedSignals.map((s: string) => (
                            <button key={s} onClick={() => router.push(`/research?symbol=${s}`)} style={{ fontSize:10, padding:"4px 10px", background:"rgba(0,170,255,0.07)", border:"1px solid rgba(0,170,255,0.15)", borderRadius:5, color:"#00aaff", cursor:"pointer", fontFamily:"var(--font-mono)", fontWeight:600 }}>{s} → Research</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)", fontFamily:"var(--font-mono)", color:"#e2e8f0", display:"flex", overflow:"hidden" }}>
      <div style={{ flex:1, overflowY:"auto", minWidth:0, transition:"all 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
      <div style={{ padding:"20px 24px 16px", paddingRight: infoEvent ? "440px" : "24px", display:"flex", alignItems:"flex-end", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,0.05)", flexWrap:"wrap", gap:10, transition:"padding-right 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
        <div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:"0.12em", marginBottom:4 }}>QUANTSIGNAL · LIVE</div>
          <div style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em" }}>Economic Calendar</div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {(["ALL","High","Medium"] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:"5px 14px", borderRadius:20, fontSize:10, fontWeight:600, cursor:"pointer", background:filter===f?(f==="High"?"#ff4466":f==="Medium"?"#f59e0b":"rgba(255,255,255,0.12)"):"transparent", border:`1px solid ${filter===f?"transparent":"rgba(255,255,255,0.1)"}`, color:filter===f?(f==="Medium"?"#000":"#fff"):"rgba(255,255,255,0.4)", transition:"all 0.15s" }}>{f==="High"?"🔴 High":f==="Medium"?"🟡 Med":"All"}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"20px 24px", paddingRight: infoEvent ? "440px" : "24px", transition:"padding-right 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
        {!loading && spotlightEvents.length > 0 && (
          <div style={{ marginBottom:32 }}>
            <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.25)", letterSpacing:"0.12em", marginBottom:12 }}>⚡ SPOTLIGHT — HIGH IMPACT THIS WEEK</div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {spotlightEvents.map((e, i) => <SpotlightCard key={i} event={e} />)}
            </div>
          </div>
        )}

        {loading && <div style={{ color:"rgba(255,255,255,0.25)", fontSize:11, padding:"60px 0", textAlign:"center" }}>Loading...</div>}
        {calError && <div style={{ color:"#ff4466", fontSize:11, padding:"60px 0", textAlign:"center" }}>{calError}</div>}
        {!loading && !calError && upcomingGroups.length === 0 && pastGroups.length === 0 && (
          <div style={{ color:"rgba(255,255,255,0.25)", fontSize:11, padding:"60px 0", textAlign:"center" }}>No events found.</div>
        )}

        {/* Upcoming events */}
        {upcomingGroups.map(([dateLabel, dayEvents]) => (
          <DayGroup key={dateLabel} dateLabel={dateLabel} dayEvents={dayEvents} isPast={false} />
        ))}

        {/* Past events divider */}
        {pastGroups.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:16, margin:"32px 0 24px" }}>
            <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.06)" }}/>
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", color:"rgba(255,255,255,0.18)" }}>— PAST 2 DAYS —</span>
            <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.06)" }}/>
          </div>
        )}

        {/* Past events (last 2 days, dimmed) */}
        {pastGroups.map(([dateLabel, dayEvents]) => (
          <DayGroup key={dateLabel} dateLabel={dateLabel} dayEvents={dayEvents} isPast={true} />
        ))}
      </div>

      </div>{/* end main scroll area */}

      {/* AI Playbook — right side panel */}
      <style>{`
        @keyframes calSlideIn  { from { opacity:0; transform:translateX(24px) } to { opacity:1; transform:translateX(0) } }
        @keyframes calShimmer  { 0%,100%{opacity:0.3} 50%{opacity:0.65} }
        @keyframes calBlink    { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
      {infoEvent && (
          <div style={{
            position:"fixed", top:0, right:0, bottom:0,
            width:"420px",
            background:"rgba(7,11,20,0.97)",
            backdropFilter:"blur(28px) saturate(180%)",
            borderLeft:"1px solid " + (infoEvent.impact==="High" ? "rgba(255,68,102,0.3)" : infoEvent.impact==="Medium" ? "rgba(245,158,11,0.25)" : "rgba(0,170,255,0.2)"),
            zIndex:99, overflowY:"auto",
            boxShadow:"-24px 0 80px rgba(0,0,0,0.6)",
            animation:"calSlideIn 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}>
            {/* Impact accent bar — left edge */}
            <div style={{ position:"absolute", top:0, left:0, bottom:0, width:3, background: infoEvent.impact==="High" ? "linear-gradient(180deg,#ff4466,#ff8c00)" : infoEvent.impact==="Medium" ? "linear-gradient(180deg,#f59e0b,#fbbf24)" : "linear-gradient(180deg,rgba(0,170,255,0.6),rgba(0,255,136,0.4))" }} />
            {/* Progress bar */}
            {infoProgress > 0 && (
              <div style={{ position:"absolute", top:3, left:0, right:0, height:2, background:"rgba(255,255,255,0.05)", borderRadius:2 }}>
                <div style={{ height:"100%", width:infoProgress+"%", background:"linear-gradient(90deg,#00aaff,#00ff88)", transition:"width 0.3s ease" }} />
              </div>
            )}
            <div style={{ padding:"22px 20px 26px 28px" }}>
              {/* Header */}
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", marginBottom:6, color: infoEvent.impact==="High"?"#ff4466":infoEvent.impact==="Medium"?"#f59e0b":"#00aaff" }}>
                    {infoEvent.impact==="High"?"🔴":infoEvent.impact==="Medium"?"🟡":"🔵"} AI PLAYBOOK &nbsp;·&nbsp; {(infoEvent.impact||"").toUpperCase()} IMPACT
                  </div>
                  <div style={{ fontSize:18, fontWeight:700, color:"#fff", lineHeight:1.3, marginBottom:5 }}>{infoEvent.title}</div>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.28)" }}>{infoEvent.flag} &nbsp;{calFormatDate(infoEvent)}</div>
                </div>
                <button onClick={()=>{setInfoEvent(null);setInfoText("");}} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:7, cursor:"pointer", padding:"5px 8px", marginLeft:14, flexShrink:0, lineHeight:1 }}>
                  <X size={12} color="rgba(255,255,255,0.45)"/>
                </button>
              </div>
              {/* Data chips */}
              <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
                {[
                  {label:"FORECAST", value:infoEvent.forecast, color:"rgba(255,255,255,0.75)"},
                  {label:"PREVIOUS", value:infoEvent.previous, color:"rgba(255,255,255,0.45)"},
                  {label:"ACTUAL",   value:infoEvent.actual,   color:"#00ff88"},
                ].filter(d=>d.value).map(d=>(
                  <div key={d.label} style={{ padding:"9px 14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:9, minWidth:72 }}>
                    <div style={{ fontSize:8, color:"rgba(255,255,255,0.22)", fontWeight:700, letterSpacing:"0.1em", marginBottom:5 }}>{d.label}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:d.color }}>{d.value}</div>
                  </div>
                ))}
                {(infoEvent.affected_assets||[]).slice(0,4).map((a:string)=>(
                  <div key={a} style={{ padding:"9px 12px", background:"rgba(0,170,255,0.05)", border:"1px solid rgba(0,170,255,0.13)", borderRadius:9 }}>
                    <div style={{ fontSize:8, color:"rgba(0,170,255,0.5)", marginBottom:5 }}>ASSET</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#00aaff" }}>{a}</div>
                  </div>
                ))}
              </div>
              {/* Skeleton loader */}
              {infoLoading && !infoText && (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[80,58,90,50,70,62].map((w,i)=>(
                    <div key={i} style={{ height:9, borderRadius:4, background:"rgba(255,255,255,0.05)", width:w+"%", animation:"calShimmer 1.5s ease-in-out infinite", animationDelay:(i*0.11)+"s" }}/>
                  ))}
                </div>
              )}
              {/* Streaming text with cursor */}
              {infoLoading && infoText && (
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", lineHeight:1.9, whiteSpace:"pre-wrap" }}>
                  {infoText}
                  <span style={{ display:"inline-block", width:8, height:13, background:"#00aaff", marginLeft:2, animation:"calBlink 1s step-end infinite", verticalAlign:"text-bottom", borderRadius:1 }}/>
                </div>
              )}
              {/* Parsed analysis cards */}
              {!infoLoading && infoText && (()=>{
                const get = (key:string) => {
                  const after = infoText.split(key+":")[1];
                  if (!after) return "";
                  const end = after.split("\n").findIndex((x,j) => j > 0 && x.length > 2 && x[0] >= "A" && x[0] <= "Z" && x.indexOf(":") > 0 && x.indexOf(":") < 12);
                  return (end === -1 ? after : after.split("\n").slice(0, end).join("\n")).trim();
                };
                const verdict    = get("VERDICT");
                const beat       = get("BEAT");
                const miss       = get("MISS");
                const inline     = get("INLINE");
                const timeframe  = get("TIMEFRAME");
                const confidence = get("CONFIDENCE");
                const risk       = get("RISK");
                const confColor  = confidence.includes("HIGH")?"#00ff88":confidence.includes("LOW")?"#ff4466":"#f59e0b";
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {verdict && (
                      <div style={{ padding:"12px 14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10 }}>
                        <div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", fontWeight:700, letterSpacing:"0.12em", marginBottom:6 }}>VERDICT</div>
                        <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.65 }}>{verdict}</div>
                      </div>
                    )}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      {confidence && (
                        <div style={{ padding:"10px 12px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10 }}>
                          <div style={{ fontSize:8, color:"rgba(255,255,255,0.22)", marginBottom:5 }}>CONFIDENCE</div>
                          <div style={{ fontSize:15, fontWeight:800, color:confColor }}>{confidence.split(" ")[0]}</div>
                        </div>
                      )}
                      {timeframe && (
                        <div style={{ padding:"10px 12px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10 }}>
                          <div style={{ fontSize:8, color:"rgba(255,255,255,0.22)", marginBottom:5 }}>TIMEFRAME</div>
                          <div style={{ fontSize:11, fontWeight:600, color:"#f59e0b", lineHeight:1.4 }}>{timeframe}</div>
                        </div>
                      )}
                    </div>
                    {beat && (
                      <div style={{ padding:"12px 14px", background:"rgba(0,255,136,0.03)", border:"1px solid rgba(0,255,136,0.13)", borderRadius:10 }}>
                        <div style={{ fontSize:8, color:"#00ff88", fontWeight:700, letterSpacing:"0.1em", marginBottom:6 }}>🟢 BEAT SCENARIO</div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.7 }}>{beat}</div>
                      </div>
                    )}
                    {miss && (
                      <div style={{ padding:"12px 14px", background:"rgba(255,68,102,0.03)", border:"1px solid rgba(255,68,102,0.13)", borderRadius:10 }}>
                        <div style={{ fontSize:8, color:"#ff4466", fontWeight:700, letterSpacing:"0.1em", marginBottom:6 }}>🔴 MISS SCENARIO</div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.7 }}>{miss}</div>
                      </div>
                    )}
                    {inline && (
                      <div style={{ padding:"12px 14px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10 }}>
                        <div style={{ fontSize:8, color:"rgba(255,255,255,0.28)", fontWeight:700, letterSpacing:"0.1em", marginBottom:6 }}>⚪ IN-LINE</div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>{inline}</div>
                      </div>
                    )}
                    {risk && (
                      <div style={{ padding:"11px 14px", background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.13)", borderRadius:10, display:"flex", gap:10, alignItems:"flex-start" }}>
                        <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>⚠️</span>
                        <div>
                          <div style={{ fontSize:8, color:"#f59e0b", fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>KEY RISK</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", lineHeight:1.65 }}>{risk}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize:8, color:"rgba(255,255,255,0.11)", lineHeight:1.5, paddingTop:2 }}>Not financial advice. Always manage risk.</div>
                  </div>
                );
              })()}
            </div>
          </div>
      )}

      {/* Reminder modal */}
      {reminderEvent && (
        <>
          <div onClick={()=>setReminderEvent(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:100 }}/>
          <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", background:"#0d1117", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"14px 14px 0 0", padding:"22px 24px 36px", zIndex:101, width:"min(520px, 100vw)" }}>
            <button onClick={()=>setReminderEvent(null)} style={{ position:"absolute", top:14, right:14, background:"none", border:"none", cursor:"pointer" }}><X size={14} color="rgba(255,255,255,0.35)"/></button>
            <div style={{ fontSize:10, fontWeight:700, color:"#00ff88", marginBottom:6 }}>🔔 SET REMINDER</div>
            <div style={{ fontSize:14, fontWeight:600, color:"#fff", marginBottom:2 }}>{reminderEvent.title}</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", marginBottom:16 }}>{calFormatDate(reminderEvent)}</div>
            {reminderStatus==="success" ? <div style={{ color:"#00ff88", fontSize:12 }}>✅ Reminder set!</div> : (
              <>
                <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#fff", outline:"none", boxSizing:"border-box", marginBottom:10 }}/>
                <button onClick={submitReminder} disabled={reminderStatus==="loading"} style={{ width:"100%", background:"#00aaff", border:"none", borderRadius:8, padding:10, fontSize:12, fontWeight:700, color:"#000", cursor:"pointer" }}>{reminderStatus==="loading"?"Setting...":"NOTIFY ME"}</button>
                {reminderStatus==="error" && <div style={{ color:"#ff4466", fontSize:10, marginTop:8 }}>Failed. Try again.</div>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
