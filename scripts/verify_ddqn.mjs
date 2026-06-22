// ============================================================
// Step 8 DDQN Verification Script
// Run with: node scripts/verify_ddqn.mjs
// ============================================================

import { ReplayBuffer } from '../src/rl/ReplayBuffer.js';
import { DDQNAgent } from '../src/rl/DDQNAgent.js';
import { A2CAgent } from '../src/rl/A2CAgent.js';
import { A3CAgent } from '../src/rl/A3CAgent.js';
import { GTACCSEnvironment } from '../src/simulation/environment.js';
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

// ── Test 1: Replay Buffer Functionality ─────────────────────────────────────
console.log('\n🎮 Test 1: ReplayBuffer add, sample, and evict check');
{
  try {
    const buffer = new ReplayBuffer(5);
    for (let i = 1; i <= 6; i++) {
      buffer.add({ state: [i], action: i, reward: i, nextState: [i + 1], done: false });
    }
    
    assert(buffer.size() === 5, `evicts oldest transition (size is ${buffer.size()})`);
    
    const samples = buffer.sample(3);
    assert(samples.length === 3, `samples correct size (3)`);
    assert(samples.every(s => s.action >= 2), 'evicted first transition (action 1 should not be in sampled data)');
  } catch (err) {
    assert(false, `Test 1 threw error: ${err.message}`);
  }
}

// ── Test 2: Target Network Synchronization ──────────────────────────────────
console.log('\n🎮 Test 2: DDQNAgent target network weight synchronization');
{
  try {
    const agent = new DDQNAgent();
    
    // Modify online weights
    agent.onlineL1.weights[0][0] += 10.0;
    
    // Check if target differs
    assert(agent.targetL1.weights[0][0] !== agent.onlineL1.weights[0][0], 'Target weights differ after online modification');
    
    // Sync
    agent.syncTargetWeights();
    assert(agent.targetL1.weights[0][0] === agent.onlineL1.weights[0][0], 'Target weights synchronized successfully');
  } catch (err) {
    assert(false, `Test 2 threw error: ${err.message}`);
  }
}

// ── Test 3: DDQN Agent trains successfully on the environment ────────────────
console.log('\n🎮 Test 3: DDQNAgent trains successfully (rewards improve over 50 episodes)');
{
  try {
    const env = new GTACCSEnvironment();
    const agent = new DDQNAgent({
      lr: 0.02,
      gamma: 0.9,
      batchSize: 8,
      epsilon: 0.9,
      epsilonDecay: 0.95
    });

    const episodeRewards = [];
    const totalEpisodes = 50;

    for (let ep = 0; ep < totalEpisodes; ep++) {
      let state = env.reset();
      let done = false;
      let epReward = 0;

      while (!done) {
        // Select action (evalMode = false during training)
        const { action } = agent.selectAction(state, false);
        const { state: nextState, reward, done: isDone } = env.step(action);

        agent.train(state, action, reward, nextState, isDone);

        state = nextState;
        done = isDone;
        epReward += reward;
      }

      agent.saveCheckpoint(epReward);
      episodeRewards.push(epReward);
    }

    const first10 = episodeRewards.slice(0, 10);
    const last10 = episodeRewards.slice(40, 50);

    const avgFirst10 = first10.reduce((a, b) => a + b, 0) / 10;
    const avgLast10 = last10.reduce((a, b) => a + b, 0) / 10;

    console.log(`    Avg reward (episodes 1-10):  ${avgFirst10.toFixed(4)}`);
    console.log(`    Avg reward (episodes 41-50): ${avgLast10.toFixed(4)}`);

    assert(avgLast10 > avgFirst10, `Reward improved over training: ${avgLast10.toFixed(4)} > ${avgFirst10.toFixed(4)}`);
  } catch (err) {
    assert(false, `Test 3 threw error: ${err.message}`);
  }
}

// ── Test 4: DDQN Policy Differs from A2C ────────────────────────────────────
console.log('\n🎮 Test 4: DDQNAgent selects different actions than A2CAgent');
{
  try {
    const a2cAgent = new A2CAgent();
    const ddqnAgent = new DDQNAgent();
    const state = [0.5, 45.0, 0.02, 0.6, 0.9, 50.0];

    const a2cActions = [];
    const ddqnActions = [];

    for (let i = 0; i < 50; i++) {
      // Act deterministically (eval mode)
      const a2cAct = a2cAgent.selectAction(state).action;
      const ddqnAct = ddqnAgent.selectAction(state, true).action;
      a2cActions.push(a2cAct);
      ddqnActions.push(ddqnAct);
    }

    // Check if they are not identical sequences (they are random weights, so they should act differently)
    let differs = false;
    for (let i = 0; i < 50; i++) {
      if (a2cActions[i] !== ddqnActions[i]) {
        differs = true;
        break;
      }
    }
    assert(differs === true, 'A2C and DDQN generate distinct action selections due to different initialization/structures');
  } catch (err) {
    assert(false, `Test 4 threw error: ${err.message}`);
  }
}

// ── Test 5: Evaluation Dashboard integration ─────────────────────────────────
console.log('\n🎮 Test 5: compareResults() scorecard returns Nash, A2C, DDQN, and A3C comparisons');
{
  try {
    const a2c = new A2CAgent();
    const ddqn = new DDQNAgent();
    const a3c = new A3CAgent({ topology: DEFAULT_TOPOLOGY });

    const res = compareResults(DEFAULT_TOPOLOGY, a2c, ddqn, a3c, 'mixed', 10);
    assert(res.comparison !== undefined, 'Comparison scorecard generated');
    const comp = res.comparison;

    assert(comp.fairness.nash !== undefined, 'Fairness Nash metric present');
    assert(comp.fairness.a2c !== undefined, 'Fairness A2C metric present');
    assert(comp.fairness.ddqn !== undefined, 'Fairness DDQN metric present');
    assert(comp.fairness.a3c !== undefined, 'Fairness A3C metric present');
    assert(comp.fairness.ddqnPctChange !== undefined, 'Fairness DDQN pct change calculated');
    assert(['Nash', 'A2C', 'DDQN', 'A3C'].includes(comp.fairness.winner), `Winner is Nash, A2C, DDQN, or A3C (got: ${comp.fairness.winner})`);
  } catch (err) {
    assert(false, `Test 5 threw error: ${err.message}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed > 0 ? 1 : 0);
