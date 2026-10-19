// 0 tanah, 1 tembok, 2 rumah, 3 pohon, 4 sungai, 5 jembatan.
// Semua penghalang tidak dapat dilewati. Sungai hanya bisa diseberangi di jembatan.
(function (root) {
  'use strict';
  const presets = [
    { id: 'village', name: 'Desa', description: 'Rumah, pohon, tembok, dan sungai dengan dua jembatan.' },
    { id: 'open', name: 'Lapangan', description: 'Tanpa halangan di dalam peta; pembanding paling sederhana.' },
    { id: 'maze', name: 'Lorong tembok', description: 'Tembok memaksa NPC memutar melalui celah.' },
    { id: 'river', name: 'Seberang sungai', description: 'Satu jembatan jauh dari garis langsung menuju player.' },
    { id: 'blocked', name: 'Jalan buntu', description: 'Player terpisah tembok penuh; tidak ada jalur.' }
  ];

  function create(id = 'village') {
    const preset = presets.find(p => p.id === id);
    if (!preset) throw new Error('Peta tidak dikenal.');
    const width = 20, height = 14;
    const grid = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) =>
        x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : 0));
    const start = { x: 2, y: 10 }, goal = { x: 16, y: 3 };
    function rectangle(x, y, w, h, tile) {
      for (let row = y; row < y + h; row++)
        for (let col = x; col < x + w; col++) grid[row][col] = tile;
    }

    if (id === 'village') {
      rectangle(11, 1, 2, 12, 4);
      rectangle(11, 5, 2, 1, 5);
      rectangle(11, 11, 2, 1, 5);
      rectangle(4, 3, 3, 2, 2);
      rectangle(15, 7, 3, 2, 2);
      rectangle(7, 7, 1, 5, 1);
      [[3, 7], [4, 7], [5, 10], [8, 2], [9, 3], [14, 2], [17, 5], [16, 11]]
        .forEach(([x, y]) => { grid[y][x] = 3; });
    }
    if (id === 'maze') {
      for (const [x, gap] of [[5, 2], [10, 11], [14, 4]]) {
        rectangle(x, 1, 1, 12, 1);
        grid[gap][x] = 0;
      }
    }
    if (id === 'river') {
      rectangle(9, 1, 3, 12, 4);
      rectangle(9, 11, 3, 1, 5);
      rectangle(14, 6, 3, 2, 3);
    }
    if (id === 'blocked') rectangle(10, 1, 1, 12, 1);
    return { ...preset, grid, start, goal };
  }

  // Posisi tetap: semua algoritme menerima masalah persis sama.
  function makeScenarios() { return presets.map(p => create(p.id)); }
  const api = { list: () => presets.map(p => ({ ...p })), create, makeScenarios };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LabMaps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
