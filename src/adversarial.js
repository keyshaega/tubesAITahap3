// src/adversarial.js

(function () {
  const ACTIONS = ['attack', 'defend', 'potion'];
  // Ketidakpastian: attack punya peluang critical hit (dipakai game & Expectimax).
  const CRIT_CHANCE = 0.2;
  const CRIT_MULTIPLIER = 1.5;

  class BattleState {
    constructor({
      playerHp = 100,
      npcHp = 100,
      playerPotions = 2,
      npcPotions = 2,
      playerDefending = false,
      npcDefending = false,
      turn = 'npc'
    } = {}) {
      this.playerHp = Math.max(0, playerHp);
      this.npcHp = Math.max(0, npcHp);
      this.playerPotions = Math.max(0, playerPotions);
      this.npcPotions = Math.max(0, npcPotions);
      this.playerDefending = playerDefending;
      this.npcDefending = npcDefending;
      this.turn = turn;
    }

    isTerminal() {
      return this.playerHp <= 0 || this.npcHp <= 0;
    }

    getTerminalUtility() {
      if (this.npcHp > 0 && this.playerHp <= 0) return 1000;
      if (this.npcHp <= 0 && this.playerHp > 0) return -1000;
      return 0;
    }

    evaluate(evalType = 'balanced') {
      if (this.isTerminal()) {
        return this.getTerminalUtility();
      }

      const hpDiff = this.npcHp - this.playerHp;
      const potionDiff = (this.npcPotions - this.playerPotions) * 15;

      if (evalType === 'aggressive') {
        return (100 - this.playerHp) * 2.5 + this.npcHp * 1.0;
      } else if (evalType === 'defensive') {
        return this.npcHp * 2.5 - this.playerHp * 1.0 + potionDiff;
      }
      return hpDiff * 1.5 + potionDiff;
    }

    // Penjelasan EVAL(s) = w1 f1(s) + w2 f2(s) + ... untuk debug overlay.
    describeEvaluation(evalType = 'balanced') {
      const potionDiff = this.npcPotions - this.playerPotions;
      let formula, terms;
      if (this.isTerminal()) {
        return { formula: 'Terminal state → utility', terms: `${this.getTerminalUtility()}`, value: this.getTerminalUtility() };
      }
      if (evalType === 'aggressive') {
        formula = 'EVAL = 2.5·(100 − HP_player) + 1.0·HP_npc';
        terms = `2.5·(100 − ${this.playerHp}) + 1.0·${this.npcHp}`;
      } else if (evalType === 'defensive') {
        formula = 'EVAL = 2.5·HP_npc − 1.0·HP_player + 15·(potion_npc − potion_player)';
        terms = `2.5·${this.npcHp} − 1.0·${this.playerHp} + 15·(${this.npcPotions} − ${this.playerPotions})`;
      } else {
        formula = 'EVAL = 1.5·(HP_npc − HP_player) + 15·(potion_npc − potion_player)';
        terms = `1.5·(${this.npcHp} − ${this.playerHp}) + 15·${potionDiff}`;
      }
      return { formula, terms, value: this.evaluate(evalType) };
    }

    getAvailableActions(role) {
      const actions = ['attack', 'defend'];
      const potions = role === 'npc' ? this.npcPotions : this.playerPotions;
      if (potions > 0) {
        actions.push('potion');
      }
      return actions;
    }

    applyAction(action, role, { damageMultiplier = 1.0 } = {}) {
      const next = new BattleState({
        playerHp: this.playerHp,
        npcHp: this.npcHp,
        playerPotions: this.playerPotions,
        npcPotions: this.npcPotions,
        playerDefending: role === 'player' ? false : this.playerDefending,
        npcDefending: role === 'npc' ? false : this.npcDefending,
        turn: role === 'npc' ? 'player' : 'npc'
      });

      const baseDamage = 20 * damageMultiplier;
      const healAmount = 25;

      if (role === 'npc') {
        if (action === 'attack') {
          const damage = next.playerDefending ? Math.floor(baseDamage * 0.4) : baseDamage;
          next.playerHp = Math.max(0, next.playerHp - damage);
          next.playerDefending = false;
        } else if (action === 'defend') {
          next.npcDefending = true;
        } else if (action === 'potion' && next.npcPotions > 0) {
          next.npcHp = Math.min(100, next.npcHp + healAmount);
          next.npcPotions--;
        }
      } else {
        if (action === 'attack') {
          const damage = next.npcDefending ? Math.floor(baseDamage * 0.4) : baseDamage;
          next.npcHp = Math.max(0, next.npcHp - damage);
          next.npcDefending = false;
        } else if (action === 'defend') {
          next.playerDefending = true;
        } else if (action === 'potion' && next.playerPotions > 0) {
          next.playerHp = Math.min(100, next.playerHp + healAmount);
          next.playerPotions--;
        }
      }
      return next;
    }
  }

  class AdversarialSolver {
    constructor(options = {}) {
      this.maxDepth = options.maxDepth || 4;
      this.algorithm = options.algorithm || 'alphabeta';
      this.evalType = options.evalType || 'balanced';
      this.actionOrdering = options.actionOrdering || 'default';
      this.nodeCount = 0;
      this.pruneCount = 0;
      this.actionScores = {};
    }

    sortActions(actions) {
      const priority = { attack: 3, potion: 2, defend: 1 };
      if (this.actionOrdering === 'optimal') {
        return [...actions].sort((a, b) => priority[b] - priority[a]);
      } else if (this.actionOrdering === 'reverse') {
        return [...actions].sort((a, b) => priority[a] - priority[b]);
      }
      return actions;
    }

    solve(state) {
      this.nodeCount = 0;
      this.pruneCount = 0;
      this.actionScores = {};

      let bestAction = null;
      let bestScore = -Infinity;
      let alpha = -Infinity;
      let beta = Infinity;

      const availableActions = this.sortActions(state.getAvailableActions('npc'));

      for (const action of availableActions) {
        let score;
        if (this.algorithm === 'expectimax') {
          if (action === 'attack') {
            const sNormal = state.applyAction(action, 'npc', { damageMultiplier: 1.0 });
            const sCrit = state.applyAction(action, 'npc', { damageMultiplier: CRIT_MULTIPLIER });
            const vNormal = this.expectimax(sNormal, this.maxDepth - 1, false);
            const vCrit = this.expectimax(sCrit, this.maxDepth - 1, false);
            score = (1 - CRIT_CHANCE) * vNormal + CRIT_CHANCE * vCrit;
          } else {
            const nextState = state.applyAction(action, 'npc');
            score = this.expectimax(nextState, this.maxDepth - 1, false);
          }
        } else if (this.algorithm === 'alphabeta') {
          const nextState = state.applyAction(action, 'npc');
          score = this.alphaBeta(nextState, this.maxDepth - 1, alpha, beta, false);
          alpha = Math.max(alpha, score);
        } else {
          const nextState = state.applyAction(action, 'npc');
          score = this.minimax(nextState, this.maxDepth - 1, false);
        }

        this.actionScores[action] = score;

        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
      }

      return {
        bestAction: bestAction || availableActions[0],
        bestScore,
        actionScores: this.actionScores,
        nodeCount: this.nodeCount,
        pruneCount: this.pruneCount
      };
    }

    minimax(state, depth, isMaximizing) {
      this.nodeCount++;
      if (depth === 0 || state.isTerminal()) {
        return state.evaluate(this.evalType);
      }

      if (isMaximizing) {
        let maxEval = -Infinity;
        for (const action of this.sortActions(state.getAvailableActions('npc'))) {
          const next = state.applyAction(action, 'npc');
          maxEval = Math.max(maxEval, this.minimax(next, depth - 1, false));
        }
        return maxEval;
      } else {
        let minEval = Infinity;
        for (const action of this.sortActions(state.getAvailableActions('player'))) {
          const next = state.applyAction(action, 'player');
          minEval = Math.min(minEval, this.minimax(next, depth - 1, true));
        }
        return minEval;
      }
    }

    alphaBeta(state, depth, alpha, beta, isMaximizing) {
      this.nodeCount++;
      if (depth === 0 || state.isTerminal()) {
        return state.evaluate(this.evalType);
      }

      if (isMaximizing) {
        let maxEval = -Infinity;
        for (const action of this.sortActions(state.getAvailableActions('npc'))) {
          const next = state.applyAction(action, 'npc');
          const evalScore = this.alphaBeta(next, depth - 1, alpha, beta, false);
          maxEval = Math.max(maxEval, evalScore);
          alpha = Math.max(alpha, evalScore);
          if (alpha >= beta) { this.pruneCount++; break; }
        }
        return maxEval;
      } else {
        let minEval = Infinity;
        for (const action of this.sortActions(state.getAvailableActions('player'))) {
          const next = state.applyAction(action, 'player');
          const evalScore = this.alphaBeta(next, depth - 1, alpha, beta, true);
          minEval = Math.min(minEval, evalScore);
          beta = Math.min(beta, evalScore);
          if (alpha >= beta) { this.pruneCount++; break; }
        }
        return minEval;
      }
    }

    expectimax(state, depth, isMaximizing) {
      this.nodeCount++;
      if (depth === 0 || state.isTerminal()) {
        return state.evaluate(this.evalType);
      }

      if (isMaximizing) {
        let maxEval = -Infinity;
        for (const action of this.sortActions(state.getAvailableActions('npc'))) {
          const next = state.applyAction(action, 'npc');
          maxEval = Math.max(maxEval, this.expectimax(next, depth - 1, false));
        }
        return maxEval;
      } else {
        const actions = state.getAvailableActions('player');
        let expectedVal = 0;
        for (const action of actions) {
          const next = state.applyAction(action, 'player');
          expectedVal += this.expectimax(next, depth - 1, true) / actions.length;
        }
        return expectedVal;
      }
    }
  }

  // ==========================================================
  // EKSPERIMEN ADVERSARIAL (Minimax vs Alpha-Beta, evaluation, ordering, depth)
  // ==========================================================
  const SCENARIOS = [
    { id: 'awal', name: 'Awal duel (100 vs 100)', state: {} },
    { id: 'unggul', name: 'NPC unggul (80 vs 40)', state: { npcHp: 80, playerHp: 40 } },
    { id: 'terdesak', name: 'NPC terdesak (30 vs 80)', state: { npcHp: 30, playerHp: 80 } },
    { id: 'tanpa-potion', name: 'NPC tanpa potion (45 vs 60)', state: { npcHp: 45, playerHp: 60, npcPotions: 0, playerPotions: 1 } },
    { id: 'player-bertahan', name: 'Player bertahan (70 vs 70)', state: { npcHp: 70, playerHp: 70, playerDefending: true } }
  ];
  const EXP_ALGOS = ['minimax', 'alphabeta', 'expectimax'];
  const EXP_DEPTHS = [2, 4, 6];
  const EXP_ORDERS = ['optimal', 'default', 'reverse'];
  const EXP_EVALS = ['balanced', 'aggressive', 'defensive'];

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Duel simulasi: NPC (Alpha-Beta depth 4) melawan Player acak. Seed tetap agar adil.
  function duel(evalType, seed) {
    const rng = mulberry32(seed);
    const solver = new AdversarialSolver({ algorithm: 'alphabeta', maxDepth: 4, evalType, actionOrdering: 'optimal' });
    const mult = a => (a === 'attack' && rng() < CRIT_CHANCE ? CRIT_MULTIPLIER : 1);
    let state = new BattleState({ turn: 'player' });
    let rounds = 0;
    while (!state.isTerminal() && rounds < 60) {
      const options = state.getAvailableActions('player');
      const move = options[Math.floor(rng() * options.length)];
      state = state.applyAction(move, 'player', { damageMultiplier: mult(move) });
      if (state.isTerminal()) break;
      const decision = solver.solve(state);
      state = state.applyAction(decision.bestAction, 'npc', { damageMultiplier: mult(decision.bestAction) });
      rounds++;
    }
    const winner = state.playerHp <= 0 ? 'npc' : state.npcHp <= 0 ? 'player' : 'draw';
    return { winner, rounds };
  }

  function runSuite({ games = 30, seed = 2026 } = {}) {
    const efficiency = [];
    for (const sc of SCENARIOS) {
      for (const depth of EXP_DEPTHS) {
        for (const ordering of EXP_ORDERS) {
          for (const algorithm of EXP_ALGOS) {
            const solver = new AdversarialSolver({ algorithm, maxDepth: depth, evalType: 'balanced', actionOrdering: ordering });
            const t0 = now();
            const r = solver.solve(new BattleState({ ...sc.state, turn: 'npc' }));
            efficiency.push({ scenario: sc.id, scenarioName: sc.name, algorithm, depth, ordering,
              nodes: r.nodeCount, pruned: r.pruneCount, bestAction: r.bestAction, bestScore: r.bestScore, timeMs: now() - t0 });
          }
        }
      }
    }

    const summary = [];
    for (const algorithm of EXP_ALGOS) for (const depth of EXP_DEPTHS) for (const ordering of EXP_ORDERS) {
      const rows = efficiency.filter(r => r.algorithm === algorithm && r.depth === depth && r.ordering === ordering);
      const base = efficiency.filter(r => r.algorithm === 'minimax' && r.depth === depth && r.ordering === ordering);
      const avgNodes = rows.reduce((a, r) => a + r.nodes, 0) / rows.length;
      const baseNodes = base.reduce((a, r) => a + r.nodes, 0) / base.length;
      const same = rows.filter((r, i) => r.bestScore === base[i].bestScore && r.bestAction === base[i].bestAction).length;
      summary.push({ algorithm, depth, ordering, avgNodes, avgTimeMs: rows.reduce((a, r) => a + r.timeMs, 0) / rows.length,
        savingVsMinimax: 1 - avgNodes / baseNodes, sameAsMinimax: same, total: rows.length });
    }

    const decisions = [];
    for (const evalType of EXP_EVALS) for (const sc of SCENARIOS) {
      const solver = new AdversarialSolver({ algorithm: 'alphabeta', maxDepth: 4, evalType, actionOrdering: 'optimal' });
      const r = solver.solve(new BattleState({ ...sc.state, turn: 'npc' }));
      decisions.push({ evalType, scenario: sc.id, scenarioName: sc.name, bestAction: r.bestAction, bestScore: r.bestScore, nodes: r.nodeCount });
    }

    const duels = EXP_EVALS.map(evalType => {
      let wins = 0, losses = 0, draws = 0, rounds = 0;
      for (let g = 0; g < games; g++) {
        const r = duel(evalType, seed + g);
        if (r.winner === 'npc') wins++; else if (r.winner === 'player') losses++; else draws++;
        rounds += r.rounds;
      }
      return { evalType, games, wins, losses, draws, avgRounds: rounds / games };
    });

    return { efficiency, summary, decisions, duels };
  }

  function toCSV(suite) {
    const esc = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const head = ['jenis', 'skenario', 'algoritme', 'depth', 'urutan', 'evaluasi', 'node', 'aksi', 'skor', 'waktu_ms', 'menang', 'kalah', 'seri', 'rerata_ronde'];
    const lines = [head.join(',')];
    for (const r of suite.efficiency) lines.push([ 'efisiensi', r.scenario, r.algorithm, r.depth, r.ordering, 'balanced', r.nodes, r.bestAction, r.bestScore, r.timeMs.toFixed(3), '', '', '', '' ].map(esc).join(','));
    for (const r of suite.decisions) lines.push([ 'keputusan', r.scenario, 'alphabeta', 4, 'optimal', r.evalType, r.nodes, r.bestAction, r.bestScore, '', '', '', '', '' ].map(esc).join(','));
    for (const r of suite.duels) lines.push([ 'duel', '', 'alphabeta', 4, 'optimal', r.evalType, '', '', '', '', r.wins, r.losses, r.draws, r.avgRounds.toFixed(2) ].map(esc).join(','));
    return lines.join('\n');
  }

  const AdversarialLab = { SCENARIOS, runSuite, toCSV };

  // Daftarkan ke window agar bisa diakses oleh browser & Node.js
  if (typeof window !== 'undefined') {
    window.ACTIONS = ACTIONS;
    window.CRIT_CHANCE = CRIT_CHANCE;
    window.CRIT_MULTIPLIER = CRIT_MULTIPLIER;
    window.AdversarialLab = AdversarialLab;
    window.BattleState = BattleState;
    window.AdversarialSolver = AdversarialSolver;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ACTIONS, CRIT_CHANCE, CRIT_MULTIPLIER, BattleState, AdversarialSolver, AdversarialLab };
  }
})();