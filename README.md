# obsidian-agent-base

Обезличенное ядро рабочего процесса для ведения Obsidian-vault с агентом (Claude Code): задачи в `tasks.md`, дневник в `Log/`, заметки в `Notes/`, еженедельные отчёты в `Log/Reports/`. Переиспользуемые скиллы и скрипты без привязки к конкретному проекту, людям и инструментам.

## Integration prompt (copy-paste to Claude Code)

Paste this into Claude Code from inside your own Obsidian vault / project. It installs the
skills and **adapts them to you** instead of leaving the template placeholders:

> Install the Obsidian-vault skills from https://github.com/popstas/obsidian-agent-base:
> copy its `skills/*` into my `.claude/skills/`, and optionally the `.claude/` task-status
> tooling (`gen-tasks-json.cjs`, `statusline.cjs`, `hooks/tasks-startup.sh`, merging — not
> overwriting — `settings.json`). Then read the repo's `INTEGRATION.md` and run the
> adaptation flow: ask me which setup level I want — **required** (~2–3 min: project
> name + vault layout) or **detailed** (~10–15 min) — interview me one question at a time
> with sensible defaults, and edit the copied templates to match my answers so no template
> placeholders remain (e.g. `Platform/`, `Companies/`, `CRM`). Show me a diff at the end.

## Структура

```
INTEGRATION.md           инструкция агенту: как адаптировать скиллы под пользователя
skills/                  скиллы Claude Code (по одному SKILL.md на скилл)
  new-task/              добавить задачу в tasks.md (➕ YYYY-MM-DD)
  close-task/            закрыть задачу (✅) + запись в дневной лог
  list-tasks/            утренний обзор открытых задач, поиск старых
  worklog/               запись хода работы в Log/YYYY-MM-DD.md
  weekly-report/         еженедельный отчёт в Log/Reports/ (1 док/неделю, пн–вс)
  obsidian-vault/        конвенции vault: таксономия, wikilinks, sensitivity
.claude/                 статус задач через tasks.json
  gen-tasks-json.cjs     парсит tasks.md → files/tasks.json (total/done/open)
  statusline.cjs         статус-строка: 📋 done/total │ N open │ %
  hooks/tasks-startup.sh SessionStart: подсказка посмотреть tasks.md и лог дня
  settings.json          проводка statusLine + хуков (мерджить, не перезаписывать)
```

## Как подключить скиллы

Скопируй нужные папки скиллов в `.claude/skills/` своего проекта:

```bash
cp -r skills/* /path/to/your-project/.claude/skills/
```

Скиллы самодостаточны (один `SKILL.md`, без скриптов). Они ссылаются друг на друга по имени (`[[new-task]]`, `[[worklog]]` и т.п.); ставь их вместе, чтобы ссылки были осмысленны.

**Не копируй вслепую — это шаблоны.** В скиллах зашиты примеры (доменные папки, направления отчёта, трекер) и дефолты под абстрактный vault. После `cp` попроси агента прогнать [`INTEGRATION.md`](INTEGRATION.md): он спросит, какой уровень настройки нужен (обязательный ~2–3 мин / подробный ~10–15 мин), задаст вопросы и подстроит скопированные шаблоны под тебя — вместо того чтобы оставить чужие `Platform/` и `CRM`.

## Как подключить статус задач (tasks.json)

1. Скопируй скрипты и хук:
   ```bash
   cp .claude/gen-tasks-json.cjs .claude/statusline.cjs /path/to/your-project/.claude/
   mkdir -p /path/to/your-project/.claude/hooks
   cp .claude/hooks/tasks-startup.sh /path/to/your-project/.claude/hooks/
   ```
2. **Смерджи** содержимое `.claude/settings.json` в `.claude/settings.json` своего проекта (не перезаписывай — добавь `statusLine` и блоки `hooks`).
3. Готово: при записи в `tasks.md` и на старте сессии пересчитывается `files/tasks.json`, а статус-строка показывает прогресс.

Что считается: верхнеуровневые чекбоксы `- [ ]` / `- [x]` в `tasks.md`. `done` — закрытые `- [x]`, `total` — все, `open = total - done`. Подпункты с отступом не учитываются. Зависимости: Node.js; для PostToolUse-хука — `jq`.

## Формат задач (tasks.md)

```md
- [x] Завершённая задача ➕ 2026-06-01 ✅ 2026-06-03
- [ ] Открытая задача ➕ 2026-06-04
	- https://example.com/task/12345
	- [ ] подзадача
```

`➕ YYYY-MM-DD` — дата создания, `✅ YYYY-MM-DD` — дата закрытия. Подбуллеты — табом. Закрытые задачи держатся вверху списка, открытые — ниже.
