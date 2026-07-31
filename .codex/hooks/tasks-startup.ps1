# SessionStart для Codex на Windows. Близнец tasks-startup.sh — вывод обязан совпадать.
# Совместим с Windows PowerShell 5.1: без ConvertTo-Json -Depth по умолчанию и без ??.
$ErrorActionPreference = 'Stop'
# Без этой строки Windows PowerShell 5.1 пишет stdout в консольную OEM-кодировку
# (обычно CP866 для русской локали), а не в UTF-8: JSON.parse на приёмной
# стороне не падает, но additionalContext превращается в мусор — тихая порча
# хуже падения. $false обязателен — UTF8 БЕЗ BOM в потоке, иначе сломается
# JSON.parse; BOM самого файла (см. tests) — отдельная вещь, нужны обе.
# Подтверждено на живой Windows PowerShell 5.1.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

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
