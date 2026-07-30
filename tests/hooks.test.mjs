import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../scripts/lib/repo.mjs';

test('tasks-startup печатает вложенный путь лога', () => {
  const out = execFileSync(process.execPath, [join(REPO, '.claude', 'hooks', 'tasks-startup.mjs')], { encoding: 'utf8' });
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const expected = `Log/${d.getFullYear()}/${p(d.getMonth() + 1)}/${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.md`;
  assert.ok(ctx.includes(expected), `в подсказке нет ${expected}: ${ctx}`);
});

test('settings.json регистрирует вольт как локальный marketplace', () => {
  const s = JSON.parse(readFileSync(join(REPO, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(s.extraKnownMarketplaces['obsidian-agent-base'].source,
    { source: 'directory', path: '.' });
  assert.equal(s.enabledPlugins['obsidian-agent-base@obsidian-agent-base'], true);
});

test('в хуках нет юниксовых зависимостей', () => {
  const s = readFileSync(join(REPO, '.claude', 'settings.json'), 'utf8');
  for (const bad of ['jq', 'bash ', 'date +']) {
    assert.ok(!s.includes(bad), `settings.json всё ещё использует ${bad}`);
  }
});
