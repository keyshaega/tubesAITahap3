// Tidak perlu bundler: periksa sintaks lalu salin file browser ke dist.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const scripts = ['pathfinding.js', 'maps.js', 'experiments.js', 'app.js', 'adversarial.js'];
for (const name of scripts)
  execFileSync(process.execPath, ['--check', path.join(root, 'src', name)]);
fs.mkdirSync(path.join(root, 'dist', 'src'), { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(root, 'dist', 'index.html'));
for (const name of [...scripts, 'styles.css'])
  fs.copyFileSync(path.join(root, 'src', name), path.join(root, 'dist', 'src', name));
console.log('Build berhasil. Buka index.html atau dist/index.html di browser.');
