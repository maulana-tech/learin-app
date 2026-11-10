# LEARIS · Skill Gap Radar

> Your degree already taught you more than your resume shows. LEARIS proves it, finds the
> real gap to your target role, and closes it with a plan that fits your week.

Built for **HackGlobal**. Students graduate with real skills they cannot name, and with a gap
to the job they want that nobody has measured. LEARIS reads what a student has actually
studied and built, proves which skills it shows (every one with the words that prove it),
measures the gap to a target role, and plans four weeks that respect free hours and exam weeks.

The full brief, decisions and implementation status: [learis/PROJECT-CONTEXT.md](learis/PROJECT-CONTEXT.md).

## What it does

| Step | Page | What happens |
|---|---|---|
| 1 | **Evidence** | Upload a syllabus, transcript, project README (PDF, TXT, Markdown) or paste a public GitHub repo. PDFs are read in the browser; only their text is sent. |
| 2 | **Skills** | The Skill Evidence Agent lists every skill the documents prove, each with its quote, source and confidence. Skills missing from the student's own profile are marked *hidden*. |
| 3 | **Gap map** | Pick a role (Junior Web Developer or Data Analyst) and region. Each requirement is mastered, partial or missing, with how many sample job posts ask for it and in which words. A radar shows it per category, with the first analysis dashed underneath. |
| 4 | **Roadmap & plan** | What is already proven is crossed off; the rest is ordered by prerequisite. The Planner cuts it into four weeks that never exceed 85% of free hours and drop to 30% in exam weeks. |
| 5 | **Profile** | Headline, About, CV bullets and a post draft, written only from proven skills. A model draft that claims an unproven skill or tool is rejected. |
| | **Agent team** | Every run, step by step: what each agent did and what it refused to keep. |
| | **AI & privacy** | Bring your own AI, consent, auto-delete, delete-all-my-data. |

## The agent team

One **Orchestrator** reads the student's state and runs, in order, only the agents that have
something to do:

```
documents ─► Skill Evidence ─► Roadmap ─► Planner ─► Profile
              skills+quotes    gap map     4 weeks    LinkedIn / CV
```

Each agent stands on a deterministic engine (`learis/agent/engine/`), so **the whole flow runs
without any model**. When a student connects their own model and agrees to send their
documents to it, the model adds what rules cannot (skills described in other words, a profile
in a human voice), and everything it adds is checked before it is kept:

- a skill whose quote is not really in the document is dropped;
- confidence is capped by the kind of document (a course name is a hint, a project is proof);
- a profile draft naming a skill or tool the evidence does not back is rejected and retried once.

### Tools

Each agent has its own tools (19 in all, `learis/agent/tools/`), registered with a JSON
schema in `core/registry.py`:

| Agent | Tools |
|---|---|
| Skill Evidence | `list_documents`, `read_document`, `match_skills`, `list_taxonomy`, `fetch_github_repo`, `save_evidence` |
| Roadmap | `get_skill_profile`, `get_target`, `job_demand`, `compute_gap`, `build_roadmap`, `explain_gap` |
| Planner | `get_schedule`, `build_plan`, `set_week_focus` |
| Profile | `get_proven_skills`, `get_profile_text`, `check_claims`, `save_profile` |

With a model that supports function calling (on by default for OpenAI, Anthropic, Gemini and
OpenRouter), each agent runs a tool-use loop (`agents/loop.py`) and picks its own tools; every
call appears in the agent panel. The tools do the checking: `save_evidence` drops quotes that
are not in the document, `save_profile` refuses a draft that claims an unproven skill or tool,
`build_roadmap` refuses to run before `compute_gap`. If the model calls no tool or stops early,
the team finishes the job with the fixed steps.

### Workers and scheduled jobs

Runs go into a queue served by `LEARIS_WORKERS` threads (`core/worker.py`), so several
students can run at once while the panel shows `queued` then `running`. A scheduler
(`core/jobs.py`) runs three small jobs: `stale_runs` (close runs a restart left behind),
`purge_text` (apply auto-delete to text kept earlier) and `checkin` (a weekly check-in reminder
on the Overview once a plan is a week old).

### MCP

`POST /mcp` serves the same skills to the student's own agent (Claude Code, Orca, any MCP
client): `extract_skills`, `list_documents`, `get_skill_profile`, `refresh_gap`, `get_gap_map`,
`get_roadmap`, `build_plan`, `get_plan`. The Agent team page shows the config and the token.

P1 agents (Project, Verifier, Coach) are listed in the app as what comes next.

## Bring your own AI

One OpenAI-compatible client (`learis/agent/core/ai.py`) with `generate()` and
`generate_structured()`: JSON-schema validation and one automatic retry. Presets for OpenAI,
Anthropic, Gemini, OpenRouter, Ollama and LM Studio, plus any custom endpoint, and an optional
different model per agent.

The key stays in the student's browser and travels with each request in a header. The server
uses it for that request and never stores or logs it.

## Privacy

- No document goes to an AI provider until the student agrees.
- Auto-delete (on by default): once analysed, a document's full text is deleted; only the short
  quotes that prove each skill remain.
- Uploaded text is data, never instructions; the prompts say so and the output is validated.
- Repositories are read (README, languages, dependency list), never run.
- LinkedIn is pasted, not scraped; posts are published by the student.
- "Delete all my data" removes every document, skill, plan and run.

## Run it

```bash
# agent service (Python 3.10+, standard library only)
cd learis/agent
export LEARIS_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
python3 manage.py seed        # demo student sari@demo.learis / demo12345 with sample evidence
python3 api.py                # http://127.0.0.1:8787

# web app, in another terminal
npm install
LEARIS_API=http://127.0.0.1:8787 npm run dev   # http://localhost:3000
```

Sign in as the demo student, press **Run the agents**, and walk the pages in order.
Create real users with `python3 manage.py user <email> "<Name>" student "<password>"`.

## Check it

```bash
cd learis/agent && python3 manage.py check   # 19 self-checks: engines, tools, loop, workers, MCP, API
npm run lint && npm test && npm run build
```

## Repository map

```
app/(app)/              pages: overview, evidence, skills, gap, plan, profile, agents, settings
app/api/learis/         proxy to the agent service; passes the session and the AI header
components/             radar chart, agent panel, analyse button, sidebar, ui/
lib/ai-config.ts        BYOK settings in the browser, request helper
lib/pdf-text.ts         PDF text extraction in the browser
learis/agent/
  api.py                HTTP service (stdlib), every route scoped to the signed-in student
  agents/team.py        Orchestrator + Skill Evidence, Roadmap, Planner, Profile
  agents/loop.py        the tool-use loop: an agent's model picks its own tools
  tools/                the 19 agent tools; core/registry.py holds their schemas
  core/worker.py        worker pool for runs; core/jobs.py scheduled jobs
  mcp.py                the MCP server
  engine/               evidence, gap, roadmap, planner, profile, catalog: no model inside
  core/ai.py            OpenAI-compatible BYOK client
  core/store.py         SQLite: students, documents, evidence, runs, outputs
  sources/github.py     public repositories as evidence
  catalog/              skill taxonomy, roles, illustrative job posts, demo samples
learis/PROJECT-CONTEXT.md   the brief and the status of every feature
```

The job posts in `catalog/jobs.json` are illustrative samples written by the team, not real
listings. The taxonomy is the team's own curation.
