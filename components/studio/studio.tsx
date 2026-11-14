"use client";

import { Columns2, Columns3, LayoutGrid, Plus, RotateCcw, Rows2, Square } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { AgentBadge } from "@/components/agent-card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { ModelPicker } from "@/components/model-picker";
import { cn } from "@/lib/utils";
import { Pane, type PaneState, type StudioAgent } from "./pane";

/* The Studio: several agent chats side by side, the way an ADE such as Orca
 * runs several coding agents at once.
 *
 * A layout is a grid of columns × rows. Panels fill the cells in order; the
 * borders between columns and between rows can be dragged. Everything (which
 * agent is in which panel, each conversation, the sizes) is kept per workspace
 * in this browser, so the Studio looks the same when it is opened again. */

type LayoutId = "1" | "2c" | "3c" | "2r" | "2x2";
const LAYOUTS: { id: LayoutId; label: string; cols: number; rows: number; icon: React.ElementType }[] = [
  { id: "1", label: "One panel", cols: 1, rows: 1, icon: Square },
  { id: "2c", label: "Two columns", cols: 2, rows: 1, icon: Columns2 },
  { id: "3c", label: "Three columns", cols: 3, rows: 1, icon: Columns3 },
  { id: "2r", label: "Two rows", cols: 1, rows: 2, icon: Rows2 },
  { id: "2x2", label: "Grid of four", cols: 2, rows: 2, icon: LayoutGrid },
];
const NEXT: Record<number, LayoutId> = { 1: "1", 2: "2c", 3: "3c", 4: "2x2" };
const MAX_PANES = 4;
const MIN_SHARE = 0.18;

type State = { layout: LayoutId; cols: number[]; rows: number[]; panes: PaneState[]; max: string | null };

const even = (n: number) => Array.from({ length: n }, () => 1);
const newId = () => Math.random().toString(36).slice(2, 10);
const fresh = (agentId = "orchestrator"): State =>
  ({ layout: "1", cols: even(1), rows: even(1), panes: [{ id: newId(), agentId, turns: [] }], max: null });

function load(key: string): State | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}

/** A draggable border. Moving it gives one side's share to the other, never below MIN_SHARE. */
function Splitter({ dir, onDrag }: { dir: "col" | "row"; onDrag: (deltaPx: number) => void }) {
  const start = useRef<number | null>(null);
  return (
    <div role="separator" aria-orientation={dir === "col" ? "vertical" : "horizontal"}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); start.current = dir === "col" ? e.clientX : e.clientY; }}
      onPointerMove={(e) => {
        if (start.current === null) return;
        const now = dir === "col" ? e.clientX : e.clientY;
        onDrag(now - start.current);
        start.current = now;
      }}
      onPointerUp={() => { start.current = null; }}
      className={cn("group hidden shrink-0 items-center justify-center md:flex",
        dir === "col" ? "w-2.5 cursor-col-resize" : "h-2.5 cursor-row-resize")}>
      <span className={cn("rounded-full bg-[rgba(0,0,0,0.12)] transition-colors group-hover:bg-[rgba(0,0,0,0.4)]",
        dir === "col" ? "h-10 w-1" : "h-1 w-10")} />
    </div>
  );
}

function AddAgent({ agents, onPick, label = "Add agent", variant = "default" }: {
  agents: StudioAgent[]; onPick: (id: string) => void; label?: string; variant?: "default" | "outline";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={variant}><Plus className="size-3.5" /> {label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Open a chat with</DropdownMenuLabel>
        {agents.map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => onPick(a.id)} className="items-start gap-2.5 py-2">
            <AgentBadge nickname={a.name} size="sm" showTooltip={false} />
            <span className="min-w-0">
              <span className="block text-[13px]">{a.name}</span>
              <span className="text-muted-foreground line-clamp-1 block text-[11.5px]">{a.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Studio({ workspaceId, workspaceName, agents }: {
  workspaceId: string; workspaceName: string; agents: StudioAgent[];
}) {
  const key = `learis.studio.${workspaceId}`;
  const [s, setS] = useState<State | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Read what this browser kept for the workspace once mounted (it is not known on the server).
  useEffect(() => {
    const kept = load(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setS(kept && kept.panes?.length ? kept : fresh());
  }, [key]);
  useEffect(() => {
    if (!s) return;
    try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* storage refused: fine for this session */ }
  }, [key, s]);

  if (!s) return <div className="text-muted-foreground p-6 text-[13px]">Opening the Studio…</div>;
  const layout = LAYOUTS.find((l) => l.id === s.layout) ?? LAYOUTS[0];

  function setLayout(id: LayoutId) {
    const l = LAYOUTS.find((x) => x.id === id)!;
    setS((p) => p && ({ ...p, layout: id, cols: even(l.cols), rows: even(l.rows), max: null }));
  }

  function add(agentId: string) {
    setS((p) => {
      if (!p || p.panes.length >= MAX_PANES) return p;
      const panes = [...p.panes, { id: newId(), agentId, turns: [] }];
      const cur = LAYOUTS.find((l) => l.id === p.layout)!;
      if (panes.length <= cur.cols * cur.rows) return { ...p, panes, max: null };
      const next = LAYOUTS.find((l) => l.id === NEXT[panes.length])!;
      return { ...p, panes, layout: next.id, cols: even(next.cols), rows: even(next.rows), max: null };
    });
  }

  function update(id: string, fn: (p: PaneState) => PaneState) {
    setS((p) => p && ({ ...p, panes: p.panes.map((x) => (x.id === id ? fn(x) : x)) }));
  }

  function close(id: string) {
    setS((p) => {
      if (!p) return p;
      const panes = p.panes.filter((x) => x.id !== id);
      return panes.length ? { ...p, panes, max: p.max === id ? null : p.max } : fresh();
    });
  }

  function drag(kind: "cols" | "rows", i: number, deltaPx: number) {
    const el = box.current;
    if (!el) return;
    setS((p) => {
      if (!p) return p;
      const shares = [...p[kind]];
      const total = shares.reduce((a, b) => a + b, 0);
      const span = kind === "cols" ? el.clientWidth : el.clientHeight;
      const d = (deltaPx / span) * total;
      const min = MIN_SHARE * total;
      const a = shares[i] + d, b = shares[i + 1] - d;
      if (a < min || b < min) return p;
      shares[i] = a; shares[i + 1] = b;
      return { ...p, [kind]: shares };
    });
  }

  const cells = layout.cols * layout.rows;
  const shown = s.max ? s.panes.filter((x) => x.id === s.max) : s.panes.slice(0, cells);
  const hidden = s.max ? 0 : Math.max(0, s.panes.length - cells);
  const pane = (p: PaneState) => (
    <Pane key={p.id} pane={p} agents={agents} maximised={s.max === p.id} onChange={(fn) => update(p.id, fn)} onClose={() => close(p.id)}
      onMaximise={() => setS((x) => x && ({ ...x, max: x.max === p.id ? null : p.id }))} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Segmented ariaLabel="Layout" value={s.layout} onValueChange={(v) => setLayout(v as LayoutId)}
          items={LAYOUTS.map((l) => ({ value: l.id, title: l.label, icon: <l.icon className="size-4" /> }))} />
        <span className="text-muted-foreground text-[12px]">{s.panes.length}/{MAX_PANES} panels · {workspaceName}</span>
        {hidden > 0 && <span className="text-warn text-[12px]">{hidden} panel(s) do not fit this layout</span>}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground hidden text-[12px] md:inline">Default</span>
          <ModelPicker align="end" />
          <Button size="sm" variant="ghost" title="Close every panel and start over"
            onClick={() => { if (confirm("Close every panel? The work the agents did stays in the workspace.")) setS(fresh()); }}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          {s.panes.length < MAX_PANES && <AddAgent agents={agents} onPick={add} />}
        </div>
      </div>

      {s.max ? (
        <div className="flex min-h-0 flex-1">{shown.map(pane)}</div>
      ) : (
        <div ref={box} className="flex min-h-0 flex-1 flex-col">
          {Array.from({ length: layout.rows }, (_, r) => (
            <Fragment key={`r${r}`}>
              {r > 0 && <Splitter dir="row" onDrag={(d) => drag("rows", r - 1, d)} />}
              <div className="flex min-h-0 flex-col gap-3 md:flex-row md:gap-0 md:[flex:var(--g)_1_0%]"
                style={{ "--g": s.rows[r] ?? 1 } as React.CSSProperties}>
                {Array.from({ length: layout.cols }, (_, c) => {
                  const p = shown[r * layout.cols + c];
                  return (
                    <Fragment key={`c${c}`}>
                      {c > 0 && <Splitter dir="col" onDrag={(d) => drag("cols", c - 1, d)} />}
                      <div className="flex min-h-0 min-w-0 flex-col md:[flex:var(--g)_1_0%]"
                        style={{ "--g": s.cols[c] ?? 1 } as React.CSSProperties}>
                        {p ? pane(p) : (
                          <div className="dot-grid-soft flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
                            <p className="text-muted-foreground text-[12.5px]">Empty panel</p>
                            <AddAgent agents={agents} onPick={add} label="Open a chat" variant="outline" />
                          </div>
                        )}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
