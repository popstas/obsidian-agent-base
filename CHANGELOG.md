# Changelog

> Дневные логи лежат вложенно — `Log/YYYY/MM/YYYY-MM-DD.md`; недельные отчёты по-прежнему лежат плоско в `Log/Reports/`.
>
> Репозиторий до-единичный: breaking changes едут минорным бампом, с пометкой BREAKING под версией, где они случились.

## 0.1.0


> **BREAKING.** плоский формат Log/YYYY-MM-DD.md больше не поддерживается.
Форкам нужно перенести существующие логи в подкаталоги по годам и месяцам.


### Bug Fixes

- Drop dangling reference to the private dashboard note
- Sync the project checkbox so the documented mirror is real
- Detect local skills dir instead of hardcoding .claude/skills
- Resolve bootstrap paths dynamically and guard diff against missing base
- Emit a heading per release instead of a frozen version

### Documentation

- Add INTEGRATION.md guiding per-user skill adaptation
- Add English integration prompt; rename add-task skill to new-task
- Replace Planfix example with generic CRM
- Add # Week / # Week+ task sections to skills
- Preserve author and quote on tasks
- Deidentify from Claude Code to any agent
- Log night work to previous day, no duplicate header
- Translate README to English, add README_ru.md
- Design for plugin+vault repository
- Implementation plan for plugin+vault repository
- Check symlinks via git index instead of worktree walk
- Record project-level enabledPlugins spike result
- Qualify spike verdict with canary test and scope finding
- Correct flat-log count to 15 and use node --test auto-discovery
- Widen wikilink audit pattern to catch non-ASCII dangling links
- Require INTEGRATION.md mail section so weekly-review's pointer resolves
- Document the full task ladder
- Fix ladder file count and close the projects.md mirror gap in close-task
- Fix bootstrap hardcoded skills path and cmdDiff null-base crash
- State the per-machine marketplace step precisely in README requirements

### Features

- Initial public release of obsidian-agent-base
- Add base-sync and task workflow skills
- Use nested Log/YYYY/MM/YYYY-MM-DD.md for daily logs
- Add weekly-review, monthly-review, snoozed-task, snoozed-review
- Generate Skills list.md with pre-commit and CI guards
- Add Claude, Codex and Cursor manifests with marketplace
- Register vault as local marketplace, port hooks to Node

### Testing

- Add repo helpers and convention guards
- Use node --test auto-discovery for per-test results

### Task

- Mark GitHub publish task as done

