import { UPSTREAM } from "./upstream";

export { UPSTREAM };

/* ------------------------------------------------------------------ types */
export type Me = { name: string; email: string; role: string };

export type Role = { id: string; name: string; summary: string; skills: number };
export type Region = { id: string; name: string };
export type Preset = { label: string; base_url: string; model: string; tools: boolean };
export type Catalog = {
  roles: Role[]; regions: Region[]; categories: string[]; skills: number;
  doc_kinds: string[]; ai_presets: Record<string, Preset>; server_ai: boolean;
};

export type Student = {
  user_id: string; target_role: string | null; region: string | null;
  hours_per_week: number; exam_weeks: number[]; plan_start: string | null;
  profile_text: string | null; consent_at: string | null; auto_delete: boolean;
};

export type Doc = {
  id: string; kind: string; title: string; source_url: string | null; chars: number;
  uploaded_at: string; analysed_at: string | null; text_kept: boolean; skills: number;
};

export type Evidence = {
  id: number; document_id: string; skill_id: string; quote: string; term: string | null;
  confidence: number; method: "rule" | "ai" | "verified";
  document_title: string; document_kind: string; source_url: string | null;
};
export type Skill = {
  skill_id: string; name: string; category: string; confidence: number; verified: boolean;
  evidence_count: number; evidence: Evidence[]; only_from: string[]; hidden: boolean;
};

export type GapSkill = {
  skill_id: string; name: string; category: string; level: "core" | "plus"; weight: number;
  confidence: number; status: "mastered" | "partial" | "missing"; verified: boolean;
  evidence_count: number; top_quote: string | null; top_source: string | null;
  demand: { posts: number; of: number; terms: string[] };
};
export type Gap = {
  role: { id: string; name: string; summary: string }; region: string | null; match: number;
  counts: { mastered: number; partial: number; missing: number };
  skills: GapSkill[]; radar: { category: string; score: number; skills: number }[];
  posts_read: number; beyond_role: { skill_id: string; name: string; confidence: number }[];
  explanation?: string;
};

export type RoadmapStep = {
  step: number; skill_id: string; name: string; category: string; status: string;
  confidence: number; level: string; why: string; prereqs: string[]; hours: number;
};
export type Roadmap = {
  role: { id: string; name: string };
  done: { skill_id: string; name: string; confidence: number; source: string | null }[];
  steps: RoadmapStep[]; total_hours: number;
};

export type PlanTask = { skill_id: string; name: string; hours: number; status: string; continues: boolean };
export type PlanWeek = {
  week: number; starts: string; exam: boolean; free_hours: number; capacity: number;
  planned_hours: number; load_pct: number; tasks: PlanTask[]; focus?: string;
};
export type Plan = {
  start: string; hours_per_week: number; exam_weeks: number[]; weeks: PlanWeek[];
  later: { skill_id: string; name: string; hours: number }[];
  planned_hours: number; later_hours: number; warnings: string[];
};

export type ProfileDraft = {
  headline: string; about: string; post: string | null; method: "template" | "ai";
  bullets: { text: string; source: string; skills?: string[] }[];
};

export type Output<T> = { payload: T | null; run_id?: string; created_at?: string };

export type RunStep = {
  seq: number; agent: string; kind: "start" | "info" | "tool" | "result" | "warn" | "error";
  message: string; detail: Record<string, unknown> | null; at: string;
};
export type Run = {
  id: string; status: "queued" | "running" | "done" | "failed"; ai: string | null;
  started_at: string; finished_at: string | null; error: string | null;
  summary?: Record<string, unknown> | null; steps?: RunStep[];
};

export type AgentTool = { name: string; description: string; writes: boolean };
export type TeamAgent = {
  code: string; name: string; priority: string; brief: string; uses_ai: string; tools: AgentTool[];
};

export type Reminder = { id: string; kind: string; message: string; created_at: string };

export type JobsStatus = {
  workers: { workers: number; busy: number; queued: number; done: number; failed: number };
  scheduler_on: boolean;
  jobs: { name: string; what: string; every_seconds: number; last_at: number | null;
          last_result: string | null; last_ok: boolean | null; runs: number }[];
};

export type Impact = {
  documents: number; skills_with_evidence: number; hidden_skills: number; verified_skills: number;
  match_before: number | null; match_now: number | null; planned_hours: number | null; runs: number;
  radar_before?: { category: string; score: number }[] | null; baseline_role?: string | null;
};

/* -------------------------------------------------------------- server side */
const WIB = "Asia/Jakarta";

export function when(t: string | null | undefined, opts: { time?: boolean } = {}): string {
  if (!t) return "-";
  const at = new Date(t);
  if (Number.isNaN(at.getTime())) return t;
  const date = at.toLocaleDateString("en-GB", { timeZone: WIB, day: "2-digit", month: "short", year: "numeric" });
  if (opts.time === false) return date;
  return `${date} ${at.toLocaleTimeString("en-GB", { timeZone: WIB, hour: "2-digit", minute: "2-digit" })}`;
}

/** Call the agent service from a server component, carrying the session cookie. */
export async function apiResult<T>(path: string): Promise<
  { data: T; error: null } | { data: null; error: string }
> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get("learis_session")?.value;
  const ws = jar.get("learis_ws")?.value;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ws) headers["X-Learis-Ws"] = ws;
  try {
    const r = await fetch(`${UPSTREAM}/${path}`, { cache: "no-store", headers });
    const body = await r.text();
    if (!r.ok) {
      let error = `The agent service returned HTTP ${r.status}`;
      try {
        const parsed = JSON.parse(body) as { error?: string };
        if (parsed.error) error = parsed.error;
      } catch {
        // An upstream proxy may return HTML; the status is safer to show.
      }
      return { data: null, error };
    }
    return { data: JSON.parse(body) as T, error: null };
  } catch {
    return { data: null, error: `The agent service is not responding at ${UPSTREAM}` };
  }
}

export async function api<T>(path: string): Promise<T | null> {
  return (await apiResult<T>(path)).data;
}

export async function me(): Promise<Me | null> {
  return api<Me>("me");
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/* --------------------------------------------------------------- workspace */
export type Workspace = {
  id: string; name: string; kind: "personal" | "group"; purpose: string | null; owner_id: string;
  created_at: string; role?: string; members?: number;
};
export type Member = {
  user_id: string; name: string | null; email: string | null; role: string; hours_per_week: number;
  open_hours: number; tasks_done: number; joined_at: string;
};
export type WorkspaceDetail = Workspace & { role: string; members: Member[] };
export type FileRow = {
  id: string; name: string; chars: number; source_url: string | null; uploaded_at: string;
  collection: string | null; uploader: string | null;
};
export type Collection = { name: string; files: number; chars: number };
export type PageRow = { id: string; title: string; created_by: string; updated_by: string; updated_at: string; chars: number; sources: number };
export type PageSource = { n: number; file_id: string; file_name: string; quote: string };
export type PageFull = {
  id: string; workspace_id: string; title: string; content: string; sources: PageSource[];
  created_by: string; updated_by: string; created_at: string; updated_at: string; run_id: string | null;
};
export type PageReview = {
  ok: boolean; sources: number; missing_sources: number[]; unused_sources: number[];
  stale_sources: number[]; uncited_paragraphs: string[];
};
export type Task = {
  id: string; title: string; description: string; status: "todo" | "doing" | "done";
  assignee_type: "user" | "agent" | null; assignee_id: string | null; assignee_name: string | null;
  agent_name: string | null; due_date: string | null; estimate_hours: number | null; page_id: string | null;
  created_by: string; done_by: string | null; created_at: string;
};
export type RosterAgent = {
  id: string; name: string; icon?: string | null; description: string; tools: string[];
  builtin?: boolean; pack?: boolean; custom?: boolean; model?: string | null; shared?: boolean; group?: string;
};
export type CustomAgent = {
  id: string; name: string; description: string; instructions: string; tools: string[]; model: string | null;
  icon: string | null; shared: boolean; installs: number; template_of: string | null; author?: string | null;
};
export type ToolDef = { name: string; description: string; writes: boolean; group: string };
export type GroupImpact = {
  workspace: Workspace; members: number; tasks_total: number; tasks_done: number;
  tasks_done_by_people: number; tasks_done_by_agents: number; pages: number; pages_by_agents: number;
  files: number; agent_runs: number; hours_saved_estimate: number; hours_saved_rule: string;
  shared_agent_installs: number;
  contributions: { user_id: string; name: string | null; tasks_done: number; open_hours: number; hours_per_week: number }[];
};
export type Artifact = { type: "page" | "task"; id: string; title: string; agent: string };
export type AskRun = Run & { request?: string | null; answer?: string | null; kind?: string | null; workspace_id?: string | null };

export const who = (by: string | null | undefined, names: Record<string, string> = {}) =>
  !by ? "-" : by.startsWith("agent:") ? `${by.slice(6)} agent` : names[by] ?? "a member";

/** The workspace the user is looking at (cookie), else their personal one. Server side. */
export async function currentWorkspace(): Promise<Workspace | null> {
  const { cookies } = await import("next/headers");
  const list = (await api<{ workspaces: Workspace[] }>("workspaces"))?.workspaces ?? [];
  const picked = (await cookies()).get("learis_ws")?.value;
  return list.find((w) => w.id === picked) ?? list.find((w) => w.kind === "personal") ?? null;
}

export type AgentDetail = {
  id: string; name: string; kind: "built-in" | "custom" | "pack"; description: string;
  instructions: string | null; model: string | null; shared: boolean; installs: number; template_of: string | null;
  tools: { name: string; description: string; writes: boolean }[];
  stats: { tasks_done: number; pages: number; open_tasks: number; runs: number };
  pages: { id: string; title: string; updated_at: string }[];
  activity: { run_id: string; seq: number; agent: string; kind: string; message: string; at: string; request: string | null }[];
};

/* --------------------------------------------------------- public links */
export type PublicPage = {
  title: string; content: string; sources: { n: number; file_name: string; quote: string }[];
  by_agent: boolean; shared_by: string; updated_at: string; checks: { sources: number; cited: number }; ref: string;
};
export type PublicAgent = {
  id: string; name: string; description: string; instructions: string; tools: string[];
  installs: number; author: string; shared_by: string; ref: string;
};
export type Reach = {
  links: number; views: number; signups: number; agent_installs: number; invite_joins: number;
  top: { token: string; kind: "page" | "agent"; views: number; signups: number; title: string }[];
};

/** A public link's content: no session is sent, so it is exactly what a stranger sees.
 * `count: false` for link previews and metadata, which are not a person opening it. */
export async function publicLink<T>(kind: "page" | "agent", token: string, count = true): Promise<T | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  try {
    const r = await fetch(`${UPSTREAM}/public/${kind}/${token}${count ? "" : "?count=0"}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
