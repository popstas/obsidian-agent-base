# obsidian-agent-base

🇬🇧 English · 🇷🇺 [Русский](README_ru.md)

A depersonalized core workflow for keeping an Obsidian vault with an agent — **any** agent (Claude Code, Codex, Hermes, OpenClaw, Antigravity, etc.): tasks in `tasks.md`, a journal in `Log/`, notes in `Notes/`, weekly reports in `Log/Reports/`. Reusable skills and scripts with no ties to a specific project, people, or tools.

## Integration prompt (copy-paste to your agent)

Paste this into your agent from inside your own Obsidian vault / project. It installs the
skills and **adapts them to you** instead of leaving the template placeholders:

> Install the Obsidian-vault skills from https://github.com/popstas/obsidian-agent-base:
> copy its `skills/*` into my `.claude/skills/`, and optionally the `.claude/` task-status
> tooling (`gen-tasks-json.cjs`, `statusline.cjs`, `hooks/tasks-startup.sh`, merging — not
> overwriting — `settings.json`). Then read the repo's `INTEGRATION.md` and run the
> adaptation flow: ask me which setup level I want — **required** (~2–3 min: project
> name + vault layout) or **detailed** (~10–15 min) — interview me one question at a time
> with sensible defaults, and edit the copied templates to match my answers so no template
> placeholders remain (e.g. `Platform/`, `Companies/`, `CRM`). Show me a diff at the end.

## Structure

```
INTEGRATION.md           guide for the agent: how to adapt the skills to the user
skills/                  agent skills (one SKILL.md per skill)
  new-task/              add a task to tasks.md (➕ YYYY-MM-DD)
  close-task/            close a task (✅) + write to the daily log
  list-tasks/            morning review of open tasks, find stale ones
  worklog/               log work progress in Log/YYYY-MM-DD.md
  weekly-report/         weekly report in Log/Reports/ (1 doc/week, Mon–Sun)
  decompose/             break tasks into subtasks (AUTO / NEEDS-INPUT / RISKY)
  learn/                 surgically improve a skill from conversation experience
  first-task-do/         pick the first task and start with read-only research
  obsidian-vault/        vault conventions: taxonomy, wikilinks, sensitivity
  base-sync/             sync a fork with base: diff, summary, pull/push changes
.claude/                 task status + sync with base
  gen-tasks-json.cjs     parses tasks.md → files/tasks.json (total/done/open)
  statusline.cjs         status line: 📋 done/total │ N open │ %
  sync-base.cjs          hashes/classification/diff of fork skills vs base
  hooks/tasks-startup.sh SessionStart: hint to check tasks.md and the day's log
  settings.json          wiring for statusLine + hooks (merge, don't overwrite)
```

## How to install the skills

Copy the skill folders you need into your project's `.claude/skills/`:

```bash
cp -r skills/* /path/to/your-project/.claude/skills/
```

The skills are self-contained (a single `SKILL.md`, no scripts). They reference each other by name (`[[new-task]]`, `[[worklog]]`, etc.); install them together so the links make sense.

**Don't copy them blindly — they are templates.** The skills bake in examples (domain folders, report dimensions, a tracker) and defaults for an abstract vault. After `cp`, ask your agent to run [`INTEGRATION.md`](INTEGRATION.md): it asks which setup level you want (required ~2–3 min / detailed ~10–15 min), interviews you, and tailors the copied templates to you — instead of leaving someone else's `Platform/` and `CRM` behind.

## How to install the task status (tasks.json)

1. Copy the scripts and the hook:
   ```bash
   cp .claude/gen-tasks-json.cjs .claude/statusline.cjs /path/to/your-project/.claude/
   mkdir -p /path/to/your-project/.claude/hooks
   cp .claude/hooks/tasks-startup.sh /path/to/your-project/.claude/hooks/
   ```
2. **Merge** the contents of `.claude/settings.json` into your project's `.claude/settings.json` (don't overwrite — add the `statusLine` and `hooks` blocks).
3. Done: on writes to `tasks.md` and at session start, `files/tasks.json` is recomputed and the status line shows progress.

What counts: top-level checkboxes `- [ ]` / `- [x]` in `tasks.md`. `done` — closed `- [x]`, `total` — all, `open = total - done`. Indented sub-items are not counted. Dependencies: Node.js; for the PostToolUse hook — `jq`.

## Syncing with base after a fork (skills-lock.json v2)

After a fork has adapted the skills to itself, base keeps evolving. To pull updates without clobbering local customizations, there is a `sync-base.cjs` script and a `base-sync` skill.

1. Copy `.claude/sync-base.cjs` and the `base-sync/` skill into the fork.
2. Establish a baseline once: `node .claude/sync-base.cjs bootstrap`. It adds a `baseSync` block to `skills-lock.json` (format v2), maps local skill names to base via aliases (`add-task→new-task`, `list→list-tasks`, `*-vault→obsidian-vault`), and marks already-diverged skills `customized: true`. The path to the base checkout is read from `baseSync.base.path` (default `../../obsidian-agent-base`).
3. Then on demand: `node .claude/sync-base.cjs status` — a table of states (UNCHANGED / BASE-CHANGED / LOCALLY-MODIFIED / BOTH-CHANGED / NEW-IN-BASE), `diff <skill>` — the differences, `stamp <skill>` — record the sync after a manual merge.

`skills-lock.json` v2 is compatible with v1: existing entries for external GitHub skills (`skills`) are left untouched; a separate `baseSync` block is added. A skill's hash is computed without the `name:`/`description:` lines in the frontmatter — they legitimately differ across forks and shouldn't create false mismatches. The conversational part (what to pull, what to keep, how to push an improvement back to base) is handled by the `base-sync` skill; the script itself never edits skill files.

## Task format (tasks.md)

```md
# Week:
- [x] Completed task ➕ 2026-06-01 ✅ 2026-06-03
- [ ] Open task this week ➕ 2026-06-04
	- https://example.com/task/12345
	- [ ] subtask

# Week+
- [ ] Longer-horizon task ➕ 2026-06-02

> Active tasks. Future ones: [[tasks-future]].
```

`➕ YYYY-MM-DD` — creation date, `✅ YYYY-MM-DD` — completion date. Sub-bullets use a tab. The file is split into two sections: `# Week:` — the current week (completed `- [x]` stay at the top, open ones below), `# Week+` — a longer horizon. The legend line under `# Week+` links to the `tasks-future.md` backlog.
