# Changelog

> Дневные логи лежат вложенно — `Log/YYYY/MM/YYYY-MM-DD.md`; недельные отчёты по-прежнему лежат плоско в `Log/Reports/`.
>
> Репозиторий до-единичный: breaking changes едут минорным бампом, с пометкой BREAKING под версией, где они случились.

## 0.1.0


> **BREAKING.** плоский формат Log/YYYY-MM-DD.md больше не
поддерживается; инструкция `cp -r skills/*` заменена на marketplace.

> **BREAKING.** клиенту больше не нужен Node — удалён install-obsidian-plugins.mjs

> **BREAKING.** убрать промежуточный чекбокс и выровнять порог возраста


### Bug Fixes

- Проверять baseOnly по индексу git и убрать из него docs/superpowers
- Закрывать онбординг-задачи, а не чистить ссылки
- Прятать scripts и tests регуляркой, задать ширину сайдбара в CSS
- Чистый stderr в PowerShell-установщике, тест на смешанный исход
- BOM для .ps1 на Windows PowerShell 5.1, тесты через все найденные интерпретаторы
- UTF-8 OutputEncoding в .ps1 — иначе CP866 на Windows 5.1
- Портируемость установщика на macOS и паритет с PowerShell
- Один снимок времени в codex-хуке и верная причина Node у Claude
- Убрать Node и jq с пути обычного пользователя
- Reject unknown args in PowerShell installer before install
- Safe nounset guard on main "$@" for bash 3.2
- Warn when installed version still misses minVersion
- Отказ вместо тихого нуля плагинов и кириллица прочь с разбираемой строки
- POSIX-пути в lock и предупреждение о неотслеженных скиллах
- Один источник путей чистки и полный baseOnly
- Убрать scripts/lib/repo.mjs из baseOnly
- Резолвить wikilinks index.md по индексу git, не по рабочему дереву
- Открытость чекбокса не завязана на конкретный символ
- Не разводить remote в режиме «только скиллы», знание о bootstrap — в README
- Предупреждение bootstrap не звучит как ошибка
- Дочистить символо-специфичные якоря открытой задачи
- Ссылаться на скиллы код-спаном, а не вайклинком

### CI

- Гонять bash-установщик на macOS против системного /bin/bash 3.2

### Documentation

- Add INTEGRATION.md guiding per-user skill adaptation
- Add English integration prompt; rename add-task skill to new-task
- Replace Planfix example with generic CRM
- Add # Week / # Week+ task sections to skills
- Preserve author and quote on tasks
- Deidentify from Claude Code to any agent
- Log night work to previous day, no duplicate header
- Translate README to English, add README_ru.md
- Убрать пустые каталоги после чистки демо и уточнить CLI-форму marketplace
- Как связать skills с .agents/skills для Codex
- Вопросы с примерами, меньше вопросов
- Вопрос про день сбора недельного отчёта
- Шаг 0 — установка Obsidian и подключение vault
- Нумерация вопросов и интерактивный опрос
- Исправить неточность про Node в шапке CLAUDE.md и README
- Шаг включения хуков Codex и граница по Node
- Агент сам правит config.toml, а не поручает пользователю
- Точная граница по Node на клиенте и инварианты под новую архитектуру
- Честная формулировка проверки хука Codex вместо непроверенного факта
- Грабли адаптации, на которые встал реальный прогон
- Синхронизировать таблицу адаптации со скиллами
- Полная справка по хоткеям и тест на её актуальность

### Features

- Initial public release of obsidian-agent-base
- Add base-sync and task workflow skills
- Плагин и Obsidian-вольт в одном репозитории
- Подрезать набор плагинов и добавить шаблоны недели и года
- Вендорить настройки file-explorer-plus и iconize
- Онбординг вместо демо-блоков, термин vault, группа setupDocs
- Убрать из дерева файлов CHANGELOG, CONTRIBUTING и INTEGRATION
- Wikilink на INTEGRATION и готовый промпт запуска адаптации
- Поднять адаптацию vault первой задачей лестницы
- Назвать вторую задачу по тому, что человек ищет в README
- Справка по хоткеям как заметка и задача её прочитать
- Демо-заметки в месячную папку, рядом со справкой по хоткеям
- Убрать демо-заметку про созвон
- Порог старых задач 14 дней, index.md по умолчанию
- Bash-установщик плагинов — разбор манифеста и --dry-run
- Bash-установщик плагинов — сравнение версий и установка
- PowerShell-установщик плагинов для чистой Windows
- Клиенту больше не нужен Node — удалён install-obsidian-plugins.mjs
- SessionStart-хук без Node — bash и PowerShell
- Убрать промежуточный чекбокс и выровнять порог возраста
- Рубрики отчёта из фактов, полная граница RISKY
- Корневой index.md как точка входа
- Плагин obsidian-editor-shortcuts и его хоткеи

### Testing

- Разделить паритет объекта и проверку UTF-8 в выводе .ps1
- Дискриминирующие тесты на разбор манифеста, stderr и сохранность каталога
- Дословный паритет текстов, восстановленный разбор фикстуры и якорь на позицию main

### Task

- Mark GitHub publish task as done

