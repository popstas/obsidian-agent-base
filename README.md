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
.claude/                 settings, hooks, task counter, base sync
.codex/                  Codex hooks (session-start reminder), bash + PowerShell
.obsidian/               Obsidian settings, snippets, vendored tasks-mover
scripts/                 skills list, demo manifest, plugin installer, release
tasks.md projects.md tasks-future.md tasks-snoozed.md tasks-recurring.md ideas.md
Log/ Notes/ _templates/ files/
obsidian-plugins.json    which Obsidian plugins the vault expects
demo-manifest.json       what demo-content-delete removes: demo files, setup docs, base-only paths
.stignore                Syncthing ignores for this device (a single #include line)
.stignore-common         the shared ignore rules, synced between machines
```

## Install

### As a new vault (most people)

```bash
git clone https://github.com/popstas/obsidian-agent-base my-vault
cd my-vault
bash scripts/install-obsidian-plugins.sh     # macOS / Linux
```

On Windows, run this instead:

```powershell
git clone https://github.com/popstas/obsidian-agent-base my-vault
cd my-vault
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-obsidian-plugins.ps1
```

(`-NoProfile` keeps a chatty PowerShell profile from mixing its own output — or
its own `OutputEncoding` — into the installer's.)

**Installing and updating plugins needs no Node, Python, or `jq`** — neither on
macOS/Linux nor on Windows. Two things on the client do still run on Node, and
neither is part of the daily loop:

- **Claude Code hooks** (session-start reminder, task counter). Claude Code has
  no per-OS command field, so one command string can't cover both platforms —
  Codex has one, which is why its hooks need no Node. Without Node the hooks
  just silently no-op: the agent gives the session-start reminder itself, and
  `weekly-report`'s task counter falls back to counting `tasks.md` directly.
- **`base-sync`** (`node .claude/sync-base.cjs`, see below) — the optional
  workflow for pulling upstream skill updates into a customized vault. Kept on
  Node deliberately; you only reach for it when base has moved on.

Prefer clicking? Obsidian can install every plugin from
`obsidian-plugins.json` through Settings → Community plugins → Browse.

Open the folder as a vault in Obsidian, then start an agent session in it and say
"adapt this vault to me". The agent follows `INTEGRATION.md`, interviews you, and
finishes by running the `demo-content-delete` skill to strip the demo content — the
example logs, report, and notes, plus, if you want, the setup docs themselves.

The task ladder is not part of that: the tasks shipped in `tasks.md` and
`tasks-future.md` are onboarding every user actually does — read the README, list
where else your tasks live, move them here, log your first day, write the first
weekly report. You close them, you don't delete them.

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

The marketplace brings the skills only — the task counter and hooks are optional
extras, not part of the plugin; `INTEGRATION.md` says where to get them.

### Skills only, in Codex or Cursor

Same marketplace; the `.codex-plugin/` and `.cursor-plugin/` manifests point at the
same `skills/` directory.

## Syncing the vault across devices (Syncthing)

A vault is a plain folder, so anything can sync it; the ignore rules shipped here are written
for [Syncthing](https://syncthing.net/). There is nothing to set up: add the vault folder as a
folder on each device — the files are already in place.

- **`.stignore`** — the per-device file. Syncthing **never** propagates it between machines,
  which is exactly why it lives in git: a clone arrives with it ready. It holds a single
  meaningful line — `#include .stignore-common` — plus room for rules local to that machine.
- **`.stignore-common`** — the rules themselves, and these *are* synced. Edit them on one
  machine and they reach the rest; no per-device copies to maintain.

Not synced — per-device state: `workspace*.json` (open tabs, the number-one source of
conflicts), `app.json`, `graph.json`, plugin settings and caches (`plugins/*/data.json`,
`*.db`, `cache/`), `.trash`, `.git`, the generated `files/tasks.json`,
`.claude/settings.local.json`, and OS junk. Synced on purpose: `community-plugins.json`,
`core-plugins.json`, `appearance.json`, `hotkeys.json`, snippets, plugin code, and the
settings of the two plugins the vault owns — `file-explorer-plus` and `obsidian-icon-folder`.

The condition those shared json files still depend on: **Obsidian runs on one machine at a
time**, and you don't edit those files on disk while it's open — it will overwrite them with
its own state. Conflicts in the notes themselves are deliberately not ignored: a
`*.sync-conflict-*` file next to a note is something you want to see and resolve by hand.

Two cases need one manual step:

- **The vault reached a machine by sync only, without a clone** — create `.stignore` there
  with that same `#include .stignore-common` line, or the device will start pulling other
  machines' `workspace.json`.
- **You sync a parent folder holding several vaults** rather than each vault separately — in
  that folder's root `.stignore` write `#include <vault>/.stignore-common` (an `#include`
  path is resolved from the folder root). The rules in common are written to work in both
  layouts.

`.obsidian/app.json` is the one file git distributes and sync does not: mobile Obsidian writes
`mobileToolbarCommands` into it and the desktop app strips them, so phone and desktop conflict
over it every time. The clone hands out the default once; after that each device keeps its
own. The divergence is pinned by a test (`tests/stignore.test.mjs`, the `GIT_ONLY` list).

## Syncing with base after a fork (skills-lock.json v2)

A vault cloned as in "As a new vault" already has `.claude/sync-base.cjs` and the
`base-sync/` skill — nothing to copy. Base keeps evolving after you've adapted the
skills to yourself; to pull updates without clobbering local customizations:

1. Establish a baseline once: `node .claude/sync-base.cjs bootstrap`. It adds a
   `baseSync` block to `skills-lock.json` (format v2), maps local skill names to base
   via aliases (`add-task→new-task`, `list→list-tasks`, `*-vault→obsidian-vault`), and
   marks already-diverged skills `customized: true`. The path to the base checkout is
   read from `baseSync.base.path` (default `../../obsidian-agent-base`).

   The base checkout must already exist at that path **before** you run this:
   `bootstrap` doesn't clone it for you and fails with "Base not found" if it's
   missing. Also mind the checkout's branch — bootstrap only sees skills that exist
   in base at its current commit; any other local skills get a separate warning line,
   but they won't be tracked in the lock.
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

> Demo file: the `demo-content-delete` skill will offer to delete this file.
