#!/usr/bin/env node
// Статус-строка: прогресс по задачам из files/tasks.json.
const { readFileSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const TASKS_JSON = join(ROOT, "files", "tasks.json");
const TASKS_MD = join(ROOT, "tasks.md");

const R = "\x1b[0m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";

function load() {
  try {
    const j = JSON.parse(readFileSync(TASKS_JSON, "utf-8"));
    if (typeof j.total === "number" && typeof j.done === "number") {
      return { total: j.total, done: j.done, open: j.open ?? j.total - j.done };
    }
  } catch {}
  // fallback: посчитать напрямую из tasks.md
  try { return require("./gen-tasks-json.cjs").count(TASKS_MD); } catch {}
  return null;
}

const t = load();
if (!t) {
  process.stdout.write(DIM + "tasks: n/a" + R);
  process.exit(0);
}

const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
const sep = " " + DIM + "│" + R + " ";
process.stdout.write(
  "📋 " + GREEN + t.done + "/" + t.total + R +
  sep + CYAN + t.open + " open" + R +
  sep + DIM + pct + "%" + R
);
