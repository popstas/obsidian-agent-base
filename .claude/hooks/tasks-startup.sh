#!/usr/bin/env bash
set -euo pipefail

today="$(date +%F)"

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Посмотри tasks.md в корне проекта и Log/${today}.md (файл текущего дня, может отсутствовать). Напиши список задач, текущую задачу, варианты действий, если известны."
  }
}
EOF
