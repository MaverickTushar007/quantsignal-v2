"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { X } from "lucide-react";

const API = "https://quantsignal-api-production-a5e1.up.railway.app/api/v1";

const CATEGORIES = ["ALL", "CRYPTO", "EQUITY", "MACRO", "COMMODITY", "FOREX", "INDIA"] as const;
type Category = typeof CATEGORIES[number];

const SENT_COLOR: Record<string, string> = {
  BULLISH: "#00ff88", BEARISH: "#ff4466", NEUTRAL: "rgba(255,255,255,0.35)",
};
const SENT_BG: Record<string, string> = {
  BULLISH: "rgba(0,255,136,0.08)", BEARISH: "rgba(255,68,102,0.08)", NEUTRAL: "rgba(255,255,255,0.04)",
};
const CAT_COLOR: Record<string, string> = {
  CRYPTO: "#f59e0b", EQUITY: "#00aaff", MACRO: "#a78bfa",
  COMMODITY: "#fb923c", FOREX: "#34d399", INDIA: "#f97316",
};

interface Article {
  title: string; summary: string; source: string;
  url: string; sentiment: string; symbol: string; category: string;
}

interface Analysis {
  verdict: string; assets: string; trade: string;
  timeframe: string; confidence: string; raw: string;
}

export default function NewsPage() {
  const { session } = useAuth();
  const [articles, setArticles]     = useState<Article[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [category, setCategory]     = useState<Category>("ALL");
  const [sentiment, setSentiment]   = useState<"ALL"|"BULLISH"|"BEARISH"|"NEUTRAL">("ALL");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sourceWeights, setSourceWeights] = useState<Record<string, { weight: number; accuracy: number; confidence_tier: string }>>({});

  useEffect(() => {
    fetch(`${API}/news/backtest-summary`)
      .then(r => r.json())
      .then(d => { if (d.by_source) setSourceWeights(d.by_source); })
      .catch(() => {});
  }, []);

  // Analysis panel state
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [analysisText, setAnalysisText]   = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [progress, setProgress]           = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const token = session?.access_token;
      const res = await fetch(`${API}/news/feed`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
      setLastUpdate(new Date());
    } catch { setError("Failed to load news."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [session]);
  useEffect(() => { const iv = setInterval(load, 5*60*1000); return () => clearInterval(iv); }, [session]);

  const openAnalysis = async (article: Article) => {
    setActiveArticle(article);
    setAnalysisText("");
    setAnalysisLoading(true);
    setProgress(0);

    // Animate progress bar
    const progInterval = setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 8 : p);
    }, 300);

    const prompt = `You are a professional trading analyst. Analyze this news for trading implications.

News: "${article.title}"
Summary: "${article.summary}"
Category: ${article.category} | Symbol: ${article.symbol}

Respond in this EXACT format:
VERDICT: [one sentence — bullish/bearish/neutral for which asset and why]
ASSETS: [2-4 ticker symbols most affected, comma separated]
TRADE: [specific actionable trade idea with direction, entry context, target, stop]
TIMEFRAME: [when will this impact play out — e.g. "next 4-8 hours" or "2-5 trading days"]
CONFIDENCE: [LOW / MEDIUM / HIGH — based on clarity of signal]
REASONING: [2-3 sentences of deeper context a trader needs to know]`;

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: article.symbol, message: prompt, history: [] }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const l of lines) {
          if (l.trim().startsWith("data: ")) {
            try { const d = JSON.parse(l.trim().slice(6)); if (d.type === "token") setAnalysisText(t => t + d.content); } catch {}
          }
        }
      }
    } catch { setAnalysisText("Analysis unavailable. Try again."); }

    clearInterval(progInterval);
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
    setAnalysisLoading(false);
  };

  const parseAnalysis = (raw: string): Analysis => {
    const get = (key: string) => {
      const match = raw.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z]+:|$)`, "s"));
      return match ? match[1].trim() : "";
    };
    return {
      verdict: get("VERDICT"), assets: get("ASSETS"),
      trade: get("TRADE"), timeframe: get("TIMEFRAME"),
      confidence: get("CONFIDENCE"), raw,
    };
  };

  const filtered = articles.filter(a =>
    (category === "ALL" || a.category === category) &&
    (sentiment === "ALL" || a.sentiment === sentiment)
  );

  const sentimentCounts = {
    BULLISH: articles.filter(a => a.sentiment === "BULLISH").length,
    BEARISH: articles.filter(a => a.sentiment === "BEARISH").length,
    NEUTRAL: articles.filter(a => a.sentiment === "NEUTRAL").length,
  };

  const analysis = activeArticle && analysisText ? parseAnalysis(analysisText) : null;
  const mono = "var(--font-mono)";
  const confColor = (c: string) => c?.includes("HIGH") ? "#00ff88" : c?.includes("LOW") ? "#ff4466" : "#f59e0b";

  const CredibilityDot = ({ source }: { source: string }) => {
    const data = sourceWeights[source];
    if (!data) return null;
    const acc = data.accuracy as number;
    const tier = data.confidence_tier as string;
    const color = acc >= 0.6 ? "#00ff88" : acc >= 0.4 ? "#f59e0b" : "#ff4466";
    return (
      <span title={`${source}: ${Math.round(acc * 100)}% TB accuracy · ${tier} sample`} style={{
        display: "inline-block", width: 5, height: 5, borderRadius: "50%",
        background: color, marginLeft: 4, verticalAlign: "middle",
        boxShadow: `0 0 3px ${color}99`, cursor: "help", flexShrink: 0,
      }} />
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", fontFamily: mono, color: "#e2e8f0", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", marginBottom: 4 }}>QUANTSIGNAL · LIVE</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Market News</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdate && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Updated {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={() => { setLoading(true); load(); }} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: mono }}>↻ REFRESH</button>
        </div>
      </div>

      {/* Sentiment bar */}
      {!loading && articles.length > 0 && (
        <div style={{ padding: "10px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 20, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>SENTIMENT</span>
          {(["BULLISH","BEARISH","NEUTRAL"] as const).map(s => (
            <button key={s} onClick={() => setSentiment(sentiment === s ? "ALL" : s)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0, opacity: sentiment !== "ALL" && sentiment !== s ? 0.3 : 1, transition: "opacity 0.2s" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: SENT_COLOR[s], boxShadow: sentiment === s ? `0 0 8px ${SENT_COLOR[s]}` : "none", transition: "box-shadow 0.2s" }} />
              <span style={{ fontSize: 10, color: SENT_COLOR[s], fontWeight: 700 }}>{sentimentCounts[s]}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{s}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{filtered.length} articles</span>
        </div>
      )}

      {/* Main content — split when panel open */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

        {/* Article list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)" }}>

          {/* Category filters */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: "pointer",
                background: category === c ? (CAT_COLOR[c] || "rgba(255,255,255,0.15)") : "transparent",
                border: `1px solid ${category === c ? "transparent" : "rgba(255,255,255,0.1)"}`,
                color: category === c ? "#000" : "rgba(255,255,255,0.4)", transition: "all 0.15s",
              }}>{c}</button>
            ))}
          </div>

          {loading && <div style={{ padding: "60px 0", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 11 }}>Loading market news...</div>}
          {error && <div style={{ padding: "60px 0", textAlign: "center", color: "#ff4466", fontSize: 11 }}>{error}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((a, i) => {
              const isActive = activeArticle?.title === a.title;
              return (
                <div key={i} style={{
                  padding: "14px 16px", borderRadius: 10,
                  background: isActive ? "rgba(0,170,255,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isActive ? "rgba(0,170,255,0.25)" : "rgba(255,255,255,0.06)"}`,
                  display: "flex", alignItems: "flex-start", gap: 14,
                  transition: "all 0.2s",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: `${CAT_COLOR[a.category] || "#fff"}18`, color: CAT_COLOR[a.category] || "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>{a.category}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{a.symbol}</span>
                    </div>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 5 }}>{a.title}</div>
                    </a>
                    {a.summary && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 8 }}>{a.summary}</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", display: "inline-flex", alignItems: "center", gap: 3 }}>{a.source}<CredibilityDot source={a.source} /> · <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(0,170,255,0.5)", textDecoration: "none" }}>Read →</a></span>
                    </div>
                  </div>

                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: SENT_BG[a.sentiment] || SENT_BG.NEUTRAL, color: SENT_COLOR[a.sentiment] || SENT_COLOR.NEUTRAL, letterSpacing: "0.06em" }}>{a.sentiment}</span>
                    <button onClick={() => openAnalysis(a)} style={{
                      padding: "5px 12px", borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: "pointer",
                      background: isActive ? "rgba(0,170,255,0.15)" : "rgba(0,170,255,0.07)",
                      border: `1px solid ${isActive ? "rgba(0,170,255,0.4)" : "rgba(0,170,255,0.15)"}`,
                      color: "#00aaff", fontFamily: mono, whiteSpace: "nowrap",
                      transition: "all 0.15s",
                    }}>
                      {isActive && analysisLoading ? "⟳ ANALYSING..." : "ANALYSE →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Analysis panel — slides in from right */}
        <div ref={panelRef} style={{
          width: activeArticle ? 400 : 0,
          minWidth: activeArticle ? 400 : 0,
          overflow: "hidden",
          transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
          borderLeft: activeArticle ? "1px solid rgba(255,255,255,0.07)" : "none",
          background: "rgba(8,12,20,0.95)",
          backdropFilter: "blur(20px)",
          position: "relative",
          flexShrink: 0,
        }}>
          {activeArticle && (
            <div style={{ width: 400, height: "100%", overflowY: "auto", padding: "20px" }}>

              {/* Progress bar */}
              {progress > 0 && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "rgba(0,170,255,0.1)", zIndex: 10 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #00aaff, #00ff88)", transition: "width 0.3s ease", borderRadius: 2 }} />
                </div>
              )}

              {/* Panel header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, paddingTop: 4 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#00aaff", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 4 }}>AI TRADE ANALYSIS</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4, maxWidth: 320 }}>{activeArticle.title}</div>
                </div>
                <button onClick={() => { setActiveArticle(null); setAnalysisText(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, marginLeft: 8, flexShrink: 0 }}>
                  <X size={13} color="rgba(255,255,255,0.3)" />
                </button>
              </div>

              {/* Source chip */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 3, background: `${CAT_COLOR[activeArticle.category]}18`, color: CAT_COLOR[activeArticle.category], fontWeight: 700 }}>{activeArticle.category}</span>
                <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 3, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}>{activeArticle.source}</span>
                <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 3, background: SENT_BG[activeArticle.sentiment], color: SENT_COLOR[activeArticle.sentiment], fontWeight: 700 }}>{activeArticle.sentiment}</span>
              </div>

              {/* Loading skeleton */}
              {analysisLoading && !analysisText && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[80, 60, 90, 50, 70].map((w, i) => (
                    <div key={i} style={{ height: 10, borderRadius: 4, background: "rgba(255,255,255,0.04)", width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i*0.1}s` }} />
                  ))}
                  <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
                </div>
              )}

              {/* Parsed analysis cards */}
              {analysis && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  {/* Verdict */}
                  {analysis.verdict && (
                    <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>VERDICT</div>
                      <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>{analysis.verdict}</div>
                    </div>
                  )}

                  {/* Confidence + Timeframe row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {analysis.confidence && (
                      <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>CONFIDENCE</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: confColor(analysis.confidence) }}>{analysis.confidence.replace(/^(LOW|MEDIUM|HIGH).*/i, (m: string) => m.split(/\s/)[0])}</div>
                      </div>
                    )}
                    {analysis.timeframe && (
                      <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>TIMEFRAME</div>
                        <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>{analysis.timeframe}</div>
                      </div>
                    )}
                  </div>

                  {/* Affected assets */}
                  {analysis.assets && (
                    <div style={{ padding: "10px 14px", background: "rgba(0,170,255,0.04)", border: "1px solid rgba(0,170,255,0.12)", borderRadius: 8 }}>
                      <div style={{ fontSize: 8, color: "#00aaff", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>AFFECTED ASSETS</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {analysis.assets.split(",").map((s, i) => (
                          <span key={i} style={{ fontSize: 10, padding: "3px 10px", background: "rgba(0,170,255,0.08)", border: "1px solid rgba(0,170,255,0.2)", borderRadius: 4, color: "#00aaff", fontWeight: 600 }}>{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trade idea */}
                  {analysis.trade && (
                    <div style={{ padding: "12px 14px", background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: 8 }}>
                      <div style={{ fontSize: 8, color: "#00ff88", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>TRADE IDEA</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{analysis.trade}</div>
                    </div>
                  )}

                  {/* Reasoning */}
                  {analysis.raw.includes("REASONING:") && (
                    <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>REASONING</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                        {analysis.raw.split("REASONING:")[1]?.trim()}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", lineHeight: 1.5, marginTop: 4, padding: "0 2px" }}>
                    AI analysis for informational purposes only. Not financial advice. Always manage risk.
                  </div>
                </div>
              )}

              {/* Still streaming — show raw */}
              {analysisLoading && analysisText && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{analysisText}<span style={{ display: "inline-block", width: 8, height: 12, background: "#00aaff", marginLeft: 2, animation: "blink 1s step-end infinite", verticalAlign: "text-bottom" }} /><style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
