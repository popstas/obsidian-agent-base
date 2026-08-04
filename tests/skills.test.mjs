// tests/skills.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, SKILLS_LIST, skillNames, frontmatter, renderSkillsList } from '../scripts/lib/repo.mjs';

const EXPECTED = [
  'close-task', 'decompose', 'demo-content-delete', 'first-task-do',
  'learn', 'list-tasks', 'monthly-review', 'new-task', 'obsidian-vault',
  'snoozed-review', 'snoozed-task', 'weekly-report', 'weekly-review', 'worklog',
];

test('состав скиллов совпадает с ожидаемым', () => {
  assert.deepEqual(skillNames(), EXPECTED);
});

test('у каждого скилла валидный frontmatter', () => {
  for (const name of skillNames()) {
    const text = readFileSync(join(REPO, 'skills', name, 'SKILL.md'), 'utf8');
    const fm = frontmatter(text);
    assert.ok(fm, `${name}: нет frontmatter`);
    assert.equal(fm.name, name, `${name}: поле name не совпадает с именем каталога`);
    assert.ok(fm.description && fm.description.length > 20, `${name}: пустой или слишком короткий description`);
  }
});

test('Skills list.md актуален', () => {
  const onDisk = readFileSync(join(REPO, SKILLS_LIST), 'utf8');
  assert.equal(onDisk, renderSkillsList(),
    'Skills list.md устарел — запусти npm run gen:skills-list');
});
