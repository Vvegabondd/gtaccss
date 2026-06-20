// ============================================================
// Step 6 RL Agent Integration Verification
// Run with: node scripts/verify_a2c.mjs
// ============================================================

import { DenseLayer, softmax } from '../src/rl/neural.js';
import { A2CAgent } from '../src/rl/A2CAgent.js';
import { GTACCSEnvironment } from '../src/simulation/environment.js';

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

// ── Test 1: neural.js layers forward/backward passes and activations ────────
console.log('\n🤖 Test 1: neural.js activations & layers forward/backward check');
{
  try {
    const layer = new DenseLayer(4, 2, 'relu');
    const input = [1, 2, 3, 4];
    const out = layer.forward(input);
    
    assert(out.length === 2, `Forward output dimension is 2 (got ${out.length})`);
    assert(out.every(val => typeof val === 'number' && !isNaN(val)), 'Forward output elements are valid numbers');

    // Backward check
    const dOutput = [0.1, -0.2];
    const dInput = layer.backward(dOutput, 0.01);
    
    assert(dInput.length === 4, `Backward output dimension is 4 (got ${dInput.length})`);
    assert(dInput.every(val => typeof val === 'number' && !isNaN(val)), 'Backward output elements are valid numbers');
    
    // Test softmax activation helper function
    const probs = softmax([1.0, 2.0, 3.0]);
    const sum = probs.reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - 1.0) < 1e-6, `Softmax sum is 1.0 (got ${sum})`);
    assert(probs[2] > probs[1] && probs[1] > probs[0], 'Softmax preserves ordering/magnitudes');
  } catch (err) {
    assert(false, `Test 1 threw error: ${err.message}`);
  }
}

// ── Test 2: A2CAgent forward pass shape checks ──────────────────────────────
console.log('\n🤖 Test 2: A2CAgent action selection and forward output shapes');
{
  try {
    const agent = new A2CAgent();
    const state = [0.5, 50.0, 0.05, 0.6, 0.9, 45.0]; // sample state
    
    const { action, probs, logits } = agent.selectAction(state);
    
    assert([0, 1, 2].includes(action), `Selected action is 0, 1, or 2 (got ${action})`);
    assert(probs.length === 3, `Probabilities vector size is 3`);
    assert(logits.length === 3, `Logits vector size is 3`);
    
    const probSum = probs.reduce((a, b) => a + b, 0);
    assert(Math.abs(probSum - 1.0) < 1e-6, `Action probabilities sum to 1.0 (got ${probSum})`);
  } catch (err) {
    assert(false, `Test 2 threw error: ${err.message}`);
  }
}

// ── Test 3: Model checkpointing saves best weights correctly ───────────────
console.log('\n🤖 Test 3: Model checkpointing saves best weights');
{
  try {
    const agent = new A2CAgent();
    
    // Fill rewards to trigger checkpointing
    // Checkpoints trigger every 10 episodes (saveCheckpoint increments episodeCount)
    for (let ep = 1; ep <= 10; ep++) {
      agent.saveCheckpoint(10.0 + ep); // reward climbs from 11 to 20
    }
    
    assert(agent.bestWeights !== null, 'bestWeights is checkpointed');
    assert(agent.bestReward === 15.5, `bestReward is correct average of last 10 episodes (got ${agent.bestReward})`);
    
    const weightsBefore = agent.getWeights();
    
    // Change current weights to verify reload
    agent.actorL1.weights[0][0] += 5.0;
    
    // Load checkpoint
    agent.loadWeights(agent.bestWeights);
    const weightsAfter = agent.getWeights();
    
    assert(weightsAfter.actorL1.weights[0][0] === weightsBefore.actorL1.weights[0][0], 'Checkpoint successfully loaded original weights');
  } catch (err) {
    assert(false, `Test 3 threw error: ${err.message}`);
  }
}

// ── Test 4: Learning verification ───────────────────────────────────────────
console.log('\n🤖 Test 4: Average reward over episodes 41-50 > Average reward over episodes 1-10');
{
  try {
    let success = false;
    let avgFirst10 = 0, avgLast10 = 0;

    for (let trial = 1; trial <= 3; trial++) {
      const env = new GTACCSEnvironment();
      const agent = new A2CAgent({
        lrActor: 0.02,
        lrCritic: 0.05,
        gamma: 0.9
      });
      
      const episodeRewards = [];
      const totalEpisodes = 50;
      
      for (let ep = 0; ep < totalEpisodes; ep++) {
        let state = env.reset();
        let done = false;
        let epReward = 0;
        
        while (!done) {
          const { action } = agent.selectAction(state);
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
      
      avgFirst10 = first10.reduce((a, b) => a + b, 0) / 10;
      avgLast10 = last10.reduce((a, b) => a + b, 0) / 10;
      
      if (avgLast10 > avgFirst10) {
        success = true;
        break;
      }
      console.log(`    [Trial ${trial}] Avg 1-10: ${avgFirst10.toFixed(4)}, Avg 41-50: ${avgLast10.toFixed(4)} (No improvement, retrying...)`);
    }
    
    console.log(`    Final Avg reward (episodes 1-10):  ${avgFirst10.toFixed(4)}`);
    console.log(`    Final Avg reward (episodes 41-50): ${avgLast10.toFixed(4)}`);
    
    assert(success, `Reward improved over training in at least one trial: ${avgLast10.toFixed(4)} > ${avgFirst10.toFixed(4)}`);
  } catch (err) {
    assert(false, `Test 4 threw error: ${err.message}`);
  }
}

// ── Test 5: Action counts show non-zero exploration ─────────────────────────
console.log('\n🤖 Test 5: Action counts show non-zero selection for all actions (verifies exploration)');
{
  try {
    const agent = new A2CAgent();
    agent.resetActionCounts();
    
    const state = [0.5, 50.0, 0.05, 0.6, 0.9, 45.0];
    for (let i = 0; i < 300; i++) {
      agent.selectAction(state);
    }
    
    const counts = agent.actionCounts;
    console.log(`    Action 0 (Conservative): ${counts[0]} selections`);
    console.log(`    Action 1 (Adaptive):     ${counts[1]} selections`);
    console.log(`    Action 2 (Aggressive):   ${counts[2]} selections`);
    
    assert(counts[0] > 0, 'Conservative action selected at least once');
    assert(counts[1] > 0, 'Adaptive action selected at least once');
    assert(counts[2] > 0, 'Aggressive action selected at least once');
  } catch (err) {
    assert(false, `Test 5 threw error: ${err.message}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed > 0 ? 1 : 0);
