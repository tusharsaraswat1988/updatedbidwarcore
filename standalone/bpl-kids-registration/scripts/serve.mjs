/** Minimal static production server for Railway. It exposes no application API. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 3000);
const dist = join(process.cwd(), 'dist');
const types = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };

createServer((request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (pathname === '/health') { response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end('{"ok":true}'); return; }
  const requested = normalize(join(dist, pathname));
  const isInsideDist = requested === dist || requested.startsWith(`${dist}/`);
  const file = isInsideDist && existsSync(requested) && statSync(requested).isFile() ? requested : join(dist, 'index.html');
  if (!existsSync(file)) { response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Application build is unavailable.'); return; }
  response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
  createReadStream(file).pipe(response);
}).listen(port, '0.0.0.0', () => console.log(`BPL Kids static service listening on ${port}`));
