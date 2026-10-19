// Kontrol permainan, gambar grid, dan tabel. Algoritme ada di pathfinding.js.
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const canvas = byId('world');
  const ctx = canvas.getContext('2d');
  const mapSelect = byId('map-select');
  const heuristicSelect = byId('heuristic-select');
  let map, npc, player, result, timer = null, experiment = null;
  const labelOf = id => PathLab.HEURISTICS.find(h => h.id === id)?.label || id;
  const number = value => Number.isFinite(value) ? value.toFixed(2) : '—';

  for (const item of LabMaps.list()) mapSelect.add(new Option(item.name, item.id));
  for (const item of PathLab.HEURISTICS) heuristicSelect.add(new Option(item.label, item.id));
  heuristicSelect.value = 'manhattan';

  mapSelect.addEventListener('change', function() {
    generateLevel();  
  });

  setTimeout(() => {
    generateLevel();
  }, 500);

  function pause() {
    clearInterval(timer);
    timer = null;
    byId('play').textContent = '▶ Mulai mengejar';
  }

  function updateCSPOverlay(algo, steps, backtracks, time, status) {
    document.getElementById('csp-algo').innerText = algo;
    document.getElementById('csp-steps').innerText = steps;
    document.getElementById('csp-backtracks').innerText = backtracks;
    document.getElementById('csp-time').innerText = time;
    document.getElementById('csp-status').innerText = status;
  }

  function generateLevel() {
    // Asumsi: Anda punya variabel gridWidth, gridHeight, dan objek/set rintangan
    // Jika obstacles Anda bentuknya array, ubah menjadi Set('x,y') terlebih dahulu.
    const obstaclesSet = new Set(['1,1', '1,2', '5,5']); // Ganti dengan obstacle asli dari map Anda
    
    const csp = new CSPEngine(20, 20, obstaclesSet); // Sesuaikan ukuran map
    
    // Tentukan mau spawn berapa (Misal: 3 Musuh, 4 Item)
    const { variables, domains } = csp.setupProblem(3, 4);

    const startTime = performance.now();
    
    // PILIH ALGORITMA DI SINI (Ganti komentar untuk ganti eksperimen)
    const solution = csp.solveBacktracking(variables, domains);
    // const solution = csp.solveLocalSearch(variables, domains);

    const endTime = performance.now();
    const execTime = (endTime - startTime).toFixed(2);

    if (solution) {
        updateCSPOverlay("Backtracking (MRV+LCV+AC3)", csp.steps, csp.backtracks, execTime, "Berhasil");
        console.log("CSP Solusi:", solution);
        
        // LOOPING: Render entitas ke dalam grid game Anda
        for (let [entityName, pos] of Object.entries(solution)) {
            let [x, y] = pos.split(',').map(Number);
            if (entityName.startsWith('E')) {
                // spawnEnemy(x, y);  // Panggil fungsi spawn game Anda
            } else if (entityName.startsWith('I')) {
                // spawnItem(x, y);   // Panggil fungsi spawn game Anda
            }
        }
    } else {
        updateCSPOverlay("Backtracking", csp.steps, csp.backtracks, execTime, "Gagal");
        console.error("CSP gagal menemukan solusi tata letak!");
    }
  }

  function reset() {
    pause();
    map = LabMaps.create(mapSelect.value);
    npc = { ...map.start };
    player = { ...map.goal };
    byId('map-title').textContent = map.name;
    byId('map-description').textContent = map.description;
    replan();
    startChase(); // NPC langsung mengejar player saat game dimulai / direset.
  }

  function startChase() {
    if (timer || isBattleActive || !result.found) return;
    timer = setInterval(step, 350);
    byId('play').textContent = 'Ⅱ Jeda';
    replan();
  }

  function replan() {
    result = PathLab.search(map.grid, npc, player, heuristicSelect.value);
    byId('formula').textContent = 'h(n) = ' + PathLab.HEURISTICS.find(h => h.id === heuristicSelect.value).formula;
    byId('expanded-count').textContent = result.expandedCount;
    byId('path-cost').textContent = result.found ? result.cost : '—';
    byId('frontier-count').textContent = result.frontier.length;
    byId('search-time').textContent = number(result.timeMs);
    const caught = npc.x === player.x && npc.y === player.y;
    if (!result.found || caught) pause();
    byId('status').textContent = caught ? 'Player tertangkap! Gerakkan player untuk bermain lagi.' :
      !result.found ? 'Tidak ada jalur ke player. Coba pindahkan player atau ganti peta.' :
      timer ? 'NPC sedang mengejar. Gerakkan player untuk menghindar.' : 'Jalur siap. Mulai mengejar atau coba satu langkah.';
    byId('step').disabled = !result.found || caught;
    byId('play').disabled = !result.found || caught;
    byId('trace').replaceChildren();
    result.expanded.slice(0, 8).forEach((node, index) => {
      addRow(byId('trace'), [index + 1, `(${node.x}, ${node.y})`, node.g, number(node.h), number(node.f)]);
    });
    draw();
  }

  function step() {
    if (isBattleActive || !result.found || result.path.length < 2) return;
    npc = { ...result.path[1] };
    replan(); // Overlay selalu cocok dengan posisi NPC yang sekarang.
    checkBattleTrigger(player, npc);
  }

  function movePlayer(dx, dy) {
    if (isBattleActive) return;
    const next = { x: player.x + dx, y: player.y + dy };

    if (PathLab.isWalkable(map.grid, next)) {
      player = next;
      replan();
      checkBattleTrigger(player, npc); // Battle mulai jika NPC sudah dekat.
    }
  }

  // Setiap sel digambar sederhana agar hubungan gambar dan grid mudah dilihat.
  function draw() {
    const size = canvas.width / map.grid[0].length;
    const colors = ['#e0e7c8', '#8d9684', '#d4ad83', '#6e9461', '#9fc9d5', '#c29d6d'];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    map.grid.forEach((row, y) => row.forEach((tile, x) => {
      const px = x * size, py = y * size;
      ctx.fillStyle = colors[tile];
      ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = 'rgba(48,70,46,.10)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + .5, py + .5, size, size);
      if (tile === 1) {
        ctx.fillStyle = '#a0aa95';
        ctx.fillRect(px + 3, py + 3, size - 6, size - 10);
        ctx.strokeStyle = '#7b8673';
        ctx.beginPath(); ctx.moveTo(px, py + size / 2); ctx.lineTo(px + size, py + size / 2); ctx.stroke();
      } else if (tile === 2) {
        ctx.fillStyle = '#ecd7b2'; ctx.fillRect(px + 9, py + 18, size - 18, size - 21);
        ctx.fillStyle = '#ac7058'; ctx.beginPath();
        ctx.moveTo(px + 4, py + 20); ctx.lineTo(px + size / 2, py + 5); ctx.lineTo(px + size - 4, py + 20); ctx.fill();
        ctx.fillStyle = '#886b53'; ctx.fillRect(px + 17, py + 26, 7, 11);
      } else if (tile === 3) {
        ctx.fillStyle = '#796b45'; ctx.fillRect(px + 17, py + 24, 6, 12);
        circle(px + 20, py + 18, 14, '#467446');
        circle(px + 16, py + 14, 9, '#5d8953');
      } else if (tile === 4) {
        ctx.strokeStyle = '#cbe2e5'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + 7, py + 15); ctx.lineTo(px + 20, py + 15);
        ctx.moveTo(px + 20, py + 27); ctx.lineTo(px + 34, py + 27); ctx.stroke();
      } else if (tile === 5) {
        ctx.strokeStyle = '#957449'; ctx.lineWidth = 2;
        for (let offset = 7; offset < size; offset += 9) {
          ctx.beginPath(); ctx.moveTo(px + offset, py + 3); ctx.lineTo(px + offset, py + size - 3); ctx.stroke();
        }
      }
    }));

    if (byId('overlay').checked) {
      for (const node of result.expanded) {
        ctx.fillStyle = 'rgba(215,165,46,.36)';
        ctx.fillRect(node.x * size + 2, node.y * size + 2, size - 4, size - 4);
      }
      for (const node of result.frontier) {
        ctx.fillStyle = 'rgba(71,132,174,.36)';
        ctx.fillRect(node.x * size + 2, node.y * size + 2, size - 4, size - 4);
      }
      if (result.path.length) {
        ctx.strokeStyle = '#bd642d'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        ctx.beginPath();
        result.path.forEach((node, index) => {
          const x = (node.x + .5) * size, y = (node.y + .5) * size;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
    character(npc, '#ce7137', 'N', size);
    character(player, '#27654f', 'P', size);
  }

  function circle(x, y, radius, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  }

  function character(position, color, letter, size) {
    const x = (position.x + .5) * size, y = (position.y + .5) * size;
    circle(x, y + 3, 16, 'rgba(41,58,32,.20)');
    circle(x, y, 16, '#fffaf0');
    circle(x, y, 13, color);
    ctx.fillStyle = 'white'; ctx.font = 'bold 15px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, x, y + 1);
  }

  function addRow(body, values) {
    const row = document.createElement('tr');
    for (const value of values) {
      const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
    }
    body.appendChild(row);
  }

  function runExperiments() {
    pause(); replan();
    experiment = Experiments.runSuite();
    byId('experiment-summary').replaceChildren();
    byId('experiment-details').replaceChildren();
    for (const row of experiment.summary) {
      addRow(byId('experiment-summary'), [labelOf(row.heuristic), `${row.found} / ${row.runs}`,
        number(row.avgExpanded), number(row.avgTimeMs), number(row.avgRatio)]);
    }
    for (const row of experiment.rows) {
      const mapName = LabMaps.list().find(item => item.id === row.scenario)?.name || row.scenario;
      addRow(byId('experiment-details'), [mapName, labelOf(row.heuristic), row.expandedCount,
        row.found ? row.cost : 'Tidak ada jalur', number(row.timeMs)]);
    }
    byId('experiment-status').textContent = `${experiment.rows.length} kasus selesai. Rerata node mencakup peta tanpa jalur; rasio biaya mengecualikannya. Unduh CSV untuk data setiap kasus.`;
    byId('export').disabled = false;
  }

  function exportCSV() {
    if (!experiment) return;
    const csv = Experiments.toCSV(experiment);
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'eksperimen-ucs-astar.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  byId('play').addEventListener('click', () => {
    if (isBattleActive) return;
    if (timer) pause(); else {
      timer = setInterval(step, 350);
      byId('play').textContent = 'Ⅱ Jeda';
    }
    replan();
  });
  byId('step').addEventListener('click', () => { if (isBattleActive) return; pause(); step(); });
  byId('reset').addEventListener('click', reset);
  mapSelect.addEventListener('change', reset);
  heuristicSelect.addEventListener('change', replan);
  byId('overlay').addEventListener('change', draw);
  byId('run-experiments').addEventListener('click', runExperiments);
  byId('export').addEventListener('click', exportCSV);
  document.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => {
    movePlayer(...button.dataset.move.split(',').map(Number));
  }));
  const keys = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
  document.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = keys[event.key] || keys[event.key.toLowerCase()];
    if (direction) { event.preventDefault(); movePlayer(...direction); }
  });
    canvas.addEventListener('click', event => {
    const bounds = canvas.getBoundingClientRect();

    const next = {
      x: Math.floor(
        (event.clientX - bounds.left) / bounds.width * map.grid[0].length
      ),
      y: Math.floor(
        (event.clientY - bounds.top) / bounds.height * map.grid.length
      )
    };

    if (!isBattleActive && PathLab.isWalkable(map.grid, next)) {
      player = next;
      replan();
      checkBattleTrigger(player, npc);
    }

    canvas.focus({ preventScroll: true });
  });

// ==========================================
// KODE ADVERSARIAL SEARCH & BATTLE (TAHAP 2) - SAFE MODE
// ==========================================
let currentBattle = null;
let isBattleActive = false;

// Ambil Solver dari window atau inisialisasi aman
const SolverClass = window.AdversarialSolver || class DummySolver {
  solve() { return { bestAction: 'attack', bestScore: 0, actionScores: {}, nodeCount: 1 }; }
};

const aiSolver = new SolverClass({
  algorithm: 'alphabeta',
  maxDepth: 4,
  evalType: 'balanced',
  actionOrdering: 'optimal'
});

// Pasang event listener dengan pengecekan aman agar tidak membunuh peta
function setupBattleUIEvents() {
  const algoSel = document.getElementById('select-algo');
  const evalSel = document.getElementById('select-eval');
  const depthSel = document.getElementById('select-depth');
  const orderSel = document.getElementById('select-order');

  if (algoSel) algoSel.onchange = (e) => aiSolver.algorithm = e.target.value;
  if (evalSel) evalSel.onchange = (e) => aiSolver.evalType = e.target.value;
  if (depthSel) depthSel.onchange = (e) => aiSolver.maxDepth = parseInt(e.target.value);
  if (orderSel) orderSel.onchange = (e) => aiSolver.actionOrdering = e.target.value;

  document.getElementById('btn-attack')?.addEventListener('click', () => playerTurn('attack'));
  document.getElementById('btn-defend')?.addEventListener('click', () => playerTurn('defend'));
  document.getElementById('btn-potion')?.addEventListener('click', () => playerTurn('potion'));
}

// Jalankan listener saat DOM sudah siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBattleUIEvents);
} else {
  setupBattleUIEvents();
}

function checkBattleTrigger(playerPos, npcPos) {
  if (isBattleActive || !playerPos || !npcPos) return;

  // Jarak Manhattan: selisih x + selisih y
  const dist = Math.abs(playerPos.x - npcPos.x) + Math.abs(playerPos.y - npcPos.y);

  // Jika bersebelahan (jarak 1) atau di kotak yang sama (jarak 0)
  if (dist <= 1) {
    pause(); // Hentikan pergerakan otomatis NPC.
    initiateBattle();
  }
}
function initiateBattle() {
  isBattleActive = true;
  const BattleStateClass = window.BattleState;
  if (!BattleStateClass) {
    console.error("BattleState belum dimuat di window!");
    return;
  }

  currentBattle = new BattleStateClass({
    playerHp: 100,
    npcHp: 100,
    playerPotions: 2,
    npcPotions: 2,
    turn: 'player'
  });

  const modal = document.getElementById('battle-container');
  if (modal) modal.style.display = 'flex';
  const log = document.getElementById('battle-log');
  if (log) log.innerHTML = '';
  const overlay = document.getElementById('debug-overlay');
  if (overlay) overlay.innerHTML = '<em>Menunggu giliran NPC...</em>';
  logMessage("NPC berhasil mendekat! Pertarungan dimulai. Pilih langkah pertamamu.");
  updateBattleUI();
  toggleActionButtons(true);
}

function playerTurn(action) {
  if (!isBattleActive || !currentBattle || currentBattle.turn !== 'player') return;

  const crit = action === 'attack' && Math.random() < window.CRIT_CHANCE;
  logMessage(`Player menggunakan: <b>${action.toUpperCase()}</b>${crit ? ' 💥 <b>CRITICAL HIT!</b>' : ''}`);
  currentBattle = currentBattle.applyAction(action, 'player', { damageMultiplier: crit ? window.CRIT_MULTIPLIER : 1 });
  updateBattleUI();

  if (currentBattle.isTerminal()) {
    endBattle(currentBattle.playerHp > 0 ? "Selamat, Kamu Menang!" : "NPC Menang!");
    return;
  }

  toggleActionButtons(false);
  setTimeout(npcTurn, 600);
}

function npcTurn() {
  if (!isBattleActive || !currentBattle || currentBattle.turn !== 'npc') return;

  const evalInfo = currentBattle.describeEvaluation ? currentBattle.describeEvaluation(aiSolver.evalType) : null;
  const t0 = performance.now();
  const decision = aiSolver.solve(currentBattle);
  const computeTime = (performance.now() - t0).toFixed(2);

  renderDebugOverlay(decision, computeTime, evalInfo);

  const npcCrit = decision.bestAction === 'attack' && Math.random() < window.CRIT_CHANCE;
  logMessage(`NPC memilih: <b>${decision.bestAction.toUpperCase()}</b>${npcCrit ? ' 💥 <b>CRITICAL HIT!</b>' : ''}`);
  currentBattle = currentBattle.applyAction(decision.bestAction, 'npc', { damageMultiplier: npcCrit ? window.CRIT_MULTIPLIER : 1 });
  updateBattleUI();

  if (currentBattle.isTerminal()) {
    endBattle(currentBattle.npcHp > 0 ? "NPC Menang!" : "Selamat, Kamu Menang!");
    return;
  }

  toggleActionButtons(true);
}

function renderDebugOverlay(decision, computeTime, evalInfo) {
  const overlay = document.getElementById('debug-overlay');
  if (!overlay) return;

  const scores = Object.entries(decision.actionScores || {})
    .map(([act, score]) => `<li><b>${act}</b>: ${score.toFixed(1)}</li>`)
    .join('');

  overlay.innerHTML = `
    <div><b>Mode:</b> ${aiSolver.algorithm.toUpperCase()} (Depth: ${aiSolver.maxDepth}, Eval: ${aiSolver.evalType})</div>
    <div><b>Nodes Evaluated:</b> <span style="color:#38bdf8">${decision.nodeCount} nodes</span> (${computeTime} ms)</div>
    ${aiSolver.algorithm === 'alphabeta' ? `<div><b>Pruning (α ≥ β):</b> ${decision.pruneCount || 0} cabang dipangkas</div>` : ''}
    ${evalInfo ? `<div><b>${evalInfo.formula}</b><br>= ${evalInfo.terms} = <span style="color:#38bdf8">${Number(evalInfo.value).toFixed(1)}</span> (state sebelum NPC bergerak)</div>` : ''}
    <div><b>Aksi terpilih:</b> ${decision.bestAction.toUpperCase()} (skor ${Number(decision.bestScore).toFixed(1)})</div>
    <div><b>Pertimbangan Skor Aksi:</b></div>
    <ul style="margin: 2px 0 0 16px; padding: 0;">${scores}</ul>
  `;
}

function updateBattleUI() {
  if (!currentBattle) return;
  const pVal = document.getElementById('player-hp-val');
  const pBar = document.getElementById('player-hp-bar');
  const pPot = document.getElementById('player-potions-val');
  const nVal = document.getElementById('npc-hp-val');
  const nBar = document.getElementById('npc-hp-bar');
  const nPot = document.getElementById('npc-potions-val');

  if (pVal) pVal.innerText = currentBattle.playerHp;
  if (pBar) pBar.style.width = `${currentBattle.playerHp}%`;
  if (pPot) pPot.innerText = currentBattle.playerPotions;

  if (nVal) nVal.innerText = currentBattle.npcHp;
  if (nBar) nBar.style.width = `${currentBattle.npcHp}%`;
  if (nPot) nPot.innerText = currentBattle.npcPotions;

  const pDef = document.getElementById('player-def');
  const nDef = document.getElementById('npc-def');
  if (pDef) pDef.textContent = currentBattle.playerDefending ? '🛡️ Bertahan' : '';
  if (nDef) nDef.textContent = currentBattle.npcDefending ? '🛡️ Bertahan' : '';

  const potionBtn = document.getElementById('btn-potion');
  if (potionBtn) potionBtn.disabled = currentBattle.playerPotions <= 0;
}

function toggleActionButtons(enable) {
  const bAtk = document.getElementById('btn-attack');
  const bDef = document.getElementById('btn-defend');
  const bPot = document.getElementById('btn-potion');
  if (bAtk) bAtk.disabled = !enable;
  if (bDef) bDef.disabled = !enable;
  if (bPot) bPot.disabled = !enable || (currentBattle && currentBattle.playerPotions <= 0);
}

function logMessage(msg) {
  const log = document.getElementById('battle-log');
  if (log) {
    log.innerHTML = `<div>${msg}</div>` + log.innerHTML;
  }
}

function endBattle(message) {
  setTimeout(() => {
    alert(message);
    const modal = document.getElementById('battle-container');
    if (modal) modal.style.display = 'none';
    isBattleActive = false;
    reset(); // Posisi dikembalikan dan NPC mengejar lagi.
  }, 400);
}


  // ---------- Eksperimen adversarial (Tahap 2) ----------
  let advSuite = null;
  const ALGO_LABEL = { minimax: 'Minimax', alphabeta: 'Alpha-Beta', expectimax: 'Expectimax' };
  const ORDER_LABEL = { optimal: 'Optimal', default: 'Default', reverse: 'Reverse' };
  const EVAL_LABEL = { balanced: 'Balanced', aggressive: 'Aggressive', defensive: 'Defensive' };
  const pct = v => (Math.abs(v) < 1e-9 ? '—' : `${(v * 100).toFixed(0)}%`);

  function runAdversarialExperiments() {
    if (!window.AdversarialLab) return;
    byId('adv-status').textContent = 'Menjalankan eksperimen...';
    setTimeout(() => {
      advSuite = window.AdversarialLab.runSuite();
      for (const id of ['adv-summary', 'adv-order', 'adv-eval', 'adv-decisions', 'adv-details']) byId(id).replaceChildren();
      for (const r of advSuite.summary.filter(x => x.ordering === 'optimal'))
        addRow(byId('adv-summary'), [ALGO_LABEL[r.algorithm], r.depth, number(r.avgNodes),
          r.algorithm === 'minimax' ? '—' : r.algorithm === 'expectimax' ? 'n/a (model berbeda)' : pct(r.savingVsMinimax),
          r.algorithm === 'expectimax' ? 'n/a (model peluang)' : `${r.sameAsMinimax} / ${r.total}`]);
      for (const r of advSuite.summary.filter(x => x.algorithm === 'alphabeta'))
        addRow(byId('adv-order'), [r.depth, ORDER_LABEL[r.ordering], number(r.avgNodes), pct(r.savingVsMinimax)]);
      for (const r of advSuite.duels)
        addRow(byId('adv-eval'), [EVAL_LABEL[r.evalType], `${r.wins} / ${r.games}`, r.losses, r.draws, number(r.avgRounds)]);
      for (const r of advSuite.decisions)
        addRow(byId('adv-decisions'), [EVAL_LABEL[r.evalType], r.scenarioName, r.bestAction, number(r.bestScore), r.nodes]);
      for (const r of advSuite.efficiency)
        addRow(byId('adv-details'), [r.scenarioName, ALGO_LABEL[r.algorithm], r.depth, ORDER_LABEL[r.ordering], r.nodes, r.bestAction, number(r.bestScore)]);
      byId('adv-status').textContent = `${advSuite.efficiency.length} kasus efisiensi, ${advSuite.decisions.length} keputusan, dan ${advSuite.duels.length * advSuite.duels[0].games} duel simulasi selesai.`;
      byId('export-adv').disabled = false;
    }, 20);
  }

  function exportAdversarialCSV() {
    if (!advSuite) return;
    const csv = window.AdversarialLab.toCSV(advSuite);
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'eksperimen-adversarial.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  byId('run-adv').addEventListener('click', runAdversarialExperiments);
  byId('export-adv').addEventListener('click', exportAdversarialCSV);

  // Mulai game: NPC langsung mengejar player.
  reset();
})();
