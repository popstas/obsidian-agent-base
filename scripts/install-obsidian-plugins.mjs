#!/usr/bin/env node
// Ставит чужие Obsidian-плагины из obsidian-plugins.json.
// Чужой код в репозиторий не коммитится, поэтому это шаг развёртывания.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib/repo.mjs';

const ASSETS = ['manifest.json', 'main.js', 'styles.css']; // styles.css опционален
const { plugins } = JSON.parse(readFileSync(join(REPO, 'obsidian-plugins.json'), 'utf8'));
const headers = { 'user-agent': 'obsidian-agent-base', accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

// Числовое сравнение семвер-подобных версий по компонентам: "0.9.0" < "0.10.0",
// чего не даёт строковое сравнение. Возвращает -1/0/1, недостающие компоненты — 0.
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

// Версия установленного плагина по его manifest.json. null — если плагина нет
// или его manifest.json не читается/не парсится (считаем это "не установлен").
function readInstalledVersion(dir) {
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const data = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

function describeHttpFailure(id, status) {
  if (status === 403) {
    return `FAIL ${id}: GitHub ответил 403 — похоже, исчерпан лимит запросов к API без авторизации. Установи GITHUB_TOKEN в окружении, чтобы поднять лимит.`;
  }
  if (status === 404) {
    return `FAIL ${id}: GitHub ответил 404 — репозиторий мог быть переименован или удалён. Проверь и обнови obsidian-plugins.json.`;
  }
  return `FAIL ${id}: GitHub ответил ${status}`;
}

let failed = 0;
for (const p of plugins) {
  const dir = join(REPO, '.obsidian', 'plugins', p.id);
  if (p.vendored) { console.log(`skip ${p.id} — вендоренный`); continue; }

  const installedVersion = readInstalledVersion(dir);
  if (installedVersion && compareVersions(installedVersion, p.minVersion) >= 0) {
    console.log(`skip ${p.id} — установлена версия ${installedVersion}, требуется ${p.minVersion}`);
    continue;
  }

  const res = await fetch(`https://api.github.com/repos/${p.repo}/releases/latest`, { headers });
  if (!res.ok) { console.error(describeHttpFailure(p.id, res.status)); failed++; continue; }
  const assets = (await res.json()).assets ?? [];

  // Запоминаем, существовала ли директория плагина ДО этого запуска: если
  // скачивание упадёт посередине, чистим только то, что создали сами —
  // ранее рабочую установку не трогаем, даже если она теперь смешанной версии.
  const dirExisted = existsSync(dir);
  mkdirSync(dir, { recursive: true });
  try {
    for (const name of ASSETS) {
      const asset = assets.find((a) => a.name === name);
      if (!asset) {
        if (name === 'styles.css') continue;
        throw new Error(`в релизе нет ${name}`);
      }
      const file = await fetch(asset.browser_download_url, { headers });
      if (!file.ok) throw new Error(`не удалось скачать ${name}: HTTP ${file.status}`);
      writeFileSync(join(dir, name), Buffer.from(await file.arrayBuffer()));
    }
    const newVersion = readInstalledVersion(dir);
    if (installedVersion) {
      console.log(`installed ${p.id} — обновлён ${installedVersion} → ${newVersion ?? '?'}`);
    } else {
      console.log(`installed ${p.id} (${newVersion ?? '?'})`);
    }
  } catch (err) {
    console.error(`FAIL ${p.id}: ${err.message}`);
    if (!dirExisted) rmSync(dir, { recursive: true, force: true });
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} плагин(ов) не установлено. Поставь их вручную через Obsidian → Community plugins.`);
  process.exit(1);
}
