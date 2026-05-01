import type { Metadata } from "next";
import "@/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuantSignal — Institutional-Grade Trading Intelligence",
  description: "AI-powered signal generation, confluence scoring, and regime-aware portfolio analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: "#07080a", color: "#e2e8f0", fontFamily: "var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
