"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchSignals, type Signal } from "@/lib/api";

const PAGES = [
  { label: "Dashboard", sub: "Signals & market", path: "/dashboard", icon: "▦" },
  { label: "Signals", sub: "Live signal feed", path: "/signals", icon: "◈" },
  { label: "Research", sub: "Evidence intel", path: "/research", icon: "◎" },
  { label: "Portfolio", sub: "Holdings", path: "/portfolio", icon: "◇" },
  { label: "Perseus", sub: "AI agents", path: "/agents", icon: "◉" },
  { label: "Journal", sub: "Trade log", path: "/journal", icon: "▤" },
  { label: "Alerts", sub: "Notifications", path: "/alerts", icon: "▲" },
];

interface Result {
  type: "page" | "signal";
  label: string; sub: string; icon: string; path: string;
  direction?: string; probability?: number;
}

export default function CommandMenu() {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [idx, setIdx]         = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const mono = "var(--font-mono)", sans = "var(--font-sans)";

  useEffect(() => { fetchSignals().then(setSignals).catch(() => {}); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(o => !o); setQuery(""); setIdx(0); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const q = query.toLowerCase();
  const pageResults = PAGES.filter(p => !q || p.label.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q))
    .map(p => ({ type: "page" as const, ...p }));
  const sigResults = signals.filter(s => q && (s.symbol.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q)))
    .slice(0, 6)
    .map(s => ({ type: "signal" as const, label: s.display, sub: s.name, icon: s.icon, path: `/research?symbol=${s.symbol}`, direction: s.direction, probability: s.probability }));
  const results: Result[] = [...pageResults, ...sigResults];

  useEffect(() => { setIdx(0); }, [query]);

  function navigate(r: Result) { router.push(r.path); setOpen(false); setQuery(""); }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[idx]) navigate(results[idx]);
  }

  useEffect(() => {
    const el = listRef.current?.children[idx] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const dirColor = (d?: string) => d === "BUY" ? "#00ff88" : d === "SELL" ? "#ff4d6d" : "rgba(226,232,240,0.3)";

  return (
    <>
      <button onClick={() => { setOpen(true); setQuery(""); setIdx(0); }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", color: "var(--text-disabled)", fontSize: 11, fontFamily: mono, cursor: "pointer" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-default)")}
      >
        <span style={{ fontSize: 13 }}>⌕</span>
        <span>Search…</span>
        <kbd style={{ fontSize: 9, background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 3, padding: "1px 5px", marginLeft: 4 }}>⌘K</kbd>
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}>
          <style>{`@keyframes cmdIn{from{opacity:0;transform:scale(0.97) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div style={{ width: 560, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", animation: "cmdIn 0.15s ease" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 16, color: "var(--text-disabled)" }}>⌕</span>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Search pages, signals, assets…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 14, fontFamily: sans }} />
              <kbd style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 3, padding: "2px 6px" }}>ESC</kbd>
            </div>

            <div ref={listRef} style={{ maxHeight: 400, overflowY: "auto" }}>
              {results.length === 0 ? (
                <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-disabled)", fontSize: 13 }}>No results for "{query}"</div>
              ) : (
                <>
                  {pageResults.length > 0 && (
                    <>
                      <div style={{ padding: "10px 20px 4px", fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono }}>PAGES</div>
                      {pageResults.map((r) => {
                        const gi = results.indexOf(r);
                        return (
                          <div key={r.path} onClick={() => navigate(r)}
                            style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: idx === gi ? "var(--brand-dim)" : "transparent", borderLeft: `2px solid ${idx === gi ? "var(--brand)" : "transparent"}` }}
                            onMouseEnter={() => setIdx(gi)}>
                            <div style={{ width: 32, height: 32, background: "var(--bg-elevated)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: idx === gi ? "var(--brand)" : "var(--text-tertiary)", flexShrink: 0 }}>{r.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: idx === gi ? "var(--text-primary)" : "var(--text-secondary)" }}>{r.label}</div>
                              <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 1 }}>{r.sub}</div>
                            </div>
                            {idx === gi && <span style={{ fontFamily: mono, fontSize: 9, color: "var(--brand)" }}>↵</span>}
                          </div>
                        );
                      })}
                    </>
                  )}
                  {sigResults.length > 0 && (
                    <>
                      <div style={{ padding: "10px 20px 4px", fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", fontFamily: mono, borderTop: pageResults.length > 0 ? "1px solid var(--border-subtle)" : "none" }}>SIGNALS</div>
                      {sigResults.map((r) => {
                        const gi = results.indexOf(r);
                        return (
                          <div key={r.path + r.label} onClick={() => navigate(r)}
                            style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: idx === gi ? "var(--brand-dim)" : "transparent", borderLeft: `2px solid ${idx === gi ? "var(--brand)" : "transparent"}` }}
                            onMouseEnter={() => setIdx(gi)}>
                            <div style={{ width: 32, height: 32, background: "var(--bg-elevated)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: mono, color: idx === gi ? "var(--text-primary)" : "var(--text-secondary)" }}>{r.label}</div>
                              <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 1 }}>{r.sub}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              {r.probability != null && <span style={{ fontFamily: mono, fontSize: 11, color: r.probability >= 0.65 ? "#00ff88" : r.probability >= 0.5 ? "#f59e0b" : "#ff4d6d" }}>{Math.round(r.probability * 100)}%</span>}
                              {r.direction && <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: dirColor(r.direction), border: `1px solid ${dirColor(r.direction)}44`, borderRadius: 3, padding: "2px 6px", letterSpacing: "0.08em" }}>{r.direction}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 16 }}>
              {[["↑↓","Navigate"],["↵","Open"],["ESC","Close"]].map(([key, label]) => (
                <div key={key} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <kbd style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 3, padding: "2px 5px" }}>{key}</kbd>
                  <span style={{ fontSize: 10, color: "var(--text-disabled)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
