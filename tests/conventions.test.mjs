// tests/conventions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, basename } from 'node:path';
import { REPO, walk, rootDocs } from '../scripts/lib/repo.mjs';

// Плоский дневной лог: сразу после Log/ идёт дата, даже если Log/ и дата
// разнесены по строке (например через markdown-таблицу или свободный текст:
// "Log/ | дневные логи YYYY-MM-DD.md"). Вложенный (Log/YYYY/MM/…) и отчёты
// (Log/Reports/…) под это не попадают — лукахед после Log/ явно их исключает.
const FLAT_LOG = /Log\/(?!YYYY\/|Reports\/|\d{4}\/)(?:(?!Log\/).)*(?:YYYY-MM-DD|\d{4}-\d{2}-\d{2})/;

// Промежуточный чекбокс `- [/]` в базе не поддерживается: ни один скилл его не
// создаёт, а семь скиллов, которые его читали, успели разойтись между собой по
// смежным правилам. Вернуться он может только тихо — ловим здесь.
const INTERMEDIATE_CHECKBOX = /- \[\/\]/;

// Общие классы приватных маркеров: абсолютные домашние пути и email-адреса.
// Конкретные приватные термины (названия компаний, городов и т.п.) сюда не
// зашиваются — они читаются из необязательного gitignored файла
// .privacy-terms (см. .privacy-terms.example), чтобы сам guard не был
// местом утечки.
const HOME_PATH = /\/home\/[^\s/'"]+\/|\/Users\/[^\s/'"]+\/|C:\\Users\\[^\s\\]+\\/;
const EMAIL = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+/;

// CHANGELOG.md обязан упоминать плоский формат в пометке BREAKING — это
// описание истории, а не действующая конвенция.
const FLAT_LOG_EXEMPT = new Set(['CHANGELOG.md']);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Необязательный локальный файл с проектно-специфичными приватными
// терминами, по одному на строку, `#`-строки и пустые строки игнорируются.
// Файл в .gitignore — в клоне его нет, и тест просто не проверяет термины,
// которых не знает.
function loadPrivacyTerms() {
  const p = join(REPO, '.privacy-terms');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function markdownFiles() {
  return [
    ...walk(join(REPO, 'skills')).filter((p) => p.endsWith('.md')),
    ...rootDocs(),
  ];
}

function scan(re, exempt = new Set()) {
  const hits = [];
  for (const path of markdownFiles()) {
    const rel = relative(REPO, path);
    if (exempt.has(rel)) continue;
    readFileSync(path, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (re.test(line)) hits.push(`${rel}:${i + 1}`);
    });
  }
  return hits;
}

test('нет плоского формата дневных логов', () => {
  assert.deepEqual(scan(FLAT_LOG, FLAT_LOG_EXEMPT), []);
});

test('нет промежуточного чекбокса `- [/]`', () => {
  assert.deepEqual(scan(INTERMEDIATE_CHECKBOX), []);
});

// list-tasks и weekly-review оба классифицируют задачи по одному и тому же
// порогу возраста «старых» задач — list-tasks в обзоре, weekly-review в шаге
// 3 (признак «Долгожитель»). Если наследник меняет порог в одном скилле и
// забывает про другой, list-tasks и weekly-review начинают спорить о статусе
// одной и той же задачи. Число не хардкодим (наследник вправе сменить 14 на
// своё), сверяем только равенство между файлами.
function ageThreshold(relPath) {
  const text = readFileSync(join(REPO, relPath), 'utf8');
  const matches = [...text.matchAll(/старше (\d+) дней/g)];
  assert.equal(
    matches.length,
    1,
    `ожидался ровно один порог возраста («старше N дней») в ${relPath}, найдено ${matches.length}`
  );
  return Number(matches[0][1]);
}

test('порог "старых" задач одинаков в list-tasks и weekly-review', () => {
  const listTasks = ageThreshold('skills/list-tasks/SKILL.md');
  const weeklyReview = ageThreshold('skills/weekly-review/SKILL.md');
  assert.equal(
    listTasks,
    weeklyReview,
    `list-tasks считает старой задачу старше ${listTasks} дней, weekly-review — старше ${weeklyReview} дней`
  );
});

test('нет личных маркеров (домашних путей, email) в скиллах и корневых документах', () => {
  const hits = [...scan(HOME_PATH), ...scan(EMAIL)];
  assert.deepEqual([...new Set(hits)].sort(), []);
});

test('нет проектно-специфичных приватных терминов из .privacy-terms (если файл есть локально)', () => {
  const terms = loadPrivacyTerms();
  if (terms.length === 0) return; // нет локального файла — нечего проверять
  const re = new RegExp(terms.map(escapeRegExp).join('|'), 'i');
  assert.deepEqual(scan(re), []);
});

// Считаем по индексу git, а не по рабочему дереву: значение имеет только то,
// что приедет пользователю при clone. Скачанные Obsidian-плагины и
// git-ignored мусор рядом с репозиторием тест не касаются.
test('в репозитории нет симлинков', () => {
  const out = execFileSync('git', ['ls-files', '-s'], { cwd: REPO, encoding: 'utf8' });
  const links = out.split('\n')
    .filter((line) => line.startsWith('120000'))
    .map((line) => line.split('\t')[1]);
  assert.deepEqual(links, []);
});

// index.md заявлен в obsidian-vault и INTEGRATION.md как штатная точка входа.
// Битая ссылка в нём — первое, что увидит новый пользователь vault. Считаем
// по индексу git, а не по рабочему дереву: gitignored мусор рядом с
// репозиторием (например .superpowers/) не должен делать битую ссылку зелёной.
test('index.md существует, и его wikilinks резолвятся', () => {
  const path = join(REPO, 'index.md');
  assert.ok(existsSync(path), 'нет корневого index.md');
  const text = readFileSync(path, 'utf8');
  const names = [...text.matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim());
  assert.ok(names.length > 0, 'в index.md нет wikilinks — это не точка входа');
  const known = new Set(
    execFileSync('git', ['ls-files', '-z', '*.md'], { cwd: REPO, encoding: 'utf8' })
      .split('\0').filter(Boolean)
      .map((p) => basename(p, '.md'))
  );
  assert.deepEqual(names.filter((n) => !known.has(n)), [], 'битые wikilinks в index.md');
});
