#!/usr/bin/env node
// Генерит files/tasks.json из tasks.md.
// total = все задачи верхнего уровня (col0 чекбоксы), done = закрытые - [x].
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { join, dirname } = require("path");

const ROOT = join(__dirname, "..");
const TASKS_MD = join(ROOT, "tasks.md");
const OUT = join(ROOT, "files", "tasks.json");

function count(tasksPath) {
  let text = "";
  try { text = readFileSync(tasksPath, "utf-8"); } catch { return { total: 0, done: 0, open: 0 }; }
  let total = 0, done = 0;
  for (const line of text.split("\n")) {
    const m = /^- \[(.)\] /.exec(line); // только верхний уровень (без отступа)
    if (!m) continue;
    total++;
    if (m[1] === "x" || m[1] === "X") done++;
  }
  return { total, done, open: total - done };
}

module.exports = { count };

if (require.main === module) {
  const c = count(TASKS_MD);
  const out = { ...c, generatedAt: new Date().toISOString() };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
}
