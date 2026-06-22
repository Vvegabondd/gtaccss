// ============================================================
// Step 5 Verification: Packet Loss Rate & Reliability Modeling
// Run with: node scripts/verify_step5.mjs
// ============================================================

import {
  gaussianRandom,
  getOfferedRate,
  TRAFFIC_PROFILES,
  updateNodeQueues,
  simulationStep,
  QUEUE_SCALE_FACTOR,
  DEFAULT_QUEUE_CAPACITY,
} from '../src/simulation/engine.js';

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

// ── Test 1: Gaussian Random Noise Distribution ─────────────────────────────
console.log('\n📊 Test 1: Gaussian Random Noise Distribution (Box-Muller)');
{
  const samples = [];
  const targetMean = 0;
  const targetStddev = 10;
  
  for (let i = 0; i < 5000; i++) {
    samples.push(gaussianRandom(targetMean, targetStddev));
  }
  
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  const variance = samples.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / samples.length;
  const stddev = Math.sqrt(variance);
  
  console.log(`    Generated 5000 samples: mean=${mean.toFixed(2)} (expected ~0), stddev=${stddev.toFixed(2)} (expected ~10)`);
  assert(Math.abs(mean) < 1.0, `Mean is close to 0 (got ${mean.toFixed(2)})`);
  assert(Math.abs(stddev - 10) < 1.5, `Standard deviation is close to 10 (got ${stddev.toFixed(2)})`);
}

// ── Test 2: Burst Scaling Independence ──────────────────────────────────────
console.log('\n📊 Test 2: Burst scales only baseRate, independent of variance');
{
  // Modify the traffic profiles temporarily to have controlled parameters
  const oldConservative = TRAFFIC_PROFILES.conservative;
  TRAFFIC_PROFILES.conservative = {
    variance: 0.1,             // extremely low variance to make base rate constant
    burstProbability: 1.0,     // always burst
    burstMultiplier: 2.0,      // double the base
  };
  
  const offered = getOfferedRate('conservative', 100);
  console.log(`    Offered rate with 100 baseRate: ${offered.toFixed(2)} Mbps (expected ~200)`);
  assert(Math.abs(offered - 200) < 2.0, `Burst scales baseRate directly (got ${offered.toFixed(2)} Mbps)`);
  
  // Restore
  TRAFFIC_PROFILES.conservative = oldConservative;
}

// ── Test 3: Gaming Profile Burst Parameters ────────────────────────────────
console.log('\n📊 Test 3: Gaming profile contains non-zero burst properties');
{
  const gaming = TRAFFIC_PROFILES.gaming;
  assert(gaming.burstProbability === 0.20, `gaming burstProbability is 0.20 (got ${gaming.burstProbability})`);
  assert(gaming.burstMultiplier === 1.4, `gaming burstMultiplier is 1.4 (got ${gaming.burstMultiplier})`);
}

// ── Test 4: Proportional Flow-Level Loss Sharing ────────────────────────────
console.log('\n📊 Test 4: Proportional flow-level packet loss share');
{
  const links = [{ from: 'X', to: 'Y', capacity: 100 }];
  const flows = [
    { id: 'F1', path: ['X', 'Y'], rate: 90, strategy: 'conservative', trafficProfile: 'conservative' },
    { id: 'F2', path: ['X', 'Y'], rate: 60, strategy: 'conservative', trafficProfile: 'conservative' }
  ];
  
  // Total demand = 150 Mbps, capacity = 100 Mbps.
  // Link loss = (150 - 100) / 150 = 33.33% (0.3333)
  // F1 (90 Mbps, 60% share) loss rate = 33.33% * 0.60 = 20.00% (0.2000)
  // F2 (60 Mbps, 40% share) loss rate = 33.33% * 0.40 = 13.33% (0.1333)
  
  // Override traffic profile to make offered rates exact
  const oldConservative = TRAFFIC_PROFILES.conservative;
  TRAFFIC_PROFILES.conservative = {
    variance: 0,
    burstProbability: 0,
    burstMultiplier: 1.0,
  };
  
  // We mock simulationStep by passing these rates
  const payoffHistories = [[], []];
  const result = simulationStep(flows, payoffHistories, links);
  
  // Restore
  TRAFFIC_PROFILES.conservative = oldConservative;
  
  const f1 = result.flowsWithPayoff.find(f => f.id === 'F1');
  const f2 = result.flowsWithPayoff.find(f => f.id === 'F2');
  
  console.log(`    Link loss: 33.33%`);
  console.log(`    Flow 1 Loss Rate: ${(f1.lossRate * 100).toFixed(2)}% (expected 20.00%)`);
  console.log(`    Flow 2 Loss Rate: ${(f2.lossRate * 100).toFixed(2)}% (expected 13.33%)`);
  
  assert(Math.abs(f1.lossRate - 0.20) < 0.01, `Flow 1 experienced 20.0% loss rate (got ${(f1.lossRate * 100).toFixed(1)}%)`);
  assert(Math.abs(f2.lossRate - 0.1333) < 0.01, `Flow 2 experienced 13.3% loss rate (got ${(f2.lossRate * 100).toFixed(1)}%)`);
}

// ── Test 5: Node-Level Cumulative Packet Loss Rate ─────────────────────────
console.log('\n📊 Test 5: Node-level cumulative packet loss rate');
{
  const links = [{ from: 'Z', to: 'W', capacity: 10 }]; // drainRate = 10
  const flows = [{ id: 'F1', path: ['Z', 'W'], rate: 60 }]; // excess = 50 Mbps
  
  // Round 1
  let queueStats = updateNodeQueues(flows, links, {});
  let nodeZ = queueStats['Z'];
  const expectedIncomingPackets1 = 60 * QUEUE_SCALE_FACTOR; // 120
  
  // Round 2
  queueStats = updateNodeQueues(flows, links, queueStats);
  nodeZ = queueStats['Z'];
  const expectedIncomingPackets2 = expectedIncomingPackets1 + 60 * QUEUE_SCALE_FACTOR; // 240
  const expectedLossRate = nodeZ.droppedPackets / nodeZ.totalIncomingPackets;
  
  console.log(`    Node Z: totalIncomingPackets=${nodeZ.totalIncomingPackets}, droppedPackets=${nodeZ.droppedPackets}`);
  console.log(`    Computed packetLossRate=${(nodeZ.packetLossRate * 100).toFixed(2)}%`);
  
  assert(nodeZ.totalIncomingPackets === expectedIncomingPackets2, `totalIncomingPackets accumulated correctly (${nodeZ.totalIncomingPackets})`);
  assert(Math.abs(nodeZ.packetLossRate - expectedLossRate) < 0.0001, `packetLossRate equals droppedPackets / totalIncomingPackets`);
  assert(nodeZ.packetLossRate > 0, `Node packet loss rate is non-zero under congestion`);
}

// ── Test 6: Network-Level Reliability Statistics ───────────────────────────
console.log('\n📊 Test 6: Network reliability is computed correctly');
{
  const links = [{ from: 'P', to: 'Q', capacity: 10 }];
  const flows = [{ id: 'F1', path: ['P', 'Q'], rate: 110, strategy: 'conservative', trafficProfile: 'conservative' }];
  
  let result = simulationStep(flows, [[]], links);
  // Run another step to accumulate history
  result = simulationStep(result.flows, result.newHistories, links, 0.3, 2.0, result.equilibriumHistory, result.equilibriumStats, result.nodeQueueStats);
  
  const reliability = result.networkQueueStats.networkReliability;
  const totalDropped = result.networkQueueStats.totalDroppedPacketsCumulative;
  const totalIncoming = result.networkQueueStats.totalIncomingPacketsCumulative;
  const expectedReliability = totalIncoming > 0 ? (1 - totalDropped / totalIncoming) * 100 : 100;
  
  console.log(`    Network Queue Stats: totalDropped=${totalDropped}, totalIncoming=${totalIncoming}`);
  console.log(`    Network Reliability: ${reliability.toFixed(2)}% (expected ${expectedReliability.toFixed(2)}%)`);
  
  assert(Math.abs(reliability - expectedReliability) < 0.01, `networkReliability matches overall packet survival calculation`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed > 0 ? 1 : 0);
