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

test('settings.json регистрирует vault как локальный marketplace', () => {
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

// Codex читает хуки проекта из <repo>/.codex/hooks.json и использует ту же
// схему, что Claude Code, плюс своё поле commandWindows — готовый диспетчер
// по ОС. Без него на Windows потребовался бы Git Bash, то есть ровно та
// зависимость, ради снятия которой всё и делается.
test('.codex/hooks.json разводит команды по ОС', () => {
  const h = JSON.parse(readFileSync(join(REPO, '.codex', 'hooks.json'), 'utf8'));
  const entry = h.hooks.SessionStart[0].hooks[0];
  assert.equal(entry.type, 'command');
  assert.match(entry.command, /^bash \.codex\/hooks\/tasks-startup\.sh$/);
  assert.match(entry.commandWindows, /powershell .*tasks-startup\.ps1$/);
  assert.ok(!entry.commandWindows.includes('bash'),
    'commandWindows не должен требовать bash — на чистой Windows его нет');
});

const expectedLogPath = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `Log/${d.getFullYear()}/${p(d.getMonth() + 1)}/${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.md`;
};

test('codex-хук на bash печатает тот же путь лога, что и Claude-версия', () => {
  const out = execFileSync('bash', [join(REPO, '.codex', 'hooks', 'tasks-startup.sh')], { encoding: 'utf8' });
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes(expectedLogPath()), `в подсказке нет ${expectedLogPath()}: ${ctx}`);
});

// Два разных PowerShell-интерпретатора, оба реальные целевые среды — тот же
// подход, что в tests/obsidian-plugins.test.mjs: pwsh хардкодить нельзя,
// на чистой Windows есть только powershell (Windows PowerShell 5.1).
const PS_INTERPRETERS = [
  { label: 'pwsh', cmd: 'pwsh' },
  { label: 'Windows PowerShell 5.1', cmd: 'powershell' },
];

function hasInterpreter(cmd) {
  try {
    execFileSync(cmd, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const availablePs = PS_INTERPRETERS.filter((s) => hasInterpreter(s.cmd));
const psRunners = availablePs.length > 0
  ? availablePs
  : [{ label: 'PowerShell', cmd: null, skip: 'ни pwsh, ни powershell (Windows PowerShell 5.1) не найдены в PATH' }];

// Убирает CRLF, оставленный PowerShell-переводом строк, не трогая остальные
// байты — единственная ожидаемая разница между выводами bash и PowerShell.
function stripCrBeforeLf(buf) {
  const out = [];
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) continue;
    out.push(buf[i]);
  }
  return Buffer.from(out);
}

for (const ps of psRunners) {
  const skip = ps.skip || false;

  // Байтовое сравнение, а не только сравнение разобранных объектов: если
  // Windows PowerShell 5.1 напишет stdout в консольную OEM-кодировку (CP866
  // для русской локали) вместо UTF-8, JSON.parse после декодирования как
  // UTF-8 может не упасть, но байты будут отличаться от bash-версии —
  // именно это поймал живой прогон на Windows. Без [Console]::OutputEncoding
  // = UTF8 (без BOM в потоке — BOM файла тут ни при чём) хук отдаёт
  // синтаксически валидный, но испорченный JSON.
  test(`codex-хук на PowerShell (${ps.label}) печатает те же байты, что и bash-версия`, { skip }, () => {
    const shBuf = execFileSync('bash', [join(REPO, '.codex', 'hooks', 'tasks-startup.sh')]);
    const psBufRaw = execFileSync(ps.cmd, ['-NoProfile', '-File',
      join(REPO, '.codex', 'hooks', 'tasks-startup.ps1')]);
    const psBuf = stripCrBeforeLf(psBufRaw);

    assert.deepEqual([...psBuf], [...shBuf],
      'сырые байты вывода PowerShell не совпадают с bash побайтово (после нормализации CRLF→LF). ' +
      'Если это падает, а JSON.parse ниже — нет, значит вывод PowerShell ушёл не в UTF-8 (например, в CP866 ' +
      'консоли на Windows 5.1 без [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false) — ' +
      'получатель прочитает синтаксически валидный, но испорченный JSON.');

    // Дублирующая проверка на разобранном объекте — для читаемого диагноза,
    // если байтовое сравнение выше когда-нибудь разъедется по форматированию.
    assert.deepEqual(
      JSON.parse(psBuf.toString('utf8')).hookSpecificOutput,
      JSON.parse(shBuf.toString('utf8')).hookSpecificOutput);
  });
}
