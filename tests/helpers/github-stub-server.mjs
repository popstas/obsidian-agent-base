// Тело HTTP-заглушки GitHub, запускаемое как отдельный процесс (см. комментарий
// в github-stub.mjs о том, зачем это вынесено из процесса теста).
import { createServer } from 'node:http';

const opts = JSON.parse(process.env.OAB_STUB_OPTS || '{}');
const { tag = '1.0.0', assets = {}, apiStatus = 200, repos = {} } = opts;

// opts.repos — необязательные переопределения по конкретному "owner/name",
// например { 'owner/bad': { apiStatus: 404 } }. Нужно тестам на манифест из
// нескольких плагинов с разным исходом (один ставится, другой падает) — без
// этого apiStatus/assets были бы одни на все репозитории сразу.
const forRepo = (repo) => repos[repo] || {};

const server = createServer((req, res) => {
  if (req.url.startsWith('/repos/')) {
    // /repos/<owner>/<name>/releases/latest
    const parts = req.url.split('/').filter(Boolean);
    const repo = `${parts[1]}/${parts[2]}`;
    const override = forRepo(repo);
    const status = override.apiStatus !== undefined ? override.apiStatus : apiStatus;
    if (status !== 200) { res.writeHead(status); res.end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ tag_name: override.tag || tag }));
    return;
  }
  // /<owner>/<name>/releases/download/<tag>/<file>
  const parts = req.url.split('/').filter(Boolean);
  const repo = `${parts[0]}/${parts[1]}`;
  const repoAssets = forRepo(repo).assets || assets;
  const name = parts[parts.length - 1];
  if (!(name in repoAssets)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': 'application/octet-stream' });
  res.end(repoAssets[name]);
});

server.listen(0, '127.0.0.1', () => {
  if (process.send) process.send({ port: server.address().port });
});

process.on('message', (msg) => {
  if (msg === 'close') server.close(() => process.exit(0));
});
