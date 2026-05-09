"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchSignals, fetchHealth, type Signal } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const DIR_COLOR: Record<string, string> = {
  BUY:  "#00ff88",
  SELL: "#ff4d6d",
  HOLD: "rgba(226,232,240,0.35)",
};
const CONF_COLOR: Record<string, string> = {
  HIGH:   "#00ff88",
  MEDIUM: "#f59e0b",
  LOW:    "#ff4d6d",
};
const CATEGORIES = ["ALL","CRYPTO","STOCK","IN_STOCK","FOREX","COMMODITY","ETF","INDEX"] as const;
type Category = typeof CATEGORIES[number];
type DirFilter = "ALL"|"BUY"|"SELL"|"HOLD";

const CAT_LABEL: Record<string, string> = {
  CRYPTO: "Crypto", STOCK: "US Stocks", IN_STOCK: "India", FOREX: "Forex",
  COMMODITY: "Commodities", ETF: "ETFs", INDEX: "Indices",
};

function Skeleton({ h, radius }: { h: number; radius?: string }) {
  return <div style={{ height: h, background: "var(--bg-elevated)", borderRadius: radius ?? "var(--radius-md)", animation: "pulse 1.6s ease-in-out infinite" }} />;
}

function ProbBar({ prob, dir }: { prob: number; dir: string }) {
  const pct = Math.round(prob * 100);
  const color = dir === "BUY" ? "#00ff88" : dir === "SELL" ? "#ff4d6d" : "#f59e0b";
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  );
}

// ── Signal Detail Drawer ──────────────────────────────────────────────────────
function SignalDrawer({ s, onClose, userEmail }: { s: Signal | null; onClose: () => void; userEmail?: string }) {
  useEffect(() => {
    if (!s) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [s, onClose]);

  const mono = "var(--font-mono)";
  const sans = "var(--font-sans)";
  const display = "var(--font-display)";
  const [alertOpen,   setAlertOpen]   = useState(false);
  const [alertEmail,  setAlertEmail]  = useState(userEmail ?? "");
  const [alertStatus, setAlertStatus] = useState<"idle"|"loading"|"ok"|"err">("idle");

  async function subscribeAlert() {
    if (!alertEmail) return;
    setAlertStatus("loading");
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
      const res = await fetch(apiBase + "/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: alertEmail, symbols: [s!.symbol], directions: ["BUY","SELL"] }),
      });
      if (res.ok) setAlertStatus("ok");
      else setAlertStatus("err");
    } catch { setAlertStatus("err"); }
  }

  if (!s) return null;

  const dirColor  = DIR_COLOR[s.direction]  ?? "rgba(226,232,240,0.35)";
  const confColor = CONF_COLOR[s.confidence?.toUpperCase?.()] ?? "#f59e0b";
  const pct       = Math.round((s.probability ?? 0) * 100);
  const isHigh    = s.confidence?.toUpperCase() === "HIGH";

  const price     = s.current_price ?? 0;
  const decimals   = price < 1 ? 4 : price < 10 ? 3 : 2;
  const stopLoss  = s.stop_loss  ?? (s.direction === "BUY"  ? price * 0.97 : price * 1.03);
  const takeProfit = s.take_profit ?? (s.direction === "BUY" ? price * 1.06 : price * 0.94);
  const entryLow  = s.entry_low  ?? (s.direction === "BUY"  ? price * 0.995 : price * 1.005);
  const entryHigh = s.entry_high ?? (s.direction === "BUY"  ? price * 1.005 : price * 0.995);
  const rr        = Math.abs(takeProfit - price) / Math.abs(price - stopLoss);
  const changePct = s.price_change_pct ?? null;

  const headerBg = s.direction === "BUY"
    ? "linear-gradient(135deg, rgba(0,255,136,0.10) 0%, rgba(0,0,0,0) 60%)"
    : s.direction === "SELL"
    ? "linear-gradient(135deg, rgba(255,77,109,0.10) 0%, rgba(0,0,0,0) 60%)"
    : "transparent";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          zIndex: 998, backdropFilter: "blur(2px)",
          animation: "fadeIn 0.18s ease",
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: "var(--bg-base)", borderLeft: `1px solid ${dirColor}33`,
        zIndex: 999, overflowY: "auto", display: "flex", flexDirection: "column",
        animation: "slideIn 0.22s cubic-bezier(0.32,0.72,0,1)",
        fontFamily: sans,
      }}>

        {/* Header */}
        <div style={{ background: headerBg, borderBottom: `1px solid ${dirColor}22`, padding: "20px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, background: "var(--bg-elevated)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontFamily: display, fontSize: 22, fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.2 }}>{s.name}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{s.display} · {s.type === "IN_STOCK" ? "INDIA" : s.type} · {s.timeframe ?? "4H"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setAlertOpen(o => !o); setAlertStatus("idle"); }} style={{ background: alertOpen ? "rgba(245,158,11,0.15)" : "var(--bg-elevated)", border: `1px solid ${alertOpen ? "rgba(245,158,11,0.4)" : "var(--border-subtle)"}`, borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>🔔</button>
              <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 14, flexShrink: 0 }}>✕</button>
            </div>
          </div>

          {/* Direction + Price row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                fontFamily: mono, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em",
                color: s.direction === "HOLD" ? "rgba(226,232,240,0.6)" : "#000",
                background: s.direction === "BUY" ? "#00ff88" : s.direction === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.18)",
                borderRadius: 4, padding: "5px 12px",
              }}>{s.direction}</div>
              <div style={{
                fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                color: isHigh ? dirColor : confColor,
                background: isHigh ? `${dirColor}15` : "var(--bg-elevated)",
                border: `1px solid ${isHigh ? dirColor + "44" : "var(--border-subtle)"}`,
                borderRadius: 4, padding: "4px 10px",
              }}>{s.confidence?.toUpperCase()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {changePct !== null && (
                <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: changePct >= 0 ? "#00ff88" : "#ff4d6d", textAlign: "right" }}>
                  {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}% today
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert subscribe panel */}
        {alertOpen && (
          <div style={{ padding: "14px 24px", background: "rgba(245,158,11,0.06)", borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(245,158,11,0.7)", letterSpacing: "0.14em", marginBottom: 10 }}>🔔 ALERT ON SIGNAL CHANGE</div>
            {alertStatus === "ok" ? (
              <div style={{ fontFamily: mono, fontSize: 11, color: "#00ff88" }}>✓ Alert set for {s.display}. We'll email you when direction changes.</div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="email"
                  value={alertEmail}
                  onChange={e => setAlertEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{ flex: 1, padding: "6px 10px", background: "var(--bg-elevated)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 11, fontFamily: sans, outline: "none" }}
                />
                <button
                  onClick={subscribeAlert}
                  disabled={alertStatus === "loading"}
                  style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", padding: "6px 14px", background: "#f59e0b", color: "#000", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap" }}
                >{alertStatus === "loading" ? "..." : "SET ALERT"}</button>
              </div>
            )}
            {alertStatus === "err" && <div style={{ fontFamily: mono, fontSize: 9, color: "#ff4d6d", marginTop: 6 }}>Failed to set alert. Try again.</div>}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

          {/* Probability */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.14em", marginBottom: 12 }}>SIGNAL STRENGTH</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 36, fontWeight: 700, color: dirColor, lineHeight: 1 }}>{pct}%</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>probability</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: "var(--text-secondary)" }}>{s.kelly_size?.toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>kelly size</div>
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: dirColor, borderRadius: 3, transition: "width 0.6s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)" }}>0%</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)" }}>50%</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)" }}>100%</span>
            </div>
          </div>

          {/* Trade levels */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.14em", marginBottom: 14 }}>TRADE LEVELS</div>

            {/* Visual price ladder */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              {[
                { label: "TAKE PROFIT", display: `$${takeProfit.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:decimals})}`, color: "#00ff88", icon: "▲" },
                { label: "ENTRY ZONE",  display: `$${entryLow.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:decimals})} – $${entryHigh.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:decimals})}`, color: dirColor, icon: "◆" },
                { label: "STOP LOSS",   display: `$${stopLoss.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:decimals})}`, color: "#ff4d6d", icon: "▼" },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: i === 1 ? `${dirColor}0d` : "var(--bg-elevated)", borderRadius: "var(--radius-sm)", marginBottom: 4, border: i === 1 ? `1px solid ${dirColor}22` : "1px solid transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: row.color }}>{row.icon}</span>
                    <span style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em" }}>{row.label}</span>
                  </div>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: row.color }}>{row.display}</span>
                </div>
              ))}
            </div>

            {/* R:R */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                <div style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em", marginBottom: 4 }}>RISK / REWARD</div>
                <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: rr >= 2 ? "#00ff88" : rr >= 1.5 ? "#f59e0b" : "#ff4d6d" }}>1 : {rr.toFixed(1)}</div>
              </div>
              <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                <div style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em", marginBottom: 4 }}>TIMEFRAME</div>
                <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{s.timeframe ?? "4H"}</div>
              </div>
              <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                <div style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em", marginBottom: 4 }}>ASSET CLASS</div>
                <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{s.type === "IN_STOCK" ? "INDIA" : s.type}</div>
              </div>
            </div>
          </div>

          {/* Reasoning */}
          {s.reasoning && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
              <div style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.14em", marginBottom: 10 }}>SIGNAL REASONING</div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{s.reasoning}</p>
            </div>
          )}

          {/* Indicators */}
          {s.indicators && Object.keys(s.indicators).length > 0 && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
              <div style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.14em", marginBottom: 12 }}>TECHNICAL INDICATORS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(s.indicators).map(([key, val]) => (
                  <div key={key} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
                    <div style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.08em", marginBottom: 3 }}>{key.toUpperCase()}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{String(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invalidation */}
          <div style={{ background: "rgba(255,77,109,0.04)", border: "1px solid rgba(255,77,109,0.15)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,77,109,0.5)", letterSpacing: "0.14em", marginBottom: 8 }}>INVALIDATION</div>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
              Signal degrades if probability drops below 55% or direction flips on next refresh. Exit immediately if price breaches stop loss.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}

// ── Signal Card ───────────────────────────────────────────────────────────────
function SignalCard({ s, featured, onClick }: { s: Signal; featured?: boolean; onClick: (s: Signal) => void }) {
  const dirColor  = DIR_COLOR[s.direction]  ?? "rgba(226,232,240,0.35)";
  const confColor = CONF_COLOR[s.confidence?.toUpperCase?.()] ?? "#f59e0b";
  const pct       = Math.round((s.probability ?? 0) * 100);
  const isHigh    = s.confidence?.toUpperCase() === "HIGH";

  const headerBg = s.direction === "BUY"
    ? "linear-gradient(135deg, rgba(0,255,136,0.12) 0%, rgba(0,255,136,0.04) 100%)"
    : s.direction === "SELL"
    ? "linear-gradient(135deg, rgba(255,77,109,0.12) 0%, rgba(255,77,109,0.04) 100%)"
    : "rgba(255,255,255,0.02)";

  const borderColor = s.direction === "BUY"
    ? `rgba(0,255,136,${isHigh ? "0.35" : "0.15"})`
    : s.direction === "SELL"
    ? `rgba(255,77,109,${isHigh ? "0.35" : "0.15"})`
    : "var(--border-default)";

  const changePct = s.price_change_pct ?? null;

  return (
    <div
      onClick={() => onClick(s)}
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s",
        gridColumn: featured ? "span 2" : undefined,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = dirColor + "66";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${dirColor}0f`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Color-flood header */}
      <div style={{ background: headerBg, borderBottom: `1px solid ${borderColor}`, padding: featured ? "14px 18px" : "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: featured ? 30 : 24, height: featured ? 30 : 24, background: "var(--bg-elevated)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: featured ? 14 : 11, color: "var(--text-secondary)", flexShrink: 0 }}>{s.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: featured ? 13 : 11, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.display}</div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0, marginLeft: 8 }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: featured ? 10 : 8, fontWeight: 800,
            color: s.direction === "HOLD" ? "rgba(226,232,240,0.6)" : "#000",
            background: s.direction === "BUY" ? "#00ff88" : s.direction === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.18)",
            borderRadius: 3, padding: featured ? "4px 10px" : "3px 7px", letterSpacing: "0.1em"
          }}>{s.direction}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.08em" }}>{s.type === "IN_STOCK" ? "INDIA" : s.type}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: featured ? "14px 18px" : "11px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Price row */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: featured ? 19 : 15, fontWeight: 700, color: "var(--text-primary)" }}>
            ${s.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {changePct !== null && (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
              color: changePct >= 0 ? "#00ff88" : "#ff4d6d",
              background: changePct >= 0 ? "rgba(0,255,136,0.08)" : "rgba(255,77,109,0.08)",
              borderRadius: 3, padding: "2px 5px"
            }}>
              {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
            </div>
          )}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginBottom: 8 }}>{s.timeframe ?? "4H"}</div>

        {/* Prob */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>Probability</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: dirColor }}>{pct}%</span>
          </div>
          <ProbBar prob={s.probability ?? 0} dir={s.direction} />
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: featured ? "1fr 1fr 1fr" : "1fr 1fr", gap: 5 }}>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "6px 8px" }}>
            <div style={{ fontSize: 7, color: "var(--text-disabled)", marginBottom: 2, letterSpacing: "0.06em" }}>KELLY</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>{s.kelly_size?.toFixed(1)}%</div>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "6px 8px" }}>
            <div style={{ fontSize: 7, color: "var(--text-disabled)", marginBottom: 2, letterSpacing: "0.06em" }}>CONF</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: confColor, textTransform: "capitalize" }}>{s.confidence?.toLowerCase()}</div>
          </div>
          {featured && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "6px 8px" }}>
              <div style={{ fontSize: 7, color: "var(--text-disabled)", marginBottom: 2, letterSpacing: "0.06em" }}>R:R</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>
                {s.stop_loss && s.take_profit && s.current_price
                  ? `1:${(Math.abs(s.take_profit - s.current_price) / Math.abs(s.current_price - s.stop_loss)).toFixed(1)}`
                  : "—"}
              </div>
            </div>
          )}
        </div>

        {/* Confluence conflict warning */}
        {(s as any).confluence_conflict && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "var(--radius-sm)", padding: "4px 8px" }}>
            <span style={{ fontSize: 9, color: "#f59e0b" }}>⚠</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#f59e0b", letterSpacing: "0.06em" }}>LOW CONFLUENCE</span>
          </div>
        )}
        {/* Click hint */}
        <div style={{ marginTop: 8, fontSize: 8, color: "var(--text-disabled)", textAlign: "right", letterSpacing: "0.05em" }}>click for details →</div>
      </div>
    </div>
  );
}

function getRegimeNarrative(regime: string, buyCount: number, sellCount: number, avgProb: number, total: number): string {
  const bullPct = total ? Math.round(buyCount / total * 100) : 0;
  const bearPct = total ? Math.round(sellCount / total * 100) : 0;
  if (regime === "RISK-ON") {
    if (avgProb >= 65) return `Strong bullish consensus — ${bullPct}% of signals favour longs with above-average conviction. Momentum regime in play.`;
    return `Moderate risk-on bias — buy signals dominate at ${bullPct}% but conviction is mixed. Selective long exposure warranted.`;
  }
  if (regime === "RISK-OFF") {
    if (avgProb >= 65) return `Broad defensive positioning — ${bearPct}% of signals favour shorts with elevated conviction. Risk reduction advised.`;
    return `Mild risk-off tilt — sell pressure at ${bearPct}% but without high-conviction alignment. Monitor for trend confirmation.`;
  }
  return `Cross-asset disagreement — buy/sell split at ${bullPct}/${bearPct}%. System detects regime transition or macro uncertainty. Reduce size, await clarity.`;
}

export default function DashboardPage() {
  const { session, loading: authLoading } = useAuth();
  const [signals, setSignals]       = useState<Signal[]>([]);
  const [health, setHealth]         = useState<{ status: string; signals_count: number } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [dirFilter, setDirFilter]   = useState<DirFilter>("ALL");
  const [catFilter, setCatFilter]   = useState<Category>("ALL");
  const [search, setSearch]         = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [briefing, setBriefing]     = useState<any>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [drawerSignal, setDrawerSignal] = useState<Signal | null>(null);

  const openDrawer  = useCallback((s: Signal) => setDrawerSignal(s), []);
  const closeDrawer = useCallback(() => setDrawerSignal(null), []);

  useEffect(() => {
    if (authLoading) return;
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [session, authLoading]);

  async function load() {
    try {
      const [sigs, h] = await Promise.all([fetchSignals(session?.access_token), fetchHealth()]);
      setSignals(sigs); setHealth(h);
      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
      fetch(apiBase + "/system/morning-briefing")
        .then(r => r.json()).then(b => { if (b.briefing_text) setBriefing(b); }).catch(() => {});
      setLastUpdated(new Date().toLocaleTimeString()); setError("");
    } catch (e: any) { setError(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    const base = signals.filter(s => {
      const matchDir = dirFilter === "ALL" || s.direction === dirFilter;
      const matchCat = catFilter === "ALL" || s.type?.toUpperCase() === catFilter;
      const q = search.toLowerCase();
      const matchQ = !q || s.symbol.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.display?.toLowerCase().includes(q);
      return matchDir && matchCat && matchQ;
    });
    return base.sort((a, b) => {
      const confRank = (c: string) => c?.toUpperCase() === "HIGH" ? 2 : c?.toUpperCase() === "MEDIUM" ? 1 : 0;
      const cr = confRank(b.confidence) - confRank(a.confidence);
      if (cr !== 0) return cr;
      return (b.probability ?? 0) - (a.probability ?? 0);
    });
  }, [signals, dirFilter, catFilter, search]);

  const grouped = useMemo(() => {
    if (catFilter !== "ALL" || search || dirFilter !== "ALL") return null;
    const order = ["CRYPTO","STOCK","IN_STOCK","FOREX","COMMODITY","ETF","INDEX"];
    const map: Record<string, Signal[]> = {};
    filtered.forEach(s => {
      const cat = s.type?.toUpperCase() ?? "OTHER";
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    });
    return order.filter(c => map[c]?.length).map(c => ({ cat: c, signals: map[c] }));
  }, [filtered, catFilter, search, dirFilter]);

  const availableCats = useMemo(() => {
    const types = new Set(signals.map(s => s.type?.toUpperCase()).filter(Boolean));
    return CATEGORIES.filter(c => c === "ALL" || types.has(c));
  }, [signals]);

  const buyCount  = signals.filter(s => s.direction === "BUY").length;
  const sellCount = signals.filter(s => s.direction === "SELL").length;
  const holdCount = signals.filter(s => s.direction === "HOLD").length;
  const avgProb   = signals.length ? Math.round(signals.reduce((a,s) => a + (s.probability??0), 0) / signals.length * 100) : 0;
  const topBuy    = [...signals].filter(s => s.direction === "BUY").sort((a,b) => (b.probability??0)-(a.probability??0))[0];
  const topSell   = [...signals].filter(s => s.direction === "SELL").sort((a,b) => (b.probability??0)-(a.probability??0))[0];
  const bullPct   = signals.length ? Math.round(buyCount / signals.length * 100) : 0;
  const regime    = bullPct >= 60 ? "RISK-ON" : bullPct <= 35 ? "RISK-OFF" : "MIXED";
  const regimeColor = regime === "RISK-ON" ? "#00ff88" : regime === "RISK-OFF" ? "#ff4d6d" : "#f59e0b";
  const narrative = signals.length ? getRegimeNarrative(regime, buyCount, sellCount, avgProb, signals.length) : "";

  const mono    = "var(--font-mono)";
  const sans    = "var(--font-sans)";
  const display = "var(--font-display)";

  return (
    <div className="qs-page" style={{ padding: "24px 28px", fontFamily: sans, color: "var(--text-primary)", minHeight: "100%", boxSizing: "border-box" }}>
      <style>{`
        @keyframes pulse      { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
        @keyframes slideIn    { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes slideUp    { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @media (max-width:640px) {
          .qs-grid { grid-template-columns: 1fr !important; }
          .qs-page { padding: 16px 14px !important; }
          .qs-filters { gap: 6px !important; }
          .qs-regime { flex-direction: column !important; gap: 10px !important; }
          .qs-top-conviction { grid-template-columns: 1fr !important; }
          .qs-drawer { width: 100% !important; top: auto !important; height: 85vh; animation: slideUp 0.22s cubic-bezier(0.32,0.72,0,1) !important; border-left: none !important; border-top: 1px solid var(--border-default) !important; border-radius: 16px 16px 0 0 !important; }
          .qs-drawer-handle { display: block !important; }
        }
        .qs-drawer-handle { display: none; width: 36px; height: 4px; background: var(--border-strong); border-radius: 2px; margin: 0 auto 16px; }
      `}</style>

      <SignalDrawer s={drawerSignal} onClose={closeDrawer} userEmail={session?.user?.email ?? ""} />

      {/* Morning Briefing Banner */}
      {briefing && (
        <div style={{ marginBottom: 20, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderLeft: "3px solid var(--brand)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div onClick={() => setBriefingOpen(o => !o)}
            style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)", boxShadow: "0 0 6px rgba(0,255,136,0.5)", flexShrink: 0 }} />
              <span style={{ fontFamily: mono, fontSize: 9, color: "var(--brand)", letterSpacing: "0.12em" }}>MORNING BRIEFING</span>
              <span style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)" }}>{briefing.date}</span>
              <span style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)" }}>· {briefing.signals_analyzed} signals</span>
              {briefing.circuit_breaker_active && (
                <span style={{ fontFamily: mono, fontSize: 8, color: "#ff4d6d", border: "1px solid rgba(255,77,109,0.3)", borderRadius: 3, padding: "2px 6px", letterSpacing: "0.08em" }}>CIRCUIT BREAKER ACTIVE</span>
              )}
            </div>
            <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-disabled)", display: "inline-block", transform: briefingOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
          </div>
          {briefingOpen && (
            <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border-subtle)" }}>
              <pre style={{ margin: "14px 0 12px", fontFamily: mono, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.9, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{briefing.briefing_text}</pre>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { label: "ALERTS FIRED",    value: String(briefing.alerts_fired ?? 0),    color: briefing.alerts_fired > 0 ? "#f59e0b" : "var(--text-disabled)" },
                  { label: "ERRORS",          value: String(briefing.errors_detected ?? 0), color: briefing.errors_detected > 0 ? "#ff4d6d" : "var(--text-disabled)" },
                  { label: "CIRCUIT BREAKER", value: briefing.circuit_breaker_active ? "ACTIVE" : "INACTIVE", color: briefing.circuit_breaker_active ? "#ff4d6d" : "#00ff88" },
                ].map(m => (
                  <div key={m.label} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                    <div style={{ fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LAYER 1: Regime strip ── */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "14px 22px", marginBottom: 14 }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            {[120,80,60,60].map((w,i) => <Skeleton key={i} h={32} />)}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: narrative ? 10 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 4 }}>MARKET REGIME</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: regimeColor, boxShadow: `0 0 7px ${regimeColor}88` }} />
                    <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: regimeColor, letterSpacing: "0.06em" }}>{regime}</span>
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 4 }}>SIGNAL BIAS</div>
                  <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: "#00ff88" }}>{buyCount}B</span>
                    <span style={{ color: "var(--text-disabled)", margin: "0 5px" }}>·</span>
                    <span style={{ color: "#ff4d6d" }}>{sellCount}S</span>
                    <span style={{ color: "var(--text-disabled)", margin: "0 5px" }}>·</span>
                    <span style={{ color: "rgba(226,232,240,0.35)" }}>{holdCount}H</span>
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 4 }}>AVG PROB</div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: avgProb >= 60 ? "#00ff88" : avgProb >= 50 ? "#f59e0b" : "#ff4d6d" }}>{avgProb}%</div>
                </div>
                <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 4 }}>COVERAGE</div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{health?.signals_count ?? signals.length} assets</div>
                </div>
              </div>
              {lastUpdated && <div style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.08em" }}>UPDATED {lastUpdated}</div>}
            </div>
            {narrative && (
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: regimeColor, marginTop: 5, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, fontStyle: "italic" }}>{narrative}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── LAYER 2: Top conviction ── */}
      {!loading && (topBuy || topSell) && (
        <div style={{ display: "grid", gridTemplateColumns: topBuy && topSell ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
          {topBuy && (
            <div
              onClick={() => openDrawer(topBuy)}
              style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.22)", borderRadius: "var(--radius-lg)", padding: "16px 20px", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,255,136,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,255,136,0.22)")}
            >
              <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(0,255,136,0.55)", letterSpacing: "0.14em", marginBottom: 8 }}>⚡ TOP CONVICTION BUY</div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: display, fontSize: 20, fontWeight: 400, color: "var(--text-primary)", marginBottom: 3 }}>{topBuy.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-tertiary)" }}>{topBuy.display} · {topBuy.type === "IN_STOCK" ? "INDIA" : topBuy.type}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 700, color: "#00ff88" }}>{Math.round((topBuy.probability??0) * 100)}%</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>probability</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "PRICE", value: `$${topBuy.current_price?.toLocaleString(undefined,{maximumFractionDigits:2})}` },
                  { label: "KELLY", value: `${topBuy.kelly_size?.toFixed(1)}%` },
                  { label: "CONF",  value: topBuy.confidence },
                ].map(m => (
                  <div key={m.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-sm)", padding: "6px 8px" }}>
                    <div style={{ fontSize: 8, color: "rgba(0,255,136,0.4)", letterSpacing: "0.1em", marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{m.value?.toLowerCase?.() ?? m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {topSell && (
            <div
              onClick={() => openDrawer(topSell)}
              style={{ background: "rgba(255,77,109,0.04)", border: "1px solid rgba(255,77,109,0.22)", borderRadius: "var(--radius-lg)", padding: "16px 20px", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,77,109,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,77,109,0.22)")}
            >
              <div style={{ fontFamily: mono, fontSize: 8, color: "rgba(255,77,109,0.55)", letterSpacing: "0.14em", marginBottom: 8 }}>⚡ TOP CONVICTION SELL</div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: display, fontSize: 20, fontWeight: 400, color: "var(--text-primary)", marginBottom: 3 }}>{topSell.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-tertiary)" }}>{topSell.display} · {topSell.type === "IN_STOCK" ? "INDIA" : topSell.type}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 700, color: "#ff4d6d" }}>{Math.round((topSell.probability??0) * 100)}%</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>probability</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "PRICE", value: `$${topSell.current_price?.toLocaleString(undefined,{maximumFractionDigits:2})}` },
                  { label: "KELLY", value: `${topSell.kelly_size?.toFixed(1)}%` },
                  { label: "CONF",  value: topSell.confidence },
                ].map(m => (
                  <div key={m.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-sm)", padding: "6px 8px" }}>
                    <div style={{ fontSize: 8, color: "rgba(255,77,109,0.4)", letterSpacing: "0.1em", marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{m.value?.toLowerCase?.() ?? m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LAYER 3: Search + filters ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "0 0 200px" }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-disabled)", pointerEvents: "none" }}>⌕</div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol or name…"
            style={{ width: "100%", boxSizing: "border-box", paddingLeft: 26, paddingRight: 10, paddingTop: 6, paddingBottom: 6, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 11, fontFamily: sans, outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {availableCats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: "4px 9px", fontSize: 9, fontWeight: 700, fontFamily: mono, letterSpacing: "0.08em",
              border: "1px solid", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 0.12s",
              background: catFilter === c ? "var(--bg-elevated)" : "transparent",
              color: catFilter === c ? "var(--text-primary)" : "var(--text-tertiary)",
              borderColor: catFilter === c ? "var(--border-strong)" : "var(--border-subtle)",
            }}>{c === "IN_STOCK" ? "INDIA" : c}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 3 }}>
          {(["ALL","BUY","SELL","HOLD"] as const).map(f => (
            <button key={f} onClick={() => setDirFilter(f)} style={{
              padding: "4px 9px", fontSize: 9, fontWeight: 700, fontFamily: mono, letterSpacing: "0.08em",
              border: "1px solid", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 0.12s",
              background: dirFilter === f ? (f === "BUY" ? "#00ff88" : f === "SELL" ? "#ff4d6d" : "var(--bg-elevated)") : "transparent",
              color: dirFilter === f ? (f === "BUY" || f === "SELL" ? "#000" : "var(--text-primary)") : "var(--text-tertiary)",
              borderColor: dirFilter === f ? (f === "BUY" ? "#00ff88" : f === "SELL" ? "#ff4d6d" : "var(--border-strong)") : "var(--border-subtle)",
            }}>{f}</button>
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.08em" }}>{filtered.length} / {signals.length}</div>
      </div>

      {/* ── Grid (grouped or flat) ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
          {Array.from({ length: 12 }).map((_,i) => (
            <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Skeleton h={24} radius="5px" />
                <div style={{ flex: 1 }}><Skeleton h={11} radius="3px" /></div>
              </div>
              <Skeleton h={18} radius="3px" />
              <Skeleton h={7} radius="2px" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                <Skeleton h={32} radius="var(--radius-sm)" />
                <Skeleton h={32} radius="var(--radius-sm)" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#ff4d6d", marginBottom: 10 }}>{error}</div>
          <button onClick={load} style={{ fontFamily: mono, fontSize: 9, color: "var(--brand)", background: "transparent", border: "1px solid var(--brand-border)", borderRadius: "var(--radius-sm)", padding: "6px 14px", cursor: "pointer", letterSpacing: "0.1em" }}>RETRY</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-disabled)", letterSpacing: "0.1em", marginBottom: 12 }}>NO SIGNALS MATCH</div>
          <button onClick={() => { setSearch(""); setDirFilter("ALL"); setCatFilter("ALL"); }} style={{ fontFamily: mono, fontSize: 9, color: "var(--brand)", background: "transparent", border: "1px solid var(--brand-border)", borderRadius: "var(--radius-sm)", padding: "5px 12px", cursor: "pointer", letterSpacing: "0.08em" }}>CLEAR FILTERS</button>
        </div>
      ) : grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {grouped.map(({ cat, signals: groupSigs }) => (
            <div key={cat}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: "var(--text-disabled)", letterSpacing: "0.14em" }}>{CAT_LABEL[cat] ?? cat}</span>
                <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
                <span style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)" }}>{groupSigs.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
                {groupSigs.map((s, i) => (
                  <SignalCard
                    key={s.symbol} s={s}
                    featured={i === 0 && s.confidence?.toUpperCase() === "HIGH" && s.direction === "BUY"}
                    onClick={openDrawer}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
          {filtered.map(s => <SignalCard key={s.symbol} s={s} onClick={openDrawer} />)}
        </div>
      )}
    </div>
  );
}
