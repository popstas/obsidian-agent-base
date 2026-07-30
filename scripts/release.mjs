#!/usr/bin/env node
// Проставляет версию во все файлы, где она дублируется.
// Тест в tests/manifests.test.mjs следит, чтобы они не разъехались.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, VERSION_FILES } from './lib/repo.mjs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('usage: node scripts/release.mjs <x.y.z>');
  process.exit(2);
}

for (const rel of VERSION_FILES) {
  const path = join(REPO, rel);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  if (rel.endsWith('marketplace.json')) {
    json.metadata.version = version;
    json.plugins[0].version = version;
  } else {
    json.version = version;
  }
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  console.log(`${rel} → ${version}`);
}
