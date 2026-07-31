import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO } from '../scripts/lib/repo.mjs';
import { startGithubStub } from './helpers/github-stub.mjs';

// pwsh предустановлен на обоих раннерах CI (ubuntu-latest и windows-latest),
// поэтому обе клиентские реализации проверяются на обеих ОС. Локально pwsh
// может отсутствовать — тогда PowerShell-тесты штатно пропускаются, а не
// падают, чтобы разработка на bash-версии не блокировалась установкой pwsh.
let hasPwsh = false;
try {
  execFileSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { stdio: 'pipe' });
  hasPwsh = true;
} catch {
  hasPwsh = false;
}
const skipNoPwsh = hasPwsh ? false : 'pwsh не установлен';

const manifest = JSON.parse(readFileSync(join(REPO, 'obsidian-plugins.json'), 'utf8'));
const community = JSON.parse(readFileSync(join(REPO, '.obsidian', 'community-plugins.json'), 'utf8'));
const pluginData = (id) =>
  JSON.parse(readFileSync(join(REPO, '.obsidian', 'plugins', id, 'data.json'), 'utf8'));

test('каждая запись манифеста заполнена', () => {
  for (const p of manifest.plugins) {
    assert.match(p.id, /^[a-z0-9-]+$/, `плохой id: ${p.id}`);
    assert.match(p.repo, /^[\w.-]+\/[\w.-]+$/, `${p.id}: repo должен быть owner/name, получено ${p.repo}`);
    assert.match(p.minVersion, /^\d+\.\d+\.\d+/, `${p.id}: minVersion`);
    assert.equal(typeof p.enabled, 'boolean', `${p.id}: enabled`);
  }
});

test('community-plugins.json совпадает со включёнными в манифесте', () => {
  const enabled = manifest.plugins.filter((p) => p.enabled).map((p) => p.id).sort();
  assert.deepEqual([...community].sort(), enabled);
});

test('ровно один вендоренный плагин', () => {
  const vendored = manifest.plugins.filter((p) => p.vendored).map((p) => p.id);
  assert.deepEqual(vendored, ['tasks-mover']);
});

// Настройки плагинов Obsidian переписывает целиком при любом изменении в UI,
// поэтому вендоренные data.json проверяем на то, ради чего их вообще везём.
test('file-explorer-plus прячет AGENTS.md', () => {
  const paths = pluginData('file-explorer-plus').hideFilters.paths;
  const rule = paths.find((f) => f.pattern === 'AGENTS.md');
  assert.ok(rule, 'в hideFilters.paths нет правила на AGENTS.md');
  assert.equal(rule.active, true, 'правило на AGENTS.md выключено');
});

// Каталоги прячутся регуляркой, а не STRICT: хук плагина на удаление файла
// вырезает из настроек ровно STRICT-фильтры и тут же перезаписывает data.json,
// поэтому STRICT-правила на scripts/tests однажды пропали молча.
test('file-explorer-plus прячет каталоги и служебные доки, не полагаясь на STRICT', () => {
  const paths = pluginData('file-explorer-plus').hideFilters.paths;
  const hidden = (path, kind) => paths.some((f) =>
    f.active && f.patternType !== 'STRICT' &&
    (kind === 'dir' ? f.type !== 'FILES' : f.type !== 'DIRECTORIES') &&
    new RegExp(f.patternType === 'REGEX' ? f.pattern : `^${f.pattern}$`).test(path));

  for (const dir of ['scripts', 'tests']) {
    assert.ok(hidden(dir, 'dir'), `нет активного не-STRICT правила, прячущего каталог ${dir}`);
  }
  for (const file of ['CHANGELOG.md', 'CONTRIBUTING.md', 'INTEGRATION.md']) {
    assert.ok(hidden(file, 'file'), `нет активного не-STRICT правила, прячущего ${file}`);
  }
  // README читают по ссылкам из первой задачи лестницы — он остаётся видимым.
  for (const file of ['README.md', 'README_ru.md', 'tasks.md']) {
    assert.ok(!hidden(file, 'file'), `${file} не должен прятаться`);
  }
});

// Ключи верхнего уровня в data.json иконок — это пути к заметкам. Личный vault
// приносит сюда свои: так в базу чуть не уехала «Книги/Книги 2026.md».
test('иконки назначены только существующим файлам', () => {
  for (const key of Object.keys(pluginData('obsidian-icon-folder'))) {
    if (key === 'settings') continue;
    assert.ok(existsSync(join(REPO, key)), `иконка назначена несуществующему пути: ${key}`);
  }
});

// Клиентский установщик на bash разбирает obsidian-plugins.json построчно —
// без jq, которого нет на чистой macOS. Парсер валиден, только пока каждый
// объект плагина занимает ровно одну строку.
test('каждый плагин в манифесте занимает одну строку', () => {
  const raw = readFileSync(join(REPO, 'obsidian-plugins.json'), 'utf8');
  const objectLines = raw.split('\n').filter((l) => l.includes('"id"'));
  assert.equal(objectLines.length, manifest.plugins.length,
    `строк с "id" ${objectLines.length}, плагинов ${manifest.plugins.length} — объект растянулся на несколько строк`);
  for (const line of objectLines) {
    assert.match(line.trim(), /^\{.*\},?$/,
      `объект плагина не помещается в одну строку: ${line.trim()}`);
  }
});

const dryRunLines = () => manifest.plugins.map((p) =>
  [p.id, p.repo, p.minVersion, p.vendored ? 'vendored' : 'remote'].join('\t')).join('\n') + '\n';

test('bash-установщик разбирает манифест так же, как JSON.parse', () => {
  const out = execFileSync('bash', [join(REPO, 'scripts', 'install-obsidian-plugins.sh'), '--dry-run'],
    { encoding: 'utf8' });
  assert.equal(out, dryRunLines());
});

// "0.9.0" < "0.10.0" — строковое сравнение этого не даёт, поэтому обе
// клиентские реализации сравнивают версии покомпонентно и численно.
const bashCompare = (a, b) => execFileSync('bash', ['-c',
  `source "${join(REPO, 'scripts', 'install-obsidian-plugins.sh')}"; compare_versions "${a}" "${b}"`],
  { encoding: 'utf8' }).trim();

test('bash сравнивает версии покомпонентно', () => {
  assert.equal(bashCompare('0.9.0', '0.10.0'), '-1');
  assert.equal(bashCompare('0.10.0', '0.9.0'), '1');
  assert.equal(bashCompare('1.2.3', '1.2.3'), '0');
  assert.equal(bashCompare('8.3', '8.3.0'), '0');
  assert.equal(bashCompare('8.4', '8.3.9'), '1');
});

const pwsh = (args) => execFileSync('pwsh', ['-NoProfile', '-File',
  join(REPO, 'scripts', 'install-obsidian-plugins.ps1'), ...args], { encoding: 'utf8' });

test('PowerShell-установщик разбирает манифест так же, как JSON.parse', { skip: skipNoPwsh }, () => {
  assert.equal(pwsh(['-DryRun']).replace(/\r\n/g, '\n'), dryRunLines());
});

test('PowerShell сравнивает версии покомпонентно', { skip: skipNoPwsh }, () => {
  const out = execFileSync('pwsh', ['-NoProfile', '-Command',
    `. '${join(REPO, 'scripts', 'install-obsidian-plugins.ps1')}';` +
    `@('0.9.0|0.10.0','0.10.0|0.9.0','1.2.3|1.2.3','8.3|8.3.0','8.4|8.3.9') | ` +
    `ForEach-Object { $p = $_ -split '\\|'; Compare-PluginVersion $p[0] $p[1] }`],
    { encoding: 'utf8' });
  assert.deepEqual(out.trim().split(/\r?\n/), ['-1', '1', '0', '0', '1']);
});

// Установочный путь у bash- и PowerShell-реализаций одинаков, поэтому тест
// один и параметризован раннером. Копия на каждую ОС разошлась бы при первой
// же правке поведения.
const RUNNERS = [
  { name: 'bash', script: 'install-obsidian-plugins.sh', cmd: 'bash', args: [] },
  { name: 'PowerShell', script: 'install-obsidian-plugins.ps1', cmd: 'pwsh', args: ['-NoProfile', '-File'], requiresPwsh: true },
];

// Один плагин на строку — построчный парсер bash находит на ней "id" и
// разбирает как один плагин; с несколькими плагинами на одной строке JSON
// он бы слился в одну (жадную) запись. Формат — как в настоящем
// obsidian-plugins.json (см. тест "каждый плагин в манифесте занимает одну строку").
const manifestText = (plugins) =>
  '{\n  "plugins": [\n' +
  plugins.map((p, i) => '    ' + JSON.stringify(p) + (i < plugins.length - 1 ? ',' : '')).join('\n') +
  '\n  ]\n}\n';

const DEFAULT_PLUGINS = [{ id: 'stub-plugin', repo: 'owner/stub', minVersion: '1.0.0', enabled: true }];

// Готовит песочницу с манифестом (по умолчанию — на один плагин) и копией
// скрипта, запускает установщик против подменённого GitHub и отдаёт телу
// теста путь и запускалку.
async function inSandbox(runner, stubOpts, body, plugins = DEFAULT_PLUGINS) {
  const stub = await startGithubStub(stubOpts);
  const sandbox = mkdtempSync(join(tmpdir(), 'oab-'));
  try {
    writeFileSync(join(sandbox, 'obsidian-plugins.json'), manifestText(plugins));
    mkdirSync(join(sandbox, 'scripts'), { recursive: true });
    const script = join(sandbox, 'scripts', runner.script);
    copyFileSync(join(REPO, 'scripts', runner.script), script);
    const run = () => execFileSync(runner.cmd, [...runner.args, script], {
      encoding: 'utf8', stdio: 'pipe',
      env: { ...process.env, OAB_GITHUB_API: stub.api, OAB_GITHUB_DOWNLOAD: stub.download },
    });
    body({ sandbox, run });
  } finally {
    await stub.close();
    rmSync(sandbox, { recursive: true, force: true });
  }
}

for (const runner of RUNNERS) {
  const skip = runner.requiresPwsh ? skipNoPwsh : false;

  // Установочный путь целиком: скрипт ходит в подменённый GitHub, кладёт файлы
  // в .obsidian/plugins/<id>/ и пропускает отсутствующий styles.css.
  test(`${runner.name}: установщик кладёт файлы плагина и переживает отсутствие styles.css`, { skip }, async () => {
    await inSandbox(runner, {
      tag: '9.9.9',
      assets: { 'manifest.json': '{"version":"9.9.9"}', 'main.js': 'console.log(1)' },
    }, ({ sandbox, run }) => {
      run();
      const dir = join(sandbox, '.obsidian', 'plugins', 'stub-plugin');
      assert.equal(readFileSync(join(dir, 'main.js'), 'utf8'), 'console.log(1)');
      assert.equal(existsSync(join(dir, 'styles.css')), false, 'styles.css не должен создаваться');
    });
  });

  // Каталог, которого не было до запуска, при провале удаляется целиком —
  // иначе на диске остаётся полуустановленный плагин. В стенде нет даже
  // manifest.json, поэтому падение гарантировано.
  test(`${runner.name}: установщик убирает за собой при провале`, { skip }, async () => {
    await inSandbox(runner, { tag: '9.9.9', assets: {} }, ({ sandbox, run }) => {
      assert.throws(run, 'скрипт обязан выйти с ненулевым кодом');
      assert.equal(existsSync(join(sandbox, '.obsidian', 'plugins', 'stub-plugin')), false);
    });
  });

  // Регрессия на баг, который уже реально стрелял: один плагин ставится
  // успешно (печатает info-строку в stdout), другой падает на 404 API —
  // частичный провал обязан отдавать НЕНУЛЕВОЙ код возврата, а не молча
  // схлопываться в 0 из-за того, что info-сообщения об успехе смешиваются
  // с итоговым кодом выхода. Проверяем конкретный код (1 = один провал), а
  // не просто "бросило исключение": exit 0 не бросает исключение вообще, и
  // assert.throws такую регрессию бы не поймал.
  test(`${runner.name}: смешанный исход — один плагин ставится, другой падает на 404, код возврата ненулевой`, { skip }, async () => {
    const plugins = [
      { id: 'good-plugin', repo: 'owner/good', minVersion: '1.0.0', enabled: true },
      { id: 'bad-plugin', repo: 'owner/bad', minVersion: '1.0.0', enabled: true },
    ];
    await inSandbox(runner, {
      tag: '9.9.9',
      assets: { 'manifest.json': '{"version":"9.9.9"}', 'main.js': 'console.log(1)' },
      repos: { 'owner/bad': { apiStatus: 404 } },
    }, ({ sandbox, run }) => {
      let err;
      try { run(); } catch (e) { err = e; }
      assert.ok(err, 'скрипт обязан выйти с ненулевым кодом при частичном провале');
      assert.equal(err.status, 1, `код возврата должен быть ровно 1 (один провал), получено ${err.status}`);

      const goodDir = join(sandbox, '.obsidian', 'plugins', 'good-plugin');
      assert.equal(readFileSync(join(goodDir, 'main.js'), 'utf8'), 'console.log(1)',
        'успешный плагин обязан установиться, несмотря на провал соседнего');
      assert.equal(existsSync(join(sandbox, '.obsidian', 'plugins', 'bad-plugin')), false,
        'за упавшим плагином должно быть убрано');
    }, plugins);
  });
}
