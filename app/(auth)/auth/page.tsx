"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup" | "reset";

const LIVE_SIGNALS = [
  { symbol: "BTC", dir: "LONG",  conf: 87, regime: "Bull trend",    entry: "94,210", target: "98,800" },
  { symbol: "ETH", dir: "LONG",  conf: 74, regime: "Accumulation",  entry: "3,180",  target: "3,620"  },
  { symbol: "SPY", dir: "SHORT", conf: 81, regime: "Distribution",  entry: "512.40", target: "498.00" },
  { symbol: "GLD", dir: "LONG",  conf: 69, regime: "Bull trend",    entry: "218.70", target: "228.00" },
  { symbol: "QQQ", dir: "SHORT", conf: 78, regime: "Bear trend",    entry: "434.20", target: "418.50" },
];

const STATS = [
  { label: "Signals live",    value: "186"   },
  { label: "Win rate",        value: "73.4%" },
  { label: "Avg confluence",  value: "81.2"  },
  { label: "Assets covered",  value: "47"    },
];

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode]         = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [message, setMessage]   = useState("");
  const [tick, setTick]         = useState(0);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 3200);
    return () => clearInterval(t);
  }, []);

  async function handleSubmit() {
    setError(""); setMessage(""); setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setMessage("Reset link sent — check your inbox.");
      }
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  const active = LIVE_SIGNALS[tick % LIVE_SIGNALS.length];
  const display = "var(--font-display)";
  const sans    = "var(--font-sans)";
  const mono    = "var(--font-mono)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", fontFamily: sans, color: "var(--text-primary)", overflow: "hidden" }}>

      {/* ── LEFT — Product story ── */}
      <div style={{ flex: "0 0 54%", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", padding: "44px 52px", position: "relative", overflow: "hidden" }}>

        {/* Ambient glow */}
        <div style={{ position: "absolute", top: -140, left: -100, width: 560, height: 560, background: "radial-gradient(circle, rgba(0,255,136,0.05) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, right: -60, width: 360, height: 360, background: "radial-gradient(circle, rgba(0,100,255,0.03) 0%, transparent 65%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 56 }}>
            <div style={{ width: 26, height: 26, background: "var(--brand)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000", fontFamily: mono, flexShrink: 0 }}>Q</div>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>QuantSignal</span>
            <div style={{ marginLeft: 4, display: "flex", alignItems: "center", gap: 5, background: "var(--brand-dim)", border: "1px solid var(--brand-border)", borderRadius: 3, padding: "2px 7px" }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand)" }} />
              <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: "var(--brand)", letterSpacing: "0.1em" }}>LIVE</span>
            </div>
          </div>

          {/* Hero — DM Serif Display only here */}
          <div style={{ marginBottom: 44 }}>
            <h1 style={{ fontFamily: display, fontSize: 38, fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.01em", margin: "0 0 16px", color: "var(--text-primary)" }}>
              Institutional-grade<br />
              <em style={{ color: "var(--brand)", fontStyle: "italic" }}>signal intelligence.</em>
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 380, margin: 0, fontWeight: 400 }}>
              Confluence-weighted signals across crypto, equities, and macro —
              computed by a multi-model ensemble with regime awareness.
            </p>
          </div>

          {/* Active signal */}
          <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid var(--brand-border)", borderRadius: "var(--radius-lg)", padding: "18px 22px", marginBottom: 20 }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(0,255,136,0.55)", letterSpacing: "0.14em", fontWeight: 600, marginBottom: 14 }}>ACTIVE SIGNAL</div>
            {mounted && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{active.symbol}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>{active.regime}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 700, color: "var(--brand)", lineHeight: 1 }}>{active.conf}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>Confluence</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: active.dir === "LONG" ? "var(--brand)" : "var(--accent-red)", letterSpacing: "0.08em", marginBottom: 6 }}>{active.dir}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Entry <span style={{ fontFamily: mono, color: "var(--text-secondary)" }}>${active.entry}</span></div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Target <span style={{ fontFamily: mono, color: "var(--brand)" }}>${active.target}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Signal feed */}
          <div style={{ marginBottom: "auto" }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.14em", marginBottom: 10 }}>SIGNAL FEED</div>
            {LIVE_SIGNALS.map((s, i) => {
              const isActive = mounted && i === tick % LIVE_SIGNALS.length;
              return (
                <div key={s.symbol} style={{
                  display: "flex", alignItems: "center", gap: 0,
                  padding: "8px 12px", borderRadius: "var(--radius-sm)",
                  background: isActive ? "var(--brand-dim)" : "transparent",
                  borderLeft: `2px solid ${isActive ? "var(--brand)" : "transparent"}`,
                  transition: "all 0.4s ease",
                  marginBottom: 1,
                }}>
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: "var(--text-primary)", width: 44 }}>{s.symbol}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: s.dir === "LONG" ? "var(--brand)" : "var(--accent-red)", width: 48 }}>{s.dir}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", flex: 1 }}>{s.regime}</span>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>{s.conf}</span>
                </div>
              );
            })}
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--border-subtle)" }}>
            {STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: "var(--brand)", marginBottom: 3 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT — Auth form ── */}
      <div style={{ flex: "0 0 46%", display: "flex", alignItems: "center", justifyContent: "center", padding: "44px 52px", background: "var(--bg-surface)" }}>
        <div style={{ width: "100%", maxWidth: 340 }}>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontFamily: display, fontSize: 26, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
              {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
              {mode === "login"  ? "Access your signal intelligence dashboard" :
               mode === "signup" ? "Start with 5 free signals per day"         :
               "We'll send a reset link to your email"}
            </p>
          </div>

          {/* Mode tabs */}
          <div style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: 3, marginBottom: 20 }}>
            {(["login", "signup"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setMessage(""); }} style={{
                flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 500,
                border: "none", cursor: "pointer", borderRadius: "var(--radius-sm)",
                fontFamily: sans, transition: "all 0.15s",
                background: mode === m ? "var(--bg-overlay)" : "transparent",
                color: mode === m ? "var(--text-primary)" : "var(--text-tertiary)",
              }}>
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* Google */}
          <button onClick={handleGoogle} disabled={loading} style={{
            width: "100%", padding: "11px 0", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "transparent", border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)", cursor: loading ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontFamily: sans, transition: "border-color 0.15s",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
            <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)", marginBottom: 6 }}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="you@fund.com"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: 13, fontFamily: sans, outline: "none" }} />
            </div>
            {mode !== "reset" && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)", marginBottom: 6 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="••••••••"
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: 13, fontFamily: sans, outline: "none" }} />
              </div>
            )}
          </div>

          {error   && <div style={{ fontSize: 12, color: "var(--accent-red)", background: "rgba(255,77,109,0.07)", border: "1px solid rgba(255,77,109,0.18)", borderRadius: "var(--radius-sm)", padding: "8px 12px", marginBottom: 12 }}>{error}</div>}
          {message && <div style={{ fontSize: 12, color: "var(--brand)",      background: "var(--brand-dim)",      border: "1px solid var(--brand-border)",   borderRadius: "var(--radius-sm)", padding: "8px 12px", marginBottom: 12 }}>{message}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", padding: "12px 0",
            background: loading ? "rgba(0,255,136,0.3)" : "var(--brand)",
            border: "none", borderRadius: "var(--radius-md)", color: "#000",
            fontSize: 13, fontWeight: 600, fontFamily: sans,
            cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s",
          }}>
            {loading ? "..." : mode === "login" ? "Access dashboard →" : mode === "signup" ? "Create account →" : "Send reset link →"}
          </button>

          {mode === "login" && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={() => { setMode("reset"); setError(""); setMessage(""); }}
                style={{ background: "transparent", border: "none", color: "var(--text-disabled)", fontSize: 12, cursor: "pointer", fontFamily: sans }}>
                Forgot password?
              </button>
            </div>
          )}

          {/* Trust markers */}
          <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--border-subtle)" }}>
            {[
              "Multi-model ensemble — 7 independent models",
              "Regime-aware confluence scoring",
              "Real-time liquidity & order flow analysis",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 9 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand)", marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
