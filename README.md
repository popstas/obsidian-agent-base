# obsidian-agent-base

🇬🇧 English · 🇷🇺 [Русский](README_ru.md)

A depersonalized core workflow for keeping an Obsidian vault with an agent — **any** agent (Claude Code, Codex, Cursor, and others): tasks in `tasks.md`, a journal in `Log/`, notes in `Notes/`, weekly reports in `Log/Reports/`. Reusable skills and scripts with no ties to a specific project, people, or tools.

This repository is three things at once: an installable plugin for Claude Code, Codex, and Cursor; a ready-to-use Obsidian vault you clone and adapt; and the source of a demo you delete once you've adapted it. Pick the install mode below that matches what you're doing.

## Structure

```
skills/                  agent skills, one SKILL.md per skill (browsable in Obsidian)
  Skills list.md         generated index of all skills
.claude-plugin/          Claude Code plugin + single-plugin marketplace
.codex-plugin/           Codex plugin manifest
.cursor-plugin/          Cursor plugin manifest
.claude/                 settings, hooks, task counter, statusline, base sync
.obsidian/               Obsidian settings, snippets, vendored tasks-mover
scripts/                 skills list, demo manifest, plugin installer, release
tasks.md projects.md tasks-future.md tasks-snoozed.md tasks-recurring.md ideas.md
Log/ Notes/ _templates/ files/
obsidian-plugins.json    which Obsidian plugins the vault expects
demo-manifest.json       demo files + hashes, consumed by demo-content-delete
```

## Install

### As a new vault (most people)

```bash
git clone https://github.com/popstas/obsidian-agent-base my-vault
cd my-vault
node scripts/install-obsidian-plugins.mjs
```

Open the folder as a vault in Obsidian, then start an agent session in it and say
"adapt this vault to me". The agent follows `INTEGRATION.md`, interviews you, and
finishes by running the `demo-content-delete` skill to strip the demo content.

Updates: `git pull`. If you have customized the skills, use the `base-sync` skill
instead — it shows what changed upstream without clobbering your edits.

> **One-time setup per machine.** After cloning, run these two commands once in an agent
> session — the bundled skills stay inactive until you do both:
> ```
> /plugin marketplace add .
> /plugin install obsidian-agent-base@obsidian-agent-base
> ```
> Adding the marketplace only registers it; the `install` step actually activates the
> plugin's skills. Both are recorded in your **user-level** `~/.claude/settings.json`, not
> in the clone, so you repeat this on each machine you use, not once per vault.
>
> Outside an agent session the equivalent is `claude plugin marketplace add ./` — the CLI
> rejects a bare `.` with `Invalid marketplace source format`.

### Into an existing vault

```
/plugin marketplace add popstas/obsidian-agent-base
/plugin install obsidian-agent-base@obsidian-agent-base
```

Adding the marketplace alone does not install anything — run both commands. Once
installed, skills auto-update with the marketplace. The vault side — the task ladder and
the `.obsidian` settings — is merged by hand; ask your agent to walk you through
`INTEGRATION.md`.

The marketplace brings the skills only — the task counter and statusline are optional
extras, not part of the plugin; `INTEGRATION.md` says where to get them.

### Skills only, in Codex or Cursor

Same marketplace; the `.codex-plugin/` and `.cursor-plugin/` manifests point at the
same `skills/` directory.

## Syncing with base after a fork (skills-lock.json v2)

A vault cloned as in "As a new vault" already has `.claude/sync-base.cjs` and the
`base-sync/` skill — nothing to copy. Base keeps evolving after you've adapted the
skills to yourself; to pull updates without clobbering local customizations:

1. Establish a baseline once: `node .claude/sync-base.cjs bootstrap`. It adds a
   `baseSync` block to `skills-lock.json` (format v2), maps local skill names to base
   via aliases (`add-task→new-task`, `list→list-tasks`, `*-vault→obsidian-vault`), and
   marks already-diverged skills `customized: true`. The path to the base checkout is
   read from `baseSync.base.path` (default `../../obsidian-agent-base`).
2. Then on demand: `node .claude/sync-base.cjs status` — a table of states (UNCHANGED /
   BASE-CHANGED / LOCALLY-MODIFIED / BOTH-CHANGED / NEW-IN-BASE), `diff <skill>` — the
   differences, `stamp <skill>` — record the sync after a manual merge.

`skills-lock.json` v2 is compatible with v1: existing entries for external GitHub skills
(`skills`) are left untouched; a separate `baseSync` block is added. A skill's hash is
computed without the `name:`/`description:` lines in the frontmatter — they legitimately
differ across forks and shouldn't create false mismatches. The conversational part (what
to pull, what to keep, how to push an improvement back to base) is handled by the
`base-sync` skill; the script itself never edits skill files.

## Task format (tasks.md)

```md
# Week:
- [x] Completed task ➕ 2026-06-01 ✅ 2026-06-03
- [ ] Open task this week ➕ 2026-06-04
	- https://example.com/task/12345
	- [ ] subtask

# Week+
- [ ] Longer-horizon task ➕ 2026-06-02

> Active tasks. Future ones: [[tasks-future]]. Snoozed: [[tasks-snoozed]]. Projects: [[projects]].
```

`➕ YYYY-MM-DD` — creation date, `✅ YYYY-MM-DD` — completion date. Sub-bullets use a tab. The file is split into two sections: `# Week:` — the current week (completed `- [x]` stay at the top, open ones below), `# Week+` — a longer horizon. The legend line under `# Week+` links to the `tasks-future.md` backlog.
