"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

const VALIDATED_UNIVERSE = [
  { symbol: "BTC-USD", display: "BTC/USD", sharpe: 1.32, ret: 64.9, wr: 57.1, maxdd: -22.4, icon: "₿" },
  { symbol: "MSFT",    display: "MSFT",    sharpe: 1.32, ret: 80.5, wr: 52.0, maxdd: -20.9, icon: "M" },
  { symbol: "NVDA",    display: "NVDA",    sharpe: 2.88, ret: 41.2, wr: 66.7, maxdd: -21.1, icon: "N" },
  { symbol: "INFY.NS", display: "INFY",    sharpe: 0.81, ret: 31.3, wr: 48.4, maxdd: -21.3, icon: "I" },
  { symbol: "TSLA",    display: "TSLA",    sharpe: 0.94, ret: 27.7, wr: 46.9, maxdd: -22.6, icon: "T" },
  { symbol: "SOL-USD", display: "SOL/USD", sharpe: 0.66, ret: 26.4, wr: 46.6, maxdd: -21.4, icon: "◎" },
];

const EXCLUDED = [
  { symbol: "RELIANCE.NS", sharpe: -1.67, reason: "BUY accuracy = base rate (52%)" },
  { symbol: "GOOGL",       sharpe: -1.32, reason: "No predictive edge in test period" },
  { symbol: "META",        sharpe: -4.59, reason: "Win rate 25% — noise only" },
  { symbol: "HDFCBANK.NS", sharpe: -2.33, reason: "Systematic losses in ranging regime" },
  { symbol: "AAPL",        sharpe:  0.06, reason: "Sharpe below 0.5 threshold" },
  { symbol: "ETH-USD",     sharpe: -0.18, reason: "No edge after regime filtering" },
  { symbol: "TCS.NS",      sharpe: -0.37, reason: "No edge in test period" },
  { symbol: "SBIN.NS",     sharpe: -0.60, reason: "Bear regime losses dominate" },
  { symbol: "AMZN",        sharpe: -0.09, reason: "Below threshold" },
  { symbol: "SPY",         sharpe:  0.04, reason: "Below threshold" },
];

export default function BacktestPage() {
  const { session } = useAuth();
  const [outcomes, setOutcomes] = useState<any>(null);
  const mono = "var(--font-mono)";
  const sans = "var(--font-sans)";

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
    fetch(`${base}/api/v1/signals/outcomes`)
      .then(r => r.json()).then(setOutcomes).catch(() => {});
  }, []);

  return (
    <div style={{ padding: "24px 28px", fontFamily: sans, color: "var(--text-primary)", minHeight: "100%" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, marginBottom: 4 }}>Backtest Results</div>
        <div style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em" }}>WALK-FORWARD VALIDATION · TRAIN 2021–2024 · TEST 2024–2026 · NO LOOKAHEAD</div>
      </div>

      {/* Methodology */}
      <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "var(--radius-lg)", padding: "14px 18px", marginBottom: 24, display: "flex", gap: 24, flexWrap: "wrap" }}>
        {[["TRAIN SPLIT","60% (2021–2024)"],["TEST SPLIT","40% (2024–2026)"],["METHOD","Walk-Forward WF"],["EXIT","ATR-based SL/TP"],["FILTER","Regime-conditional"],["LOOKAHEAD","None — honest"]].map(([l,v]) => (
          <div key={l}>
            <div style={{ fontFamily: mono, fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.12em", marginBottom: 3 }}>{l}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: "#00ff88" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Live outcomes */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "18px", marginBottom: 24 }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", marginBottom: 14 }}>LIVE SIGNAL OUTCOMES (5-DAY FORWARD)</div>
        {outcomes ? (
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[["TOTAL",outcomes.total??0,"var(--text-primary)"],["WINS",outcomes.wins??0,"#00ff88"],["LOSSES",outcomes.losses??0,"#ff4d6d"],["PENDING",outcomes.pending??0,"#f59e0b"],["WIN RATE",outcomes.win_rate?`${outcomes.win_rate}%`:"—",outcomes.win_rate>50?"#00ff88":"var(--text-disabled)"]].map(([l,v,c]:any) => (
              <div key={l}>
                <div style={{ fontFamily: mono, fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.12em", marginBottom: 4 }}>{l}</div>
                <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        ) : <div style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)" }}>Outcomes accumulate as signals are scored over 5-day windows.</div>}
      </div>

      {/* Validated */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 6px #00ff88" }} />
          <span style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em" }}>VALIDATED SIGNAL UNIVERSE</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["SYMBOL","SHARPE","RETURN (2Y TEST)","WIN RATE","MAX DD","STATUS"].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontFamily: mono, fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.12em", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VALIDATED_UNIVERSE.map((s, i) => (
              <tr key={s.symbol} style={{ borderBottom: "1px solid var(--border-subtle)", background: i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, background: "var(--bg-elevated)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{s.icon}</div>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700 }}>{s.display}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", fontFamily: mono, fontSize: 12, fontWeight: 700, color: s.sharpe>1.5?"#00ff88":s.sharpe>0.5?"#f59e0b":"var(--text-primary)" }}>{s.sharpe.toFixed(2)}</td>
                <td style={{ padding: "12px 16px", fontFamily: mono, fontSize: 12, fontWeight: 700, color: "#00ff88" }}>+{s.ret}%</td>
                <td style={{ padding: "12px 16px", fontFamily: mono, fontSize: 11, color: s.wr>55?"#00ff88":"var(--text-primary)" }}>{s.wr}%</td>
                <td style={{ padding: "12px 16px", fontFamily: mono, fontSize: 11, color: "#ff4d6d" }}>{s.maxdd}%</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 800, color: "#000", background: "#00ff88", borderRadius: 3, padding: "3px 8px" }}>✓ DEPLOY</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Excluded */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4d6d" }} />
          <span style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em" }}>EXCLUDED — NO VALIDATED EDGE</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["SYMBOL","SHARPE","REASON","STATUS"].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontFamily: mono, fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.12em", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXCLUDED.map((s, i) => (
              <tr key={s.symbol} style={{ borderBottom: "1px solid var(--border-subtle)", background: i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                <td style={{ padding: "12px 16px", fontFamily: mono, fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{s.symbol}</td>
                <td style={{ padding: "12px 16px", fontFamily: mono, fontSize: 11, color: "#ff4d6d" }}>{s.sharpe.toFixed(2)}</td>
                <td style={{ padding: "12px 16px", fontSize: 10, color: "var(--text-tertiary)" }}>{s.reason}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: "#ff4d6d", border: "1px solid #ff4d6d33", borderRadius: 3, padding: "3px 8px" }}>✕ EXCLUDED</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
