#!/usr/bin/env bash
# SessionStart для Codex: подсказать агенту заглянуть в задачи и лог текущего дня.
# Близнец .claude/hooks/tasks-startup.mjs, но без Node — на клиенте его может не быть.
set -eu

today="$(date +%Y-%m-%d)"
logpath="Log/$(date +%Y)/$(date +%m)/${today}.md"

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Посмотри tasks.md в корне проекта и ${logpath} (файл текущего дня, может отсутствовать). Напиши список задач, текущую задачу, варианты действий, если известны."
  }
}
EOF
