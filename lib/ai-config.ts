import { useMemo, useSyncExternalStore } from "react";

/* Bring Your Own AI, on the browser side.
 *
 * The student's provider, model and API key live in this browser only
 * (localStorage), never on our server. Each request that needs a model carries
 * them in the X-Learis-AI header; the agent service uses them for that request
 * and keeps nothing. Clearing them here is all it takes to disconnect.
 */

export type AIConfig = {
  provider: string;
  base_url: string;
  model: string;
  api_key: string;
  /** A cheaper or stronger model for one agent (P1): evidence, roadmap, planner, profile. */
  agent_models?: Record<string, string>;
  /** Let agents choose their own tools (function calling). Unset: the provider's default. */
  tools?: boolean;
};

const KEY = "learis.ai";

export function loadAI(): AIConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AIConfig) : null;
  } catch {
    return null;
  }
}

export function saveAI(cfg: AIConfig | null): void {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Private windows can refuse storage; the page still works for this session.
  }
}

/** base64 of UTF-8 JSON, which is what core/ai.from_header reads. */
export function encodeAI(cfg: AIConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function maskKey(key: string): string {
  if (!key) return "no key";
  return key.length <= 8 ? "••••" : `${key.slice(0, 3)}…${key.slice(-4)}`;
}

/** POST to the agent service through the Next proxy, with the AI settings when asked. */
export async function call<T = unknown>(
  path: string,
  body?: unknown,
  opts: { ai?: boolean; ai_config?: AIConfig | null; method?: "GET" | "POST" } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const cfg = opts.ai_config ?? (opts.ai ? loadAI() : null);
  if (cfg) headers["x-learis-ai"] = encodeAI(cfg);
  const res = await fetch(`/api/learis/${path}`, {
    method: opts.method ?? (body === undefined ? "GET" : "POST"),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

/* ------------------------------------------------------------- React hook */

const EVENT = "learis-ai-change";

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function rawSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The saved AI settings, kept in sync across components and tabs. Null on the server. */
export function useAIConfig(): AIConfig | null {
  const raw = useSyncExternalStore(subscribe, rawSnapshot, () => null);
  return useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as AIConfig) : null;
    } catch {
      return null;
    }
  }, [raw]);
}
