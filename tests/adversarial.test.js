const test = require('node:test');
const assert = require('node:assert/strict');
const { BattleState, AdversarialSolver, AdversarialLab, CRIT_CHANCE, CRIT_MULTIPLIER } = require('../src/adversarial.js');

test('attack mengurangi HP, defend mengurangi damage 60%, potion menambah HP', () => {
  const s = new BattleState({ turn: 'npc' });
  assert.equal(s.applyAction('attack', 'npc').playerHp, 80);
  const def = s.applyAction('defend', 'player').applyAction('attack', 'npc');
  assert.equal(def.npcHp, 100);
  assert.equal(new BattleState({ playerHp: 50, turn: 'player' }).applyAction('potion', 'player').playerHp, 75);
  assert.equal(s.applyAction('attack', 'npc', { damageMultiplier: CRIT_MULTIPLIER }).playerHp, 70);
  assert.equal(CRIT_CHANCE, 0.2);
});

test('Alpha-Beta memberi keputusan sama dengan Minimax dengan node lebih sedikit', () => {
  for (const sc of AdversarialLab.SCENARIOS) for (const depth of [2, 4, 6]) {
    const state = new BattleState({ ...sc.state, turn: 'npc' });
    const mm = new AdversarialSolver({ algorithm: 'minimax', maxDepth: depth }).solve(state);
    const ab = new AdversarialSolver({ algorithm: 'alphabeta', maxDepth: depth }).solve(state);
    assert.equal(ab.bestAction, mm.bestAction);
    assert.equal(ab.bestScore, mm.bestScore);
    assert.ok(ab.nodeCount <= mm.nodeCount);
  }
  const s = new BattleState({ turn: 'npc' });
  const mm = new AdversarialSolver({ algorithm: 'minimax', maxDepth: 6 }).solve(s);
  const ab = new AdversarialSolver({ algorithm: 'alphabeta', maxDepth: 6, actionOrdering: 'optimal' }).solve(s);
  assert.ok(ab.nodeCount < mm.nodeCount / 3);
  assert.ok(ab.pruneCount > 0);
});

test('urutan action memengaruhi jumlah node Alpha-Beta', () => {
  const s = new BattleState({ turn: 'npc' });
  const run = actionOrdering => new AdversarialSolver({ algorithm: 'alphabeta', maxDepth: 6, actionOrdering }).solve(s).nodeCount;
  assert.ok(run('optimal') < run('reverse'));
});

test('NPC menyerang saat player hampir kalah dan memilih potion dst tidak error', () => {
  const s = new BattleState({ playerHp: 20, npcHp: 60, turn: 'npc' });
  for (const algorithm of ['minimax', 'alphabeta', 'expectimax'])
    assert.equal(new AdversarialSolver({ algorithm, maxDepth: 4 }).solve(s).bestAction, 'attack');
});

test('describeEvaluation cocok dengan evaluate', () => {
  const s = new BattleState({ npcHp: 65, playerHp: 80, npcPotions: 2, playerPotions: 1, turn: 'npc' });
  for (const type of ['balanced', 'aggressive', 'defensive'])
    assert.equal(s.describeEvaluation(type).value, s.evaluate(type));
  assert.equal(s.evaluate('balanced'), -7.5);
});

test('suite eksperimen adversarial lengkap dan deterministik', () => {
  const a = AdversarialLab.runSuite({ games: 5 });
  const b = AdversarialLab.runSuite({ games: 5 });
  assert.equal(a.efficiency.length, 5 * 3 * 3 * 3);
  assert.equal(a.decisions.length, 15);
  assert.deepEqual(a.duels, b.duels);
  for (const r of a.summary.filter(x => x.algorithm === 'alphabeta')) assert.equal(r.sameAsMinimax, r.total);
  assert.ok(AdversarialLab.toCSV(a).split('\n').length > 100);
});
