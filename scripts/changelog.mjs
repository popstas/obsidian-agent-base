#!/usr/bin/env node
// Генерирует CHANGELOG.md через git-cliff. Версия для --tag читается из
// package.json (release.mjs её меняет), а не хардкодится.
//
// Раньше тег вычислялся прямо в package.json через `$(node -p ...)` —
// это POSIX command substitution. npm запускает скрипты через cmd.exe на
// Windows, где `$(...)` не раскрывается: git-cliff получил бы буквальную
// строку `v$(node -p "...")` как имя тега. Здесь версия читается в Node и
// передаётся spawnSync отдельным элементом массива — никакой shell-строки
// не собирается, экранировать нечего.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib/repo.mjs';

const { version } = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));

// npx на Windows — это npx.cmd, не .exe. Node подставляет cmd.exe для файлов
// с расширением .cmd/.bat сам, даже без shell: true, если дать ему это
// расширение явно, так что отдельный shell тут по-прежнему не строится.
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const res = spawnSync(npx, ['git-cliff', '--tag', `v${version}`, '-o', 'CHANGELOG.md'], {
  cwd: REPO,
  stdio: 'inherit',
});

if (res.error) throw res.error;
// Пробрасываем код возврата git-cliff, чтобы падение генератора валило и
// сам npm-скрипт, а не проходило молча.
process.exit(res.status ?? 1);
