import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../scripts/lib/repo.mjs';

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
test('file-explorer-plus прячет scripts и tests, не полагаясь на STRICT', () => {
  const paths = pluginData('file-explorer-plus').hideFilters.paths;
  for (const dir of ['scripts', 'tests']) {
    const rule = paths.find((f) =>
      f.active && f.patternType !== 'STRICT' && f.type !== 'FILES' &&
      new RegExp(f.patternType === 'REGEX' ? f.pattern : `^${f.pattern}$`).test(dir));
    assert.ok(rule, `нет активного не-STRICT правила, прячущего каталог ${dir}`);
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
