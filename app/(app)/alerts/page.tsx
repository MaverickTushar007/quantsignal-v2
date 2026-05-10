"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export default function AlertsPage() {
  const { session, loading: authLoading } = useAuth();
  const [perf, setPerf]     = useState<any>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const mono = "var(--font-mono)", sans = "var(--font-sans)", display = "var(--font-display)";

  useEffect(() => {
    const h: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    if (authLoading) return;
    Promise.allSettled([
      fetch(`${API_BASE}/alerts/performance`, { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/signals`, { headers: h }).then(r => r.json()),
    ]).then(([p, s]) => {
      if (p.status === "fulfilled") setPerf(p.value);
      if (s.status === "fulfilled") setSignals(Array.isArray(s.value) ? s.value : []);
    }).finally(() => setLoading(false));
  }, [session, authLoading]);

  const dirColor = (d: string) => d === "BUY" ? "#00ff88" : d === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.3)";

  const MetricBox = ({ label, value, color, sub }: any) => (
    <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "16px 18px" }}>
      <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: color ?? "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", fontFamily: sans, color: "var(--text-primary)" }}>
      <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 6 }}>ALERTS</div>
      <div style={{ fontFamily: display, fontSize: 24, fontWeight: 400, marginBottom: 24 }}>Signal Performance</div>

      {/* Performance metrics */}
      <div className="qs-metric-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <MetricBox label="TOTAL SIGNALS" value={loading ? "—" : perf?.total ?? 0} />
        <MetricBox label="WIN RATE" value={loading ? "—" : perf?.win_rate != null ? `${(perf.win_rate * 100).toFixed(1)}%` : "—"} color="#00ff88" />
        <MetricBox label="AVG P&L" value={loading ? "—" : perf?.avg_pnl != null ? `${perf.avg_pnl > 0 ? "+" : ""}${perf.avg_pnl.toFixed(2)}%` : "—"} color={perf?.avg_pnl > 0 ? "#00ff88" : perf?.avg_pnl < 0 ? "#ff4d6d" : "var(--text-primary)"} />
        <MetricBox label="ACTIVE SIGNALS" value={loading ? "—" : signals.length} sub="across all assets" />
      </div>

      {/* By probability breakdown */}
      {perf?.by_probability?.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 14 }}>WIN RATE BY PROBABILITY BUCKET</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {perf.by_probability.map((b: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-tertiary)", width: 80 }}>{b.bucket}</div>
                <div style={{ flex: 1, height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(b.win_rate ?? 0) * 100}%`, background: "var(--brand)", borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, color: "var(--brand)", width: 50, textAlign: "right" }}>{b.win_rate != null ? `${(b.win_rate * 100).toFixed(0)}%` : "—"}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)", width: 40, textAlign: "right" }}>{b.count}x</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live signals as alert feed */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono }}>LIVE SIGNAL ALERTS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: mono, fontSize: 9, color: "var(--brand)" }}>LIVE</span>
          </div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>

        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-disabled)", fontSize: 13 }}>Loading signals…</div>
        ) : signals.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono }}>NO ACTIVE SIGNALS</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 100px 100px 100px 80px", padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.01)" }}>
              {["ASSET","DIR","PROBABILITY","KELLY SIZE","PRICE","CONFIDENCE"].map(h => (
                <div key={h} style={{ fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono }}>{h}</div>
              ))}
            </div>
            {signals.map((s: any, i: number) => (
              <div key={s.symbol} style={{ display: "grid", gridTemplateColumns: "2fr 80px 100px 100px 100px 80px", padding: "13px 20px", borderBottom: i < signals.length-1 ? "1px solid var(--border-subtle)" : "none", alignItems: "center", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, background: "var(--bg-elevated)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{s.display}</div>
                    <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 1 }}>{s.name}</div>
                  </div>
                </div>
                <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: dirColor(s.direction), border: `1px solid ${dirColor(s.direction)}44`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.08em", width: "fit-content" }}>{s.direction}</div>
                <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: s.probability >= 0.65 ? "#00ff88" : s.probability >= 0.5 ? "#f59e0b" : "#ff4d6d" }}>{Math.round(s.probability * 100)}%</div>
                <div style={{ fontFamily: mono, fontSize: 13, color: "var(--text-primary)" }}>{s.kelly_size?.toFixed(1)}%</div>
                <div style={{ fontFamily: mono, fontSize: 13, color: "var(--text-primary)" }}>${s.current_price?.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                <div style={{ fontFamily: mono, fontSize: 9, textTransform: "capitalize", color: s.confidence === "high" ? "#00ff88" : s.confidence === "moderate" ? "#f59e0b" : "var(--text-disabled)" }}>{s.confidence}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
