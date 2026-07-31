# SessionStart для Codex на Windows. Близнец tasks-startup.sh — вывод обязан совпадать.
# Совместим с Windows PowerShell 5.1: без ConvertTo-Json -Depth по умолчанию и без ??.
$ErrorActionPreference = 'Stop'

$now = Get-Date
$today = $now.ToString('yyyy-MM-dd')
$logpath = "Log/{0}/{1}/{2}.md" -f $now.ToString('yyyy'), $now.ToString('MM'), $today

$payload = [ordered]@{
  hookSpecificOutput = [ordered]@{
    hookEventName = 'SessionStart'
    additionalContext = "Посмотри tasks.md в корне проекта и $logpath (файл текущего дня, может отсутствовать). Напиши список задач, текущую задачу, варианты действий, если известны."
  }
}

[Console]::Out.Write(($payload | ConvertTo-Json -Depth 5) + "`n")
