// Opsional. index.html juga dapat dibuka langsung tanpa server / npm install.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT tidak valid.');
const allowed = new Set(['index.html', 'src/app.js', 'src/maps.js',
  'src/pathfinding.js', 'src/experiments.js', 'src/adversarial.js', 'src/styles.css']);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer((req, res) => {
  let file;
  try { file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (!allowed.has(file)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(root, file), (error, data) => {
    if (error) { res.writeHead(500); res.end('Cannot read file'); return; }
    res.writeHead(200, { 'Content-Type': `${types[path.extname(file)]}; charset=utf-8` });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Buka http://127.0.0.1:${port}`));
