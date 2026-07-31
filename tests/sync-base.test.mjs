import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { REPO } from '../scripts/lib/repo.mjs';

const require = createRequire(import.meta.url);
const sync = require(join(REPO, '.claude', 'sync-base.cjs'));

test('localSkillsDir предпочитает skills/, когда он есть', () => {
  assert.equal(sync.localSkillsDir({}), join(REPO, 'skills'));
  assert.equal(sync.localSkillsRel({}), 'skills');
});

test('localSkillsDir уважает явный baseSync.local.skillsDir', () => {
  const lock = { baseSync: { local: { skillsDir: '.claude/skills' } } };
  assert.equal(sync.localSkillsDir(lock), join(REPO, '.claude', 'skills'));
  assert.equal(sync.localSkillsRel(lock), '.claude/skills');
});

test('findLocal резолвит любой локальный "*-vault" как аналог obsidian-vault (без приватных имён в коде)', () => {
  const lock = { baseSync: { local: { skillsDir: 'tests/fixtures/alias-skills' } } };
  const found = sync.findLocal(lock, 'obsidian-vault');
  assert.ok(found, 'work-vault должен резолвиться суффиксным правилом');
  assert.equal(found.name, 'work-vault');
  assert.equal(found.path, join('tests/fixtures/alias-skills', 'work-vault', 'SKILL.md'));
});

test('пути в lock пишутся POSIX-разделителями, читаются любые', () => {
  assert.equal(sync.toLockPath(join('skills', 'close-task', 'SKILL.md')),
    'skills/close-task/SKILL.md');
  // lock, созданный на Windows, должен читаться на POSIX без ручной правки
  assert.equal(sync.fromLockPath('skills\\close-task\\SKILL.md'),
    join('skills', 'close-task', 'SKILL.md'));
  assert.equal(sync.fromLockPath('skills/close-task/SKILL.md'),
    join('skills', 'close-task', 'SKILL.md'));
});

test('untrackedLocalSkills находит локальные скиллы, которых нет в base', () => {
  const lock = { baseSync: { local: { skillsDir: 'tests/fixtures/alias-skills' } } };
  // фикстура содержит ровно один скилл — work-vault
  assert.deepEqual(sync.untrackedLocalSkills(lock, {}), ['work-vault']);
  const mapped = { 'obsidian-vault': { localName: 'work-vault' } };
  assert.deepEqual(sync.untrackedLocalSkills(lock, mapped), []);
});
