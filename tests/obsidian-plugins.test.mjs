import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../scripts/lib/repo.mjs';

const manifest = JSON.parse(readFileSync(join(REPO, 'obsidian-plugins.json'), 'utf8'));
const community = JSON.parse(readFileSync(join(REPO, '.obsidian', 'community-plugins.json'), 'utf8'));

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
