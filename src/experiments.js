// Perbandingan yang adil: peta, start, goal, urutan tetangga, dan aturan seri sama.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const PathLab = node ? require('./pathfinding.js') : root.PathLab;
  const LabMaps = node ? require('./maps.js') : root.LabMaps;
  const methodology = {
    movement: 'Empat arah, biaya setiap langkah 1; hanya tanah dan jembatan dapat dilewati.',
    cases: 'Lima peta tetap, empat heuristik: total 20 perbandingan.',
    expansion: 'Node yang di-expand adalah pop valid yang diproses, termasuk goal; entry lama tidak dihitung.',
    timing: 'Satu pemanasan dan lima pengukuran per kasus; waktu memakai median. Waktu kecil sensitif terhadap perangkat dan JIT.',
    ratio: 'Biaya jalur dibagi biaya UCS; 1 berarti optimal. Kasus tanpa jalur tidak masuk rata-rata rasio.',
    tieBreak: 'Prioritas f = g + h; nilai f seri diproses FIFO sesuai urutan masuk.',
    conclusion: 'Manhattan cocok untuk grid empat arah: menjadi batas bawah jarak paling kuat dari heuristik yang diuji. Semua heuristik di sini admissible dan consistent.',
    limitation: 'Hasil lima peta ini bukan jaminan penghematan untuk semua peta. Halangan dan nilai f yang seri dapat membuat jumlah ekspansi sama.'
  };
  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  function runSuite(seed = 20260911) {
    // Seed dipertahankan pada API; kelima peta sengaja tetap, tanpa generator acak.
    const scenarios = LabMaps.makeScenarios();
    const rows = [];
    for (const scenario of scenarios) {
      let baseline;
      for (const h of PathLab.HEURISTICS) {
        const { grid, start, goal } = scenario;
        PathLab.search(grid, start, goal, h.id); // Pemanasan tidak masuk hitungan.
        const measurements = Array.from({ length: 5 }, () => PathLab.search(grid, start, goal, h.id));
        const result = measurements[0];
        if (h.id === 'ucs') baseline = result;
        const times = measurements.map(item => item.timeMs).sort((a, b) => a - b);
        rows.push({
          scenario: scenario.id, heuristic: h.id, found: result.found,
          cost: result.found ? result.cost : null,
          expandedCount: result.expandedCount, uniqueExpandedCount: result.uniqueExpandedCount,
          timeMs: times[2],
          ratio: result.found && baseline.found ? (baseline.cost === 0 ? 1 : result.cost / baseline.cost) : null
        });
      }
    }
    const summary = PathLab.HEURISTICS.map(h => {
      const subset = rows.filter(row => row.heuristic === h.id);
      return {
        heuristic: h.id, runs: subset.length, found: subset.filter(row => row.found).length,
        avgExpanded: mean(subset.map(row => row.expandedCount)),
        avgTimeMs: mean(subset.map(row => row.timeMs)),
        avgRatio: mean(subset.filter(row => row.ratio !== null).map(row => row.ratio)),
        suboptimalCount: subset.filter(row => row.ratio !== null && row.ratio > 1).length
      };
    });
    return { rows, summary, scenarios, seed, methodology };
  }

  function toCSV(result) {
    const columns = ['scenario', 'heuristic', 'found', 'cost', 'expandedCount', 'uniqueExpandedCount', 'timeMs', 'ratio'];
    const escape = value => value == null ? '' : '"' + String(value).replace(/"/g, '""') + '"';
    return [columns.join(','), ...result.rows.map(row => columns.map(column => escape(row[column])).join(','))].join('\n');
  }

  const api = { runSuite, toCSV, methodology };
  if (node) module.exports = api;
  else root.Experiments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
