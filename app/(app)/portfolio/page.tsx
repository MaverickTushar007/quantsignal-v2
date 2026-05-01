"use client";
import { useState, useEffect, useRef } from "react";
import { fetchSignals, type Signal } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

interface Holding { symbol: string; name: string; amount: number; direction: string; icon: string; }
interface PortfolioResult {
  assets: any[];
  total_capital: number;
  current_metrics: { expected_return: number; volatility: number; sharpe_ratio: number };
  optimal_metrics: { expected_return: number; volatility: number; sharpe_ratio: number };
  optimal_allocation: any[];
}

function AssetPicker({ signals, onSelect, onClose }: { signals: Signal[]; onSelect: (s: Signal) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = signals.filter(s => {
    const query = q.toLowerCase();
    return !query || s.symbol.toLowerCase().includes(query) || s.name?.toLowerCase().includes(query);
  });

  const dirColor = (d: string) => d === "BUY" ? "#00ff88" : d === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.3)";
  const mono = "var(--font-mono)", sans = "var(--font-sans)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div style={{ width: 520, maxHeight: "70vh", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={e => e.stopPropagation()}>
        {/* Search */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, color: "var(--text-disabled)" }}>⌕</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search assets…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 14, fontFamily: sans }} />
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-disabled)", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {/* Results */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-disabled)", fontSize: 13 }}>No assets found</div>
          ) : filtered.map(s => (
            <div key={s.symbol} onClick={() => { onSelect(s); onClose(); }}
              style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", borderBottom: "1px solid var(--border-subtle)", transition: "background 0.1s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 36, height: 36, background: "var(--bg-elevated)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{s.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{s.display}</div>
                <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 1 }}>{s.name}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>${s.current_price?.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: dirColor(s.direction), border: `1px solid ${dirColor(s.direction)}44`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.08em", marginTop: 3, display: "inline-block" }}>{s.direction}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "16px 18px" }}>
      <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: color ?? "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function PortfolioPage() {
  const { session } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [capital, setCapital]   = useState<number>(10000);
  const [result, setResult]     = useState<PortfolioResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [signals, setSignals]   = useState<Signal[]>([]);
  const [picker, setPicker]     = useState(false);
  const [editIdx, setEditIdx]   = useState<number | null>(null);

  const mono = "var(--font-mono)", sans = "var(--font-sans)", display = "var(--font-display)";

  useEffect(() => {
    fetchSignals(session?.access_token).then(setSignals).catch(() => {});
  }, [session, loading]);

  function openPicker(idx: number | null) { setEditIdx(idx); setPicker(true); }

  function selectAsset(s: Signal) {
    const holding = { symbol: s.symbol, name: s.name, amount: 0, direction: s.direction, icon: s.icon };
    if (editIdx === null) {
      setHoldings(h => [...h, holding]);
    } else {
      setHoldings(h => h.map((r, i) => i === editIdx ? { ...r, symbol: s.symbol, name: s.name, direction: s.direction, icon: s.icon } : r));
    }
  }

  function removeHolding(i: number) { setHoldings(h => h.filter((_, idx) => idx !== i)); }
  function updateAmount(i: number, v: string) { setHoldings(h => h.map((r, idx) => idx === i ? { ...r, amount: Number(v) } : r)); }

  async function analyze() {
    const valid = holdings.filter(h => h.symbol && h.amount > 0);
    if (valid.length < 1) { setError("Add at least one asset with an amount."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolio/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ assets: valid.map(h => ({ symbol: h.symbol, amount: h.amount })), total_capital: capital }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(typeof e.detail === "string" ? e.detail : "Analysis failed"); }
      setResult(await res.json());
    } catch (e: any) { setError(e.message ?? "Failed"); }
    finally { setLoading(false); }
  }

  const changeColor = (n: number) => n > 0 ? "#00ff88" : n < 0 ? "#ff4d6d" : "var(--text-tertiary)";
  const dirColor = (d: string) => d === "BUY" ? "#00ff88" : d === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.35)";

  return (
    <div style={{ padding: "24px 28px", fontFamily: sans, color: "var(--text-primary)", minHeight: "100%", boxSizing: "border-box" }}>
      {picker && <AssetPicker signals={signals} onSelect={selectAsset} onClose={() => setPicker(false)} />}

      <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 6 }}>PORTFOLIO</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ fontFamily: display, fontSize: 24, fontWeight: 400 }}>Portfolio Analyser</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Capital</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontFamily: mono, fontSize: 12, color: "var(--text-tertiary)" }}>$</span>
              <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))}
                style={{ paddingLeft: 22, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 13, fontFamily: mono, outline: "none", width: 130 }} />
            </div>
          </div>
          <button onClick={() => openPicker(null)} style={{ padding: "8px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)", fontSize: 12, fontFamily: sans, cursor: "pointer" }}>+ Add Asset</button>
          <button onClick={analyze} disabled={loading || holdings.length === 0} style={{
            padding: "8px 20px", background: loading ? "var(--bg-elevated)" : "var(--brand)",
            border: "1px solid", borderColor: loading ? "var(--border-default)" : "var(--brand)",
            borderRadius: "var(--radius-sm)", color: loading ? "var(--text-disabled)" : "#000",
            fontSize: 12, fontWeight: 700, fontFamily: sans, cursor: loading || holdings.length === 0 ? "not-allowed" : "pointer", transition: "all 0.15s",
          }}>{loading ? "Analysing…" : "Analyse →"}</button>
        </div>
      </div>

      {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)", borderRadius: "var(--radius-md)", fontSize: 12, color: "#ff4d6d" }}>{error}</div>}

      {/* Holdings grid */}
      {holdings.length === 0 ? (
        <div style={{ padding: "80px 0", textAlign: "center", border: "2px dashed var(--border-subtle)", borderRadius: "var(--radius-lg)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-disabled)", letterSpacing: "0.12em", marginBottom: 8 }}>NO ASSETS ADDED</div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 }}>Add assets to build your portfolio and run optimisation</div>
          <button onClick={() => openPicker(null)} style={{ padding: "10px 24px", background: "var(--brand)", border: "none", borderRadius: "var(--radius-md)", color: "#000", fontSize: 13, fontWeight: 700, fontFamily: sans, cursor: "pointer" }}>+ Add First Asset</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
          {holdings.map((h, i) => (
            <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "16px 18px", position: "relative" }}>
              <button onClick={() => removeHolding(i)} style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, background: "transparent", border: "none", color: "var(--text-disabled)", fontSize: 16, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, background: "var(--bg-elevated)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }} onClick={() => openPicker(i)}>{h.icon || "?"}</div>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{h.symbol || "—"}</div>
                  <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 1 }}>{h.name || "Click icon to change"}</div>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 5 }}>AMOUNT ($)</div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontFamily: mono, fontSize: 12, color: "var(--text-tertiary)" }}>$</span>
                  <input type="number" value={h.amount || ""} onChange={e => updateAmount(i, e.target.value)} placeholder="0"
                    style={{ width: "100%", boxSizing: "border-box", paddingLeft: 22, paddingRight: 10, paddingTop: 8, paddingBottom: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 13, fontFamily: mono, outline: "none" }} />
                </div>
              </div>
              {capital > 0 && h.amount > 0 && (
                <div style={{ fontSize: 10, color: "var(--text-disabled)" }}>{((h.amount / capital) * 100).toFixed(1)}% of portfolio</div>
              )}
              {h.direction && (
                <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: dirColor(h.direction), border: `1px solid ${dirColor(h.direction)}44`, borderRadius: 3, padding: "2px 7px", letterSpacing: "0.08em", marginTop: 8, display: "inline-block" }}>{h.direction}</div>
              )}
            </div>
          ))}
          {/* Add more card */}
          <div onClick={() => openPicker(null)} style={{ background: "transparent", border: "2px dashed var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "16px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", minHeight: 140, transition: "border-color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
          >
            <div style={{ fontSize: 24, color: "var(--text-disabled)", marginBottom: 6 }}>+</div>
            <div style={{ fontSize: 11, color: "var(--text-disabled)" }}>Add Asset</div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Metrics row */}
          <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 12 }}>ANALYSIS RESULTS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "18px 20px" }}>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 14 }}>CURRENT PORTFOLIO</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <MetricCard label="EXP. RETURN" value={`${result.current_metrics.expected_return?.toFixed(1)}%`} color="#00ff88" />
                <MetricCard label="VOLATILITY" value={`${result.current_metrics.volatility?.toFixed(1)}%`} color="#f59e0b" />
                <MetricCard label="SHARPE" value={result.current_metrics.sharpe_ratio?.toFixed(2)} />
              </div>
            </div>
            <div style={{ background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "var(--radius-lg)", padding: "18px 20px" }}>
              <div style={{ fontSize: 9, color: "rgba(0,255,136,0.5)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 14 }}>OPTIMAL PORTFOLIO</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <MetricCard label="EXP. RETURN" value={`${result.optimal_metrics.expected_return?.toFixed(1)}%`} color="#00ff88" />
                <MetricCard label="VOLATILITY" value={`${result.optimal_metrics.volatility?.toFixed(1)}%`} color="#f59e0b" />
                <MetricCard label="SHARPE" value={result.optimal_metrics.sharpe_ratio?.toFixed(2)} />
              </div>
            </div>
          </div>

          {/* Allocation table */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono }}>OPTIMAL ALLOCATION</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Rebalance recommendations based on signal strength</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 1fr 1fr 120px 80px", padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.01)" }}>
              {["ASSET","SIGNAL","CURRENT","OPTIMAL","CHANGE","PROB."].map(h => (
                <div key={h} style={{ fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono }}>{h}</div>
              ))}
            </div>
            {result.optimal_allocation.map((a, i) => {
              const sig = signals.find(s => s.symbol === a.symbol);
              const dc = a.direction === "BUY" ? "#00ff88" : a.direction === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.35)";
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 80px 1fr 1fr 120px 80px", padding: "14px 20px", borderBottom: i < result.optimal_allocation.length-1 ? "1px solid var(--border-subtle)" : "none", alignItems: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {sig && <div style={{ width: 28, height: 28, background: "var(--bg-elevated)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{sig.icon}</div>}
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{a.display ?? a.symbol}</div>
                      {sig && <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 1 }}>{sig.name}</div>}
                    </div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: dc, border: `1px solid ${dc}44`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.08em", width: "fit-content" }}>{a.direction}</div>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 12, color: "var(--text-primary)" }}>${a.current_amount?.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
                    <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 1 }}>{a.current_weight?.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 12, color: "var(--brand)" }}>${a.optimal_amount?.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
                    <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 1 }}>{a.optimal_weight?.toFixed(1)}%</div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: changeColor(a.change) }}>
                    {a.change > 0 ? "+" : ""}{a.change?.toLocaleString(undefined,{maximumFractionDigits:0})}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: a.probability >= 0.65 ? "#00ff88" : a.probability >= 0.5 ? "#f59e0b" : "#ff4d6d" }}>
                    {Math.round((a.probability ?? 0.5) * 100)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
