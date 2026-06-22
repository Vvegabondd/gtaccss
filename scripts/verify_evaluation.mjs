// ============================================================
// Step 7 Evaluation Runner Verification (Upgraded for Step 8 DDQN)
// Run with: node scripts/verify_evaluation.mjs
// ============================================================

import {
  runNashEvaluation,
  runA2CEvaluation,
  runDDQNEvaluation,
  compareResults,
  configureFlowsForScenario,
  EVAL_SCENARIOS
} from '../src/rl/evaluation.js';
import { A2CAgent } from '../src/rl/A2CAgent.js';
import { DDQNAgent } from '../src/rl/DDQNAgent.js';
import { A3CAgent } from '../src/rl/A3CAgent.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

const DEFAULT_TOPOLOGY = {
  nodes: [
    { id: 'A', x: 80, y: 190 },
    { id: 'B', x: 220, y: 100 },
    { id: 'C', x: 220, y: 290 },
    { id: 'D', x: 380, y: 190 },
    { id: 'E', x: 500, y: 190 },
    { id: 'F', x: 620, y: 190 },
    { id: 'G', x: 750, y: 100 },
    { id: 'H', x: 750, y: 290 },
  ],
  links: [
    { from: 'A', to: 'B', capacity: 100 },
    { from: 'A', to: 'C', capacity: 80 },
    { from: 'B', to: 'D', capacity: 60 },
    { from: 'C', to: 'D', capacity: 70 },
    { from: 'D', to: 'E', capacity: 50 },
    { from: 'E', to: 'F', capacity: 100 },
    { from: 'F', to: 'G', capacity: 90 },
    { from: 'F', to: 'H', capacity: 80 },
  ],
  flows: [
    { id: 'F1', path: ['A', 'B', 'D', 'E', 'F', 'G'], strategy: 'aggressive', trafficProfile: 'aggressive', rate: 40, color: '#ef4444' },
    { id: 'F2', path: ['A', 'C', 'D', 'E', 'F', 'H'], strategy: 'adaptive', trafficProfile: 'adaptive', rate: 40, color: '#3b82f6' },
    { id: 'F3', path: ['B', 'D', 'E', 'F'], strategy: 'conservative', trafficProfile: 'conservative', rate: 40, color: '#22c55e' },
  ],
};

// ── Test 1: Verify Nash Evaluation ──────────────────────────────────────────
console.log('\n📊 Test 1: runNashEvaluation() collects and summarizes metrics');
{
  try {
    const res = runNashEvaluation(DEFAULT_TOPOLOGY, 'mixed', 10);
    assert(res.steps.length === 10, 'Nash evaluation executes exact rounds (10)');
    assert(res.summary !== undefined, 'Summary object is calculated');
    assert(typeof res.summary.fairness === 'number' && !isNaN(res.summary.fairness), `Average fairness is a number: ${res.summary.fairness}`);
    assert(typeof res.summary.throughput === 'number' && !isNaN(res.summary.throughput), `Average throughput is a number: ${res.summary.throughput}`);
    assert(typeof res.summary.latency === 'number' && !isNaN(res.summary.latency), `Average latency is a number: ${res.summary.latency}`);
    assert(typeof res.summary.packetLoss === 'number' && !isNaN(res.summary.packetLoss), `Average packet loss is a number: ${res.summary.packetLoss}`);
    assert(typeof res.summary.reward === 'number' && !isNaN(res.summary.reward), `Average reward is a number: ${res.summary.reward}`);
  } catch (err) {
    assert(false, `Test 1 threw error: ${err.message}`);
  }
}

// ── Test 2: Verify A2C Evaluation ───────────────────────────────────────────
console.log('\n📊 Test 2: runA2CEvaluation() runs deterministic policy');
{
  try {
    const agent = new A2CAgent();
    const res = runA2CEvaluation(DEFAULT_TOPOLOGY, 'mixed', agent, 10);
    assert(res.steps.length === 10, 'A2C evaluation executes exact rounds (10)');
    assert(res.summary !== undefined, 'Summary object is calculated');
    assert(typeof res.summary.fairness === 'number' && !isNaN(res.summary.fairness), `Average fairness is a number: ${res.summary.fairness}`);
    assert(typeof res.summary.throughput === 'number' && !isNaN(res.summary.throughput), `Average throughput is a number: ${res.summary.throughput}`);
    assert(typeof res.summary.latency === 'number' && !isNaN(res.summary.latency), `Average latency is a number: ${res.summary.latency}`);
    assert(typeof res.summary.packetLoss === 'number' && !isNaN(res.summary.packetLoss), `Average packet loss is a number: ${res.summary.packetLoss}`);
    assert(typeof res.summary.reward === 'number' && !isNaN(res.summary.reward), `Average reward is a number: ${res.summary.reward}`);
  } catch (err) {
    assert(false, `Test 2 threw error: ${err.message}`);
  }
}

// ── Test 3: Verify Comparison ───────────────────────────────────────────────
console.log('\n📊 Test 3: compareResults() computes winners and improvement metrics');
{
  try {
    const a2c = new A2CAgent();
    const ddqn = new DDQNAgent();
    const a3c = new A3CAgent({ topology: DEFAULT_TOPOLOGY });
    const res = compareResults(DEFAULT_TOPOLOGY, a2c, ddqn, a3c, 'mixed', 10);
    
    assert(res.comparison !== undefined, 'Comparison scorecard generated');
    const comp = res.comparison;
    
    // Check fields presence
    const expectedMetrics = ['fairness', 'throughput', 'latency', 'packetLoss', 'reward'];
    expectedMetrics.forEach(m => {
      assert(comp[m] !== undefined, `Scorecard contains metric: ${m}`);
      assert(typeof comp[m].nash === 'number', `Nash value present for ${m}`);
      assert(typeof comp[m].a2c === 'number', `A2C value present for ${m}`);
      assert(typeof comp[m].ddqn === 'number', `DDQN value present for ${m}`);
      assert(typeof comp[m].a3c === 'number', `A3C value present for ${m}`);
      assert(typeof comp[m].a2cPctChange === 'number', `a2cPctChange calculated for ${m}`);
      assert(typeof comp[m].ddqnPctChange === 'number', `ddqnPctChange calculated for ${m}`);
      assert(typeof comp[m].a3cPctChange === 'number', `a3cPctChange calculated for ${m}`);
      assert(['Nash', 'A2C', 'DDQN', 'A3C'].includes(comp[m].winner), `Winner designated for ${m}: ${comp[m].winner}`);
    });
    
    // Double check formula
    const fairnessNash = comp.fairness.nash;
    const fairnessA2c = comp.fairness.a2c;
    const expectedPct = parseFloat((((fairnessA2c - fairnessNash) / (fairnessNash || 1)) * 100).toFixed(2));
    assert(Math.abs(comp.fairness.a2cPctChange - expectedPct) < 0.1, `Improvement % is mathematically correct (expected ${expectedPct}%, got ${comp.fairness.a2cPctChange}%)`);
  } catch (err) {
    assert(false, `Test 3 threw error: ${err.message}`);
  }
}

// ── Test 4: Validate all scenarios evaluate successfully ───────────────────
console.log('\n📊 Test 4: configureFlowsForScenario() configurations run cleanly');
{
  try {
    const a2c = new A2CAgent();
    const ddqn = new DDQNAgent();
    const a3c = new A3CAgent({ topology: DEFAULT_TOPOLOGY });
    const keys = Object.keys(EVAL_SCENARIOS);
    
    for (const key of keys) {
      const res = compareResults(DEFAULT_TOPOLOGY, a2c, ddqn, a3c, key, 5);
      assert(res !== null && res.comparison !== undefined, `Successfully executed comparison for scenario: ${key}`);
    }
  } catch (err) {
    assert(false, `Test 4 threw error: ${err.message}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed > 0 ? 1 : 0);
