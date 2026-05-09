"use client";
import CommandMenu from "@/components/CommandMenu";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",  icon: "▣", desc: "Signals & market" },
  { href: "/signals",    label: "Signals",     icon: "◎", desc: "Live signal feed" },
  { href: "/backtest",   label: "Backtest",    icon: "◈", desc: "WF validation results" },
  { href: "/research",   label: "Research",    icon: "◑", desc: "Evidence intel" },
  { href: "/calendar",   label: "Calendar",    icon: "▦", desc: "Econ events" },
  { href: "/news",       label: "News",        icon: "◪", desc: "Market news feed" },
  { href: "/agents",     label: "Agents",      icon: "◉", desc: "AI agents" },

];

const CAL_API = process.env.NEXT_PUBLIC_API_URL || "https://quantsignal-api.onrender.com/api/v1";

function CalendarStrip() {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${CAL_API}/calendar/events`)
      .then(r => r.json())
      .then(d => {
        const all = [...(d.upcoming||[]), ...(d.past||[])];
        const today = new Date();
        const todayStr = today.getDate().toString();
        const todays = all.filter((e: any) => {
          const d = e.date_display || "";
          return d.split(" ")[2] === todayStr;
        }).slice(0, 3);
        setEvents(todays);
      })
      .catch(() => {});
  }, []);

  if (events.length === 0) return null;

  const impactColor = (i: string) => i === "High" ? "#ff4466" : i === "Medium" ? "#f59e0b" : "rgba(255,255,255,0.2)";

  return (
    <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", marginBottom: 6 }}>TODAY</div>
      {events.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: i < events.length-1 ? 6 : 0 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: impactColor(e.impact), flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{e.title}</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>{e.time_display || "All day"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isPro, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)" }}>
      <div style={{ fontSize: 11, color: "var(--text-disabled)", letterSpacing: "0.15em" }}>LOADING...</div>
    </div>
  );

  if (!user) return null;

  const currentPage = NAV.find(n => pathname === n.href || pathname.startsWith(n.href + "/"));

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)",
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
        overflow: "hidden",
      }}>

        {/* Logo row */}
        <div style={{ padding: collapsed ? "14px 0" : "14px var(--space-4)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 22, height: 22, background: "var(--brand)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#000", flexShrink: 0 }}>Q</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>QuantSignal</span>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4, fontSize: 12, lineHeight: 1, flexShrink: 0 }}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Plan badge */}
        {!collapsed && (
          <div style={{ padding: "8px var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: isPro ? "var(--accent-gold-dim)" : "rgba(255,255,255,0.03)", border: isPro ? "1px solid rgba(255,215,0,0.25)" : "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "3px 8px" }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: isPro ? "var(--accent-gold)" : "var(--text-disabled)" }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: isPro ? "var(--accent-gold)" : "var(--text-tertiary)", letterSpacing: "0.12em" }}>{isPro ? "PRO" : "FREE"}</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "6px 0", overflowY: "auto" }}>
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: collapsed ? "10px 0" : "9px var(--space-4)",
                justifyContent: collapsed ? "center" : "flex-start",
                textDecoration: "none",
                background: active ? "var(--brand-dim)" : "transparent",
                borderLeft: active ? "2px solid var(--brand)" : "2px solid transparent",
                transition: "all 0.12s",
              }}>
                <span style={{ fontSize: 13, color: active ? "var(--brand)" : "var(--text-tertiary)", flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: active ? "var(--text-primary)" : "var(--text-secondary)", letterSpacing: "0.05em" }}>{item.label}</div>
                    <div style={{ fontSize: 9, color: "var(--text-disabled)", marginTop: 1 }}>{item.desc}</div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding: collapsed ? "10px 0" : "10px var(--space-4)", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8, justifyContent: collapsed ? "center" : "flex-start", flexShrink: 0 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--brand-dim)", border: "1px solid var(--brand-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--brand)", flexShrink: 0 }}>
            {user.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ fontSize: 9, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
              <button
                onClick={async () => { const { supabase } = await import("@/lib/supabase"); await supabase.auth.signOut(); router.replace("/auth"); }}
                style={{ background: "transparent", border: "none", color: "var(--text-disabled)", fontSize: 8, cursor: "pointer", padding: 0, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginTop: 2 }}>
                SIGN OUT
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <div style={{ height: "var(--topbar-height)", flexShrink: 0, borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-5)", background: "var(--bg-surface)" }}>
          <CommandMenu />
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", letterSpacing: "0.12em" }}>
            {currentPage?.label?.toUpperCase() ?? "QUANTSIGNAL"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand)", boxShadow: "0 0 6px rgba(0,255,136,0.5)" }} />
              <span style={{ fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>LIVE</span>
            </div>
            {!isPro && (
              <Link href="/pricing" style={{ fontSize: 9, fontWeight: 700, color: "var(--brand)", border: "1px solid var(--brand-border)", borderRadius: "var(--radius-sm)", padding: "3px 10px", textDecoration: "none", letterSpacing: "0.08em", background: "var(--brand-dim)" }}>
                UPGRADE →
              </Link>
            )}
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
