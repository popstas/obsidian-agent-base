// Правила Syncthing легко ломаются молча: `!`-исключение, уехавшее ниже своего
// правила, или потерянный корневой вариант пути перестают работать не в момент
// правки, а на другой машине через сутки. Поэтому здесь маленький матчер
// подмножества синтаксиса .stignore и таблица «что должно синкаться, что нет».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO } from '../scripts/lib/repo.mjs';

// Разворачивает #include и выкидывает комментарии, сохраняя порядок строк:
// у Syncthing первое совпадение решает судьбу файла.
function loadPatterns(rel, seen = new Set()) {
  assert.ok(!seen.has(rel), `циклический #include: ${rel}`);
  seen.add(rel);
  const out = [];
  for (const raw of readFileSync(join(REPO, rel), 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const inc = /^#include\s+(.+)$/.exec(line);
    if (inc) out.push(...loadPatterns(inc[1].trim(), seen));
    else out.push(line);
  }
  return out;
}

function compile(line) {
  let rest = line;
  let negate = false;
  if (rest.startsWith('!')) { negate = true; rest = rest.slice(1); }
  rest = rest.replace(/^(\(\?[di]\))+/, '');
  // Паттерн с ведущим `/` привязан к корню папки; без него совпадает на любом уровне.
  const anchored = rest.startsWith('/');
  if (anchored) rest = rest.slice(1);
  let re = '';
  for (let i = 0; i < rest.length; i += 1) {
    const c = rest[i];
    if (c === '*' && rest[i + 1] === '*') { re += '.*'; i += 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return { negate, re: new RegExp(`^${anchored ? '' : '(?:.*/)?'}${re}$`), line };
}

// Игнор каталога распространяется на его содержимое, поэтому путь проверяется
// вместе со всеми своими предками — от самого файла вверх.
function decide(patterns, path) {
  const parts = path.split('/');
  for (let depth = parts.length; depth > 0; depth -= 1) {
    const candidate = parts.slice(0, depth).join('/');
    for (const p of patterns) {
      if (p.re.test(candidate)) return { ignored: !p.negate, by: p.line };
    }
  }
  return { ignored: false, by: null };
}

const PATTERNS = loadPatterns('.stignore').map(compile);

// Каждый путь проверяется в двух раскладках: вольт как папка Syncthing (путь от
// его корня) и вольт внутри синкаемого родителя нескольких вольтов.
const LAYOUTS = ['', 'my-vault/'];

const IGNORED = [
  '.git/config',
  '.obsidian/workspace.json',
  '.obsidian/workspace-mobile.json',
  '.obsidian/workspace.json.bak',
  '.obsidian/app.json',
  '.obsidian/graph.json',
  '.obsidian/core-plugins-migration.json',
  '.obsidian/plugins/dataview/data.json',
  '.obsidian/plugins/omnisearch/cache/index',
  '.obsidian/plugins/various-complements/words.db',
  '.obsidian/plugins/dataview/data.sync-conflict-20260801-120000-ABCDEFG.json',
  '.trash/Заметка.md',
  'files/tasks.json',
  '.claude/settings.local.json',
  '.DS_Store',
  'Notes/2026/07/.DS_Store',
  'node_modules/left-pad/index.js',
];

const SYNCED = [
  // Настройки Obsidian, ради распространения которых vault и держит .obsidian в git.
  '.obsidian/community-plugins.json',
  '.obsidian/core-plugins.json',
  '.obsidian/appearance.json',
  '.obsidian/hotkeys.json',
  '.obsidian/templates.json',
  '.obsidian/types.json',
  '.obsidian/snippets/tab-width.css',
  // Два плагина, чьими настройками владеет вольт, а не устройство.
  '.obsidian/plugins/file-explorer-plus/data.json',
  '.obsidian/plugins/obsidian-icon-folder/data.json',
  // Код плагинов ставится один раз и разъезжается синком.
  '.obsidian/plugins/tasks-mover/main.js',
  '.obsidian/plugins/tasks-mover/manifest.json',
  // Содержимое вольта.
  'tasks.md',
  'Log/2026/07/2026-07-27.md',
  'Notes/2026/07/Обустройство vault.md',
  'files/screenshot.png',
  'skills/worklog/SKILL.md',
  // Конфликт в самой заметке видно глазами — его игнорировать нельзя.
  'Log/2026/07/2026-07-27.sync-conflict-20260801-120000-ABCDEFG.md',
];

test('.stignore подключает общие правила через #include', () => {
  const text = readFileSync(join(REPO, '.stignore'), 'utf8');
  assert.match(text, /^#include \.stignore-common$/m,
    '.stignore должен подключать .stignore-common, а не дублировать правила');
});

test('.stignore не спрятан от git', () => {
  const res = spawnSync('git', ['check-ignore', '-q', '.stignore'], { cwd: REPO });
  assert.equal(res.status, 1,
    '.stignore приезжает вместе с клоном — он не должен попадать в .gitignore');
});

test('состояние устройства и мусор игнорируются в обеих раскладках', () => {
  for (const prefix of LAYOUTS) {
    for (const path of IGNORED) {
      const { ignored } = decide(PATTERNS, prefix + path);
      assert.ok(ignored, `${prefix + path} должен игнорироваться, но синкается`);
    }
  }
});

test('содержимое вольта и общие настройки синкаются в обеих раскладках', () => {
  for (const prefix of LAYOUTS) {
    for (const path of SYNCED) {
      const { ignored, by } = decide(PATTERNS, prefix + path);
      assert.ok(!ignored, `${prefix + path} не должен игнорироваться, но попал под «${by}»`);
    }
  }
});

// Раздаются клоном, но не синком: файл нужен в репозитории и при этом
// по-разному выглядит на устройствах. app.json — мобильный Obsidian дописывает
// в него mobileToolbarCommands, десктопный их выкидывает.
const GIT_ONLY = ['.obsidian/app.json'];

test('git и Syncthing расходятся только на заранее оговорённых файлах', () => {
  const res = spawnSync('git', ['ls-files', '.obsidian'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const tracked = res.stdout.split('\n').filter(Boolean);
  assert.ok(tracked.length > 0, 'ожидались отслеживаемые файлы в .obsidian');
  for (const path of tracked) {
    const { ignored, by } = decide(PATTERNS, path);
    if (GIT_ONLY.includes(path)) {
      assert.ok(ignored, `${path} числится git-only, но Syncthing его синкает — обнови GIT_ONLY`);
    } else {
      assert.ok(!ignored, `${path} лежит в git, но Syncthing его пропустит из-за «${by}»`);
    }
  }
});
