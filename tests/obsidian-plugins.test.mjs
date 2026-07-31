import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO } from '../scripts/lib/repo.mjs';
import { startGithubStub } from './helpers/github-stub.mjs';

// Два разных PowerShell-интерпретатора, оба реальные целевые среды:
// pwsh — кросс-платформенный PowerShell 7+, есть на Linux/macOS и на обоих
// раннерах CI; powershell — Windows PowerShell 5.1, то, что стоит на чистой
// Windows "из коробки", pwsh на ней обычно нет. Раньше тесты хардкодили
// только pwsh — 5.1-специфичный баг (см. тест на BOM ниже) не ловился ни
// локально, ни в CI на windows-latest, потому что там тоже есть pwsh и
// именно он использовался. Теперь гоняем через каждый интерпретатор, какой
// реально найден в PATH; если не нашёлся ни один — соответствующие тесты
// пропускаются с объяснением, а не падают.
const PS_INTERPRETERS = [
  { label: 'pwsh', cmd: 'pwsh' },
  { label: 'Windows PowerShell 5.1', cmd: 'powershell' },
];

function hasInterpreter(cmd) {
  try {
    execFileSync(cmd, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const availablePs = PS_INTERPRETERS.filter((s) => hasInterpreter(s.cmd));
// Пусто только когда в PATH нет вообще ни одного PowerShell — тогда один
// плейсхолдер-раннер со skip и внятной причиной вместо падения тестов.
const psRunners = availablePs.length > 0
  ? availablePs
  : [{ label: 'PowerShell', cmd: null, skip: 'ни pwsh, ни powershell (Windows PowerShell 5.1) не найдены в PATH' }];

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

// Обходит репозиторий и находит все *.ps1 — не хардкодит список файлов,
// потому что следующая задача (Задача 5) добавит ещё один .ps1, и он обязан
// попасть под то же правило автоматически.
function findPs1Files(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...findPs1Files(full));
    else if (entry.name.endsWith('.ps1')) result.push(full);
  }
  return result;
}

// Подтверждено на живой Windows PowerShell 5.1.26100: без UTF-8 BOM в начале
// файла 5.1 читает .ps1 в системной ANSI-кодировке, а не в UTF-8. Кириллица
// в строковых литералах и комментариях разваливается и валит скрипт
// синтаксическими ошибками ещё до первой строки выполнения — pwsh (7+) от
// этого бага не страдает, поэтому раньше он не ловился. BOM здесь — не
// мусор от редактора, который можно "почистить", а обязательное условие
// запуска на целевой платформе; текстовый .gitattributes (eol=lf) его не
// трогает.
test('каждый .ps1 в репозитории начинается с UTF-8 BOM', () => {
  const files = findPs1Files(REPO);
  assert.ok(files.length > 0, 'не нашлось ни одного .ps1 — проверь findPs1Files, тест не должен молча проходить пустым');
  for (const file of files) {
    const bom = readFileSync(file).subarray(0, 3);
    assert.deepEqual([...bom], [0xef, 0xbb, 0xbf],
      `${file}: нет UTF-8 BOM в начале файла. Без BOM Windows PowerShell 5.1 читает .ps1 в системной ANSI-кодировке ` +
      `вместо UTF-8 — кириллица в строках и комментариях разваливается, скрипт не парсится (подтверждено на живой ` +
      `Windows PowerShell 5.1.26100). НЕ убирай BOM как "лишние байты" — пересохрани файл в UTF-8 с BOM.`);
  }
});

// Подтверждено на живой Windows PowerShell 5.1: без переустановки
// [Console]::OutputEncoding вывод (stdout и stderr) идёт в консольную OEM-
// кодировку (CP866 для русской локали), а не в UTF-8 — приёмная сторона
// получает синтаксически валидный JSON/текст с побитой кириллицой внутри,
// не падение, а тихая порча. BOM файла (тест выше) и кодировка потока вывода
// — разные вещи, обе обязательны. New-Object ... $false — принципиально:
// $false значит UTF8 БЕЗ BOM в потоке; С BOM в потоке ломается JSON.parse на
// приёмной стороне. НЕ убирай эту строку как "дублирует BOM файла".
test('каждый .ps1 в репозитории переустанавливает OutputEncoding в UTF-8 без BOM', () => {
  const files = findPs1Files(REPO);
  assert.ok(files.length > 0, 'не нашлось ни одного .ps1 — проверь findPs1Files, тест не должен молча проходить пустым');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.match(text, /\[Console\]::OutputEncoding\s*=\s*New-Object\s+System\.Text\.UTF8Encoding\s+\$false/,
      `${file}: нет переустановки [Console]::OutputEncoding в UTF8 без BOM. Без неё Windows PowerShell 5.1 пишет ` +
      `stdout/stderr в консольную OEM-кодировку (CP866 для русской локали) — русский текст в выводе превращается ` +
      `в мусор без ручного chcp 65001, которого обычный пользователь не делает (подтверждено на живой Windows ` +
      `PowerShell 5.1). Добавь "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding \\$false" до первого ` +
      `вывода в скрипте — не снимай эту строку как "лишнюю", она не то же самое, что BOM файла.`);
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

for (const ps of psRunners) {
  const skip = ps.skip || false;
  const runPs = (args) => execFileSync(ps.cmd, ['-NoProfile', '-File',
    join(REPO, 'scripts', 'install-obsidian-plugins.ps1'), ...args], { encoding: 'utf8' });

  test(`PowerShell-установщик (${ps.label}) разбирает манифест так же, как JSON.parse`, { skip }, () => {
    assert.equal(runPs(['-DryRun']).replace(/\r\n/g, '\n'), dryRunLines());
  });

  test(`PowerShell (${ps.label}) сравнивает версии покомпонентно`, { skip }, () => {
    const out = execFileSync(ps.cmd, ['-NoProfile', '-Command',
      `. '${join(REPO, 'scripts', 'install-obsidian-plugins.ps1')}';` +
      `@('0.9.0|0.10.0','0.10.0|0.9.0','1.2.3|1.2.3','8.3|8.3.0','8.4|8.3.9') | ` +
      `ForEach-Object { $p = $_ -split '\\|'; Compare-PluginVersion $p[0] $p[1] }`],
      { encoding: 'utf8' });
    assert.deepEqual(out.trim().split(/\r?\n/), ['-1', '1', '0', '0', '1']);
  });
}

// Установочный путь у bash- и PowerShell-реализаций одинаков, поэтому тест
// один и параметризован раннером. Копия на каждую ОС разошлась бы при первой
// же правке поведения. По одному раннеру на каждый реально найденный
// PowerShell-интерпретатор (см. psRunners выше) — на windows-latest в CI это
// и pwsh, и Windows PowerShell 5.1 одновременно.
const RUNNERS = [
  { name: 'bash', script: 'install-obsidian-plugins.sh', cmd: 'bash', args: [] },
  ...psRunners.map((ps) => ({
    name: `PowerShell (${ps.label})`,
    script: 'install-obsidian-plugins.ps1',
    cmd: ps.cmd,
    args: ['-NoProfile', '-File'],
    skip: ps.skip || false,
  })),
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
  const skip = runner.skip || false;

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
