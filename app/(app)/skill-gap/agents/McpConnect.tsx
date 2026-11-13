"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/** How to call LEARIS from the student's own agent over MCP. */
export function McpConnect() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  // The origin is only known in the browser; the server renders a placeholder.
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "https://<your-learis>");
  const url = `${origin}/api/learis/mcp`;
  const config = JSON.stringify({
    mcpServers: { learis: { type: "http", url, headers: { Authorization: `Bearer ${token || "<token>"}` } } },
  }, null, 2);

  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground leading-relaxed">
        Your own agent (Claude Code, Orca, any MCP client) can call LEARIS as you:{" "}
        <span className="font-mono">extract_skills</span>, <span className="font-mono">get_gap_map</span>,{" "}
        <span className="font-mono">build_plan</span> and five more. The token is your session; it
        expires when you sign out or after 12 hours. Do not share it.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={async () => {
          setError("");
          const r = await fetch("/api/mcp-token");
          const d = await r.json();
          if (r.ok) setToken(d.token); else setError(d.error ?? "could not get a token");
        }}>{token ? "Token shown" : "Show my token"}</Button>
        {token && (
          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(config)}>Copy config</Button>
        )}
      </div>
      {error && <p className="text-destructive">{error}</p>}
      <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-[11px] leading-relaxed">{config}</pre>
    </div>
  );
}
