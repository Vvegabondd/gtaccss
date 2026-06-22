// ============================================================
// Step 5 RL Env Verification: GTACCSEnvironment validation
// Run with: node scripts/verify_rl_env.mjs
// ============================================================

import { GTACCSEnvironment, MAX_EPISODE_ROUNDS } from '../src/simulation/environment.js';

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

// ── Test 1: reset() returns a valid state vector ───────────────────────────
console.log('\n🤖 Test 1: reset() returns a valid state vector of size 6');
{
  const env = new GTACCSEnvironment();
  const state = env.reset();
  
  assert(Array.isArray(state), 'State is an array');
  assert(state.length === 6, `State size is 6 (got ${state.length})`);
  state.forEach((val, idx) => {
    assert(typeof val === 'number' && !isNaN(val), `State element at index ${idx} is a valid number (got ${val})`);
  });
}

// ── Test 2: step(action) returns correct structure ──────────────────────────
console.log('\n🤖 Test 2: step(action) returns { state, reward, done } correctly');
{
  const env = new GTACCSEnvironment();
  env.reset();
  
  const transition = env.step(1); // adaptive action
  
  assert(transition !== undefined, 'Transition object exists');
  assert(Array.isArray(transition.state) && transition.state.length === 6, 'transition.state is a size-6 vector');
  assert(typeof transition.reward === 'number' && !isNaN(transition.reward), `transition.reward is a valid number (got ${transition.reward})`);
  assert(typeof transition.done === 'boolean', `transition.done is a boolean (got ${transition.done})`);
  
  // Test episode completion
  let done = false;
  for (let r = 2; r <= MAX_EPISODE_ROUNDS; r++) {
    const stepRes = env.step(1);
    done = stepRes.done;
  }
  assert(done === true, `Episode is marked done at MAX_EPISODE_ROUNDS = ${MAX_EPISODE_ROUNDS} (got ${done})`);
  assert(env.environmentStats.currentRound === MAX_EPISODE_ROUNDS, `environmentStats.currentRound tracks rounds correctly (${env.environmentStats.currentRound})`);
}

// ── Test 3: different actions produce different future states ───────────────
console.log('\n🤖 Test 3: different actions (Conservative vs Aggressive) produce different future states');
{
  // Running two separate environment instances starting from same state
  const env1 = new GTACCSEnvironment();
  env1.reset();
  // Play 5 rounds of action 0 (Conservative)
  for (let i = 0; i < 5; i++) {
    env1.step(0);
  }
  const stateConservative = env1.getState();
  
  const env2 = new GTACCSEnvironment();
  env2.reset();
  // Play 5 rounds of action 2 (Aggressive)
  for (let i = 0; i < 5; i++) {
    env2.step(2);
  }
  const stateAggressive = env2.getState();
  
  console.log(`    Conservative final state:`, stateConservative);
  console.log(`    Aggressive final state:`, stateAggressive);
  
  // State elements: index 5 is total throughput. Conservative should have lower throughput than Aggressive.
  const diffThroughput = Math.abs(stateConservative[5] - stateAggressive[5]);
  assert(diffThroughput > 1.0, `Throughputs differ: Conservative=${stateConservative[5]}, Aggressive=${stateAggressive[5]}`);
}

// ── Test 4: higher congestion produces lower rewards ───────────────────────
console.log('\n🤖 Test 4: higher congestion/loss produces lower rewards');
{
  const env = new GTACCSEnvironment();
  env.reset();
  
  // Case A: normal operation with default links
  const resNormal = env.step(1);
  const rewardNormal = resNormal.reward;
  
  // Case B: high congestion (shrink link capacities to create bottleneck drops)
  const congestedLinks = env.initialLinks.map(l => ({ ...l, capacity: 5 })); // 5 Mbps capacity everywhere
  const envCongested = new GTACCSEnvironment(env.initialFlows, congestedLinks);
  envCongested.reset();
  const resCongested = envCongested.step(2); // Aggressive action under constrained link
  const rewardCongested = resCongested.reward;
  
  console.log(`    Normal Reward: ${rewardNormal.toFixed(4)}, Congested Reward: ${rewardCongested.toFixed(4)}`);
  assert(rewardCongested < rewardNormal, `Congested Reward (${rewardCongested.toFixed(4)}) is lower than Normal Reward (${rewardNormal.toFixed(4)})`);
}

// ── Test 5: higher fairness produces higher rewards ────────────────────────
console.log('\n🤖 Test 5: higher fairness produces higher rewards');
{
  // We can manually supply state metrics to getReward to test its output deterministically
  const env = new GTACCSEnvironment();
  
  // Case A: low fairness (0.4)
  const rewardLowFairness = env.getReward({
    fairness: 0.40,
    throughput: 40,
    avgPacketLoss: 0,
    avgLatency: 10
  });
  
  // Case B: high fairness (0.95)
  const rewardHighFairness = env.getReward({
    fairness: 0.95,
    throughput: 40,
    avgPacketLoss: 0,
    avgLatency: 10
  });
  
  console.log(`    Low Fairness Reward: ${rewardLowFairness.toFixed(4)}, High Fairness Reward: ${rewardHighFairness.toFixed(4)}`);
  assert(rewardHighFairness > rewardLowFairness, `High Fairness Reward (${rewardHighFairness.toFixed(4)}) is higher than Low Fairness Reward (${rewardLowFairness.toFixed(4)})`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed > 0 ? 1 : 0);
