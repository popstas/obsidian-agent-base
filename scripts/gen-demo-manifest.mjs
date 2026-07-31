#!/usr/bin/env node
// Пересчитывает sha256 файлов, которые удаляет demo-content-delete. Список путей
// ведётся руками в demo-manifest.json — скрипт только обновляет хэши.
//
// demoFiles: примеры работы (логи, отчёт, заметки) — удаляются молча, если хэш сошёлся.
// setupDocs: инструкции по развёртыванию — удаляются по одному явному вопросу.
// baseOnly хэшей не имеет: это каталоги разработки самой базы.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { REPO } from './lib/repo.mjs';

const path = join(REPO, 'demo-manifest.json');
const manifest = JSON.parse(readFileSync(path, 'utf8'));

for (const group of ['demoFiles', 'setupDocs']) {
  for (const entry of manifest[group]) {
    entry.sha256 = createHash('sha256').update(readFileSync(join(REPO, entry.path))).digest('hex');
    console.log(`${entry.path} → ${entry.sha256.slice(0, 12)}…`);
  }
}

writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
