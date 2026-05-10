"use client";
import { useState, useRef, useEffect } from "react";
import { marked } from "marked";
import { streamPerseusChat, type PerseusMessage } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const API = "https://quantsignal-api.onrender.com/api/v1";

const STARTERS = [
  { label: "TOP CONVICTION", prompt: "What are the 3 highest-conviction signals right now? Give me direction, price, TP, SL, and why.", icon: "◆" },
  { label: "MARKET REGIME", prompt: "What is the current market regime? Is it risk-on or risk-off? What trades does it favour?", icon: "◑" },
  { label: "BEST LONG/SHORT", prompt: "Give me the single best long idea and single best short idea right now, side by side.", icon: "⇅" },
  { label: "MORNING BRIEF", prompt: "Give me a morning briefing: regime, top 3 buys, top 3 sells, key risks today.", icon: "▣" },
  { label: "AVOID TODAY", prompt: "Which assets should I avoid trading today and why?", icon: "⊘" },
  { label: "BTC vs ETH", prompt: "Compare BTC and ETH: probability, regime fit, risk/reward, and which to prefer now.", icon: "◎" },
];

marked.setOptions({ breaks: true });

function MsgContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  const html = marked.parse(content) as string;
  return <div dangerouslySetInnerHTML={{ __html: html }} className="perseus-prose" />;
}

function DirPill({ dir }: { dir: string }) {
  const c = dir === "BUY" ? "#00ff88" : dir === "SELL" ? "#ff4466" : "rgba(255,255,255,0.25)";
  return (
    <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.1em", padding: "2px 6px", borderRadius: 3, border: `1px solid ${c}44`, color: c, fontFamily: "var(--font-mono)" }}>
      {dir}
    </span>
  );
}

export default function AgentsPage() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<PerseusMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState("");
  const [signals, setSignals] = useState<any[]>([]);
  const [signalsReady, setSignalsReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${API}/signals`, { headers: { Accept: "application/json" } })
      .then(r => r.json())
      .then(d => { setSignals(Array.isArray(d) ? d : []); setSignalsReady(true); })
      .catch(() => setSignalsReady(true));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamBuffer]);

  const buys = signals.filter(s => s.direction === "BUY").length;
  const sells = signals.filter(s => s.direction === "SELL").length;
  const highConv = signals.filter(s => s.confidence === "HIGH").length;
  const bias = signals.length ? (buys > sells ? "RISK-ON" : "RISK-OFF") : "—";
  const biasColor = bias === "RISK-ON" ? "#00ff88" : bias === "RISK-OFF" ? "#ff4466" : "rgba(255,255,255,0.3)";
  const topSignals = [...signals]
    .sort((a, b) => ((b.expected_value || 0) * (b.probability || 0)) - ((a.expected_value || 0) * (a.probability || 0)))
    .slice(0, 5);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !signalsReady) return;
    setInput(""); setError(""); setStreamBuffer("");

    const sorted = [...signals].sort((a, b) =>
      ((b.expected_value || 0) * (b.probability || 0)) - ((a.expected_value || 0) * (a.probability || 0)));
    const top = sorted.slice(0, 40).map((s: any) =>
      `${s.symbol}|${s.direction}|${Math.round((s.probability || 0) * 100)}%|${s.confidence}|EV:${(s.expected_value || 0).toFixed(1)}|K:${(s.kelly_size || 0).toFixed(1)}%|$${(s.current_price || 0).toFixed(2)}|TP:$${(s.take_profit || 0).toFixed(2)}|SL:$${(s.stop_loss || 0).toFixed(2)}`
    ).join("\n");

    const systemCtx = signals.length > 0 ? `CRITICAL: You are Perseus, QuantSignal's AI analyst. Use ONLY the live data below for prices, directions, probabilities. Never invent numbers.

LIVE DATA — ${signals.length} assets | BUY:${buys} SELL:${sells} HOLD:${signals.length - buys - sells} | HIGH:${highConv} | Bias:${bias}

FORMAT: symbol|direction|prob%|confidence|EV|kelly|price|TP|SL
${top}

RULES: Every price cited MUST match the price column. Be concise, specific, trader-focused.

QUESTION: ` : "";

    const userMsg: PerseusMessage = { role: "user", content: systemCtx + content };
    setMessages(prev => [...prev, { role: "user", content }]);
    setStreaming(true);

    try {
      let full = "";
      await streamPerseusChat([...messages, userMsg], (token) => {
        full += token;
        setStreamBuffer(prev => prev + token);
      }, session?.access_token);
      setMessages(prev => [...prev, { role: "assistant", content: full }]);
      setStreamBuffer("");
    } catch (e: any) {
      setError(e.message ?? "Perseus unavailable. Try again.");
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

  return (
    <div className="qs-agents-shell" style={{ display: "flex", height: "100%", fontFamily: sans, color: "var(--text-primary)", background: "var(--bg-base)", overflow: "hidden" }}>
      <style>{`
        .perseus-prose{font-size:13px;line-height:1.75;color:var(--text-secondary)}
        .perseus-prose h1,.perseus-prose h2,.perseus-prose h3{font-family:var(--font-display);font-weight:400;color:var(--text-primary);margin:14px 0 6px}
        .perseus-prose h2{font-size:14px;border-bottom:1px solid var(--border-subtle);padding-bottom:5px}
        .perseus-prose p{margin:0 0 8px}
        .perseus-prose ul,.perseus-prose ol{padding-left:18px;margin:0 0 8px}
        .perseus-prose li{margin-bottom:3px}
        .perseus-prose strong{color:var(--text-primary);font-weight:600}
        .perseus-prose code{font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);padding:1px 5px;border-radius:3px}
        .perseus-prose hr{border:none;border-top:1px solid var(--border-subtle);margin:12px 0}
        .starter:hover{background:rgba(255,255,255,0.06)!important;border-color:rgba(255,255,255,0.15)!important}
        .sig-row:hover{background:rgba(255,255,255,0.05)!important;cursor:pointer}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* LEFT PANEL */}
      <div className="qs-agents-left-panel" style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", background: "var(--bg-surface)", overflow: "hidden" }}>

        {/* Perseus header */}
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#00ff88" }}>◉</div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>Perseus</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#00ff88" }} />
                <span style={{ fontSize: 8, color: "#00ff88", fontFamily: mono, letterSpacing: "0.1em" }}>ONLINE</span>
              </div>
            </div>
          </div>

          {/* Bias bar */}
          <div style={{ background: "var(--bg-elevated)", borderRadius: 6, padding: "7px 9px" }}>
            <div style={{ fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 4 }}>MARKET BIAS</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: biasColor }}>{bias}</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)" }}>{signals.length > 0 ? `${Math.round(buys / signals.length * 100)}% bull` : "—"}</span>
            </div>
            {signals.length > 0 && (
              <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(buys / signals.length * 100)}%`, background: biasColor, borderRadius: 1 }} />
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
            {[{ l: "BUY", v: buys, c: "#00ff88" }, { l: "SELL", v: sells, c: "#ff4466" }, { l: "HIGH", v: highConv, c: "#f59e0b" }].map(({ l, v, c }) => (
              <div key={l} style={{ background: "var(--bg-elevated)", borderRadius: 5, padding: "5px 6px", textAlign: "center" }}>
                <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: c }}>{signalsReady ? v : "—"}</div>
                <div style={{ fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.08em" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top signals */}
        <div style={{ flex: 1, overflow: "hidden", padding: "8px 12px 6px" }}>
          <div style={{ fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 6 }}>TOP SIGNALS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {!signalsReady ? [1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 30, background: "var(--bg-elevated)", borderRadius: 4, opacity: 0.3 }} />
            )) : topSignals.map((s: any) => (
              <div key={s.symbol} className="sig-row" onClick={() => send(`Tell me about ${s.symbol}: direction, price, TP, SL, conviction, and what's driving it.`)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 7px", background: "var(--bg-elevated)", borderRadius: 4, transition: "background 0.1s" }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: "var(--text-primary)" }}>{s.display || s.symbol}</div>
                  <div style={{ fontSize: 7, color: "var(--text-disabled)" }}>${(s.current_price || 0).toFixed(1)}</div>
                </div>
                <DirPill dir={s.direction} />
              </div>
            ))}
          </div>
        </div>

        {/* Context status */}
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 8, color: signalsReady && signals.length > 0 ? "#00ff88" : "var(--text-disabled)", fontFamily: mono, display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: signalsReady && signals.length > 0 ? "#00ff88" : "rgba(255,255,255,0.15)" }} />
            {signalsReady ? `${signals.length} signals in context` : "Loading context…"}
          </div>
        </div>
      </div>

      {/* MAIN CHAT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Top bar */}
        <div style={{ padding: "11px 22px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.14em" }}>AI AGENTS</span>
            <span style={{ color: "var(--border-subtle)" }}>·</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>Perseus Intelligence Layer</span>
          </div>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setStreamBuffer(""); setError(""); }}
              style={{ fontSize: 9, color: "var(--text-disabled)", background: "none", border: "none", cursor: "pointer", fontFamily: mono, letterSpacing: "0.08em" }}>
              CLEAR
            </button>
          )}
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 22px" }}>
          {isEmpty ? (
            <div style={{ paddingTop: 40, paddingBottom: 20, maxWidth: 680, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, margin: "0 auto 12px", background: "rgba(0,255,136,0.07)", border: "1px solid rgba(0,255,136,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#00ff88" }}>◉</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 400, marginBottom: 5 }}>Perseus</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", maxWidth: 380, margin: "0 auto", lineHeight: 1.6 }}>
                  Institutional-grade market intelligence grounded in live signals, regime analysis, and real-time market structure.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {STARTERS.map(({ label, prompt, icon }) => (
                  <button key={label} className="starter" onClick={() => send(prompt)}
                    style={{ padding: "11px 13px", textAlign: "left", cursor: "pointer", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 7, transition: "all 0.12s", color: "var(--text-primary)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: "#00ff88" }}>{icon}</span>
                      <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-secondary)" }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{prompt.slice(0, 58)}…</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 780, margin: "0 auto", paddingTop: 20, paddingBottom: 12, display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "fadein 0.2s ease" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, fontFamily: mono, background: msg.role === "user" ? "var(--bg-elevated)" : "rgba(0,255,136,0.08)", border: `1px solid ${msg.role === "user" ? "var(--border-subtle)" : "rgba(0,255,136,0.18)"}`, color: msg.role === "user" ? "var(--text-tertiary)" : "#00ff88" }}>
                    {msg.role === "user" ? "U" : "P"}
                  </div>
                  <div style={{ flex: 1, padding: "9px 13px", borderRadius: 9, background: msg.role === "user" ? "var(--bg-surface)" : "transparent", border: msg.role === "user" ? "1px solid var(--border-subtle)" : "none", minWidth: 0 }}>
                    <MsgContent content={msg.content} isUser={msg.role === "user"} />
                  </div>
                </div>
              ))}

              {streaming && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "fadein 0.2s ease" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, fontFamily: mono, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.18)", color: "#00ff88" }}>P</div>
                  <div style={{ flex: 1, padding: "9px 13px" }}>
                    {streamBuffer
                      ? <div className="perseus-prose" dangerouslySetInnerHTML={{ __html: marked.parse(streamBuffer) as string }} />
                      : <div style={{ display: "flex", gap: 4, paddingTop: 3 }}>
                          {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#00ff88", opacity: 0.5, animation: `blink 1.2s ${i*0.2}s ease-in-out infinite` }} />)}
                        </div>
                    }
                  </div>
                </div>
              )}

              {error && <div style={{ padding: "8px 12px", background: "rgba(255,68,102,0.06)", border: "1px solid rgba(255,68,102,0.2)", borderRadius: 7, fontSize: 11, color: "#ff4466" }}>{error}</div>}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "14px 22px 18px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 9, padding: "9px 11px" }}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={signalsReady ? `Ask Perseus about ${signals.length} live signals…` : "Loading signal context…"}
                disabled={!signalsReady} rows={1}
                style={{ flex: 1, background: "transparent", border: "none", resize: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: sans, lineHeight: 1.5, maxHeight: 100, overflowY: "auto", padding: 0, outline: "none" }}
                onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 100) + "px"; }}
              />
              <button onClick={() => send()} disabled={streaming || !input.trim() || !signalsReady}
                style={{ padding: "6px 14px", borderRadius: 6, flexShrink: 0, background: input.trim() && !streaming ? "var(--brand)" : "var(--bg-elevated)", border: "1px solid", borderColor: input.trim() && !streaming ? "var(--brand)" : "var(--border-default)", color: input.trim() && !streaming ? "#000" : "var(--text-disabled)", fontSize: 10, fontFamily: mono, fontWeight: 700, cursor: streaming ? "not-allowed" : "pointer", transition: "all 0.12s", letterSpacing: "0.06em" }}>
                {streaming ? "…" : "SEND →"}
              </button>
            </div>
            <div style={{ marginTop: 5, fontSize: 8, color: "var(--text-disabled)", textAlign: "center", fontFamily: mono, letterSpacing: "0.06em" }}>
              ENTER TO SEND · SHIFT+ENTER NEW LINE · NOT FINANCIAL ADVICE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
