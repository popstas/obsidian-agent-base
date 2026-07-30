#!/usr/bin/env node
// PostToolUse: если правился tasks.md — пересчитать files/tasks.json.
// Заменяет конвейер с jq, которого нет на Windows.
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let filePath = '';
try { filePath = JSON.parse(raw)?.tool_input?.file_path ?? ''; } catch { /* не JSON — выходим тихо */ }
if (!filePath.endsWith('tasks.md')) process.exit(0);

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
try {
  execFileSync(process.execPath, [join(root, '.claude', 'gen-tasks-json.cjs')], { stdio: 'ignore' });
} catch { /* хук не должен ломать сессию */ }
