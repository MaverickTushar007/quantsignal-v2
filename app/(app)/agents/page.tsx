"use client";
import { useState, useRef, useEffect } from "react";
import { marked } from "marked";
import { streamPerseusChat, type PerseusMessage } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const STARTERS = [
  "What's the highest conviction signal right now?",
  "Explain the current market regime",
  "Which assets should I avoid today?",
  "Compare BTC and ETH signals",
  "What does the buy/sell bias tell us?",
  "Give me a morning briefing",
];

marked.setOptions({ breaks: true });

function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  const html = marked.parse(content) as string;
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ lineHeight: 1.7 }}
    />
  );
}

export default function AgentsPage() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<PerseusMessage[]>([]);
  const [input, setInput]       = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError]       = useState("");
  const [signals, setSignals]   = useState<any[]>([]);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://quantsignal-api.onrender.com/api/v1"}/signals`)
      .then(r => r.json()).then(setSignals).catch(() => {});
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamBuffer]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput(""); setError(""); setStreamBuffer("");
    const top = signals.slice(0,40).map((s:any) => 
      `${s.symbol} (${s.name||s.symbol}): ${s.direction} | prob=${(s.probability*100).toFixed(1)}% | conf=${s.confidence} | EV=${s.expected_value?.toFixed(2)}x | kelly=${s.kelly_size?.toFixed(1)}% | price=$${s.current_price?.toFixed(2)} | tp=$${s.take_profit?.toFixed(2)} | sl=$${s.stop_loss?.toFixed(2)} | type=${s.type}`
    ).join("\n");
    const buys = signals.filter((s:any)=>s.direction==="BUY").length;
    const sells = signals.filter((s:any)=>s.direction==="SELL").length;
    const highConv = signals.filter((s:any)=>s.confidence==="HIGH").length;
    const systemCtx = signals.length > 0 ? `You are Perseus, QuantSignal's institutional-grade AI analyst. You have access to LIVE signal data for ${signals.length} assets. Be specific, cite actual symbols and numbers from the data. Be concise and trader-friendly.

LIVE MARKET SNAPSHOT:
- Total signals: ${signals.length} | BUY: ${buys} | SELL: ${sells} | HIGH conviction: ${highConv}
- Market bias: ${buys > sells ? "RISK-ON ("+Math.round(buys/signals.length*100)+"% bullish)" : "RISK-OFF ("+Math.round(sells/signals.length*100)+"% bearish)"}

TOP 40 SIGNALS (symbol | direction | probability | confidence | expected value | kelly size | price | take profit | stop loss | asset type):
${top}

Rules: Always cite specific symbols and numbers. Never say "data not available" for fields above. Be direct and actionable. Format responses clearly with sections.

USER QUESTION: ` : "";
    const userMsg: PerseusMessage = { role: "user", content: systemCtx + content };
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setStreaming(true);
    try {
      let full = "";
      await streamPerseusChat(history, (token) => {
        full += token;
        setStreamBuffer(prev => prev + token);
      }, session?.access_token);
      setMessages(prev => [...prev, { role: "assistant", content: full }]);
      setStreamBuffer("");
    } catch (e: any) {
      setError(e.message ?? "Perseus is unavailable");
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const sans    = "var(--font-sans)";
  const mono    = "var(--font-mono)";
  const display = "var(--font-display)";
  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: sans, color: "var(--text-primary)", background: "var(--bg-base)" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        .perseus-msg h1,.perseus-msg h2,.perseus-msg h3{
          font-family:var(--font-display);font-weight:400;
          color:var(--text-primary);margin:14px 0 6px;font-size:15px;
        }
        .perseus-msg h2{font-size:14px;}
        .perseus-msg h3{font-size:13px;font-family:var(--font-sans);font-weight:600;}
        .perseus-msg p{margin:0 0 10px;}
        .perseus-msg p:last-child{margin-bottom:0;}
        .perseus-msg strong{color:var(--text-primary);font-weight:700;}
        .perseus-msg em{color:var(--text-secondary);}
        .perseus-msg ul,.perseus-msg ol{margin:6px 0 10px;padding-left:18px;}
        .perseus-msg li{margin-bottom:4px;color:var(--text-secondary);}
        .perseus-msg code{font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);padding:1px 5px;border-radius:3px;}
        .perseus-msg hr{border:none;border-top:1px solid var(--border-subtle);margin:12px 0;}
        .perseus-msg a{color:var(--brand);text-decoration:none;}
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 4 }}>AI AGENTS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: display, fontSize: 22, fontWeight: 400 }}>Perseus</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--brand-dim)", border: "1px solid var(--brand-border)", borderRadius: 3, padding: "3px 8px" }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand)" }} />
            <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: "var(--brand)", letterSpacing: "0.1em" }}>ONLINE</span>
          </div>
        </div>
        <div style={{ height: 1, background: "var(--border-subtle)" }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
        {isEmpty && !streaming ? (
          <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 40 }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ width: 48, height: 48, background: "var(--brand-dim)", border: "1px solid var(--brand-border)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 20 }}>◉</div>
              <div style={{ fontFamily: display, fontSize: 20, marginBottom: 8 }}>Ask Perseus anything</div>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6 }}>Your AI analyst with live access to signals, regime data, and market intelligence.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  textAlign: "left", padding: "12px 16px",
                  background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)", color: "var(--text-secondary)",
                  fontSize: 13, fontFamily: sans, cursor: "pointer", transition: "border-color 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-default)")}
                >{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: mono,
                  background: m.role === "user" ? "var(--bg-elevated)" : "var(--brand-dim)",
                  border: m.role === "user" ? "1px solid var(--border-default)" : "1px solid var(--brand-border)",
                  color: m.role === "user" ? "var(--text-tertiary)" : "var(--brand)",
                }}>{m.role === "user" ? "U" : "P"}</div>
                <div className={m.role === "assistant" ? "perseus-msg" : ""} style={{
                  maxWidth: "78%", padding: "12px 16px", borderRadius: "var(--radius-lg)",
                  background: m.role === "user" ? "var(--bg-elevated)" : "var(--bg-surface)",
                  border: m.role === "user" ? "1px solid var(--border-default)" : "1px solid var(--border-subtle)",
                  fontSize: 13, color: "var(--text-secondary)", wordBreak: "break-word",
                }}>
                  <MessageContent content={m.content} isUser={m.role === "user"} />
                </div>
              </div>
            ))}

            {streaming && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-dim)", border: "1px solid var(--brand-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: mono, color: "var(--brand)", flexShrink: 0 }}>P</div>
                <div className="perseus-msg" style={{ maxWidth: "78%", padding: "12px 16px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", fontSize: 13, color: "var(--text-secondary)", wordBreak: "break-word" }}>
                  {streamBuffer ? (
                    <>
                      <MessageContent content={streamBuffer} isUser={false} />
                      <span style={{ animation: "blink 1s step-end infinite", color: "var(--brand)" }}>▌</span>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "2px 0" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand)", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && <div style={{ padding: "10px 14px", background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)", borderRadius: "var(--radius-md)", fontSize: 12, color: "#ff4d6d" }}>{error}</div>}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "16px 28px 20px", flexShrink: 0, borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Ask Perseus about signals, regime, risk, or strategy…" rows={1}
            style={{ flex: 1, padding: "11px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: 13, fontFamily: sans, outline: "none", resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }} />
          <button onClick={() => send()} disabled={!input.trim() || streaming} style={{
            padding: "11px 18px", background: input.trim() && !streaming ? "var(--brand)" : "var(--bg-elevated)",
            border: "1px solid", borderColor: input.trim() && !streaming ? "var(--brand)" : "var(--border-default)",
            borderRadius: "var(--radius-md)", color: input.trim() && !streaming ? "#000" : "var(--text-disabled)",
            fontSize: 12, fontWeight: 600, fontFamily: sans, cursor: input.trim() && !streaming ? "pointer" : "not-allowed", transition: "all 0.15s", flexShrink: 0,
          }}>{streaming ? "…" : "Send →"}</button>
        </div>
        <div style={{ maxWidth: 1100, margin: "8px auto 0", fontSize: 10, color: "var(--text-disabled)", textAlign: "center" }}>Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  );
}
