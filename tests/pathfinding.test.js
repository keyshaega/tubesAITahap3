'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PathLab = require('../src/pathfinding.js');
const LabMaps = require('../src/maps.js');
const Experiments = require('../src/experiments.js');

// Oracle BFS independen: tidak menggunakan neighbors/search dari implementasi A*.
function bfs(grid, start, goal) {
  const queue = [{ ...start, distance: 0 }], seen = new Set([`${start.x},${start.y}`]);
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    if (p.x === goal.x && p.y === goal.y) return p.distance;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
      if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length || seen.has(key)) continue;
      if (grid[y][x] !== 0 && grid[y][x] !== 5) continue;
      seen.add(key);
      queue.push({ x, y, distance: p.distance + 1 });
    }
  }
  return Infinity;
}

function checkPath(result, grid, start, goal) {
  assert.equal(result.expandedCount, result.expanded.length);
  assert.equal(result.uniqueExpandedCount, new Set(result.expanded.map(p => `${p.x},${p.y}`)).size);
  if (!result.found) {
    assert.deepEqual(result.path, []);
    assert.equal(result.cost, Infinity);
    return;
  }
  assert.deepEqual(result.path[0], start);
  assert.deepEqual(result.path.at(-1), goal);
  assert.equal(result.cost, result.path.length - 1);
  result.path.forEach((p, i) => {
    assert.ok(grid[p.y][p.x] === 0 || grid[p.y][p.x] === 5);
    if (i) assert.equal(Math.abs(p.x - result.path[i - 1].x) + Math.abs(p.y - result.path[i - 1].y), 1);
  });
  assert.equal(result.expanded.at(-1).x, goal.x);
  assert.equal(result.expanded.at(-1).y, goal.y);
}

test('semua peta tetap menghasilkan biaya optimal dan jalur valid', () => {
  for (const scenario of LabMaps.makeScenarios()) {
    const { grid, start, goal } = scenario;
    const optimal = bfs(grid, start, goal);
    for (const h of PathLab.HEURISTICS) {
      const result = PathLab.search(grid, start, goal, h.id);
      assert.equal(result.cost, optimal, `${scenario.id}/${h.id}`);
      assert.equal(result.found, Number.isFinite(optimal));
      checkPath(result, grid, start, goal);
    }
  }
});

test('dua puluh grid acak deterministik dibandingkan dengan BFS independen', () => {
  let state = 20260911;
  function random() { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; }
  for (let trial = 0; trial < 20; trial++) {
    const grid = Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => random() < 0.28 ? 1 : 0));
    const start = { x: 0, y: 0 }, goal = { x: 8, y: 7 };
    grid[0][0] = grid[7][8] = 0;
    const optimal = bfs(grid, start, goal);
    for (const h of PathLab.HEURISTICS) {
      const result = PathLab.search(grid, start, goal, h.id);
      assert.equal(result.cost, optimal, `trial ${trial}/${h.id}`);
      checkPath(result, grid, start, goal);
    }
  }
});

test('heuristik admissible dan consistent pada setiap sisi peta desa', () => {
  const { grid, goal } = LabMaps.create('village');
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
    const p = { x, y };
    if (!PathLab.isWalkable(grid, p)) continue;
    const optimal = bfs(grid, p, goal);
    for (const h of PathLab.HEURISTICS) {
      const estimate = PathLab.heuristic(h.id, p, goal);
      assert.ok(estimate <= optimal + 1e-10);
      assert.equal(PathLab.heuristic(h.id, goal, goal), 0);
      for (const next of PathLab.neighbors(grid, p))
        assert.ok(estimate <= 1 + PathLab.heuristic(h.id, next, goal) + 1e-10);
    }
  }
});

test('start sama dengan goal dihitung satu ekspansi dan nol biaya', () => {
  for (const h of PathLab.HEURISTICS) {
    const p = { x: 0, y: 0 }, result = PathLab.search([[0]], p, p, h.id);
    assert.equal(result.expandedCount, 1);
    assert.equal(result.cost, 0);
    checkPath(result, [[0]], p, p);
  }
});

test('rumah, pohon, tembok, sungai menghalangi; jembatan dapat dilalui', () => {
  for (const tile of [1, 2, 3, 4]) {
    const result = PathLab.search([[0, tile, 0]], { x: 0, y: 0 }, { x: 2, y: 0 });
    assert.equal(result.found, false);
    assert.equal(result.expandedCount, 1);
  }
  assert.equal(PathLab.search([[0, 5, 0]], { x: 0, y: 0 }, { x: 2, y: 0 }).cost, 2);
});

test('input tidak valid ditolak pada batas fungsi pencarian', () => {
  const p = { x: 0, y: 0 };
  for (const grid of [null, [], [[]], [[0], [0, 0]], [[6]], [[-1]], [['0']]])
    assert.throws(() => PathLab.search(grid, p, p));
  for (const position of [null, { x: -1, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }])
    assert.throws(() => PathLab.search([[0]], position, p));
  assert.throws(() => PathLab.search([[0, 1]], p, { x: 1, y: 0 }));
  assert.throws(() => PathLab.search([[0]], p, p, 'unknown'));
});

test('FIFO untuk nilai f seri deterministik dan grid tidak diubah', () => {
  const grid = [[0, 0], [0, 0]], original = JSON.stringify(grid);
  for (const h of PathLab.HEURISTICS) {
    const result = PathLab.search(grid, { x: 0, y: 0 }, { x: 1, y: 1 }, h.id);
    assert.deepEqual(result.path, [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
    assert.equal(result.expandedCount, 4);
  }
  assert.equal(JSON.stringify(grid), original);
});

test('eksperimen berisi 20 perbandingan dan tidak memasukkan jalan buntu ke rasio', () => {
  const result = Experiments.runSuite();
  assert.equal(result.rows.length, 20);
  assert.equal(result.scenarios.length, 5);
  assert.equal(result.summary.length, 4);
  for (const summary of result.summary) {
    assert.equal(summary.runs, 5);
    assert.equal(summary.found, 4);
    assert.equal(summary.avgRatio, 1);
    assert.equal(summary.suboptimalCount, 0);
  }
  for (const row of result.rows.filter(row => row.scenario === 'blocked')) {
    assert.equal(row.cost, null);
    assert.equal(row.ratio, null);
  }
  assert.equal(Experiments.toCSV(result).split('\n').length, 21);
});
