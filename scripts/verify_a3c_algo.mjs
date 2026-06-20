// ============================================================
// Step 9 A3C Verification Script
// Run with: node scripts/verify_a3c_algo.mjs
// ============================================================

import { A3CAgent, A3CWorker } from '../src/rl/A3CAgent.js';
import { A2CAgent } from '../src/rl/A2CAgent.js';
import { DDQNAgent } from '../src/rl/DDQNAgent.js';
import { compareResults } from '../src/rl/evaluation.js';

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

// ── Test 1: Worker Spawning Check ───────────────────────────────────────────
console.log('\n🚀 Test 1: A3CAgent spawns and initializes workers');
{
  try {
    const agent = new A3CAgent({ topology: DEFAULT_TOPOLOGY });
    assert(agent.workers.length === 4, `Spawns 4 workers (got: ${agent.workers.length})`);
    
    const workerKeys = agent.workers.map(w => w.scenarioKey);
    assert(workerKeys.includes('conservative'), 'Worker 1 is conservative');
    assert(workerKeys.includes('adaptive'), 'Worker 2 is adaptive');
    assert(workerKeys.includes('burst'), 'Worker 3 is burst');
    assert(workerKeys.includes('mixed'), 'Worker 4 is mixed');
    
    agent.workers.forEach((w, idx) => {
      assert(w.env !== undefined, `Worker ${idx + 1} has environment initialized`);
      assert(w.state !== undefined && w.state.length === 6, `Worker ${idx + 1} state is valid size-6`);
    });
  } catch (err) {
    assert(false, `Test 1 threw error: ${err.message}`);
  }
}

// ── Test 2: Local Gradient Pushing ──────────────────────────────────────────
console.log('\n🚀 Test 2: Local worker gradients apply changes to global agent weights');
{
  try {
    const agent = new A3CAgent({ topology: DEFAULT_TOPOLOGY });
    const worker = agent.workers[0];
    
    // Snapshot old global weights
    const oldWeights = JSON.parse(JSON.stringify(agent.actorL1.getWeights()));
    
    // Step and train worker once
    worker.stepAndTrain(agent);
    
    // Verify global weights changed
    const newWeights = agent.actorL1.getWeights();
    let changed = false;
    for (let i = 0; i < oldWeights.weights.length; i++) {
      for (let j = 0; j < oldWeights.weights[i].length; j++) {
        if (oldWeights.weights[i][j] !== newWeights.weights[i][j]) {
          changed = true;
          break;
        }
      }
    }
    
    assert(changed === true, 'Global Actor L1 weights modified after worker updates');
  } catch (err) {
    assert(false, `Test 2 threw error: ${err.message}`);
  }
}

// ── Test 3: Global A3C converges over episodes ─────────────────────────────
console.log('\n🚀 Test 3: Global A3C trains and converges (rewards improve over episodes)');
{
  try {
    let success = false;
    let avgFirst10 = 0, avgLast10 = 0;

    for (let trial = 1; trial <= 3; trial++) {
      const agent = new A3CAgent({
        topology: DEFAULT_TOPOLOGY,
        lrActor: 0.02,
        lrCritic: 0.05,
        gamma: 0.9
      });
      
      const totalEpisodes = 50;
      
      // Since train() runs stepAndTrain on all 4 workers,
      // stepping A3CAgent.train() 100 times executes one full episode of 100 steps on each worker.
      // So we train for 50 episodes.
      for (let ep = 0; ep < totalEpisodes; ep++) {
        for (let step = 0; step < 100; step++) {
          agent.train();
        }
      }
      
      const first10 = agent.episodeRewards.slice(0, 10);
      const last10 = agent.episodeRewards.slice(40, 50);
      
      avgFirst10 = first10.reduce((a, b) => a + b, 0) / 10;
      avgLast10 = last10.reduce((a, b) => a + b, 0) / 10;
      
      if (avgLast10 > avgFirst10) {
        success = true;
        break;
      }
      console.log(`    [Trial ${trial}] A3C Avg 1-10: ${avgFirst10.toFixed(4)}, Avg 41-50: ${avgLast10.toFixed(4)} (No improvement, retrying...)`);
    }
    
    console.log(`    Final Avg A3C Reward (episodes 1-10):  ${avgFirst10.toFixed(4)}`);
    console.log(`    Final Avg A3C Reward (episodes 41-50): ${avgLast10.toFixed(4)}`);
    
    assert(success, `A3C Global agent improved rewards over training: ${avgLast10.toFixed(4)} > ${avgFirst10.toFixed(4)}`);
  } catch (err) {
    assert(false, `Test 3 threw error: ${err.message}`);
  }
}

// ── Test 4: Scorecard metrics validation ────────────────────────────────────
console.log('\n🚀 Test 4: compareResults() generates scorecard comparing A2C, DDQN, and A3C');
{
  try {
    const a2c = new A2CAgent();
    const ddqn = new DDQNAgent();
    const a3c = new A3CAgent({ topology: DEFAULT_TOPOLOGY });
    
    const res = compareResults(DEFAULT_TOPOLOGY, a2c, ddqn, a3c, 'mixed', 10);
    assert(res.comparison !== undefined, 'Scorecard generated');
    const comp = res.comparison;
    
    assert(comp.fairness.nash !== undefined, 'Fairness Nash present');
    assert(comp.fairness.a2c !== undefined, 'Fairness A2C present');
    assert(comp.fairness.ddqn !== undefined, 'Fairness DDQN present');
    assert(comp.fairness.a3c !== undefined, 'Fairness A3C present');
    assert(comp.fairness.a3cPctChange !== undefined, 'A3C improvement pct change calculated');
    assert(['Nash', 'A2C', 'DDQN', 'A3C'].includes(comp.fairness.winner), `Winner is Nash, A2C, DDQN, or A3C (got: ${comp.fairness.winner})`);
  } catch (err) {
    assert(false, `Test 4 threw error: ${err.message}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed > 0 ? 1 : 0);
