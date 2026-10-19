// Satu algoritme untuk UCS dan A*. Tidak memakai library pencarian.
(function (root) {
  'use strict';
  const HEURISTICS = [
    { id: 'ucs', label: 'UCS (h = 0)', formula: '0', admissible: true },
    { id: 'manhattan', label: 'A* Manhattan', formula: '|dx| + |dy|', admissible: true },
    { id: 'euclidean', label: 'A* Euclidean', formula: '√(dx² + dy²)', admissible: true },
    { id: 'chebyshev', label: 'A* Chebyshev', formula: 'max(|dx|, |dy|)', admissible: true }
  ];
  // Urutan yang sama dengan notebook: UP, DOWN, LEFT, RIGHT.
  const MOVES = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const key = p => `${p.x},${p.y}`;

  function isWalkable(grid, p) {
    return !!p && Number.isInteger(p.x) && Number.isInteger(p.y) &&
      p.y >= 0 && p.y < grid.length && p.x >= 0 && p.x < grid[p.y].length &&
      (grid[p.y][p.x] === 0 || grid[p.y][p.x] === 5);
  }

  function validate(grid, start, goal, id) {
    if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length)
      throw new Error('Grid harus berupa array 2D yang tidak kosong.');
    if (grid.some(row => !Array.isArray(row) || row.length !== grid[0].length ||
      row.some(cell => !Number.isInteger(cell) || cell < 0 || cell > 5)))
      throw new Error('Grid harus persegi panjang dengan nilai sel 0 sampai 5.');
    if (!isWalkable(grid, start) || !isWalkable(grid, goal))
      throw new Error('Start dan goal harus berada pada sel yang dapat dilewati.');
    if (!HEURISTICS.some(h => h.id === id)) throw new Error('Heuristik tidak dikenal.');
  }

  function heuristic(id, a, b) {
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    switch (id) {
      case 'ucs': return 0;
      case 'manhattan': return dx + dy;
      case 'euclidean': return Math.hypot(dx, dy);
      case 'chebyshev': return Math.max(dx, dy);
      default: throw new Error('Heuristik tidak dikenal.');
    }
  }

  function neighbors(grid, p) {
    return MOVES.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
      .filter(next => isWalkable(grid, next));
  }

  function reconstruct(cameFrom, goal) {
    const path = [goal];
    let current = goal;
    while (cameFrom.has(key(current))) {
      current = cameFrom.get(key(current));
      path.push(current);
    }
    return path.reverse();
  }

  function search(grid, start, goal, id = 'manhattan') {
    validate(grid, start, goal, id);
    const started = performance.now();
    let counter = 0;
    // Array + sort menggantikan heapq agar contoh JavaScript mudah dibaca.
    // Priority tetap f=g+h. Counter memecahkan nilai f seri secara FIFO.
    const frontier = [{ ...start, g: 0, f: heuristic(id, start, goal), order: counter++ }];
    const gScore = new Map([[key(start), 0]]);
    const cameFrom = new Map();
    const expanded = [];
    const closed = new Set();
    let path = [], found = false, cost = Infinity;

    while (frontier.length > 0) {
      frontier.sort((a, b) => a.f - b.f || a.order - b.order);
      const current = frontier.shift();
      const currentKey = key(current);
      // Entry lama diabaikan jika sudah ditemukan biaya g yang lebih murah.
      if (current.g !== gScore.get(currentKey)) continue;
      closed.add(currentKey);
      // Definisi metrik: pop valid yang diproses, TERMASUK goal.
      expanded.push({ x: current.x, y: current.y, g: current.g,
        h: heuristic(id, current, goal), f: current.f });

      if (current.x === goal.x && current.y === goal.y) {
        found = true;
        cost = current.g;
        path = reconstruct(cameFrom, { x: current.x, y: current.y });
        break;
      }

      for (const next of neighbors(grid, current)) {
        const nextKey = key(next);
        const tentativeG = current.g + 1; // Semua langkah berbiaya 1.
        if (tentativeG < (gScore.get(nextKey) ?? Infinity)) {
          // Jangan gunakan visited boolean saja: izinkan perbaikan biaya.
          cameFrom.set(nextKey, { x: current.x, y: current.y });
          gScore.set(nextKey, tentativeG);
          closed.delete(nextKey);
          frontier.push({ ...next, g: tentativeG,
            f: tentativeG + heuristic(id, next, goal), order: counter++ });
        }
      }
    }

    const open = new Map();
    for (const p of frontier) {
      if (!closed.has(key(p)) && p.g === gScore.get(key(p)))
        open.set(key(p), { x: p.x, y: p.y });
    }
    return { found, path, cost, expanded, frontier: [...open.values()],
      expandedCount: expanded.length, uniqueExpandedCount: new Set(expanded.map(key)).size,
      timeMs: performance.now() - started };
  }

  const api = { HEURISTICS, search, heuristic, isWalkable, neighbors };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PathLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
