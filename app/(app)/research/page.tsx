"use client";

import { Calendar, Bell, BellOff, RefreshCw, X, Info, TrendingUp, TrendingDown, ChevronDown, Activity, Zap, Target, AlertTriangle } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Signal,
  fetchSignals,
  fetchSignal,
  fetchSignalReasoning,
  fetchNews,
  streamPerseusChat,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────



interface ReasoningData {
  symbol?: string;
  direction?: string;
  probability?: number;
  probability_raw?: number;
  raw_probability?: number;
  regime_adjusted_probability?: number;
  model_agreement?: number;
  confluence_score?: string | number;
  volume_ratio?: number;
  kelly_capped?: number;
  regime?: string;
  volatility_state?: string;
  regime_percentile?: number;
  mtf?: Record<string, any>;
  energy?: Record<string, any>;
  top_features?: string[];
  rationale?: string;
  h4_confluence?: number;
  [key: string]: any;
}

type Tab = "overview" | "mtf" | "energy" | "levels" | "news" | "calendar" | "chat";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (v: any) => (v != null && !isNaN(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : "—");
const usd = (v: any) => (v != null && !isNaN(Number(v)) ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—");
const num = (v: any, d = 2) => (v != null && !isNaN(Number(v)) ? Number(v).toFixed(d) : "—");

function ageMinutes(generated_at?: string): number | null {
  if (!generated_at) return null;
  const ms = Date.now() - new Date(generated_at).getTime();
  return Math.floor(ms / 60000);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, variant }: { label: string; variant: "bull" | "bear" | "neutral" | "high" | "med" | "low" | "stale" }) {
  const styles: Record<string, string> = {
    bull: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    bear: "bg-red-500/15 text-red-400 border border-red-500/30",
    neutral: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
    high: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    med: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    low: "bg-red-500/15 text-red-400 border border-red-500/30",
    stale: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${styles[variant]}`}>
      {label}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0d1117] border border-slate-800/60 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">{children}</p>;
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/40 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-semibold ${accent ? "text-emerald-400" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}

function MiniBar({ value, max = 1, color = "#10b981" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "mtf", label: "MTF / Confluence" },
  { id: "energy", label: "Energy" },
  { id: "levels", label: "Trade Levels" },
  { id: "news", label: "News" },
  { id: "chat", label: "AI Chat" },
];

// ─── Tab Views ────────────────────────────────────────────────────────────────

function OverviewTab({ signal, reasoning }: { signal: Signal; reasoning: ReasoningData }) {
  const R = reasoning;
  const S = signal;
  const features: string[] = R.top_features ?? S.top_features ?? [];
  const rationale = R.context_text ?? R.rationale ?? R.signal_rationale ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Signal Metrics */}
      <Card>
        <SectionLabel>Signal Metrics</SectionLabel>
        <Row label="Raw probability" value={pct(R.probability_raw ?? R.raw_probability ?? S.probability)} />
        <Row label="Regime-adjusted prob." value={pct(R.regime_adjusted_probability)} />
        <Row label="Model agreement" value={R.model_agreement != null ? pct(R.model_agreement) : num(S.model_agreement)} />
        <Row label="Confluence score" value={R.confluence_score ?? "—"} />
        <Row label="Volume ratio" value={R.volume_ratio != null ? `${num(R.volume_ratio)}×` : "—"} />
        <Row label="Kelly size" value={pct(R.kelly_capped ?? S.kelly_size)} />
        <Row label="Expected value" value={S.expected_value != null ? `${num(S.expected_value)}×` : "—"} />
      </Card>

      {/* Regime / Context */}
      <Card>
        <SectionLabel>Market Context</SectionLabel>
        <Row label="Regime" value={R.regime ?? "—"} />
        <Row label="Volatility" value={R.volatility_state ?? "—"} />
        <Row label="Regime percentile" value={R.regime_percentile != null ? `${num(R.regime_percentile, 1)}%` : "—"} />
        <Row label="Asset type" value={S.type ?? "—"} />
        <Row label="Confidence" value={S.confidence ?? "—"} />
      </Card>

      {/* Top Features */}
      {features.length > 0 && (
        <Card className="md:col-span-2">
          <SectionLabel>Top Features</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {features.map((f, i) => (
              <span key={i} className="px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-slate-300 font-mono">
                {f.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Rationale */}
      {rationale && (
        <Card className="md:col-span-2">
          <SectionLabel>Signal Rationale</SectionLabel>
          <p className="text-sm text-slate-300 leading-relaxed">{rationale}</p>
        </Card>
      )}
    </div>
  );
}

function MtfTab({ signal, reasoning }: { signal: Signal; reasoning: ReasoningData }) {
  const confluence = signal.confluence ?? [];
  const mtf = reasoning.mtf ?? {};
  const mtfDetails: Record<string, string> = mtf.mtf_details ?? {};

  const timeframes = ["15m", "1h", "4h", "1d"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* MTF Timeframes */}
      <Card className="md:col-span-2">
        <SectionLabel>Multi-Timeframe Alignment</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {timeframes.map((tf) => {
            const bias = mtfDetails[tf] ?? null;
            const isBull = bias === "BULL";
            const isBear = bias === "BEAR";
            // Extra data from flat mtf object
            const rsi = tf === "1h" ? mtf.tf_1h_rsi : tf === "4h" ? mtf.tf_4h_rsi : null;
            return (
              <div key={tf} className={`border rounded-lg p-3 ${
                isBull ? "bg-emerald-500/10 border-emerald-500/30" :
                isBear ? "bg-red-500/10 border-red-500/30" :
                "bg-slate-800/30 border-slate-700/40"
              }`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{tf}</p>
                {bias ? (
                  <>
                    <p className={`text-lg font-bold mb-1 ${isBull ? "text-emerald-400" : isBear ? "text-red-400" : "text-slate-400"}`}>{bias}</p>
                    {rsi != null && <p className="text-xs text-slate-400">RSI: {num(rsi, 1)}</p>}
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">—</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* MTF Score Summary */}
      {mtf.mtf_score != null && (
        <Card>
          <SectionLabel>MTF Score</SectionLabel>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-bold tabular-nums text-slate-100">{mtf.mtf_score_with_daily ?? mtf.mtf_score}<span className="text-slate-500 text-lg">/4</span></p>
            <p className="text-sm text-slate-400">{mtf.mtf_score === 0 ? "Full bearish alignment" : mtf.mtf_score === 4 ? "Full bullish alignment" : "Mixed timeframes"}</p>
          </div>
        </Card>
      )}

      {/* Confluence Indicators */}
      {confluence.length > 0 && (
        <Card className="md:col-span-2">
          <SectionLabel>Confluence Indicators</SectionLabel>
          <div className="space-y-2">
            {confluence.map((c, i) => {
              const bull = c.signal === "BULLISH";
              const bear = c.signal === "BEARISH";
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/40 last:border-0">
                  <span className="text-xs text-slate-300 w-28 shrink-0">{c.name}</span>
                  <span className="text-xs text-slate-400 flex-1 px-3">{c.value}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    bull ? "bg-emerald-500/15 text-emerald-400" :
                    bear ? "bg-red-500/15 text-red-400" :
                    "bg-slate-500/15 text-slate-400"
                  }`}>{c.signal}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}


function MarkdownText({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^## (.+)$/gm, '<p class="font-bold text-slate-100 mt-2 mb-1">$1</p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/---/g, '<hr class="border-slate-700 my-2"/>')
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function EnergyTab({ reasoning }: { reasoning: ReasoningData }) {
  const energy = reasoning.energy ?? {};
  const rawScore = energy.score ?? reasoning.energy_score ?? null;
  // API returns score as 0-1, convert to 0-100
  const score = rawScore != null ? rawScore * 100 : null;
  const state = energy.state ?? reasoning.energy_state ?? "—";
  const bias = energy.direction_bias ?? reasoning.energy_bias ?? "—";
  const comps = energy.components ?? {};

  const components = [
    { label: "ATR Ratio", key: "atr_ratio", max: 1 },
    { label: "BB Squeeze", key: "bb_squeeze", max: 1 },
    { label: "Volume Ratio", key: "vol_ratio", max: 1 },
    { label: "Momentum Accel", key: "momentum_accel", max: 0.1 },
    { label: "Mean Rev Z", key: "mean_rev_z", max: 1 },
  ];

  const gaugeColor = score == null ? "#475569" : score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  // SVG arc: M 20 100 A 80 80 0 0 1 180 100 → left to right, center at (100,100)
  // score=0 → needle points LEFT (180deg), score=100 → RIGHT (0deg), score=50 → UP (270deg=-90deg)
  const gaugeAngleDeg = score != null ? 180 - (score / 100) * 180 : 180;
  const gaugeAngleRad = (gaugeAngleDeg * Math.PI) / 180;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Gauge Card */}
      <Card className="flex flex-col items-center justify-center py-8">
        <SectionLabel>Energy Score</SectionLabel>
        <div className="relative w-48 h-24 mb-4">
          <svg viewBox="0 0 200 110" className="w-full">
            {/* Background arc */}
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" />
            {/* Colored arc */}
            {score != null && (
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 251} 251`}
                opacity="0.9"
              />
            )}
            {/* Needle */}
            <line
              x1="100" y1="100"
              x2={100 + 60 * Math.cos(gaugeAngleRad)}
              y2={100 + 60 * Math.sin(gaugeAngleRad)}
              stroke="#e2e8f0"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="4" fill="#e2e8f0" />
          </svg>
        </div>
        <p className="text-5xl font-bold tabular-nums" style={{ color: gaugeColor }}>
          {score != null ? Math.round(score) : "—"}
        </p>
        <p className="text-sm text-slate-400 mt-1">{state}</p>
        <p className="text-xs text-slate-500 mt-1">Bias: {bias}</p>
      </Card>

      {/* Components */}
      <Card>
        <SectionLabel>Energy Components</SectionLabel>
        <div className="space-y-4">
          {components.map(({ label, key, max }) => {
            const v = comps[key];
            const numV = v != null ? Math.abs(Number(v)) : null;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-xs font-semibold text-slate-200 tabular-nums">{v != null ? num(v) : "—"}</span>
                </div>
                {v != null ? (
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.min(100, (Math.abs(Number(v)) / max) * 100)}%`,
                      background: Number(v) < 0 ? "#ef4444" : gaugeColor,
                    }} />
                  </div>
                ) : (
                  <div className="w-full h-1.5 bg-slate-800 rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function LevelsTab({ signal }: { signal: Signal }) {
  const S = signal;
  const tp = S.take_profit;
  const sl = S.stop_loss;
  const price = S.current_price;
  const atr = S.atr;
  const isBuy = S.direction === "BUY";

  // For the ladder: always show highest price at top, lowest at bottom
  // Correct semantics: BUY → tp above price, sl below | SELL → tp below price, sl above
  const allPrices = [tp, price, sl].filter((v) => v != null && !isNaN(Number(v))) as number[];
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;
  // pos: higher price = higher on screen (bottom %)
  const pos = (v: number) => `${((v - minP) / range) * 80 + 10}%`;

  const tpPct = tp != null && price ? (((tp - price) / price) * 100) : null;
  const slPct = sl != null && price ? (((sl - price) / price) * 100) : null;

  // Determine label colors based on actual direction semantics
  // For SELL: tp < price (profit = price drop), sl > price (loss = price rise)
  // For BUY:  tp > price (profit = price rise), sl < price (loss = price drop)
  const tpColor = isBuy ? "text-emerald-400" : "text-emerald-400"; // always green = profit
  const slColor = "text-red-400"; // always red = loss

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Price Ladder */}
      <Card>
        <SectionLabel>Price Ladder</SectionLabel>
        <div className="relative h-72 mt-4">
          {/* Center vertical bar */}
          <div className="absolute left-1/2 top-[8%] bottom-[8%] w-0.5 bg-slate-700 rounded-full -translate-x-1/2" />

          {/* Colored fill between SL and TP */}
          {tp != null && sl != null && (
            <div className="absolute left-1/2 -translate-x-1/2 w-0.5" style={{
              bottom: pos(Math.min(tp, sl)),
              height: `${Math.abs(((Math.max(tp, sl) - Math.min(tp, sl)) / range) * 80)}%`,
              background: "linear-gradient(to top, #ef444444, #10b98144)",
              width: "2px",
            }} />
          )}

          {/* TP marker */}
          {tp != null && (
            <div className="absolute left-1/2 flex items-center" style={{ bottom: pos(tp), transform: "translateY(50%)" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 -translate-x-1/2 z-10 shrink-0" />
              <div className="ml-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 whitespace-nowrap">
                  Take Profit
                  {tpPct != null && <span className="ml-1 font-normal opacity-70">{tpPct > 0 ? "+" : ""}{tpPct.toFixed(1)}%</span>}
                </p>
                <p className="text-sm font-bold tabular-nums text-emerald-400">{usd(tp)}</p>
              </div>
            </div>
          )}

          {/* Current price marker */}
          {price != null && (
            <div className="absolute left-1/2 flex items-center" style={{ bottom: pos(price), transform: "translateY(50%)" }}>
              <div className="w-4 h-4 rounded-full bg-slate-200 border-2 border-slate-900 -translate-x-1/2 z-10 shrink-0" />
              <div className="ml-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Current Price</p>
                <p className="text-sm font-bold tabular-nums text-slate-100">{usd(price)}</p>
              </div>
            </div>
          )}

          {/* SL marker */}
          {sl != null && (
            <div className="absolute left-1/2 flex items-center" style={{ bottom: pos(sl), transform: "translateY(50%)" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 -translate-x-1/2 z-10 shrink-0" />
              <div className="ml-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 whitespace-nowrap">
                  Stop Loss
                  {slPct != null && <span className="ml-1 font-normal opacity-70">{slPct > 0 ? "+" : ""}{slPct.toFixed(1)}%</span>}
                </p>
                <p className="text-sm font-bold tabular-nums text-red-400">{usd(sl)}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Trade Params */}
      <Card>
        <SectionLabel>Trade Parameters</SectionLabel>
        <div className="space-y-0">
          <Row label="Direction" value={
            <span className={`font-bold ${isBuy ? "text-emerald-400" : S.direction === "SELL" ? "text-red-400" : "text-slate-400"}`}>
              {S.direction}
            </span>
          } />
          <Row label="Entry (current)" value={<span className="text-slate-100 font-semibold">{usd(price)}</span>} />
          <Row label="Take profit" value={
            <span className="text-emerald-400 font-semibold">
              {usd(tp)}{tpPct != null && <span className="text-emerald-400/60 text-xs ml-1">{tpPct > 0 ? "+" : ""}{tpPct.toFixed(1)}%</span>}
            </span>
          } />
          <Row label="Stop loss" value={
            <span className="text-red-400 font-semibold">
              {usd(sl)}{slPct != null && <span className="text-red-400/60 text-xs ml-1">{slPct > 0 ? "+" : ""}{slPct.toFixed(1)}%</span>}
            </span>
          } />
          <Row label="Risk / Reward" value={S.risk_reward != null ? `${num(S.risk_reward)}×` : "—"} />
          <Row label="ATR" value={atr != null ? usd(atr) : "—"} />
          <Row label="Kelly fraction" value={pct(S.kelly_size)} />
          <Row label="Expected value" value={S.expected_value != null ? `${num(S.expected_value)}×` : "—"} />
        </div>
      </Card>
    </div>
  );
}


function calFormatDate(event: any) {
  const date = event.date_display || "";
  const time = event.time_display || "";
  if (time && time !== "Tentative" && time !== "All Day" && time !== "") return `${date} ${time} EST`;
  return date || "TBA";
}

function calIsPast(dateStr: string) {
  try { return new Date(dateStr) < new Date(); } catch { return false; }
}

function calCountdown(event: any): string {
  try {
    const diff = new Date(event.date).getTime() - Date.now();
    if (diff <= 0) return "";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 48) return `${Math.floor(h / 24)}d`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  } catch { return ""; }
}

function NewsTab({ symbol, token }: { symbol: string; token?: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeIdx, setActiveIdx]           = useState<number | null>(null);
  const [analysisText, setAnalysisText]     = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const API = "https://quantsignal-api.onrender.com/api/v1";

  useEffect(() => {
    setLoading(true);
    fetchNews(symbol, token)
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.items ?? data?.articles ?? data?.news ?? [];
        setArticles(items);
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [symbol, token]);

  const openAnalysis = async (a: any, i: number) => {
    setActiveIdx(i);
    setAnalysisText("");
    setAnalysisLoading(true);
    setProgress(0);
    const progIv = setInterval(() => setProgress(p => p < 85 ? p + Math.random() * 8 : p), 300);
    const title = a.title ?? a.headline ?? "";
    const summary = a.summary ?? "";
    const prompt = [
      "You are a professional trading analyst. Analyze this news for trading implications.",
      "News: \"" + title + "\"",
      "Summary: \"" + summary + "\"",
      "Symbol context: " + symbol,
      "",
      "Respond in this EXACT format:",
      "VERDICT: [one sentence — bullish/bearish/neutral for which asset and why]",
      "ASSETS: [2-4 ticker symbols most affected, comma separated]",
      "TRADE: [specific actionable trade idea with direction, entry context, target, stop]",
      "TIMEFRAME: [when will this impact play out]",
      "CONFIDENCE: [LOW / MEDIUM / HIGH]",
      "REASONING: [2-3 sentences of deeper context]",
    ].join("\n");
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, message: prompt, history: [] }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const l of lines) {
          if (l.trim().startsWith("data: ")) {
            try { const d = JSON.parse(l.trim().slice(6)); if (d.type === "token") setAnalysisText(t => t + d.content); } catch { /**/ }
          }
        }
      }
    } catch { setAnalysisText("Analysis unavailable. Try again."); }
    clearInterval(progIv); setProgress(100);
    setTimeout(() => setProgress(0), 600);
    setAnalysisLoading(false);
  };

  const parseAnalysis = (raw: string) => ({
    verdict:    raw.split("VERDICT:")[1]?.split(/\n[A-Z]+:/)[0]?.trim() ?? "",
    assets:     raw.split("ASSETS:")[1]?.split(/\n[A-Z]+:/)[0]?.trim() ?? "",
    trade:      raw.split("TRADE:")[1]?.split(/\n[A-Z]+:/)[0]?.trim() ?? "",
    timeframe:  raw.split("TIMEFRAME:")[1]?.split(/\n[A-Z]+:/)[0]?.trim() ?? "",
    confidence: raw.split("CONFIDENCE:")[1]?.split(/\n[A-Z]+:/)[0]?.trim() ?? "",
    reasoning:  raw.split("REASONING:")[1]?.trim() ?? "",
  });

  const confColor = (c: string) => c?.includes("HIGH") ? "#00ff88" : c?.includes("LOW") ? "#ff4466" : "#f59e0b";

  if (loading) return <div className="text-slate-500 text-sm">Loading news…</div>;
  if (!articles.length) return <div className="text-slate-500 text-sm">No news available.</div>;

  const active = activeIdx !== null ? articles[activeIdx] : null;
  const analysis = active && analysisText && !analysisLoading ? parseAnalysis(analysisText) : null;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {articles.map((a, i) => {
          const sentiment = a.sentiment ?? a.label ?? "NEUTRAL";
          const bull = sentiment === "BULLISH" || sentiment === "POSITIVE";
          const bear = sentiment === "BEARISH" || sentiment === "NEGATIVE";
          const isActive = activeIdx === i;
          return (
            <div key={i} style={{
              padding: "12px 14px", borderRadius: 8,
              background: isActive ? "rgba(0,170,255,0.05)" : "rgba(255,255,255,0.02)",
              border: "1px solid " + (isActive ? "rgba(0,170,255,0.25)" : "rgba(255,255,255,0.07)"),
              transition: "all 0.2s",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={a.url ?? a.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4, marginBottom: 4 }}>{a.title ?? a.headline}</p>
                  </a>
                  {a.summary && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, overflow: "hidden", marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{a.summary}</p>}
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{a.source ?? a.publisher}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: bull ? "rgba(0,255,136,0.08)" : bear ? "rgba(255,68,102,0.08)" : "rgba(255,255,255,0.04)",
                    color: bull ? "#00ff88" : bear ? "#ff4466" : "rgba(255,255,255,0.35)",
                  }}>{sentiment}</span>
                  <button onClick={() => openAnalysis(a, i)} style={{
                    padding: "4px 10px", borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: "pointer",
                    background: isActive ? "rgba(0,170,255,0.15)" : "rgba(0,170,255,0.07)",
                    border: "1px solid " + (isActive ? "rgba(0,170,255,0.4)" : "rgba(0,170,255,0.15)"),
                    color: "#00aaff", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" as const,
                    transition: "all 0.15s",
                  }}>
                    {isActive && analysisLoading ? "⟳ ANALYSING..." : "ANALYSE →"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {active && (
        <div style={{
          width: 300, flexShrink: 0,
          background: "rgba(8,12,20,0.95)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(0,170,255,0.15)", borderRadius: 10,
          overflow: "hidden", position: "relative",
        }}>
          {progress > 0 && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "rgba(0,170,255,0.1)" }}>
              <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg,#00aaff,#00ff88)", transition: "width 0.3s ease" }} />
            </div>
          )}
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#00aaff", fontWeight: 700, letterSpacing: "0.12em" }}>AI TRADE ANALYSIS</div>
              <button onClick={() => { setActiveIdx(null); setAnalysisText(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, lineHeight: 1 }}>✕</button>
            </div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: 14 }}>{active.title ?? active.headline}</p>

            {analysisLoading && !analysisText && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[75,55,85,45,65].map((w,j) => (
                  <div key={j} style={{ height: 8, borderRadius: 3, background: "rgba(255,255,255,0.04)", width: w + "%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: (j*0.1) + "s" }} />
                ))}
                <style>{"@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}"}</style>
              </div>
            )}

            {analysisLoading && analysisText && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                {analysisText}<span style={{ display: "inline-block", width: 7, height: 12, background: "#00aaff", marginLeft: 2, animation: "blink 1s step-end infinite", verticalAlign: "text-bottom" }} />
                <style>{"@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}"}</style>
              </div>
            )}

            {analysis && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.verdict && (
                  <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7 }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 5 }}>VERDICT</div>
                    <div style={{ fontSize: 11, color: "#e2e8f0", lineHeight: 1.6 }}>{analysis.verdict}</div>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {analysis.confidence && (
                    <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7 }}>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>CONFIDENCE</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: confColor(analysis.confidence) }}>{analysis.confidence.split(/\s/)[0]}</div>
                    </div>
                  )}
                  {analysis.timeframe && (
                    <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7 }}>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>TIMEFRAME</div>
                      <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>{analysis.timeframe}</div>
                    </div>
                  )}
                </div>
                {analysis.assets && (
                  <div style={{ padding: "8px 12px", background: "rgba(0,170,255,0.04)", border: "1px solid rgba(0,170,255,0.12)", borderRadius: 7 }}>
                    <div style={{ fontSize: 8, color: "#00aaff", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>AFFECTED ASSETS</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {analysis.assets.split(",").map((s: string, j: number) => (
                        <span key={j} style={{ fontSize: 9, padding: "2px 8px", background: "rgba(0,170,255,0.08)", border: "1px solid rgba(0,170,255,0.2)", borderRadius: 3, color: "#00aaff", fontWeight: 600 }}>{s.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.trade && (
                  <div style={{ padding: "10px 12px", background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.1)", borderRadius: 7 }}>
                    <div style={{ fontSize: 8, color: "#00ff88", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 5 }}>TRADE IDEA</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{analysis.trade}</div>
                  </div>
                )}
                {analysis.reasoning && (
                  <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 7 }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 5 }}>REASONING</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>{analysis.reasoning}</div>
                  </div>
                )}
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.12)", lineHeight: 1.5, marginTop: 2 }}>Not financial advice. Manage risk.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatTab({ signal, reasoning, token }: { signal: Signal; reasoning: ReasoningData; token?: string }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "Should I take this trade?",
    "What's the risk here?",
    "What could invalidate this signal?",
    "Summarize the key metrics",
  ];

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      const userMsg = { role: "user" as const, content: text };
      const newMessages = [...messages, userMsg];
      setMessages([...newMessages, { role: "assistant", content: "" }]);
      setInput("");
      setStreaming(true);

      const context = `Signal: ${signal.symbol} ${signal.direction} | Price: ${signal.current_price} | Prob: ${signal.probability} | TP: ${signal.take_profit} | SL: ${signal.stop_loss} | Regime: ${reasoning.regime ?? "unknown"} | Confidence: ${signal.confidence}`;
      const systemMsg = `You are Perseus, QuantSignal's AI analyst. Current signal context: ${context}. Be concise and actionable.`;

      let full = "";
      try {
        const allMessages = [
            ...(systemMsg ? [{ role: "user" as const, content: systemMsg }, { role: "assistant" as const, content: "Understood." }] : []),
            ...newMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          ];
          await streamPerseusChat(
            allMessages,
            (tok: string) => {
              full += tok;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: full };
                return updated;
              });
            },
            token
          );
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "Perseus is unavailable right now." };
          return updated;
        });
      } finally {
        setStreaming(false);
      }
    },
    [messages, signal, reasoning, token, streaming]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-320px)] min-h-[400px]">
      {/* Messages */}
      <Card className="flex-1 overflow-y-auto space-y-3 !p-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-lg">⚡</span>
            </div>
            <p className="text-sm text-slate-400">Ask Perseus anything about this signal</p>
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/20"
                : "bg-slate-800/60 text-slate-200 border border-slate-700/40"
            }`}>
              {streaming && i === messages.length - 1 && !m.content ? (
                <span className="animate-pulse text-slate-500">●●●</span>
              ) : (
                <MarkdownText text={m.content} />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </Card>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send(input))}
          placeholder="Ask Perseus about this signal…"
          disabled={streaming}
          className="flex-1 bg-[#0d1117] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/50 transition-colors"
        />
        <button
          onClick={() => send(input)}
          disabled={streaming || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const searchParams = useSearchParams();
  const symbolParam = searchParams.get("symbol");

  const [signals, setSignals] = useState<Signal[]>([]);
  const [selected, setSelected] = useState<Signal | null>(null);
  const [reasoning, setReasoning] = useState<ReasoningData>({});
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);

  // Load signal list
  useEffect(() => {
    fetchSignals(token)
      .then((data) => {
        setSignals(data);
        if (symbolParam) {
          const found = data.find((s: Signal) => s.symbol === symbolParam);
          if (found) loadSignal(found);
        }
      })
      .catch(console.error);
  }, [token]);

  const loadSignal = useCallback(
    async (sig: Signal) => {
      setSelected(sig);
      setTab("overview");
      setLoading(true);
      setReasoning({});
      try {
        const [detail, reasoningData] = await Promise.allSettled([
          fetchSignal(sig.symbol, token),
          fetchSignalReasoning(sig.symbol, token),
        ]);
        const detailVal = detail.status === "fulfilled" ? detail.value : {};
        const reasoningVal = reasoningData.status === "fulfilled" ? reasoningData.value : {};
        setSelected((prev) => ({ ...(prev ?? sig), ...detailVal }));
        setReasoning({ ...detailVal, ...reasoningVal });
      } catch {
        setReasoning({});
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const age = selected ? ageMinutes(selected.generated_at) : null;
  const isStale = age != null && age > 60;

  const dirVariant = selected?.direction === "BUY" ? "bull" : selected?.direction === "SELL" ? "bear" : "neutral";
  const confVariant: "high" | "med" | "low" =
    selected?.confidence === "HIGH" ? "high" : selected?.confidence === "MEDIUM" ? "med" : "low";

  return (
    <div className="flex h-screen bg-[#080b10] text-slate-100 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 border-r border-slate-800/60 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800/60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Signals</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {signals.map((s) => {
            const active = selected?.symbol === s.symbol;
            return (
              <button
                key={s.symbol}
                onClick={() => loadSignal(s)}
                className={`w-full text-left px-4 py-2.5 transition-colors ${
                  active
                    ? "bg-emerald-500/10 border-r-2 border-emerald-500"
                    : "hover:bg-slate-800/40 border-r-2 border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200 truncate">{s.display ?? s.symbol}</span>
                  <span className={`text-[10px] font-bold ${s.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                    {s.direction}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{s.name}</p>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-500 text-sm">Select a signal to begin analysis</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-slate-800/60 px-6 py-4 shrink-0">
              {isStale && (
                <div className="mb-3 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
                  <span className="text-orange-400 text-xs">⚠</span>
                  <span className="text-xs text-orange-300">Signal is {age}m old — may be stale</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{selected.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-bold text-slate-100 truncate">{selected.name}</h1>
                      <span className="text-sm text-slate-500">{selected.display}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge label={selected.direction} variant={dirVariant} />
                      <Badge label={selected.confidence} variant={confVariant} />
                      {isStale && <Badge label="Stale" variant="stale" />}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold tabular-nums text-slate-100">{usd(selected.current_price)}</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    <span className={selected.direction === "BUY" ? "text-emerald-400" : "text-red-400"}>
                      {pct(selected.probability)}
                    </span>
                    {" "}calibrated prob.
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-800/60 px-6 shrink-0">
              <nav className="flex gap-0 -mb-px overflow-x-auto">
                {TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                      tab === id
                        ? "border-emerald-500 text-emerald-400"
                        : "border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm animate-pulse">
                  Loading signal data…
                </div>
              ) : (
                <>
                  {tab === "overview" && <OverviewTab signal={selected} reasoning={reasoning} />}
                  {tab === "mtf" && <MtfTab signal={selected} reasoning={reasoning} />}
                  {tab === "energy" && <EnergyTab reasoning={reasoning} />}
                  {tab === "levels" && <LevelsTab signal={selected} />}
                  {tab === "news" && <NewsTab symbol={selected.symbol} token={token} />}
                  {tab === "chat" && <ChatTab signal={selected} reasoning={reasoning} token={token} />}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
