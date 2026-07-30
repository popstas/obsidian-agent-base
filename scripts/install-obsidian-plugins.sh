#!/usr/bin/env bash
# Ставит чужие Obsidian-плагины из obsidian-plugins.json.
# Чужой код в репозиторий не коммитится, поэтому это шаг развёртывания.
#
# Совместим с bash 3.2 (macOS) и не требует jq, node и python.
# Windows-близнец — install-obsidian-plugins.ps1, их поведение должно совпадать.
set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$REPO/obsidian-plugins.json"

# Разбирает манифест построчно: без jq объект плагина обязан помещаться
# в одну строку. Это условие держит тест в tests/obsidian-plugins.test.mjs.
# Печатает: id \t repo \t minVersion \t vendored|remote
parse_manifest() {
  local line id repo minv kind
  while IFS= read -r line; do
    case "$line" in
      *'"id"'*) ;;
      *) continue ;;
    esac
    id=$(printf '%s\n' "$line" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    repo=$(printf '%s\n' "$line" | sed -n 's/.*"repo"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    minv=$(printf '%s\n' "$line" | sed -n 's/.*"minVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    case "$line" in
      *'"vendored"'*[Tt]rue*) kind=vendored ;;
      *) kind=remote ;;
    esac
    printf '%s\t%s\t%s\t%s\n' "$id" "$repo" "$minv" "$kind"
  done < "$1"
}

main() {
  if [ "${1:-}" = "--dry-run" ]; then
    parse_manifest "$MANIFEST"
    return 0
  fi
  echo "install-obsidian-plugins: установка появится в следующей задаче" >&2
  return 1
}

# Скрипт можно исходить (source) — тогда main не запускается и тесты
# получают доступ к отдельным функциям.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
