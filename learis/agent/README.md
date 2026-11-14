# LEARIS agent service

Python, standard library only. Serves the Skill Gap Radar web app.

```bash
python3 api.py              # :8787
python3 manage.py check     # every self-check
python3 manage.py seed      # demo student with sample evidence
```

## Layout

| Path | What |
|---|---|
| `api.py` | HTTP routes. All but `/health` and `/login` need a session; every query is scoped to the student in the token. |
| `agents/team.py` | The Orchestrator and the four P0 agents. Each writes its steps to the run. |
| `agents/loop.py` | Tool-use loop: with a function-calling model, an agent picks its own tools (max 10 rounds); the team finishes anything left with the fixed steps. |
| `core/registry.py`, `tools/` | 19 tools with JSON schemas, one agent each. A call to another agent's tool is refused; writes are checked by the tool. |
| `core/worker.py` | Queue + `LEARIS_WORKERS` threads for runs (`queued` → `running` → `done`). |
| `core/jobs.py` | Scheduler: `stale_runs`, `purge_text`, `checkin`. `LEARIS_SCHEDULE=0` turns it off. |
| `mcp.py` | JSON-RPC MCP server at `POST /mcp`, 8 tools, scoped to the signed-in student. |
| `engine/evidence.py` | Skills from text by the taxonomy's aliases; checks a model's proposals (quote must be in the document). Confidence by document kind; evidence combines as 1 − Π(1 − c). |
| `engine/gap.py` | Mastered ≥ 0.6, partial ≥ 0.25. Weighted match %, radar per category, demand from sample posts. |
| `engine/roadmap.py` | What is left, topologically ordered by prerequisite; unmet prerequisites pulled in. |
| `engine/planner.py` | Four weeks, ≤ 85% of free hours, exam weeks at 30%, nothing silently dropped. |
| `engine/profile.py` | Template suggestions, and `unproven()`: what a draft claims without evidence. |
| `core/ai.py` | OpenAI-compatible BYOK client: `generate`, `generate_structured` (schema + one retry). |
| `core/store.py` | SQLite. Full text dropped after analysis when auto-delete is on. |
| `sources/github.py` | Public repo: description, languages, README, dependency manifest. |
| `catalog/` | `taxonomy.json`, `roles.json`, `jobs.json` (illustrative), `samples/`. |

## Configuration

See `.env.example`. Nothing is required beyond `LEARIS_SECRET`; students bring their own
model. `LEARIS_AI_*` gives the deployment a fallback model.

## Adding a role

Add skills to `catalog/taxonomy.json` if needed (aliases, course names, prerequisites, hours),
the role and its weighted requirements to `catalog/roles.json`, a few sample posts to
`catalog/jobs.json`, then run `python3 engine/catalog.py` to check every reference resolves.
