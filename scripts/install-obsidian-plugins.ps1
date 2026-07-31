# Ставит чужие Obsidian-плагины из obsidian-plugins.json.
# Чужой код в репозиторий не коммитится, поэтому это шаг развёртывания.
#
# Совместим с Windows PowerShell 5.1 — тем, что стоит на чистой Windows.
# Unix-близнец — install-obsidian-plugins.sh, их поведение должно совпадать.
param([switch]$DryRun)

# PowerShell 5.1 по умолчанию не согласует TLS 1.2, и GitHub такому клиенту
# отказывает. Обязано стоять до первого сетевого вызова.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Без этой строки Windows PowerShell 5.1 пишет вывод (skip/installed/FAIL) в
# консольную OEM-кодировку (CP866 для русской локали), а не в UTF-8 — все
# русские сообщения превращаются в мусор без chcp 65001, чего обычный
# пользователь не делает. $false обязателен — UTF8 БЕЗ BOM в потоке, иначе
# ломается всё, что этот вывод парсит; BOM самого файла — отдельная вещь.
# Подтверждено на живой Windows PowerShell 5.1. Обязана стоять до первого
# вывода (Write-Host / [Console]::Error.WriteLine).
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Api = if ($env:OAB_GITHUB_API) { $env:OAB_GITHUB_API } else { 'https://api.github.com' }
$Dl  = if ($env:OAB_GITHUB_DOWNLOAD) { $env:OAB_GITHUB_DOWNLOAD } else { 'https://github.com' }

# Числовое сравнение семвер-подобных версий по компонентам: "0.9.0" < "0.10.0",
# чего не даёт строковое сравнение. Возвращает -1/0/1, недостающие компоненты — 0.
# Нечисловой хвост компонента отбрасывается: "8.3.0-beta" читается как 8.3.0.
function Compare-PluginVersion([string]$A, [string]$B) {
  $pa = $A -split '\.'
  $pb = $B -split '\.'
  $len = [Math]::Max($pa.Count, $pb.Count)
  for ($i = 0; $i -lt $len; $i++) {
    $na = 0; $nb = 0
    if ($i -lt $pa.Count) { [void][int]::TryParse(($pa[$i] -replace '\D.*$', ''), [ref]$na) }
    if ($i -lt $pb.Count) { [void][int]::TryParse(($pb[$i] -replace '\D.*$', ''), [ref]$nb) }
    if ($na -ne $nb) { if ($na -lt $nb) { return -1 } else { return 1 } }
  }
  return 0
}

function Get-InstalledVersion([string]$Dir) {
  $mf = Join-Path $Dir 'manifest.json'
  if (-not (Test-Path $mf)) { return $null }
  try { return (Get-Content $mf -Raw | ConvertFrom-Json).version } catch { return $null }
}

function Format-HttpCode([int]$Status) {
  # Три цифры с ведущими нулями: bash-версия печатает то, чем curl заполняет
  # %{http_code}, а он при отсутствии ответа даёт "000", не "0". Тексты обеих
  # реализаций обязаны совпадать до символа.
  return ('{0:000}' -f $Status)
}

function Get-HttpFailureText([string]$Id, [int]$Status) {
  if ($Status -eq 403) {
    return "FAIL ${Id}: GitHub ответил 403 — похоже, исчерпан лимит запросов к API без авторизации. Установи GITHUB_TOKEN в окружении, чтобы поднять лимит."
  }
  if ($Status -eq 404) {
    return "FAIL ${Id}: GitHub ответил 404 — репозиторий мог быть переименован или удалён. Проверь и обнови obsidian-plugins.json."
  }
  return "FAIL ${Id}: GitHub ответил $(Format-HttpCode $Status)"
}

function Invoke-Install {
  # Пропавший манифест — явный отказ с тем же текстом, что в bash-версии, а не
  # исключение Get-Content с многострочным блоком CategoryInfo.
  $manifestPath = Join-Path $Repo 'obsidian-plugins.json'
  if (-not (Test-Path $manifestPath)) {
    [Console]::Error.WriteLine("FAIL: не найден манифест $manifestPath — запускай скрипт из каталога vault.")
    return 1
  }
  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

  # Манифест на месте, но ни одной записи плагина из него не вышло — отказ, а
  # не тихий успех, тем же текстом и тем же кодом, что в bash-версии. У bash
  # это реальный сценарий (построчный разбор sed'ом на BSD/macOS может дать
  # пустые id, и скрипт вышел бы с 0, не напечатав ничего), здесь —
  # обязательная половина паритета: расхождение "на Windows поставилось всё,
  # на macOS молча ноль" — ровно тот дефект, который эти скрипты не должны
  # допускать. @() — чтобы форма была массивом при любом числе совпадений:
  # конвейер отдаёт $null на нуле и скаляр на единице, и дальше по коду
  # foreach и .Count не должны зависеть от того, что именно вернулось.
  $plugins = @($manifest.plugins | Where-Object { $_.id })
  if ($plugins.Count -eq 0) {
    [Console]::Error.WriteLine("FAIL: манифест $manifestPath не дал ни одной записи плагина — проверь, что массив plugins не пуст и каждый объект плагина занимает ровно одну строку.")
    return 1
  }

  if ($DryRun) {
    foreach ($p in $plugins) {
      $kind = if ($p.vendored) { 'vendored' } else { 'remote' }
      [Console]::Out.Write("$($p.id)`t$($p.repo)`t$($p.minVersion)`t$kind`n")
    }
    return 0
  }

  # Два набора заголовков: авторизация уходит ТОЛЬКО на вызов API.
  # Ассеты релиза GitHub отдаёт редиректом на objects.githubusercontent.com с
  # подписью прямо в URL, и лишний заголовок authorization на таком URL он
  # штатно отвергает 400-м. curl в bash-версии снимает Authorization на
  # кросс-хостовом редиректе сам (с 7.58, CVE-2018-1000007), а
  # Invoke-WebRequest на 5.1 честно пробрасывает его дальше — то есть с
  # выставленным GITHUB_TOKEN установщик падал бы на каждом скачивании, а сам
  # токен уезжал бы на CDN-хост. $headers ниже — без авторизации, намеренно.
  $headers = @{ 'user-agent' = 'obsidian-agent-base' }
  $apiHeaders = $headers.Clone()
  $apiHeaders['accept'] = 'application/vnd.github+json'
  if ($env:GITHUB_TOKEN) { $apiHeaders['authorization'] = "Bearer $env:GITHUB_TOKEN" }

  $failed = 0
  foreach ($p in $plugins) {
    $dir = Join-Path $Repo (Join-Path '.obsidian' (Join-Path 'plugins' $p.id))

    # Write-Host, а не Write-Output: эти строки — информационные сообщения
    # пользователю, как echo в bash-версии. Write-Output ушёл бы в success-
    # поток функции и подмешался бы к значению, которое ниже возвращает
    # Invoke-Install (return 0/1) — exit (Invoke-Install) получил бы массив
    # вместо целого числа и упал. Write-Host в поток не попадает и всё равно
    # печатается в консоль/stdout при неинтерактивном запуске.
    if ($p.vendored) { Write-Host "skip $($p.id) — вендоренный"; continue }

    $have = Get-InstalledVersion $dir
    if ($have -and (Compare-PluginVersion $have $p.minVersion) -ge 0) {
      Write-Host "skip $($p.id) — установлена версия $have, требуется $($p.minVersion)"
      continue
    }

    $tag = $null
    try {
      $rel = Invoke-RestMethod -Uri "$Api/repos/$($p.repo)/releases/latest" `
        -Headers $apiHeaders -UseBasicParsing
      $tag = $rel.tag_name
    } catch {
      $code = 0
      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
      # [Console]::Error.WriteLine, а не Write-Error: в Windows PowerShell 5.1
      # ErrorView по умолчанию — NormalView, и Write-Error печатает не чистую
      # строку, а многострочный блок с CategoryInfo/FullyQualifiedErrorId и
      # ANSI-цветом. bash-версия пишет в stderr ровно одну чистую строку
      # (echo "FAIL ..." >&2) — паритет текстов держит именно прямая запись.
      [Console]::Error.WriteLine((Get-HttpFailureText $p.id $code))
      $failed++
      continue
    }
    if (-not $tag) {
      [Console]::Error.WriteLine("FAIL $($p.id): в ответе GitHub нет tag_name")
      $failed++
      continue
    }

    # Запоминаем, существовала ли директория ДО запуска: если скачивание
    # упадёт посередине, чистим только то, что создали сами — ранее рабочую
    # установку не трогаем, даже если она теперь смешанной версии.
    $dirExisted = Test-Path $dir
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    $ok = $true
    foreach ($name in @('manifest.json', 'main.js', 'styles.css')) {
      $dest = Join-Path $dir $name
      try {
        Invoke-WebRequest -Uri "$Dl/$($p.repo)/releases/download/$tag/$name" `
          -Headers $headers -OutFile $dest -UseBasicParsing
      } catch {
        if (Test-Path $dest) { Remove-Item $dest -Force }
        if ($name -eq 'styles.css') { continue }
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        [Console]::Error.WriteLine("FAIL $($p.id): не удалось скачать ${name}: HTTP $(Format-HttpCode $code)")
        $ok = $false
        break
      }
    }

    if (-not $ok) {
      if (-not $dirExisted) { Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue }
      $failed++
      continue
    }

    $newv = Get-InstalledVersion $dir
    if (-not $newv) { $newv = '?' }
    if ($have) { Write-Host "installed $($p.id) — обновлён $have → $newv" }
    else { Write-Host "installed $($p.id) ($newv)" }

    # Ассеты релиза не обязаны совпадать версией с тегом релиза: у dataview
    # tag_name latest-релиза был 0.5.70, а manifest.json внутри того же
    # релиза нёс version 0.5.68 — реальный случай, не гипотетический. Если
    # newv всё ещё ниже minVersion, скачивание прошло успешно, но требование
    # манифеста этим репозиторием недостижимо: без этой проверки скрипт при
    # каждом запуске молча перекачивал бы те же файлы заново, бесконечно не
    # продвигаясь. newv='?' пропускаем — сравнивать плейсхолдер с версией
    # числом нечего, и ложное предупреждение хуже отсутствующего.
    if ($newv -ne '?' -and (Compare-PluginVersion $newv $p.minVersion) -eq -1) {
      [Console]::Error.WriteLine("WARN $($p.id): установлена версия $newv, но манифест требует $($p.minVersion) — такая версия недостижима из релизных ассетов $($p.repo) (тег релиза и manifest.json внутри него расходятся version'ом). Поправь minVersion в obsidian-plugins.json на версию, которую реально отдают ассеты.")
    }
  }

  if ($failed -gt 0) {
    # Две отдельные строки в stderr, как в bash (echo "" >&2; echo "$failed ..." >&2) —
    # не одна строка с "`n" внутри Write-Error.
    [Console]::Error.WriteLine('')
    [Console]::Error.WriteLine("$failed плагин(ов) не установлено. Поставь их вручную через Obsidian → Community plugins.")
    return 1
  }
  return 0
}

# Скрипт можно точечно исходить (dot-source) — тогда Invoke-Install не
# запускается и тесты получают доступ к отдельным функциям.
if ($MyInvocation.InvocationName -ne '.') {
  # Без [CmdletBinding()] это простая команда: параметр, не привязанный к
  # объявленному -DryRun (например, unix-привычный "--dry-run" или любой
  # опечатанный флаг), не вызывает ошибку биндинга, а молча оседает в
  # автоматической переменной $args. Подтверждено на живой Windows
  # PowerShell 5.1: "install-obsidian-plugins.ps1 --dry-run" проходил мимо
  # -DryRun и шёл в настоящую установку. Проверка обязана стоять до
  # Invoke-Install — то есть до первого сетевого вызова.
  if ($args.Count -gt 0) {
    [Console]::Error.WriteLine("Неизвестные аргументы: $($args -join ' ')")
    [Console]::Error.WriteLine('Использование: powershell -File scripts\install-obsidian-plugins.ps1 [-DryRun]')
    exit 2
  }
  exit (Invoke-Install)
}
