// ============================================================
// Step 3 Verification: Queue Simulation & Buffer Modeling
// Run with: node scripts/verify_step3.mjs
// ============================================================

import {
  updateNodeQueues,
  QUEUE_SCALE_FACTOR,
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeFlow(id, path, rate) {
  return { id, path, rate };
}

// ── Test 1: Incoming < drainRate → queue stays at zero, no drops ─────────────
console.log('\n📦 Test 1: Low traffic — queue stays near zero, no drops');
{
  // Node A has drainRate = A→B(100) + A→C(80) = 180 Mbps
  // Flow rate through A = 40 Mbps  → well within capacity
  const flows = [makeFlow('F1', ['A', 'B', 'D'], 40)];
  const result = updateNodeQueues(flows, DEFAULT_LINKS, {});
  const nodeA = result['A'];
  assert(nodeA !== undefined, 'Node A present in result');
  assert(nodeA.incomingTraffic === 40, `incomingTraffic = 40 (got ${nodeA.incomingTraffic})`);
  assert(nodeA.drainRate >= 40, `drainRate (${nodeA.drainRate}) ≥ incoming traffic`);
  assert(nodeA.queueSize === 0, `queueSize = 0 (got ${nodeA.queueSize})`);
  assert(nodeA.droppedThisRound === 0, `no drops this round (got ${nodeA.droppedThisRound})`);
  assert(nodeA.queueUtilization === 0, `queueUtilization = 0 (got ${nodeA.queueUtilization})`);
}

// ── Test 2: Incoming > drainRate → queue grows ───────────────────────────────
console.log('\n📦 Test 2: Sustained overload — queue grows across rounds');
{
  // Force a node with low drain rate via a tiny custom topology
  const smallLinks = [{ from: 'X', to: 'Y', capacity: 10 }]; // drainRate for X = 10
  // Three flows through X, each 20 Mbps = 60 Mbps total; excess = 50 Mbps
  const flows = [
    makeFlow('F1', ['X', 'Y'], 20),
    makeFlow('F2', ['X', 'Y'], 20),
    makeFlow('F3', ['X', 'Y'], 20),
  ];

  let queueStats = {};
  let finalNode;

  for (let round = 1; round <= 5; round++) {
    queueStats = updateNodeQueues(flows, smallLinks, queueStats);
    finalNode = queueStats['X'];
    console.log(`    Round ${round}: queueSize=${finalNode.queueSize}, dropped=${finalNode.droppedThisRound}`);
  }

  assert(finalNode.incomingTraffic === 60, `incomingTraffic = 60 (got ${finalNode.incomingTraffic})`);
  assert(finalNode.drainRate === 10, `drainRate = 10 (got ${finalNode.drainRate})`);
  const excess = 60 - 10; // = 50
  const expectedQueuedPackets = excess * QUEUE_SCALE_FACTOR; // = 100
  assert(expectedQueuedPackets === 100, `QUEUE_SCALE_FACTOR=${QUEUE_SCALE_FACTOR}, expected queuedPackets/round = ${expectedQueuedPackets}`);
  assert(finalNode.queueSize > 0 || finalNode.droppedPackets > 0, 'Queue grew or drops occurred under sustained overload');
}

// ── Test 3: Queue fills to capacity → drops occur ───────────────────────────
console.log('\n📦 Test 3: Buffer overflow — drops accumulate as queue fills');
{
  const smallLinks = [{ from: 'Z', to: 'W', capacity: 1 }]; // drainRate for Z = 1 Mbps
  // Very high traffic: 500 Mbps → excess = 499 → queuedPackets = 998/round
  const flows = [makeFlow('F1', ['Z', 'W'], 500)];

  let queueStats = {};
  let firstDropRound = null;

  for (let round = 1; round <= 10; round++) {
    queueStats = updateNodeQueues(flows, smallLinks, queueStats);
    const nodeZ = queueStats['Z'];
    if (nodeZ.droppedThisRound > 0 && firstDropRound === null) {
      firstDropRound = round;
    }
    console.log(`    Round ${round}: queueSize=${nodeZ.queueSize}/${DEFAULT_QUEUE_CAPACITY}, droppedThisRound=${nodeZ.droppedThisRound}, cumulativeDropped=${nodeZ.droppedPackets}`);
  }

  const finalNodeZ = queueStats['Z'];
  assert(finalNodeZ.queueSize <= DEFAULT_QUEUE_CAPACITY, `queueSize (${finalNodeZ.queueSize}) never exceeds capacity (${DEFAULT_QUEUE_CAPACITY})`);
  assert(finalNodeZ.droppedPackets > 0, `cumulative dropped > 0 (got ${finalNodeZ.droppedPackets})`);
  assert(firstDropRound !== null, `drops started at round ${firstDropRound}`);
  assert(firstDropRound <= 2, `buffer fills and overflows within first 2 rounds (dropped at round ${firstDropRound})`);
}

// ── Test 4: Exported constants ───────────────────────────────────────────────
console.log('\n📦 Test 4: Exported constants are correct types and values');
{
  assert(typeof QUEUE_SCALE_FACTOR === 'number', `QUEUE_SCALE_FACTOR is a number (${QUEUE_SCALE_FACTOR})`);
  assert(typeof DEFAULT_QUEUE_CAPACITY === 'number', `DEFAULT_QUEUE_CAPACITY is a number (${DEFAULT_QUEUE_CAPACITY})`);
  assert(QUEUE_SCALE_FACTOR > 0, `QUEUE_SCALE_FACTOR > 0`);
  assert(DEFAULT_QUEUE_CAPACITY > 0, `DEFAULT_QUEUE_CAPACITY > 0`);
}

// ── Test 5: drainRate = sum(outgoing capacities) ─────────────────────────────
console.log('\n📦 Test 5: drainRate = sum(outgoing capacities) not just max');
{
  // Node D has: D→E(50). sum=50
  // Node F has: F→G(90) + F→H(80) = 170 (not just 90)
  const flows = [
    makeFlow('F1', ['A', 'B', 'D', 'E', 'F', 'G'], 1),
    makeFlow('F2', ['A', 'C', 'D', 'E', 'F', 'H'], 1),
  ];
  const result = updateNodeQueues(flows, DEFAULT_LINKS, {});
  const nodeF = result['F'];
  const nodeD = result['D'];
  assert(nodeF !== undefined, 'Node F present');
  assert(nodeD !== undefined, 'Node D present');
  // F→G = 90, F→H = 80 → drainRate should be 170
  assert(nodeF.drainRate === 170, `Node F drainRate = 170 (sum of outgoing, got ${nodeF.drainRate})`);
  // D→E = 50 → drainRate = 50
  assert(nodeD.drainRate === 50, `Node D drainRate = 50 (got ${nodeD.drainRate})`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log(`${'─'.repeat(60)}\n`);
process.exit(failed > 0 ? 1 : 0);
