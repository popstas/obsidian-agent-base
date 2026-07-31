#!/usr/bin/env bash
# SessionStart для Codex: подсказать агенту заглянуть в задачи и лог текущего дня.
# Близнец .claude/hooks/tasks-startup.mjs, но без Node — на клиенте его может не быть.
set -eu

# Один снимок времени, дальше — нарезка подстановкой параметров. Три
# отдельных вызова date пересекали бы полночь между собой и давали бы
# Log/2026/12/2027-01-01.md. .mjs- и .ps1-близнецы тоже берут время один раз.
today="$(date +%Y-%m-%d)"
year="${today%%-*}"
month="${today#*-}"
month="${month%%-*}"
logpath="Log/${year}/${month}/${today}.md"

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Посмотри tasks.md в корне проекта и ${logpath} (файл текущего дня, может отсутствовать). Напиши список задач, текущую задачу, варианты действий, если известны."
  }
}
EOF
