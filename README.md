# obsidian-agent-base

Обезличенное ядро рабочего процесса для ведения Obsidian-vault с агентом (Claude Code): задачи в `tasks.md`, дневник в `Log/`, заметки в `Notes/`, еженедельные отчёты в `Log/Reports/`. Переиспользуемые скиллы и скрипты без привязки к конкретному проекту, людям и инструментам.

## Структура

```
skills/                  скиллы Claude Code (по одному SKILL.md на скилл)
  add-task/              добавить задачу в tasks.md (➕ YYYY-MM-DD)
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

Скиллы самодостаточны (один `SKILL.md`, без скриптов). Они ссылаются друг на друга по имени (`[[add-task]]`, `[[worklog]]` и т.п.); ставь их вместе, чтобы ссылки были осмысленны.

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
