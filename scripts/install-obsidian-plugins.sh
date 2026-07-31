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
  local line id repo minv kind vend
  # "|| [ -n "$line" ]" — иначе последняя строка без завершающего \n (так
  # пишет JSON.stringify) молча теряется: read возвращает код ошибки, но
  # переменную всё равно заполняет.
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      *'"id"'*) ;;
      *) continue ;;
    esac
    id=$(printf '%s\n' "$line" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    # Строка с ключом "id", из которой id не извлёкся, — не запись, а признак
    # сломанного разбора (например, sed на BSD/macOS повёл себя не так, как
    # GNU). Печатать её нельзя: пустое поле id ниже всё равно пропускается, и
    # тогда "разбор дал ноль записей" стало бы неотличимо от "записи есть".
    # Не печатаем — и ноль записей на выходе означает ровно ноль записей.
    if [ -z "$id" ]; then continue; fi
    repo=$(printf '%s\n' "$line" | sed -n 's/.*"repo"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    minv=$(printf '%s\n' "$line" | sed -n 's/.*"minVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    # Значение "vendored" разбирается так же, как остальные поля, — по ключу.
    # Позиционный шаблон вида *'"vendored"'*true* ловил бы ЛЮБОЙ true правее
    # ключа: строка с "vendored": false и "enabled": true читалась бы как
    # vendored, и плагин молча никогда бы не поставился (на Windows при этом
    # ставился бы — ConvertFrom-Json разбирает по значению).
    vend=$(printf '%s\n' "$line" | sed -n 's/.*"vendored"[[:space:]]*:[[:space:]]*\([A-Za-z]*\).*/\1/p')
    case "$vend" in
      [Tt]rue) kind=vendored ;;
      *) kind=remote ;;
    esac
    printf '%s\t%s\t%s\t%s\n' "$id" "$repo" "$minv" "$kind"
  done < "$1"
}

# Числовое сравнение семвер-подобных версий по компонентам: "0.9.0" < "0.10.0",
# чего не даёт строковое сравнение. Печатает -1/0/1, недостающие компоненты — 0.
# Нечисловой хвост компонента отбрасывается: "8.3.0-beta" читается как 8.3.0.
compare_versions() {
  local a="$1" b="$2" i len na nb
  local -a pa pb
  IFS=. read -r -a pa <<< "$a"
  IFS=. read -r -a pb <<< "$b"
  len=${#pa[@]}
  if [ ${#pb[@]} -gt "$len" ]; then len=${#pb[@]}; fi
  i=0
  while [ "$i" -lt "$len" ]; do
    na=${pa[$i]:-0}; nb=${pb[$i]:-0}
    na=${na%%[!0-9]*}; nb=${nb%%[!0-9]*}
    if [ -z "$na" ]; then na=0; fi
    if [ -z "$nb" ]; then nb=0; fi
    if [ "$na" -ne "$nb" ]; then
      if [ "$na" -lt "$nb" ]; then echo -1; else echo 1; fi
      return 0
    fi
    i=$((i + 1))
  done
  echo 0
}

API="${OAB_GITHUB_API:-https://api.github.com}"
DL="${OAB_GITHUB_DOWNLOAD:-https://github.com}"

# Два набора заголовков: авторизация уходит ТОЛЬКО на вызов API.
# Ассеты релиза GitHub отдаёт редиректом на objects.githubusercontent.com с
# подписью прямо в URL; лишний заголовок authorization на таком URL GitHub
# штатно отвергает 400-м. curl снимает пользовательский Authorization на
# кросс-хостовом редиректе сам (с 7.58, CVE-2018-1000007), а
# Invoke-WebRequest на Windows PowerShell 5.1 — нет, поэтому разделение
# сделано явно в обеих реализациях, а не оставлено на поведение клиента.
curl_args() {
  CURL_ARGS=(-sSL -H "user-agent: obsidian-agent-base")
  CURL_API_ARGS=("${CURL_ARGS[@]}" -H "accept: application/vnd.github+json")
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    CURL_API_ARGS+=(-H "authorization: Bearer $GITHUB_TOKEN")
  fi
}

# Версия установленного плагина по его manifest.json. Пусто — если плагина нет
# или manifest.json не читается (считаем это "не установлен").
installed_version() {
  local mf="$1/manifest.json"
  if [ ! -f "$mf" ]; then return 0; fi
  grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$mf" \
    | head -1 | sed 's/.*"\([^"]*\)"$/\1/'
}

describe_http_failure() {
  case "$2" in
    403) echo "FAIL $1: GitHub ответил 403 — похоже, исчерпан лимит запросов к API без авторизации. Установи GITHUB_TOKEN в окружении, чтобы поднять лимит." ;;
    404) echo "FAIL $1: GitHub ответил 404 — репозиторий мог быть переименован или удалён. Проверь и обнови obsidian-plugins.json." ;;
    *)   echo "FAIL $1: GitHub ответил $2" ;;
  esac
}

main() {
  # Всё, кроме --dry-run, — ошибка: молча игнорировать неизвестный аргумент
  # опасно, "install-obsidian-plugins.sh -DryRun" (форма Windows-близнеца)
  # иначе пошёл бы качать по-настоящему. PowerShell-версия делает ту же
  # проверку сама и явно: без неё непривязанный аргумент там молча оседал бы
  # в $args, а ошибки биндинга не было бы вовсе.
  if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--dry-run" ]; }; then
    echo "Неизвестные аргументы: $*" >&2
    echo "Использование: bash scripts/install-obsidian-plugins.sh [--dry-run]" >&2
    return 2
  fi

  # Пропавший манифест — отказ, а не тихий успех: без этой проверки dry-run
  # возвращал 0, а установочный цикл получал пустой поток и рапортовал, что
  # всё в порядке.
  if [ ! -f "$MANIFEST" ]; then
    echo "FAIL: не найден манифест $MANIFEST — запускай скрипт из каталога vault." >&2
    return 1
  fi

  # Манифест на месте, но разбор не дал ни одной записи — это отказ, а не
  # тихий успех. Без этой проверки цикл ниже читал бы одну пустую строку,
  # спотыкался о "[ -z "$id" ] && continue" и выходил с кодом 0, не напечатав
  # вообще ничего: пользователь на macOS (BSD sed/grep ведут себя не как GNU)
  # разумно решил бы, что всё поставилось, а на Windows тот же манифест
  # ставился бы целиком через ConvertFrom-Json. Тихое расхождение реализаций —
  # ровно тот класс дефектов, ради которого эти два скрипта держат в паритете.
  # Разбор делается ОДИН раз и здесь: и dry-run, и установка ниже работают с
  # этим результатом, поэтому проверка накрывает оба режима.
  local parsed; parsed=$(parse_manifest "$MANIFEST")
  if [ -z "$parsed" ]; then
    echo "FAIL: манифест $MANIFEST не дал ни одной записи плагина — проверь, что массив plugins не пуст и каждый объект плагина занимает ровно одну строку." >&2
    return 1
  fi

  if [ "${1:-}" = "--dry-run" ]; then
    printf '%s\n' "$parsed"
    return 0
  fi

  curl_args
  local failed=0 id repo minv kind dir have tag status name dir_existed newv
  # Шаблон у mktemp обязателен: он не нужен GNU-версии, но BSD/macOS без него
  # печатает usage и не создаёт файл — tmp оказался бы пустым, и "curl -o ''"
  # валил бы каждый плагин на основной целевой ОС.
  local tmp; tmp=$(mktemp "${TMPDIR:-/tmp}/oab.XXXXXX")
  # Цикл кормится here-string из уже разобранной переменной, а не пайпом:
  # пайп увёл бы цикл в подоболочку, и счётчик failed из неё не вернулся бы.
  while IFS=$'\t' read -r id repo minv kind; do
    if [ -z "$id" ]; then continue; fi
    dir="$REPO/.obsidian/plugins/$id"

    if [ "$kind" = "vendored" ]; then
      echo "skip $id — вендоренный"
      continue
    fi

    have=$(installed_version "$dir")
    if [ -n "$have" ] && [ "$(compare_versions "$have" "$minv")" != "-1" ]; then
      echo "skip $id — установлена версия $have, требуется $minv"
      continue
    fi

    status=$(curl "${CURL_API_ARGS[@]}" -o "$tmp" -w '%{http_code}' \
      "$API/repos/$repo/releases/latest")
    if [ "$status" != "200" ]; then
      describe_http_failure "$id" "$status" >&2
      failed=$((failed + 1))
      continue
    fi
    tag=$(grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' "$tmp" \
      | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ -z "$tag" ]; then
      echo "FAIL $id: в ответе GitHub нет tag_name" >&2
      failed=$((failed + 1))
      continue
    fi

    # Запоминаем, существовала ли директория ДО запуска: если скачивание
    # упадёт посередине, чистим только то, что создали сами — ранее рабочую
    # установку не трогаем, даже если она теперь смешанной версии.
    dir_existed=0
    if [ -d "$dir" ]; then dir_existed=1; fi
    mkdir -p "$dir"

    local ok=1
    for name in manifest.json main.js styles.css; do
      status=$(curl "${CURL_ARGS[@]}" -o "$dir/$name" -w '%{http_code}' \
        "$DL/$repo/releases/download/$tag/$name")
      if [ "$status" != "200" ]; then
        rm -f "$dir/$name"
        if [ "$name" = "styles.css" ]; then continue; fi
        echo "FAIL $id: не удалось скачать $name: HTTP $status" >&2
        ok=0
        break
      fi
    done

    if [ "$ok" = "0" ]; then
      if [ "$dir_existed" = "0" ]; then rm -rf "$dir"; fi
      failed=$((failed + 1))
      continue
    fi

    newv=$(installed_version "$dir")
    if [ -z "$newv" ]; then newv='?'; fi
    if [ -n "$have" ]; then
      echo "installed $id — обновлён $have → $newv"
    else
      echo "installed $id ($newv)"
    fi

    # Ассеты релиза не обязаны совпадать версией с тегом релиза: у dataview
    # tag_name latest-релиза был 0.5.70, а manifest.json внутри того же
    # релиза нёс version 0.5.68 — реальный случай, не гипотетический. Если
    # newv всё ещё ниже minVersion, скачивание прошло успешно, но требование
    # манифеста этим репозиторием недостижимо: без этой проверки скрипт при
    # каждом запуске молча перекачивал бы те же файлы заново, бесконечно не
    # продвигаясь. newv='?' пропускаем — сравнивать плейсхолдер с версией
    # числом нечего, и ложное предупреждение хуже отсутствующего.
    if [ "$newv" != "?" ] && [ "$(compare_versions "$newv" "$minv")" = "-1" ]; then
      echo "WARN $id: установлена версия $newv, но манифест требует $minv — такая версия недостижима из релизных ассетов $repo (тег релиза и manifest.json внутри него расходятся version'ом). Поправь minVersion в obsidian-plugins.json на версию, которую реально отдают ассеты." >&2
    fi
  done <<< "$parsed"
  rm -f "$tmp"

  if [ "$failed" -gt 0 ]; then
    echo "" >&2
    echo "$failed плагин(ов) не установлено. Поставь их вручную через Obsidian → Community plugins." >&2
    return 1
  fi
  return 0
}

# Скрипт можно исходить (source) — тогда main не запускается и тесты
# получают доступ к отдельным функциям.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  # ${1+"$@"}, а не голый "$@": на bash 3.2 (macOS, основная целевая ОС) "$@" под
  # set -u при пустом наборе позиционных параметров считается обращением к
  # unbound variable и валит скрипт до входа в main — обычный безаргументный
  # запуск "bash install-obsidian-plugins.sh" падал бы, ни разу не дойдя до
  # разбора аргументов. ${1+"$@"} безопасен под nounset на 3.2 и на новых bash
  # даёт то же поведение, что и "$@": ноль аргументов — main вызывается без
  # аргументов, один и более — прокинуты как есть, включая аргументы с
  # пробелами. "${@:-}" тут не подходит: при пустом наборе она передаёт main
  # ОДИН пустой аргумент, а не ноль, — он попадает в ветку "Неизвестные
  # аргументы" и завершает скрипт кодом 2. Не упрощай обратно до "$@".
  main ${1+"$@"}
fi
