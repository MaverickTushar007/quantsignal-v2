"use client";
import { useState, useEffect, useRef } from "react";
import { fetchSignals, type Signal } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface Trade {
  id: string; date: string; symbol: string; name: string; icon: string;
  direction: "BUY" | "SELL"; entry: number; exit: number | null;
  size: number; notes: string; status: "open" | "closed"; pnl?: number;
}

const STORAGE_KEY = "qs_journal_trades";
function loadTrades(): Trade[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; } }
function saveTrades(t: Trade[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); }

function TickerDropdown({ signals, value, onChange }: { signals: Signal[]; value: string; onChange: (s: Signal) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const mono = "var(--font-mono)", sans = "var(--font-sans)";

  useEffect(() => { setQ(value); }, [value]);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const filtered = signals.filter(s => {
    const query = q.toLowerCase();
    return !query || s.symbol.toLowerCase().includes(query) || s.name?.toLowerCase().includes(query);
  }).slice(0, 10);

  const dirColor = (d: string) => d === "BUY" ? "#00ff88" : d === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.3)";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Search ticker…"
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 12, fontFamily: mono, outline: "none" }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#1a1b21", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", zIndex: 200, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.6)", maxHeight: 280, overflowY: "auto" }}>
          {filtered.map(s => (
            <div key={s.symbol} onMouseDown={() => { onChange(s); setQ(s.symbol); setOpen(false); }}
              style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: "1px solid var(--border-subtle)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 30, height: 30, background: "var(--bg-elevated)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{s.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{s.display}</div>
                <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 1 }}>{s.name}</div>
              </div>
              <div>
                <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-tertiary)", marginBottom: 3 }}>${s.current_price?.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: dirColor(s.direction), border: `1px solid ${dirColor(s.direction)}44`, borderRadius: 2, padding: "1px 5px", letterSpacing: "0.08em", textAlign: "right" }}>{s.direction}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JournalPage() {
  const { session } = useAuth();
  const [trades, setTrades]   = useState<Trade[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [filter, setFilter]   = useState<"all"|"open"|"closed">("all");
  const [form, setForm] = useState({
    symbol: "", name: "", icon: "", direction: "BUY" as "BUY"|"SELL",
    entry: "", exit: "", size: "", notes: "",
    date: new Date().toISOString().slice(0,10),
  });

  const mono = "var(--font-mono)", sans = "var(--font-sans)", display = "var(--font-display)";

  useEffect(() => { setTrades(loadTrades()); }, []);
  useEffect(() => { fetchSignals(session?.access_token).then(setSignals).catch(() => {}); }, [session]);

  function selectTicker(s: Signal) {
    setForm(p => ({ ...p, symbol: s.symbol, name: s.name, icon: s.icon, direction: s.direction === "SELL" ? "SELL" : "BUY" }));
  }

  function addTrade() {
    if (!form.symbol || !form.entry) return;
    const exit = form.exit ? Number(form.exit) : null;
    const entry = Number(form.entry);
    const size = Number(form.size) || 0;
    const pnl = exit != null ? (exit - entry) / entry * 100 * (form.direction === "SELL" ? -1 : 1) : undefined;
    const t: Trade = { id: Date.now().toString(), date: form.date, symbol: form.symbol, name: form.name, icon: form.icon, direction: form.direction, entry, exit, size, notes: form.notes, status: exit != null ? "closed" : "open", pnl };
    const updated = [t, ...trades];
    setTrades(updated); saveTrades(updated);
    setForm({ symbol: "", name: "", icon: "", direction: "BUY", entry: "", exit: "", size: "", notes: "", date: new Date().toISOString().slice(0,10) });
    setShowForm(false);
  }

  function deleteTrade(id: string) { const u = trades.filter(t => t.id !== id); setTrades(u); saveTrades(u); }

  const filtered = trades.filter(t => filter === "all" || t.status === filter);
  const closed = trades.filter(t => t.status === "closed" && t.pnl != null);
  const wins = closed.filter(t => (t.pnl ?? 0) > 0);
  const winRate = closed.length > 0 ? wins.length / closed.length * 100 : null;
  const avgPnl = closed.length > 0 ? closed.reduce((a, t) => a + (t.pnl ?? 0), 0) / closed.length : null;
  const dirColor = (d: string) => d === "BUY" ? "#00ff88" : "#ff4d6d";

  return (
    <div style={{ padding: "24px 28px", fontFamily: sans, color: "var(--text-primary)" }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 6 }}>JOURNAL</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 400 }}>Trade Journal</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Log trades you take from signals. Track your real-world P&L and win rate.</div>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={{ padding: "8px 18px", background: showForm ? "var(--bg-elevated)" : "var(--brand)", border: "1px solid", borderColor: showForm ? "var(--border-default)" : "var(--brand)", borderRadius: "var(--radius-sm)", color: showForm ? "var(--text-secondary)" : "#000", fontSize: 12, fontWeight: 700, fontFamily: sans, cursor: "pointer" }}>
          {showForm ? "Cancel" : "+ Log Trade"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "TOTAL TRADES", value: String(trades.length) },
          { label: "OPEN POSITIONS", value: String(trades.filter(t=>t.status==="open").length), color: "#f59e0b" },
          { label: "WIN RATE", value: winRate != null ? `${winRate.toFixed(1)}%` : "—", color: "#00ff88", sub: `${wins.length} of ${closed.length} closed` },
          { label: "AVG P&L", value: avgPnl != null ? `${avgPnl > 0 ? "+" : ""}${avgPnl.toFixed(2)}%` : "—", color: avgPnl != null ? (avgPnl >= 0 ? "#00ff88" : "#ff4d6d") : undefined },
        ].map(m => (
          <div key={m.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "14px 18px" }}>
            <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: (m as any).color ?? "var(--text-primary)" }}>{m.value}</div>
            {(m as any).sub && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3 }}>{(m as any).sub}</div>}
          </div>
        ))}
      </div>

      {/* Log form */}
      {showForm && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 20, animation: "slideIn 0.2s ease" }}>
          <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, marginBottom: 16 }}>LOG NEW TRADE</div>

          {/* Row 1: ticker + key fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 5 }}>TICKER</div>
              <TickerDropdown signals={signals} value={form.symbol} onChange={selectTicker} />
              {form.name && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>{form.icon} {form.name}</div>}
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 5 }}>DATE</div>
              <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 12, fontFamily: mono, outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 5 }}>ENTRY PRICE ($)</div>
              <input type="number" value={form.entry} onChange={e => setForm(p => ({...p, entry: e.target.value}))} placeholder="e.g. 94000"
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 12, fontFamily: mono, outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 5 }}>EXIT PRICE ($) <span style={{color:"var(--text-disabled)"}}>optional</span></div>
              <input type="number" value={form.exit} onChange={e => setForm(p => ({...p, exit: e.target.value}))} placeholder="Leave blank if open"
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 12, fontFamily: mono, outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 5 }}>POSITION SIZE ($)</div>
              <input type="number" value={form.size} onChange={e => setForm(p => ({...p, size: e.target.value}))} placeholder="e.g. 1000"
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 12, fontFamily: mono, outline: "none" }} />
            </div>
          </div>

          {/* Row 2: direction + notes + submit */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 5 }}>DIRECTION</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["BUY","SELL"] as const).map(d => (
                  <button key={d} onClick={() => setForm(p => ({...p, direction: d}))} style={{ flex: 1, padding: "8px 0", background: form.direction === d ? (d === "BUY" ? "rgba(0,255,136,0.15)" : "rgba(255,77,109,0.15)") : "var(--bg-elevated)", border: `1px solid ${form.direction === d ? dirColor(d) + "66" : "var(--border-default)"}`, borderRadius: "var(--radius-sm)", color: form.direction === d ? dirColor(d) : "var(--text-disabled)", fontSize: 10, fontWeight: 700, fontFamily: mono, cursor: "pointer", letterSpacing: "0.08em" }}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono, marginBottom: 5 }}>NOTES / RATIONALE</div>
              <input type="text" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Why did you take this trade? What was the setup?"
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: 12, fontFamily: sans, outline: "none" }} />
            </div>
            <button onClick={addTrade} disabled={!form.symbol || !form.entry} style={{ padding: "8px 24px", background: form.symbol && form.entry ? "var(--brand)" : "var(--bg-elevated)", border: "1px solid", borderColor: form.symbol && form.entry ? "var(--brand)" : "var(--border-default)", borderRadius: "var(--radius-sm)", color: form.symbol && form.entry ? "#000" : "var(--text-disabled)", fontSize: 12, fontWeight: 700, fontFamily: sans, cursor: form.symbol && form.entry ? "pointer" : "not-allowed" }}>Log Trade</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["all","open","closed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", background: filter === f ? "var(--brand-dim)" : "transparent", border: `1px solid ${filter === f ? "var(--brand-border)" : "var(--border-default)"}`, borderRadius: "var(--radius-sm)", color: filter === f ? "var(--brand)" : "var(--text-disabled)", fontSize: 10, fontWeight: 600, fontFamily: mono, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>{f}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-disabled)", display: "flex", alignItems: "center" }}>{filtered.length} trades</div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 160px 70px 110px 110px 90px 90px 1fr 36px", padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
          {["DATE","ASSET","DIR","ENTRY","EXIT","P&L","SIZE","NOTES",""].map(h => (
            <div key={h} style={{ fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em", fontFamily: mono }}>{h}</div>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "70px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-disabled)", letterSpacing: "0.12em", marginBottom: 8 }}>NO TRADES LOGGED</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 }}>Pick a signal, take a trade, log it here. Track if you're actually winning.</div>
            <button onClick={() => setShowForm(true)} style={{ padding: "9px 20px", background: "var(--brand)", border: "none", borderRadius: "var(--radius-md)", color: "#000", fontSize: 12, fontWeight: 700, fontFamily: sans, cursor: "pointer" }}>Log First Trade</button>
          </div>
        ) : filtered.map((t, i) => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "90px 160px 70px 110px 110px 90px 90px 1fr 36px", padding: "12px 20px", borderBottom: i < filtered.length-1 ? "1px solid var(--border-subtle)" : "none", alignItems: "center", transition: "background 0.1s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-tertiary)" }}>{t.date}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, background: "var(--bg-elevated)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{t.icon || "?"}</div>
              <div>
                <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{t.symbol}</div>
                <div style={{ fontSize: 9, color: "var(--text-disabled)" }}>{t.name}</div>
              </div>
            </div>
            <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: dirColor(t.direction), border: `1px solid ${dirColor(t.direction)}44`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.08em", width: "fit-content" }}>{t.direction}</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: "var(--text-primary)" }}>${t.entry.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: t.exit != null ? "var(--text-primary)" : "var(--text-disabled)" }}>{t.exit != null ? `$${t.exit.toLocaleString(undefined,{maximumFractionDigits:2})}` : "—"}</div>
            <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: t.pnl != null ? (t.pnl >= 0 ? "#00ff88" : "#ff4d6d") : "var(--text-disabled)" }}>
              {t.pnl != null ? `${t.pnl > 0 ? "+" : ""}${t.pnl.toFixed(2)}%` : <span style={{ fontFamily: mono, fontSize: 9, color: "#f59e0b", letterSpacing: "0.08em" }}>OPEN</span>}
            </div>
            <div style={{ fontFamily: mono, fontSize: 12, color: "var(--text-tertiary)" }}>{t.size > 0 ? `$${t.size.toLocaleString()}` : "—"}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes || "—"}</div>
            <button onClick={() => deleteTrade(t.id)} style={{ background: "transparent", border: "none", color: "var(--text-disabled)", fontSize: 15, cursor: "pointer", padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ff4d6d")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-disabled)")}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
