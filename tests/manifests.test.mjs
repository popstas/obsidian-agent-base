import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO, VERSION_FILES } from '../scripts/lib/repo.mjs';

const PLUGIN_MANIFESTS = [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
];

const read = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));

function versionOf(rel) {
  const json = read(rel);
  return rel.endsWith('marketplace.json') ? json.metadata.version : json.version;
}

test('версия одинакова во всех пяти файлах', () => {
  const versions = VERSION_FILES.map((rel) => [rel, versionOf(rel)]);
  const distinct = [...new Set(versions.map(([, v]) => v))];
  assert.equal(distinct.length, 1, `версии разъехались: ${JSON.stringify(versions)}`);
});

test('marketplace ссылается на плагин той же версии', () => {
  const mp = read('.claude-plugin/marketplace.json');
  assert.equal(mp.plugins.length, 1);
  assert.equal(mp.plugins[0].version, mp.metadata.version);
  assert.equal(mp.plugins[0].name, read('.claude-plugin/plugin.json').name);
});

test('каждый plugin.json указывает на существующий каталог скиллов', () => {
  for (const rel of PLUGIN_MANIFESTS) {
    const { skills } = read(rel);
    assert.equal(skills, './skills/', `${rel}: неожидаемый путь скиллов`);
    assert.ok(existsSync(join(REPO, skills)), `${rel}: каталог ${skills} не существует`);
  }
});

test('release.mjs отвергает некорректную версию кодом 2', () => {
  const res = spawnSync(process.execPath,
    [join(REPO, 'scripts', 'release.mjs'), 'not-a-version'],
    { encoding: 'utf8' });
  assert.equal(res.status, 2, `ожидался код 2, получено ${res.status}: ${res.stderr}`);
  assert.match(res.stderr, /usage: node scripts\/release\.mjs/);
});
