# Ставит чужие Obsidian-плагины из obsidian-plugins.json.
# Чужой код в репозиторий не коммитится, поэтому это шаг развёртывания.
#
# Совместим с Windows PowerShell 5.1 — тем, что стоит на чистой Windows.
# Unix-близнец — install-obsidian-plugins.sh, их поведение должно совпадать.
param([switch]$DryRun)

# PowerShell 5.1 по умолчанию не согласует TLS 1.2, и GitHub такому клиенту
# отказывает. Обязано стоять до первого сетевого вызова.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

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

function Get-HttpFailureText([string]$Id, [int]$Status) {
  if ($Status -eq 403) {
    return "FAIL ${Id}: GitHub ответил 403 — похоже, исчерпан лимит запросов к API без авторизации. Установи GITHUB_TOKEN в окружении, чтобы поднять лимит."
  }
  if ($Status -eq 404) {
    return "FAIL ${Id}: GitHub ответил 404 — репозиторий мог быть переименован или удалён. Проверь и обнови obsidian-plugins.json."
  }
  return "FAIL ${Id}: GitHub ответил $Status"
}

function Invoke-Install {
  $manifest = Get-Content (Join-Path $Repo 'obsidian-plugins.json') -Raw | ConvertFrom-Json

  if ($DryRun) {
    foreach ($p in $manifest.plugins) {
      $kind = if ($p.vendored) { 'vendored' } else { 'remote' }
      [Console]::Out.Write("$($p.id)`t$($p.repo)`t$($p.minVersion)`t$kind`n")
    }
    return 0
  }

  $headers = @{ 'user-agent' = 'obsidian-agent-base' }
  if ($env:GITHUB_TOKEN) { $headers['authorization'] = "Bearer $env:GITHUB_TOKEN" }

  $failed = 0
  foreach ($p in $manifest.plugins) {
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
      $apiHeaders = $headers.Clone()
      $apiHeaders['accept'] = 'application/vnd.github+json'
      $rel = Invoke-RestMethod -Uri "$Api/repos/$($p.repo)/releases/latest" `
        -Headers $apiHeaders -UseBasicParsing
      $tag = $rel.tag_name
    } catch {
      $code = 0
      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
      Write-Error -Message (Get-HttpFailureText $p.id $code) -ErrorAction Continue
      $failed++
      continue
    }
    if (-not $tag) {
      Write-Error -Message "FAIL $($p.id): в ответе GitHub нет tag_name" -ErrorAction Continue
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
        Write-Error -Message "FAIL $($p.id): не удалось скачать ${name}: HTTP $code" -ErrorAction Continue
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
  }

  if ($failed -gt 0) {
    Write-Error -Message "`n$failed плагин(ов) не установлено. Поставь их вручную через Obsidian → Community plugins." -ErrorAction Continue
    return 1
  }
  return 0
}

# Скрипт можно точечно исходить (dot-source) — тогда Invoke-Install не
# запускается и тесты получают доступ к отдельным функциям.
if ($MyInvocation.InvocationName -ne '.') {
  exit (Invoke-Install)
}
