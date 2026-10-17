// Собирает sw.js: список всех файлов игры + версия по содержимому.
// Запускать после любых изменений перед публикацией: node tools/build-sw.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = /^(\.git|tools|node_modules|docs)(\/|$)|\.md$|^sw\.js$|^Ферма Головоломок|^\.gitignore$|^\.nojekyll$|License|LICENSE|OFL/;
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(root, path.join(dir, f.name)).split(path.sep).join('/');
    if (SKIP.test(rel)) continue;
    if (f.isDirectory()) walk(path.join(dir, f.name)); else files.push(rel);
  }
})(root);
files.sort();
const hash = crypto.createHash('sha1');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(root, f)));
const version = hash.digest('hex').slice(0, 10);
const list = ['./', ...files].map(f => `  '${encodeURI(f)}',`).join('\n');

fs.writeFileSync(path.join(root, 'sw.js'), `// Создано tools/build-sw.mjs — не править руками.
// Офлайн-кэш: при новой версии игры кэш обновляется целиком.
const VERSION = '${version}';
const FILES = [
${list}
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
`);
const size = files.reduce((s, f) => s + fs.statSync(path.join(root, f)).size, 0);
console.log(`sw.js: ${files.length} файлов, ${(size / 1048576).toFixed(1)} МБ, версия ${version}`);
