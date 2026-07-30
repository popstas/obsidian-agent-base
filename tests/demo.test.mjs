// tests/demo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO, extractMarkedRegions } from '../scripts/lib/repo.mjs';

const manifest = JSON.parse(readFileSync(join(REPO, 'demo-manifest.json'), 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const shaText = (s) => createHash('sha256').update(s).digest('hex');

test('все демо-файлы существуют и хэши совпадают', () => {
  for (const entry of manifest.demoFiles) {
    const path = join(REPO, entry.path);
    assert.ok(existsSync(path), `нет файла ${entry.path}`);
    assert.equal(sha(path), entry.sha256,
      `${entry.path}: хэш устарел — запусти npm run gen:demo-manifest`);
  }
});

test('каждый демо-блок размечен парными маркерами', () => {
  for (const entry of manifest.demoBlocks) {
    const text = readFileSync(join(REPO, entry.path), 'utf8');
    const begins = text.split('<!-- demo:begin -->').length - 1;
    const ends = text.split('<!-- demo:end -->').length - 1;
    assert.ok(begins > 0, `${entry.path}: нет маркеров demo:begin`);
    assert.equal(begins, ends, `${entry.path}: маркеры не парные (${begins}/${ends})`);
  }
});

// Baseline против незаметного стирания реальных задач пользователя: без этого
// hash'а demo-content-delete не может отличить нетронутый демо-блок от
// блока, в который пользователь дописал свои строки (а вставляют их именно
// туда — new-task/close-task целятся ровно между # Week: и # Week+).
test('хэш каждого демо-блока совпадает с сохранённым в манифесте', () => {
  for (const entry of manifest.demoBlocks) {
    assert.ok(entry.sha256, `${entry.path}: в манифесте нет sha256 для demoBlocks — запусти npm run gen:demo-manifest`);
    const text = readFileSync(join(REPO, entry.path), 'utf8');
    const regions = extractMarkedRegions(text);
    const actual = shaText(regions.join(''));
    assert.equal(actual, entry.sha256,
      `${entry.path}: хэш размеченных demo-блоков устарел или блок изменён — запусти npm run gen:demo-manifest, если правка намеренная`);
  }
});

// Проверяем по индексу git, а не по диску: на рабочей машине рядом могут лежать
// незакоммиченные каталоги, и тогда тест зеленеет там, где в свежем клоне падает.
// Значение имеет только то, что реально приедет пользователю.
test('base-only пути отслеживаются git', () => {
  for (const rel of manifest.baseOnly) {
    const tracked = execFileSync('git', ['ls-files', '--', rel], { cwd: REPO, encoding: 'utf8' }).trim();
    assert.ok(tracked, `${rel} есть в baseOnly, но не отслеживается git — в клоне его не будет`);
  }
});
