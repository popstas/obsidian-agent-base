#!/usr/bin/env node
// Пересчитывает sha256 демо-файлов и демо-блоков. Список путей ведётся
// руками в demo-manifest.json — скрипт только обновляет хэши.
//
// demoFiles: хэш всего файла.
// demoBlocks: хэш конкатенации размеченных <!-- demo:begin/end --> регионов
// (маркеры включены, в порядке появления в файле) — это baseline, с которым
// demo-content-delete сверяет блок перед тем как вырезать его молча.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { REPO, extractMarkedRegions } from './lib/repo.mjs';

const path = join(REPO, 'demo-manifest.json');
const manifest = JSON.parse(readFileSync(path, 'utf8'));

for (const entry of manifest.demoFiles) {
  entry.sha256 = createHash('sha256').update(readFileSync(join(REPO, entry.path))).digest('hex');
  console.log(`${entry.path} → ${entry.sha256.slice(0, 12)}…`);
}

for (const entry of manifest.demoBlocks) {
  const text = readFileSync(join(REPO, entry.path), 'utf8');
  const regions = extractMarkedRegions(text);
  entry.sha256 = createHash('sha256').update(regions.join('')).digest('hex');
  console.log(`${entry.path} (blocks) → ${entry.sha256.slice(0, 12)}…`);
}

writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
