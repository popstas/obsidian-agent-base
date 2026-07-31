# obsidian-agent-base

🇬🇧 [English](README.md) · 🇷🇺 Русский

Обезличенное ядро рабочего процесса для ведения Obsidian-vault с агентом — **любым** (Claude Code, Codex, Cursor и др.): задачи в `tasks.md`, дневник в `Log/`, заметки в `Notes/`, еженедельные отчёты в `Log/Reports/`. Переиспользуемые скиллы и скрипты без привязки к конкретному проекту, людям и инструментам.

Этот репозиторий — сразу три вещи: устанавливаемый плагин для Claude Code, Codex и Cursor; готовый к использованию Obsidian-vault, который клонируешь и адаптируешь под себя; и источник демо-контента, который удаляется после адаптации. Ниже — режим установки под твою задачу.

## Структура

```
skills/                  скиллы агента, по одному SKILL.md на скилл (читаются прямо в Obsidian)
  Skills list.md         сгенерированный индекс всех скиллов
.claude-plugin/          плагин Claude Code + однопродуктовый marketplace
.codex-plugin/           манифест плагина для Codex
.cursor-plugin/          манифест плагина для Cursor
.claude/                 настройки, хуки, счётчик задач, синхронизация с base
.codex/                  хуки Codex (подсказка на старте сессии), bash + PowerShell
.obsidian/               настройки Obsidian, сниппеты, вендоренный tasks-mover
scripts/                 список скиллов, демо-манифест, установщик плагинов, релиз
tasks.md projects.md tasks-future.md tasks-snoozed.md tasks-recurring.md ideas.md
Log/ Notes/ _templates/ files/
obsidian-plugins.json    какие Obsidian-плагины ожидает vault
demo-manifest.json       что удаляет demo-content-delete: демо-файлы, инструкции, файлы базы
```

## Установка

### Как новый vault (большинство пользователей)

```bash
git clone https://github.com/popstas/obsidian-agent-base my-vault
cd my-vault
bash scripts/install-obsidian-plugins.sh     # macOS / Linux
```

На Windows вместо этого:

```powershell
git clone https://github.com/popstas/obsidian-agent-base my-vault
cd my-vault
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-obsidian-plugins.ps1
```

(`-NoProfile` — чтобы разговорчивый профиль PowerShell не подмешал в вывод
установщика своё, в том числе свою `OutputEncoding`.)

**Для установки и обновления плагинов не нужны ни Node, ни Python, ни `jq`** —
ни на macOS/Linux, ни на Windows. На Node на клиенте остаются две вещи, и ни
одна не входит в повседневный цикл:

- **Хуки Claude Code** (подсказка на старте сессии, счётчик задач). У Claude
  Code нет поля для выбора команды по ОС, поэтому одной строкой две платформы
  не покрыть — у Codex такое поле есть, и его хуки поэтому обходятся без Node.
  Без Node хуки просто тихо не срабатывают: подсказку на старте даёт сам агент,
  а счётчик задач у `weekly-report` имеет фолбэк на прямой подсчёт по `tasks.md`.
- **`base-sync`** (`node .claude/sync-base.cjs`, см. ниже) — необязательный
  сценарий подтягивания обновлений скиллов в уже адаптированный vault. Оставлен
  на Node осознанно: к нему обращаются, только когда base ушёл вперёд.

Не хочешь терминал — Obsidian поставит все плагины из `obsidian-plugins.json`
сам: Settings → Community plugins → Browse.

Открой папку как vault в Obsidian, запусти в ней сессию агента и скажи «адаптируй
этот vault под меня». Агент следует `INTEGRATION.md`, интервьюирует тебя и в конце
запускает скилл `demo-content-delete`, чтобы убрать демо-контент — примеры логов,
отчёта и заметок, а по желанию и сами инструкции по развёртыванию.

Лестница задач к этому не относится: задачи в `tasks.md` и `tasks-future.md` — это
онбординг, который проходит каждый (прочитать README, перечислить, где ещё лежат
задачи, перенести их сюда, записать первый день, собрать первый недельный отчёт).
Их закрывают, а не удаляют.

Обновления: `git pull`. Если ты кастомизировал скиллы, вместо этого используй скилл
`base-sync` — он покажет, что изменилось в base, не затирая твои правки.

> **Разовая настройка на каждой машине.** После клонирования один раз выполни в сессии
> агента обе команды — без них скиллы из vault не активируются:
> ```
> /plugin marketplace add .
> /plugin install obsidian-agent-base@obsidian-agent-base
> ```
> Добавление marketplace только регистрирует его; активирует скиллы плагина именно
> `install`. Обе команды сохраняются в **пользовательском** `~/.claude/settings.json`,
> а не в клоне, поэтому шаг повторяется на каждой машине, которой пользуешься, а не
> один раз на vault.
>
> Вне сессии агента то же самое делается через `claude plugin marketplace add ./` —
> голую `.` CLI отвергает: `Invalid marketplace source format`.

### В существующий vault

```
/plugin marketplace add popstas/obsidian-agent-base
/plugin install obsidian-agent-base@obsidian-agent-base
```

Одного добавления marketplace недостаточно — нужны обе команды. После `install` скиллы
обновляются автоматически вместе с marketplace. Часть vault — лестницу задач и
настройки `.obsidian` — сводишь руками; попроси агента провести тебя по `INTEGRATION.md`.

Marketplace ставит только скиллы — счётчик задач и хуки в плагин не входят,
это опциональные дополнения; где их взять, написано в `INTEGRATION.md`.

### Только скиллы, в Codex или Cursor

Тот же marketplace; манифесты `.codex-plugin/` и `.cursor-plugin/` указывают на тот же
каталог `skills/`.

## Синхронизация с base после форка (skills-lock.json v2)

У vault, склонированного как «новый vault», уже есть `.claude/sync-base.cjs` и скилл
`base-sync/` — копировать ничего не нужно. Base продолжает развиваться после того, как
ты адаптировал скиллы под себя; чтобы подтягивать обновления, не затирая локальные
кастомизации:

1. Один раз заведи точку отсчёта: `node .claude/sync-base.cjs bootstrap`. Он добавит
   блок `baseSync` в `skills-lock.json` (формат v2), сопоставит локальные имена скиллов
   с base по алиасам (`add-task→new-task`, `list→list-tasks`, `*-vault→obsidian-vault`)
   и пометит уже разошедшиеся скиллы `customized: true`. Путь к чекауту base берётся из
   `baseSync.base.path` (по умолчанию `../../obsidian-agent-base`).
2. Дальше по запросу: `node .claude/sync-base.cjs status` — таблица состояний
   (UNCHANGED / BASE-CHANGED / LOCALLY-MODIFIED / BOTH-CHANGED / NEW-IN-BASE),
   `diff <skill>` — различия, `stamp <skill>` — зафиксировать синхронизацию после
   ручного merge.

`skills-lock.json` v2 совместим с v1: прежние записи внешних github-скиллов (`skills`) не
трогаются, добавляется отдельный блок `baseSync`. Хэш скилла считается без строк
`name:`/`description:` во frontmatter — они легитимно различаются у наследников и не
создают ложных расхождений. Разговорную часть (что подтянуть, что оставить, как
продвинуть улучшение обратно в base) ведёт скилл `base-sync`; скрипт сам файлы скиллов
не редактирует.

## Формат задач (tasks.md)

```md
# Week:
- [x] Завершённая задача ➕ 2026-06-01 ✅ 2026-06-03
- [ ] Открытая задача этой недели ➕ 2026-06-04
	- https://example.com/task/12345
	- [ ] подзадача

# Week+
- [ ] Задача на неделю+ ➕ 2026-06-02

> Активные задачи. Будущие: [[tasks-future]]. Отложенные: [[tasks-snoozed]]. Проекты: [[projects]].
```

`➕ YYYY-MM-DD` — дата создания, `✅ YYYY-MM-DD` — дата закрытия. Подбуллеты — табом. Файл разбит на две секции: `# Week:` — текущая неделя (вверху держатся завершённые `- [x]`, ниже открытые), `# Week+` — более долгий горизонт. Строка-легенда под `# Week+` ссылается на бэклог `tasks-future.md`.

> Демо-файл: скилл `demo-content-delete` предложит удалить этот файл.
