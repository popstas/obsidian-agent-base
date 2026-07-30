#!/usr/bin/env node
// Пишет skills/Skills list.md. Запускается вручную (npm run gen:skills-list),
// из .githooks/pre-commit и проверяется в CI.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, SKILLS_LIST, renderSkillsList } from './lib/repo.mjs';

writeFileSync(join(REPO, SKILLS_LIST), renderSkillsList());
console.log(`generated ${SKILLS_LIST}`);
