"use client";

import { useEffect, useState } from "react";

/* The deployment's own model (for example Amazon Bedrock), used when the
 * browser has not connected one. Read once from /health and shared. */
export type ServerAI = { model: string; provider: string } | null;

let cached: Promise<ServerAI> | null = null;

function fetchServerAI(): Promise<ServerAI> {
  cached ??= fetch("/api/learis/health", { cache: "no-store" })
    .then((r) => r.json())
    .then((d: { server_ai?: boolean; server_ai_model?: string; server_ai_provider?: string }) =>
      d.server_ai && d.server_ai_model ? { model: d.server_ai_model, provider: d.server_ai_provider ?? "server" } : null)
    .catch(() => null);
  return cached;
}

/** undefined while loading, null when the deployment has no model of its own. */
export function useServerAI(): ServerAI | undefined {
  const [v, setV] = useState<ServerAI | undefined>(undefined);
  useEffect(() => { void fetchServerAI().then(setV); }, []);
  return v;
}
