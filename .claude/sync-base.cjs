#!/usr/bin/env node
// sync-base.cjs — синхронизация скиллов наследника с базовым шаблоном obsidian-agent-workspace.
//
// Детерминированный помощник: считает хэши скиллов, классифицирует состояние каждого
// общего скилла (3-way по merge-base из skills-lock.json) и показывает diff.
// Скрипт НИКОГДА не редактирует файлы SKILL.md — только skills-lock.json (stamp/bootstrap).
// Все правки контента делает агент через скилл base-sync, чтобы пользователь видел каждую правку.
//
// Подкоманды:
//   status [--json]      сводная таблица состояний (по умолчанию)
//   diff <skill>         unified diff base-сейчас vs локальный скилл
//   bootstrap            разово завести baseSync в skills-lock.json (авто-маппинг по алиасам)
//   stamp <skill>        записать текущие base+local хэши как новую точку синхронизации
//
// Запускается из корня наследника: node .claude/sync-base.cjs <cmd>

const { readFileSync, writeFileSync, existsSync, readdirSync, statSync } = require("fs");
const { join, dirname, isAbsolute, sep } = require("path");
const { createHash } = require("crypto");
const { spawnSync } = require("child_process");

const ROOT = join(__dirname, ".."); // корень репозитория наследника
const LOCK = join(ROOT, "skills-lock.json");

// Таблица алиасов: имя в base -> возможные локальные имена у наследника.
// obsidian-vault резолвится не списком конкретных имён (это были бы приватные
// названия чужих vault), а суффиксным правилом ниже, в findLocal: любой
// локальный каталог скилла с именем "*-vault" считается локальным аналогом.
const ALIASES = {
  "new-task": ["new-task", "add-task"],
  "list-tasks": ["list-tasks", "list"],
  "obsidian-vault": ["obsidian-vault"],
};

// ---------- утилиты ----------

function readLock() {
  if (!existsSync(LOCK)) return { version: 2, skills: {}, baseSync: null };
  const raw = JSON.parse(readFileSync(LOCK, "utf-8"));
  if (!raw.baseSync) raw.baseSync = null;
  return raw;
}

function writeLock(lock) {
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
}

// skills-lock.json переносится между машинами, поэтому пути внутри него всегда
// POSIX-овые. join() на Windows дал бы "skills\close-task\SKILL.md", и на
// macOS/Linux такой lock превратился бы в имя файла с обратными слэшами.
function toLockPath(rel) {
  return rel.split(/[\\/]/).join("/");
}

// Обратное преобразование. Принимает оба разделителя: lock мог быть создан
// на другой ОС, и чинить его руками пользователь не должен.
function fromLockPath(rel) {
  return rel.split(/[\\/]/).join(sep);
}

function lockLocalFile(rel) {
  return join(ROOT, fromLockPath(rel));
}

// Нормализуем содержимое SKILL.md и считаем sha256.
// Из frontmatter выкидываем name: и description: — они легитимно различаются у наследников.
function rawHash(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let out = [];
  let inFm = false, fmDone = false, fmStart = false;
  for (const line of lines) {
    if (!fmStart && line.trim() === "---") { fmStart = true; inFm = true; out.push(line); continue; }
    if (inFm && line.trim() === "---") { inFm = false; fmDone = true; out.push(line); continue; }
    if (inFm) {
      if (/^(name|description)\s*:/.test(line)) continue; // выкидываем
      out.push(line);
      continue;
    }
    out.push(line);
  }
  // нормализация: rstrip каждой строки, схлопнуть хвостовые пустые, один финальный \n
  out = out.map((l) => l.replace(/[ \t]+$/g, ""));
  while (out.length && out[out.length - 1] === "") out.pop();
  const norm = out.join("\n") + "\n";
  return createHash("sha256").update(norm, "utf-8").digest("hex");
}

function hashFile(p) {
  if (!p || !existsSync(p)) return null;
  return rawHash(readFileSync(p, "utf-8"));
}

function basePath(lock) {
  const bp = lock.baseSync && lock.baseSync.base && lock.baseSync.base.path;
  if (!bp) return null;
  return isAbsolute(bp) ? bp : join(ROOT, bp);
}

function baseSkillFile(baseRoot, baseName) {
  return join(baseRoot, "skills", baseName, "SKILL.md");
}

// Локальный каталог скиллов. База и склонированные из неё vault держат
// скиллы в skills/ (Obsidian не показывает dot-каталоги); адаптированные
// форки исторически — в .claude/skills. Переопределяется через
// baseSync.local.skillsDir в skills-lock.json.
function localSkillsRel(lock) {
  const explicit = lock && lock.baseSync && lock.baseSync.local && lock.baseSync.local.skillsDir;
  if (explicit) return explicit;
  if (existsSync(join(ROOT, "skills"))) return "skills";
  return join(".claude", "skills");
}

function localSkillsDir(lock) {
  return join(ROOT, localSkillsRel(lock));
}

// Найти локальный аналог base-скилла по алиасам/одноимённости.
function findLocal(lock, baseName) {
  const cands = ALIASES[baseName] || [baseName];
  for (const name of cands) {
    const f = join(localSkillsDir(lock), name, "SKILL.md");
    if (existsSync(f)) return { name, path: join(localSkillsRel(lock), name, "SKILL.md") };
  }
  // Суффиксный фолбэк для vault-скилла: любой локальный каталог "*-vault"
  // (форки называют свой vault-скилл по имени своего vault, например
  // work-vault) считается локальным аналогом base-скилла obsidian-vault.
  if (baseName === "obsidian-vault") {
    const dir = localSkillsDir(lock);
    if (existsSync(dir)) {
      const names = readdirSync(dir)
        .filter((n) => n.endsWith("-vault") && n !== "obsidian-vault")
        .sort();
      for (const name of names) {
        const f = join(dir, name, "SKILL.md");
        if (existsSync(f)) return { name, path: join(localSkillsRel(lock), name, "SKILL.md") };
      }
    }
  }
  return null;
}

function listBaseSkills(baseRoot) {
  const dir = join(baseRoot, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => {
    try { return statSync(join(dir, n, "SKILL.md")).isFile(); } catch { return false; }
  });
}

function listLocalSkills(lock) {
  const dir = localSkillsDir(lock);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => {
    try { return statSync(join(dir, n, "SKILL.md")).isFile(); } catch { return false; }
  }).sort();
}

// Локальные скиллы, не сопоставленные ни с одним скиллом base. Обычно это значит,
// что клон base стоит на другой ветке или отстал: их правки bootstrap не отследит,
// и при обновлении base они пропадут молча.
function untrackedLocalSkills(lock, skills) {
  const mapped = new Set(Object.values(skills).map((s) => s.localName).filter(Boolean));
  return listLocalSkills(lock).filter((n) => !mapped.has(n));
}

// ---------- классификация ----------
// B = base сейчас, Bsync = base на момент sync, L = local сейчас, Lsync = local на момент sync
function classify(entry, baseHashNow, localHashNow) {
  if (entry && entry.status === "not-imported") return "NOT-IMPORTED";
  if (localHashNow === null) return "NEW-IN-BASE";
  const Bsync = entry ? entry.baseHashAtSync : null;
  const Lsync = entry ? entry.localHashAtSync : null;
  const baseMoved = baseHashNow !== Bsync;
  const localMoved = localHashNow !== Lsync;
  if (!baseMoved && !localMoved) return "UNCHANGED";
  if (baseMoved && !localMoved) return "BASE-CHANGED";
  if (!baseMoved && localMoved) return "LOCALLY-MODIFIED";
  return "BOTH-CHANGED";
}

// ---------- команды ----------

function cmdStatus(jsonOut) {
  const lock = readLock();
  const baseRoot = basePath(lock);
  if (!baseRoot || !existsSync(baseRoot)) {
    fail(`Не найден base по пути из skills-lock.json (baseSync.base.path). Запусти bootstrap.`);
  }
  const entries = (lock.baseSync && lock.baseSync.skills) || {};
  const baseSkills = listBaseSkills(baseRoot);
  const rows = [];
  for (const baseName of baseSkills) {
    const entry = entries[baseName] || null;
    const baseHashNow = hashFile(baseSkillFile(baseRoot, baseName));
    const local = entry && entry.localPath
      ? { name: entry.localName, path: lockLocalFile(entry.localPath) }
      : findLocalFull(lock, baseName);
    const localHashNow = local ? hashFile(local.path) : null;
    const state = classify(entry, baseHashNow, localHashNow);
    rows.push({ baseName, localName: local ? local.name : null, state, customized: !!(entry && entry.customized) });
  }
  if (jsonOut) { process.stdout.write(JSON.stringify({ base: lock.baseSync && lock.baseSync.base, rows }, null, 2) + "\n"); return; }
  printTable(lock, rows);
}

function findLocalFull(lock, baseName) {
  const l = findLocal(lock, baseName);
  if (!l) return null;
  return { name: l.name, path: join(ROOT, l.path) };
}

function printTable(lock, rows) {
  const order = { "BOTH-CHANGED": 0, "BASE-CHANGED": 1, "NEW-IN-BASE": 2, "LOCALLY-MODIFIED": 3, "NOT-IMPORTED": 4, "UNCHANGED": 5 };
  rows.sort((a, b) => (order[a.state] - order[b.state]) || a.baseName.localeCompare(b.baseName));
  const b = lock.baseSync && lock.baseSync.base;
  console.log(`base: ${b ? b.repo : "?"}  (${b ? b.path : "?"})`);
  console.log("");
  const hint = {
    "BOTH-CHANGED": "нужен разбор (3-way)",
    "BASE-CHANGED": "можно подтянуть",
    "NEW-IN-BASE": "новый в base — импортировать?",
    "LOCALLY-MODIFIED": "локальная правка, base без изменений",
    "NOT-IMPORTED": "сознательно не импортирован",
    "UNCHANGED": "—",
  };
  for (const r of rows) {
    const nameCol = r.localName && r.localName !== r.baseName ? `${r.baseName} (${r.localName})` : r.baseName;
    const cust = r.customized ? " [customized]" : "";
    console.log(`  ${r.state.padEnd(16)} ${nameCol}${cust}  — ${hint[r.state]}`);
  }
  const actionable = rows.filter((r) => r.state !== "UNCHANGED" && r.state !== "NOT-IMPORTED");
  console.log("");
  console.log(actionable.length ? `Требуют внимания: ${actionable.length}.` : "Всё синхронизировано.");
}

function cmdDiff(skill) {
  if (!skill) fail("Укажи имя скилла: diff <skill>");
  const lock = readLock();
  const baseRoot = basePath(lock);
  if (!baseRoot || !existsSync(baseRoot)) {
    fail(`Не найден base по пути из skills-lock.json (baseSync.base.path). Запусти bootstrap.`);
  }
  const entries = (lock.baseSync && lock.baseSync.skills) || {};
  const entry = entries[skill] || null;
  const baseFile = baseSkillFile(baseRoot, skill);
  const local = entry && entry.localPath
    ? { path: lockLocalFile(entry.localPath) }
    : findLocalFull(lock, skill);
  if (!existsSync(baseFile)) fail(`В base нет скилла ${skill}`);
  if (!local || !existsSync(local.path)) fail(`Локально нет скилла ${skill}`);
  const r = spawnSync("diff", ["-u", "--label", `base/${skill}`, "--label", `local/${skill}`, baseFile, local.path], { encoding: "utf-8" });
  if (r.stdout) process.stdout.write(r.stdout);
  else console.log(`Файлы совпадают побайтово: ${skill}`);
}

function cmdBootstrap() {
  const lock = readLock();
  let baseRoot = basePath(lock);
  // если baseSync ещё нет — попробуем дефолтный относительный путь к base рядом
  const defaultRel = "../../obsidian-agent-workspace";
  if (!baseRoot) baseRoot = join(ROOT, defaultRel);
  if (!existsSync(baseRoot)) {
    fail(`Не найден base. Создай skills-lock.json с baseSync.base.path или положи base в ${defaultRel}`);
  }
  const now = new Date().toISOString();
  let commit = null;
  try {
    const r = spawnSync("git", ["-C", baseRoot, "rev-parse", "--short", "HEAD"], { encoding: "utf-8" });
    if (r.status === 0) commit = r.stdout.trim();
  } catch {}
  lock.version = 2;
  if (!lock.skills) lock.skills = {};
  lock.baseSync = lock.baseSync || {};
  lock.baseSync.base = {
    repo: "popstas/obsidian-agent-workspace",
    path: (lock.baseSync.base && lock.baseSync.base.path) || defaultRel,
    lastSyncCommit: commit,
    lastSyncAt: now,
  };
  const skills = {};
  for (const baseName of listBaseSkills(baseRoot)) {
    const baseHash = hashFile(baseSkillFile(baseRoot, baseName));
    const local = findLocalFull(lock, baseName);
    if (!local) {
      skills[baseName] = { baseName, localName: null, localPath: null, baseHashAtSync: baseHash, localHashAtSync: null, status: "not-imported" };
      continue;
    }
    const localHash = hashFile(local.path);
    const relLocal = toLockPath(join(localSkillsRel(lock), local.name, "SKILL.md"));
    skills[baseName] = {
      baseName,
      localName: local.name,
      localPath: relLocal,
      baseHashAtSync: baseHash,
      localHashAtSync: localHash,
      customized: localHash !== baseHash,
    };
  }
  lock.baseSync.skills = skills;
  writeLock(lock);
  console.log(`bootstrap готов. base commit: ${commit || "(нет git)"}`);
  for (const [k, v] of Object.entries(skills)) {
    if (v.status === "not-imported") console.log(`  ${k}: not-imported`);
    else console.log(`  ${k} -> ${v.localName}${v.customized ? " [customized]" : ""}`);
  }
  const untracked = untrackedLocalSkills(lock, skills);
  if (untracked.length) {
    console.log("");
    console.log(`ℹ Локальных скиллов вне base ${commit || "(нет git)"}: ${untracked.length} — baseSync их не отслеживает:`);
    console.log(`  ${untracked.join(", ")}`);
    console.log("  Для доменных скиллов наследника это норма — base-sync их и не должен трогать (см. base-sync/SKILL.md, «Защита от ошибок»).");
    console.log("  Стоит свериться с веткой клона base, только если среди перечисленных есть скилл, похожий на форк одного из базовых.");
  }
  console.log(`\nЗаписан ${LOCK}`);
}

function cmdStamp(skill) {
  if (!skill) fail("Укажи имя скилла: stamp <skill>");
  const lock = readLock();
  const baseRoot = basePath(lock);
  const entries = lock.baseSync && lock.baseSync.skills;
  if (!entries || !entries[skill]) fail(`Нет записи baseSync для ${skill}. Запусти bootstrap.`);
  const entry = entries[skill];
  const baseHash = hashFile(baseSkillFile(baseRoot, skill));
  const localHash = entry.localPath ? hashFile(lockLocalFile(entry.localPath)) : null;
  entry.baseHashAtSync = baseHash;
  entry.localHashAtSync = localHash;
  entry.customized = localHash !== null && localHash !== baseHash;
  writeLock(lock);
  console.log(`stamp ${skill}: base+local хэши обновлены${entry.customized ? " (customized)" : ""}.`);
}

function fail(msg) { console.error("Ошибка: " + msg); process.exit(1); }

module.exports = { rawHash, classify, localSkillsDir, localSkillsRel, findLocal, toLockPath, fromLockPath, untrackedLocalSkills };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd || "status") {
    case "status": cmdStatus(rest.includes("--json")); break;
    case "diff": cmdDiff(rest[0]); break;
    case "bootstrap": cmdBootstrap(); break;
    case "stamp": cmdStamp(rest[0]); break;
    default: fail(`неизвестная команда: ${cmd}. Доступно: status, diff, bootstrap, stamp`);
  }
}
