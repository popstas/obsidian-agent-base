// tests/demo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO } from '../scripts/lib/repo.mjs';

const manifest = JSON.parse(readFileSync(join(REPO, 'demo-manifest.json'), 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

for (const group of ['demoFiles', 'setupDocs']) {
  test(`${group}: файлы существуют и хэши совпадают`, () => {
    for (const entry of manifest[group]) {
      const path = join(REPO, entry.path);
      assert.ok(existsSync(path), `нет файла ${entry.path}`);
      assert.equal(sha(path), entry.sha256,
        `${entry.path}: хэш устарел — запусти npm run gen:demo-manifest`);
    }
  });
}

// Проверяем по индексу git, а не по диску: на рабочей машине рядом могут лежать
// незакоммиченные каталоги, и тогда тест зеленеет там, где в свежем клоне падает.
// Значение имеет только то, что реально приедет пользователю.
test('base-only пути отслеживаются git', () => {
  for (const rel of manifest.baseOnly) {
    const tracked = execFileSync('git', ['ls-files', '--', rel], { cwd: REPO, encoding: 'utf8' }).trim();
    assert.ok(tracked, `${rel} есть в baseOnly, но не отслеживается git — в клоне его не будет`);
  }
});

// Лестница задач больше не демо: её содержимое проходит каждый пользователь,
// и demo-content-delete её не трогает. Машинерии для блоков в базе не осталось,
// поэтому вернувшийся маркер молча ничего бы не значил — ловим его здесь.
test('маркеров демо-блоков в репозитории нет', () => {
  const self = 'tests/demo.test.mjs';
  const files = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' })
    .trim().split('\n').filter((f) => f !== self);
  const marker = ['<!-- demo', ':begin -->'].join('');
  const found = files.filter((f) => {
    try {
      return readFileSync(join(REPO, f), 'utf8').includes(marker);
    } catch {
      return false;
    }
  });
  assert.deepEqual(found, [], 'демо-блоки распущены — маркеры не должны возвращаться');
});
