import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, join, normalize, resolve} from 'node:path';

const root = resolve('dist');
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};

let idle;
function armIdleShutdown() {
  if (process.env.CI) return;
  clearTimeout(idle);
  // Playwright cannot always signal its web server cleanly on Windows.
  idle = setTimeout(() => server.close(() => process.exit(0)), 10_000);
}

const server = createServer(async (request, response) => {
  armIdleShutdown();
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^[/\\]+/, '');
    const file = resolve(join(root, relative));
    if (file !== root && !file.startsWith(root + '\\') && !file.startsWith(root + '/')) throw new Error('Invalid path');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream'});
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
    response.end('Not found');
  }
});

server.listen(4173, '127.0.0.1', armIdleShutdown);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
