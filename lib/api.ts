const API_BASE = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url.replace(/\/$/, "");
})();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type SignalDirection = "BUY" | "SELL" | "HOLD";

export interface Signal {
  symbol: string; display: string; name: string; type: string; icon: string;
  direction: SignalDirection; probability: number; confidence: string;
  current_price: number; kelly_size: number;
  expected_value?: number; take_profit?: number; risk_reward?: number; atr?: number;
  stop_loss?: number; entry_low?: number; entry_high?: number;
  confluence_score?: string; entry_price?: number; target_price?: number;
  regime?: string; timeframe?: string; rationale?: string; reasoning?: string;
  model_agreement?: number; top_features?: string[];
  confluence?: { name: string; value: string; signal: string }[];
  news?: { title: string; source: string; sentiment: string; url: string }[];
  price_change_pct?: number; indicators?: Record<string, string | number>;
  generated_at?: string; signal_age_hours?: number; is_stale?: boolean;
  [key: string]: any;
}

export async function fetchSignals(token?: string): Promise<Signal[]> {
  return request<Signal[]>("/api/v1/signals", { headers: token ? authHeader(token) : {} });
}
export async function fetchSignalReasoning(symbol: string, token?: string): Promise<any> {
  return request(`/api/v1/signals/${symbol}/reasoning`, { headers: token ? authHeader(token) : {} });
}
export async function fetchNews(symbol: string, token?: string): Promise<any> {
  return request(`/api/v1/news/${symbol}`, { headers: token ? authHeader(token) : {} });
}
export async function fetchRegime(symbol: string, token?: string): Promise<any> {
  return request(`/api/v1/regime/${symbol}`, { headers: token ? authHeader(token) : {} });
}
export async function fetchHealth(): Promise<{ status: string; signals_count: number }> {
  return request("/api/v1/health");
}

export interface PerseusMessage { role: "user" | "assistant"; content: string; }

// Streaming chat — calls onToken for each chunk, returns full response
export async function streamPerseusChat(
  messages: PerseusMessage[],
  onToken: (token: string) => void,
  token?: string
): Promise<string> {
  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content,
  }));
  const message = messages[messages.length - 1].content;

  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? authHeader(token) : {}),
    },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Chat failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const obj = JSON.parse(line.slice(6));
        if (obj.type === "token" && obj.content) {
          full += obj.content;
          onToken(obj.content);
        }
      } catch {}
    }
  }
  return full;
}
export async function fetchSignal(symbol: string, token?: string): Promise<any> {
  return request<any>(`/api/v1/signals/${symbol}`, { headers: token ? authHeader(token) : {} });
}
