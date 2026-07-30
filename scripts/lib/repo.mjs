// Общие примитивы для скриптов и тестов. Единственное место, где живёт
// знание о структуре репозитория.
import { readdirSync, statSync, lstatSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const VERSION_FILES = [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'package.json',
];

const SKIP_DIRS = new Set(['.git', 'node_modules']);

// Рекурсивный обход файлов. По симлинкам не идём: их отсутствие проверяется
// отдельно, по индексу git, а не по рабочему дереву.
export function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const st = lstatSync(path);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

// Только однострочные скаляры — большего в SKILL.md не встречается.
export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

export function skillNames() {
  const dir = join(REPO, 'skills');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => {
      try { return statSync(join(dir, n, 'SKILL.md')).isFile(); } catch { return false; }
    })
    .sort();
}

export function rootDocs() {
  return readdirSync(REPO)
    .filter((n) => n.endsWith('.md'))
    .sort()
    .map((n) => join(REPO, n));
}

export const DEMO_BEGIN = '<!-- demo:begin -->';
export const DEMO_END = '<!-- demo:end -->';

// Достаёт все размеченные демо-блоки из текста файла, маркеры включены, в
// порядке появления в файле. Используется и генератором хэшей
// (scripts/gen-demo-manifest.mjs), и тестом (tests/demo.test.mjs), и
// скиллом demo-content-delete — чтобы все три считали ровно одно и то же.
// Непарный `demo:begin` без соответствующего `demo:end` молча обрывает
// разбор — это ловит отдельная проверка на парность маркеров.
export function extractMarkedRegions(text) {
  const regions = [];
  let idx = 0;
  for (;;) {
    const b = text.indexOf(DEMO_BEGIN, idx);
    if (b === -1) break;
    const e = text.indexOf(DEMO_END, b);
    if (e === -1) break;
    regions.push(text.slice(b, e + DEMO_END.length));
    idx = e + DEMO_END.length;
  }
  return regions;
}

export const SKILLS_LIST = 'skills/Skills list.md';

// Единственный не-SKILL.md файл в skills/, поэтому [[Skills list]] однозначен.
export function renderSkillsList() {
  const out = [
    '---',
    'generated_by: scripts/gen-skills-list.mjs',
    '---',
    '<sub>Генерируется автоматически — правки будут потеряны.</sub>',
    '',
  ];
  for (const name of skillNames()) {
    const fm = frontmatter(readFileSync(join(REPO, 'skills', name, 'SKILL.md'), 'utf8')) || {};
    out.push(`## ${name}`, '', fm.description || '', '');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}
