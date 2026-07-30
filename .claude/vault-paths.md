# Пути вольта для скиллов обзоров

Читают `weekly-review` и `monthly-review` (ключи `weekly_report`, `monthly_report`,
`year_goals`). Если файла нет, эти скиллы падают обратно на Glob по дефолтным путям
ядра — см. их `SKILL.md`. Заполняется/проверяется при адаптации вольта, см.
`INTEGRATION.md`.

- `weekly_report`: `Log/Reports/????-??-??.md` — недельные отчёты (`weekly-report`);
  basename — понедельник отчётной недели (`YYYY-MM-DD.md`), актуальный — с последней датой.
- `monthly_report`: `Log/Reports/????-??.md` — месячные итоги (`monthly-review`);
  basename — `YYYY-MM.md`, лежат в той же папке, что и недельные, отличаются форматом имени.
- `year_goals`: `Notes/*/Цели *.md` — файл целей года, например `Notes/2026/Цели 2026.md`;
  basename уникален глобально (см. правило wikilink-резолвинга в `obsidian-vault`).

Если ключа/файла для конкретного шага нет — соответствующий шаг обзора пропускается,
это штатное поведение (см. `SKILL.md` weekly-review/monthly-review, раздел «Пути вольта»).
