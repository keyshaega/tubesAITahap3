import fs from 'fs';
import { BattleState, AdversarialSolver } from '../src/adversarial.js';

const depths = [2, 4, 6];
const algorithms = ['minimax', 'alphabeta', 'expectimax'];
const orderings = ['default', 'optimal', 'reverse'];
const evalTypes = ['balanced', 'aggressive', 'defensive'];

const results = [];

const testState = new BattleState({
  playerHp: 80,
  npcHp: 65,
  playerPotions: 1,
  npcPotions: 2
});

console.log("Menjalankan eksperimen Adversarial Search...");

for (const algo of algorithms) {
  for (const depth of depths) {
    for (const evalType of evalTypes) {
      for (const order of orderings) {
        if (algo !== 'alphabeta' && order !== 'default') continue; // Urutan hanya relevan memangkas pada Alpha-Beta

        const solver = new AdversarialSolver({
          algorithm: algo,
          maxDepth: depth,
          evalType: evalType,
          actionOrdering: order
        });

        const t0 = performance.now();
        const output = solver.solve(testState);
        const duration = (performance.now() - t0).toFixed(3);

        results.push({
          algorithm: algo,
          depth,
          evalType,
          ordering: order,
          bestAction: output.bestAction,
          bestScore: output.bestScore.toFixed(2),
          nodesEvaluated: output.nodeCount,
          timeMs: duration
        });
      }
    }
  }
}

// Simpan JSON
fs.writeFileSync('./experiments/results.json', JSON.stringify(results, null, 2));

// Simpan CSV untuk grafik laporan
const headers = "algorithm,depth,evalType,ordering,bestAction,bestScore,nodesEvaluated,timeMs\n";
const csvRows = results.map(r => 
  `${r.algorithm},${r.depth},${r.evalType},${r.ordering},${r.bestAction},${r.bestScore},${r.nodesEvaluated},${r.timeMs}`
).join('\n');
fs.writeFileSync('./experiments/results.csv', headers + csvRows);

console.log("Eksperimen selesai! Hasil tersimpan di experiments/results.json & results.csv");