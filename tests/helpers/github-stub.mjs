// Локальный стенд вместо GitHub: и API релизов, и отдачу файлов подменяем
// одним сервером, адрес которого клиентские скрипты берут из
// OAB_GITHUB_API / OAB_GITHUB_DOWNLOAD. Позволяет прогонять установочный
// путь в CI без сети и без лимитов GitHub.
//
// Сервер запускается ОТДЕЛЬНЫМ процессом (github-stub-server.mjs), а не
// http.createServer() прямо здесь. Причина: тесты установки дёргают
// клиентский скрипт через execFileSync, который синхронно блокирует весь
// event loop процесса-теста до завершения дочернего процесса. Если бы сервер
// жил в этом же процессе, он не смог бы обслужить ни одного запроса curl,
// пока execFileSync ждёт bash — гарантированный дедлок (воспроизведён
// отдельно: http.createServer + execFileSync curl в одном процессе висит до
// таймаута). Вынос сервера в дочерний процесс с собственным event loop это
// снимает, а публичный контракт startGithubStub({ api, download, close })
// остаётся тем же.
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = join(__dirname, 'github-stub-server.mjs');

// opts.tag — что вернуть в tag_name; opts.assets — { 'main.js': 'содержимое' }.
// Файл, которого нет в assets, отдаётся как 404 — так проверяется опциональность
// styles.css. opts.apiStatus — подменить код ответа API (403/404).
// opts.repos — переопределения per-repo: { 'owner/name': { apiStatus, tag, assets } },
// для манифестов с несколькими плагинами и разным исходом на каждый.
export function startGithubStub(opts) {
  const child = fork(SERVER_SCRIPT, [], {
    env: { ...process.env, OAB_STUB_OPTS: JSON.stringify(opts ?? {}) },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('message', (msg) => {
      const base = `http://127.0.0.1:${msg.port}`;
      resolve({
        api: base,
        download: base,
        close: () => new Promise((r) => {
          child.once('exit', r);
          child.send('close');
        }),
      });
    });
  });
}
