"use client";
import { useEffect, useState, useMemo } from "react";
import { fetchSignals, type Signal } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

type SortKey = "probability" | "current_price" | "kelly_size" | "risk_reward" | "symbol";
type SortDir = "asc" | "desc";

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

function ProbBar({ prob, dir }: { prob: number; dir: string }) {
  const color = dir === "BUY" ? "#00ff88" : dir === "SELL" ? "#ff4d6d" : "#f59e0b";
  return (
    <div style={{ width: 60, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.round(prob * 100)}%`, background: color, borderRadius: 2 }} />
    </div>
  );
}

export default function SignalsPage() {
  const { session, loading: authLoading } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");
  const [dirFilter, setDirFilter] = useState<"ALL"|"BUY"|"SELL"|"HOLD">("ALL");
  const [catFilter, setCatFilter] = useState("ALL");
  const [sortKey, setSortKey]   = useState<SortKey>("probability");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const mono = "var(--font-mono)";
  const sans = "var(--font-sans)";

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [session, authLoading]);

  async function load() {
    try {
      const sigs = await fetchSignals(session?.access_token);
      setSignals(sigs);
      setError("");
    } catch (e: any) { setError(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }

  const cats = useMemo(() => {
    const types = new Set(signals.map(s => s.type?.toUpperCase()).filter(Boolean));
    return ["ALL", ...Array.from(types)];
  }, [signals]);

  const sorted = useMemo(() => {
    const base = signals.filter(s => {
      const matchDir = dirFilter === "ALL" || s.direction === dirFilter;
      const matchCat = catFilter === "ALL" || s.type?.toUpperCase() === catFilter;
      const q = search.toLowerCase();
      const matchQ = !q || s.symbol.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.display?.toLowerCase().includes(q);
      return matchDir && matchCat && matchQ;
    });
    return base.sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "symbol") {
        return sortDir === "asc"
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol);
      }
      av = (a[sortKey] ?? 0) as number;
      bv = (b[sortKey] ?? 0) as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [signals, dirFilter, catFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span style={{ color: "var(--text-disabled)", fontSize: 8 }}>↕</span>;
    return <span style={{ color: "var(--brand)", fontSize: 8 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const selected = selectedSymbol ? signals.find(s => s.symbol === selectedSymbol) : null;

  const thStyle = (k: SortKey): React.CSSProperties => ({
    padding: "8px 12px", fontFamily: mono, fontSize: 8,
    letterSpacing: "0.12em", textAlign: "left", cursor: "pointer",
    userSelect: "none", whiteSpace: "nowrap",
    color: sortKey === k ? "var(--text-secondary)" : "var(--text-disabled)",
  });

  const decimalsFor = (p: number) => p < 1 ? 4 : p < 10 ? 3 : 2;

  return (
    <div style={{ padding: "24px 28px", fontFamily: sans, color: "var(--text-primary)", minHeight: "100%", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--text-primary)", marginBottom: 3 }}>All Signals</div>
          <div style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em" }}>{sorted.length} / {signals.length} ASSETS</div>
        </div>
        <button onClick={load} style={{ fontFamily: mono, fontSize: 9, color: "var(--brand)", background: "transparent", border: "1px solid var(--brand-border)", borderRadius: "var(--radius-sm)", padding: "6px 14px", cursor: "pointer", letterSpacing: "0.1em" }}>↻ REFRESH</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 11, fontFamily: sans, outline: "none", width: 180 }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-disabled)" }}>⌕</span>
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: "4px 9px", fontSize: 9, fontWeight: 700, fontFamily: mono, letterSpacing: "0.08em",
              border: "1px solid", borderRadius: "var(--radius-sm)", cursor: "pointer",
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
              border: "1px solid", borderRadius: "var(--radius-sm)", cursor: "pointer",
              background: dirFilter === f ? (f === "BUY" ? "#00ff88" : f === "SELL" ? "#ff4d6d" : "var(--bg-elevated)") : "transparent",
              color: dirFilter === f ? (f === "BUY" || f === "SELL" ? "#000" : "var(--text-primary)") : "var(--text-tertiary)",
              borderColor: dirFilter === f ? (f === "BUY" ? "#00ff88" : f === "SELL" ? "#ff4d6d" : "var(--border-strong)") : "var(--border-subtle)",
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Table + Detail panel */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* Table */}
        <div style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", minWidth: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em" }}>LOADING SIGNALS…</div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", color: "#ff4d6d", fontSize: 12 }}>{error}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <th onClick={() => toggleSort("symbol")} style={thStyle("symbol")}>ASSET <SortIcon k="symbol" /></th>
                    <th style={{ padding: "8px 12px", fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.12em", textAlign: "left" }}>DIR</th>
                    <th onClick={() => toggleSort("probability")} style={thStyle("probability")}>PROB <SortIcon k="probability" /></th>
                    <th style={{ padding: "8px 12px", fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.12em", textAlign: "left" }}>CONF</th>
                    <th onClick={() => toggleSort("current_price")} style={thStyle("current_price")}>PRICE <SortIcon k="current_price" /></th>
                    <th onClick={() => toggleSort("kelly_size")} style={thStyle("kelly_size")}>KELLY <SortIcon k="kelly_size" /></th>
                    <th onClick={() => toggleSort("risk_reward")} style={thStyle("risk_reward")}>R:R <SortIcon k="risk_reward" /></th>
                    <th style={{ padding: "8px 12px", fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.12em", textAlign: "left" }}>TP / SL</th>
                    <th style={{ padding: "8px 12px", fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.12em", textAlign: "left" }}>CLASS</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => {
                    const isSelected = selectedSymbol === s.symbol;
                    const dirColor = DIR_COLOR[s.direction] ?? "rgba(226,232,240,0.35)";
                    const confColor = CONF_COLOR[s.confidence?.toUpperCase?.()] ?? "#f59e0b";
                    const dec = decimalsFor(s.current_price ?? 0);
                    const tpDec = s.take_profit ? decimalsFor(s.take_profit) : dec;
                    const slDec = s.stop_loss ? decimalsFor(s.stop_loss) : dec;
                    return (
                      <tr key={s.symbol}
                        onClick={() => setSelectedSymbol(isSelected ? null : s.symbol)}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                          background: isSelected ? "rgba(255,255,255,0.03)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"; }}
                      >
                        {/* Asset */}
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 24, height: 24, background: "var(--bg-elevated)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{s.icon}</div>
                            <div>
                              <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{s.display}</div>
                              <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{s.name}</div>
                            </div>
                          </div>
                        </td>
                        {/* Direction */}
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{
                            display: "inline-block", fontFamily: mono, fontSize: 8, fontWeight: 800, letterSpacing: "0.1em",
                            color: s.direction === "HOLD" ? "rgba(226,232,240,0.6)" : "#000",
                            background: s.direction === "BUY" ? "#00ff88" : s.direction === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.18)",
                            borderRadius: 3, padding: "3px 7px",
                          }}>{s.direction}</div>
                        </td>
                        {/* Probability */}
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: dirColor, minWidth: 32 }}>{Math.round((s.probability ?? 0) * 100)}%</span>
                            <ProbBar prob={s.probability ?? 0} dir={s.direction} />
                          </div>
                        </td>
                        {/* Confidence */}
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: confColor, textTransform: "uppercase" }}>{s.confidence}</span>
                        </td>
                        {/* Price */}
                        <td style={{ padding: "10px 12px", fontFamily: mono, fontSize: 11, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                          ${s.current_price?.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}
                        </td>
                        {/* Kelly */}
                        <td style={{ padding: "10px 12px", fontFamily: mono, fontSize: 11, color: "var(--text-secondary)" }}>
                          {s.kelly_size?.toFixed(1)}%
                        </td>
                        {/* R:R */}
                        <td style={{ padding: "10px 12px", fontFamily: mono, fontSize: 11, color: s.risk_reward && s.risk_reward >= 2 ? "#00ff88" : s.risk_reward && s.risk_reward >= 1.5 ? "#f59e0b" : "var(--text-secondary)" }}>
                          {s.risk_reward ? `1:${s.risk_reward.toFixed(1)}` : "—"}
                        </td>
                        {/* TP / SL */}
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          {s.take_profit ? (
                            <div>
                              <div style={{ fontFamily: mono, fontSize: 9, color: "#00ff88" }}>▲ ${s.take_profit.toLocaleString(undefined,{maximumFractionDigits:tpDec})}</div>
                              <div style={{ fontFamily: mono, fontSize: 9, color: "#ff4d6d" }}>▼ ${s.stop_loss?.toLocaleString(undefined,{maximumFractionDigits:slDec})}</div>
                            </div>
                          ) : <span style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)" }}>—</span>}
                        </td>
                        {/* Class */}
                        <td style={{ padding: "10px 12px", fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.06em" }}>
                          {s.type === "IN_STOCK" ? "INDIA" : s.type}
                        </td>
                      </tr>
                    );
                  })}
                  {sorted.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em" }}>NO SIGNALS MATCH</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail side panel */}
        {selected && (
          <div style={{ width: 280, background: "var(--bg-surface)", border: `1px solid ${DIR_COLOR[selected.direction] ?? "var(--border-subtle)"}33`, borderRadius: "var(--radius-lg)", padding: "18px", flexShrink: 0, position: "sticky", top: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, background: "var(--bg-elevated)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{selected.icon}</div>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{selected.display}</div>
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{selected.name}</div>
                </div>
              </div>
              <button onClick={() => setSelectedSymbol(null)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 5, width: 24, height: 24, cursor: "pointer", color: "var(--text-tertiary)", fontSize: 12 }}>✕</button>
            </div>

            {/* Price + direction */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                  ${selected.current_price?.toLocaleString(undefined, { minimumFractionDigits: decimalsFor(selected.current_price ?? 0), maximumFractionDigits: decimalsFor(selected.current_price ?? 0) })}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2 }}>{selected.timeframe ?? "4H"}</div>
              </div>
              <div style={{
                fontFamily: mono, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                color: selected.direction === "HOLD" ? "rgba(226,232,240,0.6)" : "#000",
                background: selected.direction === "BUY" ? "#00ff88" : selected.direction === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.18)",
                borderRadius: 4, padding: "5px 12px",
              }}>{selected.direction}</div>
            </div>

            {/* Stats grid */}
            {[
              { label: "PROBABILITY", value: `${Math.round((selected.probability ?? 0) * 100)}%`, color: DIR_COLOR[selected.direction] },
              { label: "CONFIDENCE",  value: selected.confidence, color: CONF_COLOR[selected.confidence?.toUpperCase()] },
              { label: "KELLY SIZE",  value: `${selected.kelly_size?.toFixed(1)}%`, color: "var(--text-primary)" },
              { label: "RISK/REWARD", value: selected.risk_reward ? `1:${selected.risk_reward.toFixed(1)}` : "—", color: selected.risk_reward && selected.risk_reward >= 2 ? "#00ff88" : "var(--text-primary)" },
              { label: "TAKE PROFIT", value: selected.take_profit ? `$${selected.take_profit.toLocaleString(undefined,{maximumFractionDigits:decimalsFor(selected.take_profit)})}` : "—", color: "#00ff88" },
              { label: "STOP LOSS",   value: selected.stop_loss ? `$${selected.stop_loss.toLocaleString(undefined,{maximumFractionDigits:decimalsFor(selected.stop_loss)})}` : "—", color: "#ff4d6d" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ fontFamily: mono, fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em" }}>{row.label}</span>
                <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: row.color ?? "var(--text-primary)", textTransform: "capitalize" }}>{typeof row.value === "string" ? row.value.toLowerCase() : row.value}</span>
              </div>
            ))}

            {/* Reasoning */}
            {(selected.reasoning || selected.rationale) && (
              <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", borderLeft: `2px solid ${DIR_COLOR[selected.direction] ?? "var(--border-default)"}44` }}>
                <div style={{ fontFamily: mono, fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.12em", marginBottom: 6 }}>REASONING</div>
                <p style={{ margin: 0, fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.6 }}>{selected.reasoning || selected.rationale}</p>
              </div>
            )}

            {/* Top features */}
            {selected.top_features && selected.top_features.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontFamily: mono, fontSize: 7, color: "var(--text-disabled)", letterSpacing: "0.12em", marginBottom: 6 }}>TOP FEATURES</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {selected.top_features.slice(0, 6).map((f, i) => (
                    <span key={i} style={{ fontFamily: mono, fontSize: 8, color: "var(--text-tertiary)", background: "var(--bg-elevated)", borderRadius: 3, padding: "3px 6px" }}>{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
