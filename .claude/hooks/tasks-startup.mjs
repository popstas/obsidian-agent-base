#!/usr/bin/env node
// SessionStart: подсказать агенту заглянуть в задачи и лог текущего дня.
// Node, а не пара bash/PowerShell, как у Codex-близнеца (.codex/hooks/): у
// Claude Code нет поля commandWindows, поэтому одной строкой команды две ОС
// здесь не покрыть. Подробности — в INTEGRATION.md, раздел про хуки.
const d = new Date();
const p = (n) => String(n).padStart(2, '0');
const [y, m, day] = [d.getFullYear(), p(d.getMonth() + 1), p(d.getDate())];

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: `Посмотри tasks.md в корне проекта и Log/${y}/${m}/${y}-${m}-${day}.md (файл текущего дня, может отсутствовать). Напиши список задач, текущую задачу, варианты действий, если известны.`,
  },
}) + '\n');
