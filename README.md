# LEARIS · agentic workspace

> Ask once. An Orchestrator splits the work across agents that read your files, write pages
> where every claim cites a source, plan tasks for people and agents, and check the result.

Built for **HackGlobal** (theme: AI · AI-Powered Smart Assistant; also Open Innovation and Social
Impact). For students first, useful to anyone: a workspace like Notion or Lark, where the work is
done by a team of agents you can customise, the way an ADE such as Orca lets you shape your agents.

Brief, decisions and the status of every feature: [learis/PROJECT-CONTEXT.md](learis/PROJECT-CONTEXT.md).

## What a user can do

| | |
|---|---|
| **Assistant** | Ask in plain language: "summarise each course in Files, one page per course, then plan my study week". The Orchestrator delegates, in parallel where it can, and the panel shows every agent and tool call live. |
| **Files** | Upload a whole semester at once (PDF read in the browser, TXT, Markdown, a GitHub repo) and label each file with its course. Agents can then work one course at a time. |
| **Pages** | Summaries, reports, study guides. Agent pages cite files as `[n]` with exact quotes; a quote that is not in the file is refused, and **Review sources** flags any claim without one. |
| **Tasks** | A board for people and agents. Give a task to an agent and press **Run**: it does the work, links the page it wrote, and marks it done. |
| **Agents** | Four built-in agents, plus your own: instructions, a chosen set of tools, optionally its own model. |
| **Gallery** | Share an agent with the community; install others' agents in one click. Files never travel with it. |
| **Group** | A supporting feature: invite friends with a link, share the workspace, split work between members and agents without overloading anyone, and see the group's impact with a one-click activity report. |
| **Skill Gap Radar** | A built-in pack for students: proves skills from syllabi, transcripts and projects, measures the gap to a target role, plans four weeks, writes LinkedIn/CV suggestions. |

## The swarm

```
                     user request
                          │
                 Orchestrator (LLM)  ── workspace_overview · delegate · delegate_parallel
     ┌──────────┬─────────┼──────────┬──────────────┬────────────────┐
   Reader     Writer    Planner    Reviewer    custom agents    Skill Gap pack
   reads      sourced   tasks for  checks      built by users   (6 agents of its own)
   files      pages     people &   citations
                        agents
                          │
              workspace: pages · tasks · files
```

- Every agent runs the same tool loop (`learis/agent/agents/loop.py`) and sees **only its own tools**.
- The tools do the checking, so a model cannot cheat:
  - `create_page` refuses a quote that is not in the file.
  - `create_task` warns when a member is past two weeks of their free hours.
  - The Skill Gap tools refuse unproven skill claims.
- Delegation is one level deep: the Orchestrator delegates, agents do not.
- The Orchestrator needs a model that supports function calling.
- Without a model, the workspace still works by hand, and the Skill Gap pack runs on its deterministic engines.

## Bring your own AI · privacy

- **Model:** works with OpenAI, Anthropic, Gemini, OpenRouter, Ollama, LM Studio, or any OpenAI-compatible endpoint.
- **Key:** stays in the browser and travels with each request; never stored or logged.
- **Consent:** no document is sent to a model until the user agrees.
- **Isolation:** every workspace read and write checks membership.
- **Data:** text in files is treated as data, never as instructions.
- **Repositories:** read, never run.
- **Control:** "Delete all my data" removes everything.

## Workers, schedule, MCP

- **Workers:** runs are queued and served by `LEARIS_WORKERS` threads.
- **Schedule:** three jobs run on a timer — close stuck runs, apply auto-delete, weekly check-in reminder.
- **MCP:** `POST /mcp` offers the Skill Gap tools to the user's own agent (Claude Code, Orca, …).

## Run it

```bash
cd learis/agent
export LEARIS_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
python3 manage.py seed        # optional: a demo student for the Skill Gap pack
python3 api.py                # http://127.0.0.1:8787  (Python 3.10+, standard library only)

# another terminal
npm install
LEARIS_API=http://127.0.0.1:8787 npm run dev   # http://localhost:3000
```

Create an account on the sign-in page, connect a model in **AI & privacy**, add files, and ask.

## Check it

```bash
cd learis/agent && python3 manage.py check   # 21 self-checks: engines, tools, swarm, workers, MCP, API
npm run lint && npm test && npm run build
```

## Repository map

```
app/(app)/              Assistant, files, pages, tasks, agents, gallery, group, settings, skill-gap/*
app/invite/[token]      join a group (outside the shell, so a new user can sign up first)
components/             side nav, ask, agent panel, design primitives (dort, shell, field) — UI after AERA
lib/ai-config.ts        BYOK settings in the browser · lib/pdf-text.ts PDF text in the browser
learis/agent/
  api.py · workspace_api.py   HTTP routes (stdlib), every query scoped to a member
  agents/workspace.py         Orchestrator, built-in and custom agents, gallery, run-a-task
  agents/loop.py              the tool loop every agent runs
  agents/team.py              the Skill Gap pack
  tools/                      workspace tools and Skill Gap tools; core/registry.py holds their schemas
  core/space.py               workspaces, members, invites, pages, tasks, files, impact
  core/ai.py · core/worker.py · core/jobs.py · mcp.py · engine/ · catalog/
```
