// Тело HTTP-заглушки GitHub, запускаемое как отдельный процесс (см. комментарий
// в github-stub.mjs о том, зачем это вынесено из процесса теста).
import { createServer } from 'node:http';

const opts = JSON.parse(process.env.OAB_STUB_OPTS || '{}');
const { tag = '1.0.0', assets = {}, apiStatus = 200 } = opts;

const server = createServer((req, res) => {
  if (req.url.startsWith('/repos/')) {
    if (apiStatus !== 200) { res.writeHead(apiStatus); res.end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ tag_name: tag }));
    return;
  }
  const name = req.url.split('/').pop();
  if (!(name in assets)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': 'application/octet-stream' });
  res.end(assets[name]);
});

server.listen(0, '127.0.0.1', () => {
  if (process.send) process.send({ port: server.address().port });
});

process.on('message', (msg) => {
  if (msg === 'close') server.close(() => process.exit(0));
});
