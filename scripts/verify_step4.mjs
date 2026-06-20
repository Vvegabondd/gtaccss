// ============================================================
// Step 4 Verification: Latency Modeling & Delay Propagation
// Run with: node scripts/verify_step4.mjs
// ============================================================

import {
  updateNodeQueues,
  BASE_NODE_LATENCY,
  LATENCY_PER_PACKET,
  DEFAULT_QUEUE_CAPACITY,
  DEFAULT_LINKS,
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

function makeFlow(id, path, rate) {
  return { id, path, rate };
}

// ── Test 1: Zero queue → latency = BASE_NODE_LATENCY ─────────────────────────
console.log('\n⏱  Test 1: Queue = 0 → latency equals BASE_NODE_LATENCY only');
{
  // Node A has drainRate = 180 Mbps; single 1 Mbps flow → queue stays 0
  const flows = [makeFlow('F1', ['A', 'B'], 1)];
  const result = updateNodeQueues(flows, DEFAULT_LINKS, {});
  const nodeA = result['A'];
  assert(nodeA !== undefined, 'Node A present');
  assert(nodeA.queueSize === 0, `queueSize = 0 (got ${nodeA.queueSize})`);
  assert(nodeA.queueDelay === 0, `queueDelay = 0 ms (got ${nodeA.queueDelay})`);
  assert(nodeA.latency === BASE_NODE_LATENCY,
    `latency = ${BASE_NODE_LATENCY} ms (BASE only, got ${nodeA.latency})`);
}

// ── Test 2: Increasing queue → latency increases linearly ─────────────────────
console.log('\n⏱  Test 2: Queue grows → latency increases linearly with queue size');
{
  const smallLinks = [{ from: 'X', to: 'Y', capacity: 5 }]; // drainRate = 5 Mbps
  // 55 Mbps → excess = 50 → queue fills each round
  const flows = [makeFlow('F1', ['X', 'Y'], 55)];
  let prevLatency = BASE_NODE_LATENCY;
  let queueStats = {};

  for (let round = 1; round <= 5; round++) {
    queueStats = updateNodeQueues(flows, smallLinks, queueStats);
    const node = queueStats['X'];
    const expectedLatency = parseFloat((BASE_NODE_LATENCY + node.queueSize * LATENCY_PER_PACKET).toFixed(2));
    console.log(`    Round ${round}: queueSize=${node.queueSize}, latency=${node.latency} ms (expected ${expectedLatency})`);
    assert(Math.abs(node.latency - expectedLatency) < 0.01,
      `latency = BASE + queueSize×${LATENCY_PER_PACKET} = ${expectedLatency} ms`);
    if (round > 1 && node.queueSize > 0) {
      assert(node.latency >= prevLatency,
        `latency (${node.latency}) ≥ previous round (${prevLatency}) — monotone growth`);
    }
    prevLatency = node.latency;
  }
}

// ── Test 3: Queue drains → latency decreases ──────────────────────────────────
console.log('\n⏱  Test 3: Queue drains → latency decreases toward BASE_NODE_LATENCY');
{
  const smallLinks = [{ from: 'P', to: 'Q', capacity: 10 }]; // drainRate = 10
  // Phase 1: Overload — fill the queue
  const heavyFlows = [makeFlow('F1', ['P', 'Q'], 100)];
  let queueStats = {};
  for (let i = 0; i < 3; i++) {
    queueStats = updateNodeQueues(heavyFlows, smallLinks, queueStats);
  }
  const latencyAfterOverload = queueStats['P'].latency;
  console.log(`    After overload: latency = ${latencyAfterOverload} ms`);

  // Phase 2: Relief — very low traffic; let queue drain
  const lightFlows = [makeFlow('F1', ['P', 'Q'], 1)];
  for (let i = 0; i < 5; i++) {
    queueStats = updateNodeQueues(lightFlows, smallLinks, queueStats);
    console.log(`    Drain round ${i+1}: queueSize=${queueStats['P'].queueSize}, latency=${queueStats['P'].latency} ms`);
  }
  const latencyAfterDrain = queueStats['P'].latency;
  assert(latencyAfterOverload > BASE_NODE_LATENCY,
    `latency was elevated during overload (${latencyAfterOverload} > ${BASE_NODE_LATENCY})`);
  assert(latencyAfterDrain < latencyAfterOverload,
    `latency after drain (${latencyAfterDrain}) < latency during overload (${latencyAfterOverload})`);
  assert(latencyAfterDrain >= BASE_NODE_LATENCY,
    `latency (${latencyAfterDrain}) never goes below BASE_NODE_LATENCY (${BASE_NODE_LATENCY})`);
}

// ── Test 4: Path latency = sum of node latencies along path ───────────────────
console.log('\n⏱  Test 4: Path latency = sum of each hop\'s node latency');
{
  // Use default links. Node A→B→D path.
  // With very low traffic: all queues 0, each node latency = BASE (5ms)
  // Path A→B→D = 3 nodes → pathLatency should be 15 ms
  const flows = [makeFlow('F1', ['A', 'B', 'D'], 1)];
  const result = updateNodeQueues(flows, DEFAULT_LINKS, {});
  const pathLatency = ['A', 'B', 'D'].reduce((sum, n) => sum + (result[n]?.latency || BASE_NODE_LATENCY), 0);
  const expectedPath = BASE_NODE_LATENCY * 3; // 15 ms
  console.log(`    Node latencies: A=${result['A']?.latency}, B=${result['B']?.latency}, D=${result['D']?.latency}`);
  console.log(`    Path latency: ${pathLatency} ms (expected ${expectedPath})`);
  assert(Math.abs(pathLatency - expectedPath) < 0.01,
    `pathLatency = ${pathLatency} ms for 3-hop path at zero load`);
}

// ── Test 5: Exported constants ─────────────────────────────────────────────────
console.log('\n⏱  Test 5: Exported constants exist and are physically reasonable');
{
  assert(typeof BASE_NODE_LATENCY === 'number' && BASE_NODE_LATENCY > 0,
    `BASE_NODE_LATENCY = ${BASE_NODE_LATENCY} ms (positive number)`);
  assert(typeof LATENCY_PER_PACKET === 'number' && LATENCY_PER_PACKET > 0,
    `LATENCY_PER_PACKET = ${LATENCY_PER_PACKET} ms/packet (positive number)`);
  // Sanity: full queue should give reasonable latency, not astronomical
  const fullQueueLatency = BASE_NODE_LATENCY + DEFAULT_QUEUE_CAPACITY * LATENCY_PER_PACKET;
  console.log(`    Full queue (${DEFAULT_QUEUE_CAPACITY} pkt) latency = ${fullQueueLatency} ms`);
  assert(fullQueueLatency < 500, `Full-queue latency (${fullQueueLatency} ms) is sane (< 500ms)`);
}

// ── Test 6: latency = BASE + queueDelay formula ──────────────────────────────
console.log('\n⏱  Test 6: latency = BASE_NODE_LATENCY + queueDelay for every node');
{
  const flows = [makeFlow('F1', ['A', 'B', 'D', 'E'], 200)];
  const result = updateNodeQueues(flows, DEFAULT_LINKS, {});
  Object.entries(result).forEach(([nodeId, q]) => {
    const expectedLatency = parseFloat((BASE_NODE_LATENCY + q.queueSize * LATENCY_PER_PACKET).toFixed(2));
    const expectedDelay = parseFloat((q.queueSize * LATENCY_PER_PACKET).toFixed(2));
    assert(Math.abs(q.latency - expectedLatency) < 0.01,
      `Node ${nodeId}: latency (${q.latency}) = BASE(${BASE_NODE_LATENCY}) + queueDelay(${q.queueDelay})`);
    assert(Math.abs(q.queueDelay - expectedDelay) < 0.01,
      `Node ${nodeId}: queueDelay (${q.queueDelay}) = queueSize(${q.queueSize}) × ${LATENCY_PER_PACKET}`);
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed > 0 ? 1 : 0);
