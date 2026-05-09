export default function PricingPage() {
  return (
    <div style={{ padding: "40px", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>QuantSignal Pro</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>Institutional-grade signals for retail traders.</p>
      <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 32, background: "var(--bg-surface)" }}>
        <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>₹499<span style={{ fontSize: 16, fontWeight: 400, color: "var(--text-secondary)" }}>/month</span></div>
        <ul style={{ listStyle: "none", padding: 0, margin: "24px 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 2 }}>
          <li>✓ 185 live signals across crypto, stocks, forex</li>
          <li>✓ Perseus AI analyst — ask anything</li>
          <li>✓ Real-time alerts via Telegram</li>
          <li>✓ Confluence engine + conviction ratings</li>
          <li>✓ Backtest track record</li>
        </ul>
        <a href="mailto:tusharbhatt.official.2004@gmail.com?subject=QuantSignal Pro" style={{ display: "block", textAlign: "center", background: "var(--brand)", color: "#000", fontWeight: 700, padding: "12px 0", borderRadius: 8, textDecoration: "none", fontSize: 15 }}>
          Get Access
        </a>
      </div>
    </div>
  );
}
