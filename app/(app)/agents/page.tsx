"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import { streamPerseusChat, type PerseusMessage } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const API_BASE = "https://quantsignal-api.onrender.com/api/v1";

const STARTERS = [
  { label: "Top conviction signals", prompt: "What are the top 5 highest-conviction signals right now? Rank by EV × probability and give entry, TP, SL for each." },
  { label: "Market bias", prompt: "What is the current overall market bias across all tracked assets? Is it risk-on or risk-off and why?" },
  { label: "Best BUY setups", prompt: "List the best BUY setups available right now with the highest expected value and kelly size above 5%." },
  { label: "Avoid these", prompt: "Which assets should I avoid today and why? Look for SELL signals with high confidence." },
  { label: "BTC vs ETH", prompt: "Compare BTC-USD and ETH-USD signals right now. Which has better risk/reward?" },
  { label: "Morning brief", prompt: "Give me a full morning briefing: market regime, top 3 opportunities, top 2 risks, and one macro theme to watch." },
  { label: "High EV plays", prompt: "Show me all signals with expected value above 1.5x and probability above 55%. Rank them." },
  { label: "Regime check", prompt: "What is the current volatility regime based on VIX? How should I size positions?" },
];

marked.setOptions({ breaks: true });

function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  const html = marked.parse(content) as string;
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      className="perseus-msg"
      style={{ lineHeight: 1.75 }}
    />
  );
}

interface Signal {
  symbol: string;
  direction: string;
  probability: number;
  confidence: string;
  expected_value: number;
  kelly_size: number;
  current_price: number;
  take_profit: number;
  stop_loss: number;
  type?: string;
  name?: string;
}

export default function AgentsPage() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<PerseusMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState("");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsReady, setSignalsReady] = useState(false);
  const [showSignalPanel, setShowSignalPanel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/signals`, { headers: { Accept: "application/json" } })
      .then(r => r.json())
      .then((d: Signal[]) => { setSignals(d); setSignalsReady(true); })
      .catch(() => setSignalsReady(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  const buildContext = useCallback((userContent: string) => {
    if (!signals.length) return userContent;
    const sorted = [...signals].sort((a, b) =>
      (b.expected_value || 0) * (b.probability || 0) - (a.expected_value || 0) * (a.probability || 0)
    );
    const buys = signals.filter(s => s.direction === "BUY").length;
    const sells = signals.filter(s => s.direction === "SELL").length;
    const highConv = signals.filter(s => s.confidence === "HIGH").length;
    const top = sorted.slice(0, 40).map(s =>
      `${s.symbol}|${s.direction}|${((s.probability || 0) * 100).toFixed(0)}%|${s.confidence}|EV:${(s.expected_value || 0).toFixed(1)}|K:${(s.kelly_size || 0).toFixed(1)}%|$${(s.current_price || 0).toFixed(2)}|TP:$${(s.take_profit || 0).toFixed(2)}|SL:$${(s.stop_loss || 0).toFixed(2)}`
    ).join("\n");

    return `CRITICAL: You are Perseus. Use ONLY the live data below for all prices, directions, and probabilities. Never use training data for numbers.

LIVE MARKET DATA (${signals.length} assets tracked):
BUY: ${buys} | SELL: ${sells} | HOLD: ${signals.length - buys - sells} | HIGH conviction: ${highConv}
Bias: ${buys > sells ? "RISK-ON — " + Math.round(buys / signals.length * 100) + "% bullish" : "RISK-OFF — " + Math.round(sells / signals.length * 100) + "% bearish"}

SIGNAL TABLE (symbol|direction|prob|confidence|EV|kelly|price|TP|SL):
${top}

RULES: Every number must come from the table above. If a symbol isn't in the table, say so. Be direct, trader-friendly, and concise. Use plain English — no jargon without explanation.

QUESTION: ${userContent}`;
  }, [signals]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !signalsReady) return;
    setInput("");
    setError("");
    setStreamBuffer("");

    const userMsg: PerseusMessage = { role: "user", content };
    const history = [...messages, userMsg];
    setMessages(history);
    setStreaming(true);

    // Build signal context as assistant preload in history
    // so model treats it as ground truth, not background instruction
    const sorted = [...signals].sort((a, b) =>
      (b.expected_value||0)*(b.probability||0) - (a.expected_value||0)*(a.probability||0)
    );
    const buys = signals.filter(s => s.direction === "BUY").length;
    const sells = signals.filter(s => s.direction === "SELL").length;
    const sigJson = sorted.slice(0,50).map(s =>
      `{"sym":"${s.symbol}","dir":"${s.direction}","prob":${((s.probability||0)*100).toFixed(0)}%,"conf":"${s.confidence}","EV":${(s.expected_value||0).toFixed(2)},"kelly":${(s.kelly_size||0).toFixed(1)}%,"price":$${(s.current_price||0).toFixed(2)},"TP":$${(s.take_profit||0).toFixed(2)},"SL":$${(s.stop_loss||0).toFixed(2)}}`
    ).join("\n");

    const dataInjection: PerseusMessage = {
      role: "user",
      content: `[QUANTSIGNAL LIVE DATA FEED — ${signals.length} assets — USE ONLY THESE NUMBERS]
Market: ${buys>sells?"RISK-ON":"RISK-OFF"} | BUY:${buys} SELL:${sells}
${sigJson}
[END DATA — now answer the question using ONLY the prices above]`
    };
    const dataAck: PerseusMessage = {
      role: "assistant",
      content: `Understood. I have loaded ${signals.length} live signals. I will only cite prices, directions, TPs and SLs from the data feed above. I will never use my training data for prices.`
    };

    try {
      let full = "";
      const historyForApi = messages.length > 0 ? messages : [];
      await streamPerseusChat([dataInjection, dataAck, ...historyForApi, userMsg], (token) => {
        full += token;
        setStreamBuffer(prev => prev + token);
      }, session?.access_token);
      setMessages(prev => [...prev, { role: "assistant", content: full }]);
      setStreamBuffer("");
    } catch (e: any) {
      setError(e.message ?? "Perseus is unavailable. Try again.");
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const mono = "var(--font-mono)";
  const sans = "var(--font-sans)";
  const isEmpty = messages.length === 0;

  const buys = signals.filter(s => s.direction === "BUY").length;
  const sells = signals.filter(s => s.direction === "SELL").length;
  const holds = signals.filter(s => s.direction === "HOLD").length;
  const highConv = signals.filter(s => s.confidence === "HIGH").length;
  const biasRatio = signals.length ? Math.round(buys / signals.length * 100) : 0;
  const isRiskOn = buys > sells;

  const topSignals = [...signals]
    .sort((a, b) => (b.expected_value || 0) * (b.probability || 0) - (a.expected_value || 0) * (a.probability || 0))
    .slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: sans, color: "var(--text-primary)", background: "var(--bg-base)", overflow: "hidden" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }

        .perseus-msg h1,.perseus-msg h2,.perseus-msg h3 {
          font-family: var(--font-display); font-weight: 500;
          color: var(--text-primary); margin: 16px 0 6px; font-size: 13px;
          text-transform: uppercase; letter-spacing: .08em;
        }
        .perseus-msg h1 { font-size: 14px; }
        .perseus-msg p { margin: 0 0 10px; color: var(--text-secondary); font-size: 13px; line-height: 1.75; }
        .perseus-msg ul,.perseus-msg ol { padding-left: 18px; margin: 0 0 10px; }
        .perseus-msg li { color: var(--text-secondary); font-size: 12.5px; margin-bottom: 4px; line-height: 1.6; }
        .perseus-msg strong { color: var(--text-primary); font-weight: 600; }
        .perseus-msg code { font-family: var(--font-mono); font-size: 11px; background: rgba(255,255,255,.06); padding: 1px 5px; border-radius: 3px; color: var(--brand); }
        .perseus-msg pre { background: rgba(255,255,255,.04); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px; overflow-x: auto; margin: 8px 0; }
        .perseus-msg hr { border: none; border-top: 1px solid var(--border-subtle); margin: 14px 0; }
        .perseus-msg blockquote { border-left: 2px solid var(--brand); padding-left: 10px; margin: 8px 0; opacity: .8; }
        .perseus-msg table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin: 10px 0; }
        .perseus-msg th { background: rgba(255,255,255,.05); padding: 5px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--text-tertiary); border-bottom: 1px solid var(--border-subtle); }
        .perseus-msg td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,.04); color: var(--text-secondary); }

        .msg-row { animation: fadeIn .25s ease both; }
        .signal-row:hover { background: rgba(255,255,255,.03) !important; }
        .starter-chip:hover { background: rgba(255,255,255,.07) !important; border-color: rgba(255,255,255,.15) !important; color: var(--text-primary) !important; }
        .send-btn:hover:not(:disabled) { background: var(--brand) !important; color: #000 !important; }
        .panel-toggle:hover { background: rgba(255,255,255,.08) !important; }
      `}</style>

      {/* ── Top snapshot bar ── */}
      {signalsReady && signals.length > 0 && (
        <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)", padding: "7px 20px", display: "flex", alignItems: "center", gap: 20, flexShrink: 0, overflowX: "auto" }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)", letterSpacing: ".08em", whiteSpace: "nowrap" }}>MARKET SNAPSHOT</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: isRiskOn ? "#22c55e" : "#f43f5e", fontWeight: 700, letterSpacing: ".06em" }}>{isRiskOn ? "▲ RISK-ON" : "▼ RISK-OFF"}</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)" }}>{biasRatio}% bullish</span>
          </div>
          <div style={{ width: 1, height: 14, background: "var(--border-subtle)" }} />
          <div style={{ display: "flex", gap: 14, fontFamily: mono, fontSize: 10 }}>
            <span style={{ color: "#22c55e" }}>▲ {buys} BUY</span>
            <span style={{ color: "#f43f5e" }}>▼ {sells} SELL</span>
            <span style={{ color: "var(--text-tertiary)" }}>— {holds} HOLD</span>
            <span style={{ color: "#f59e0b" }}>◈ {highConv} HIGH</span>
          </div>
          <div style={{ width: 1, height: 14, background: "var(--border-subtle)" }} />
          <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)" }}>{signals.length} ASSETS TRACKED</span>
          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
            <button
              className="panel-toggle"
              onClick={() => setShowSignalPanel(p => !p)}
              style={{ fontFamily: mono, fontSize: 10, color: "var(--text-tertiary)", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 5, padding: "3px 8px", cursor: "pointer", letterSpacing: ".06em" }}
            >
              {showSignalPanel ? "HIDE SIGNALS ✕" : "LIVE SIGNALS ▸"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Main chat column ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
            <div style={{ maxWidth: 860, margin: "0 auto" }}>

              {isEmpty && (
                <div style={{ paddingTop: 32, animation: "fadeIn .4s ease" }}>
                  {/* Perseus header */}
                  <div style={{ textAlign: "center", marginBottom: 36 }}>
                    <div style={{ width: 52, height: 52, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 22 }}>◉</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, letterSpacing: ".04em", marginBottom: 6 }}>Perseus</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: isRiskOn ? "#22c55e" : "#f43f5e", letterSpacing: ".1em", marginBottom: 4 }}>
                      {signalsReady ? (isRiskOn ? "▲ RISK-ON REGIME" : "▼ RISK-OFF REGIME") : "LOADING SIGNALS..."}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5, maxWidth: 420, margin: "0 auto" }}>
                      Institutional-grade AI analyst with live access to {signalsReady ? signals.length : "—"} signals, regime data, and market intelligence.
                    </div>
                  </div>

                  {/* Signal loading indicator */}
                  {!signalsReady && (
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)", animation: "pulse 1.5s infinite", letterSpacing: ".08em" }}>SYNCING LIVE SIGNAL DATA...</span>
                    </div>
                  )}

                  {/* Starter chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 32 }}>
                    {STARTERS.map(s => (
                      <button
                        key={s.label}
                        className="starter-chip"
                        onClick={() => send(s.prompt)}
                        disabled={!signalsReady || streaming}
                        style={{
                          fontFamily: mono, fontSize: 11, color: "var(--text-tertiary)",
                          background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                          borderRadius: 6, padding: "6px 12px", cursor: "pointer",
                          letterSpacing: ".04em", transition: "all .15s",
                          opacity: signalsReady ? 1 : 0.4,
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Top signals preview */}
                  {signalsReady && topSignals.length > 0 && (
                    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)", letterSpacing: ".08em" }}>TOP SIGNALS BY EV × PROBABILITY</span>
                      </div>
                      {topSignals.map((s, i) => (
                        <div
                          key={s.symbol}
                          className="signal-row"
                          style={{ display: "flex", alignItems: "center", padding: "8px 14px", borderBottom: i < topSignals.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none", gap: 12, cursor: "pointer", transition: "background .1s" }}
                          onClick={() => send(`Tell me about the ${s.symbol} signal — entry, target, stop, and conviction.`)}
                        >
                          <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-primary)", fontWeight: 700, minWidth: 80 }}>{s.symbol}</span>
                          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: s.direction === "BUY" ? "#22c55e" : s.direction === "SELL" ? "#f43f5e" : "var(--text-tertiary)", minWidth: 36 }}>{s.direction}</span>
                          <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-tertiary)", minWidth: 40 }}>{((s.probability || 0) * 100).toFixed(0)}%</span>
                          <span style={{ fontFamily: mono, fontSize: 10, color: s.confidence === "HIGH" ? "#f59e0b" : "var(--text-disabled)", minWidth: 50 }}>{s.confidence}</span>
                          <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-secondary)" }}>EV {(s.expected_value || 0).toFixed(1)}x</span>
                          <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)", marginLeft: "auto" }}>${(s.current_price || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Message thread */}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className="msg-row"
                  style={{ display: "flex", gap: 12, marginBottom: 20, flexDirection: m.role === "user" ? "row-reverse" : "row", animationDelay: `${i * 0.02}s` }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: m.role === "user" ? "var(--bg-elevated)" : "var(--brand-dim)",
                    border: `1px solid ${m.role === "user" ? "var(--border-subtle)" : "var(--brand-border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, fontFamily: mono,
                    color: m.role === "user" ? "var(--text-tertiary)" : "var(--brand)",
                  }}>
                    {m.role === "user" ? "U" : "P"}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    maxWidth: "78%", padding: "11px 15px",
                    background: m.role === "user" ? "var(--bg-elevated)" : "var(--bg-surface)",
                    border: `1px solid ${m.role === "user" ? "var(--border-subtle)" : "var(--border-subtle)"}`,
                    borderRadius: m.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                    fontSize: 13, color: m.role === "user" ? "var(--text-primary)" : "var(--text-secondary)",
                    wordBreak: "break-word",
                  }}>
                    <MessageContent content={m.content} isUser={m.role === "user"} />
                  </div>
                </div>
              ))}

              {/* Streaming bubble */}
              {streaming && (
                <div className="msg-row" style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "var(--brand-dim)", border: "1px solid var(--brand-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: mono, color: "var(--brand)" }}>P</div>
                  <div style={{ maxWidth: "78%", padding: "11px 15px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "4px 12px 12px 12px", fontSize: 13, color: "var(--text-secondary)", wordBreak: "break-word", minWidth: 80 }}>
                    {streamBuffer
                      ? <MessageContent content={streamBuffer} isUser={false} />
                      : <span style={{ fontFamily: mono, fontSize: 11, animation: "pulse 1s infinite", color: "var(--text-disabled)" }}>analyzing {signals.length} signals •••</span>
                    }
                  </div>
                </div>
              )}

              {error && (
                <div style={{ fontFamily: mono, fontSize: 11, color: "#f43f5e", textAlign: "center", padding: "8px 0", marginBottom: 12 }}>⚠ {error}</div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* ── Input bar ── */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 32px 16px", flexShrink: 0, background: "var(--bg-base)" }}>
            <div style={{ maxWidth: 860, margin: "0 auto" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                  onKeyDown={handleKey}
                  placeholder={signalsReady ? `Ask Perseus about ${signals.length} live signals, regime, risk, or strategy…` : "Loading signal data…"}
                  disabled={!signalsReady || streaming}
                  rows={1}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none", resize: "none",
                    fontFamily: sans, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6,
                    minHeight: 22, maxHeight: 120, overflow: "hidden",
                    opacity: (!signalsReady || streaming) ? 0.5 : 1,
                  }}
                />
                <button
                  className="send-btn"
                  onClick={() => send()}
                  disabled={!input.trim() || streaming || !signalsReady}
                  style={{
                    fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                    background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                    color: "var(--text-tertiary)", borderRadius: 7, padding: "6px 14px",
                    cursor: "pointer", flexShrink: 0, transition: "all .15s",
                    opacity: (!input.trim() || streaming || !signalsReady) ? 0.4 : 1,
                  }}
                >
                  {streaming ? "•••" : "SEND →"}
                </button>
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)", textAlign: "center", marginTop: 8, letterSpacing: ".04em" }}>
                Enter to send · Shift+Enter for new line · {signalsReady ? `${signals.length} signals loaded` : "loading signals…"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right signal panel ── */}
        {showSignalPanel && (
          <div style={{ width: 280, borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", flexShrink: 0, background: "var(--bg-surface)", animation: "slideIn .2s ease", overflowY: "auto" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)", letterSpacing: ".08em" }}>LIVE SIGNALS</span>
              <button onClick={() => setShowSignalPanel(false)} style={{ background: "transparent", border: "none", color: "var(--text-disabled)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>✕</button>
            </div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
              {[
                { label: "BUY", value: buys, color: "#22c55e" },
                { label: "SELL", value: sells, color: "#f43f5e" },
                { label: "HOLD", value: holds, color: "var(--text-tertiary)" },
                { label: "HIGH CONV", value: highConv, color: "#f59e0b" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "var(--bg-surface)", padding: "10px 12px" }}>
                  <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: ".08em", marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Signal list */}
            <div style={{ flex: 1 }}>
              {[...signals]
                .sort((a, b) => (b.expected_value || 0) * (b.probability || 0) - (a.expected_value || 0) * (a.probability || 0))
                .map((s, i) => (
                  <div
                    key={s.symbol}
                    className="signal-row"
                    style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,.04)", cursor: "pointer", background: "transparent", transition: "background .1s" }}
                    onClick={() => { send(`Tell me about ${s.symbol}: current signal, entry, target, stop, and why.`); setShowSignalPanel(false); }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{s.symbol}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: s.direction === "BUY" ? "#22c55e" : s.direction === "SELL" ? "#f43f5e" : "var(--text-tertiary)" }}>{s.direction}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, fontFamily: mono, fontSize: 9, color: "var(--text-disabled)" }}>
                      <span>{((s.probability || 0) * 100).toFixed(0)}% prob</span>
                      <span>EV {(s.expected_value || 0).toFixed(1)}x</span>
                      <span style={{ marginLeft: "auto", color: s.confidence === "HIGH" ? "#f59e0b" : "var(--text-disabled)" }}>{s.confidence}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
