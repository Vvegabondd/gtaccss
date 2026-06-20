import { initSimulation, simulationStep, EQUILIBRIUM_WINDOW } from '../src/simulation/engine.js';

function runTests() {
  console.log('=== Starting Step 2.5 Verification ===');

  // Test 1: Rolling metrics collection and history growth
  console.log('\n[Test 1] Verifying history growth and metrics...');
  const testFlows = [
    { id: 'F1', path: ['A', 'B'], strategy: 'conservative', trafficProfile: 'conservative', rate: 20, baseRate: 20 }
  ];
  const testLinks = [
    { from: 'A', to: 'B', capacity: 100 }
  ];

  let { flows, payoffHistories } = initSimulation(testFlows);
  let eqHistory = [];
  let eqStats = null;

  for (let r = 1; r <= 5; r++) {
    const result = simulationStep(flows, payoffHistories, testLinks, 0.3, 2.0, eqHistory, eqStats);
    flows = result.flows;
    payoffHistories = result.newHistories;
    eqHistory = result.equilibriumHistory;
    eqStats = result.equilibriumStats;
  }

  console.log(`History length after 5 rounds: ${eqHistory.length} (Expected: 5)`);
  if (eqHistory.length !== 5) {
    throw new Error('Test 1 failed: history did not grow correctly!');
  }

  const firstEntry = eqHistory[0];
  console.log('First round entry keys:', Object.keys(firstEntry).join(', '));
  const expectedKeys = ['round', 'avgFairness', 'avgPayoff', 'avgUtilization', 'avgThroughput', 'payoffStdDev'];
  for (const k of expectedKeys) {
    if (firstEntry[k] === undefined) {
      throw new Error(`Test 1 failed: missing key ${k} in history entry!`);
    }
  }
  console.log('✓ Test 1 Passed!');

  // Test 2: Confidence decay over rounds
  console.log('\n[Test 2] Verifying confidence decay behavior...');
  // Reset simulation and run for 20 rounds to establish stable equilibrium
  ({ flows, payoffHistories } = initSimulation(testFlows));
  eqHistory = [];
  eqStats = null;

  // Run up to round 20
  for (let r = 1; r <= 20; r++) {
    const result = simulationStep(flows, payoffHistories, testLinks, 0.3, 2.0, eqHistory, eqStats);
    flows = result.flows;
    payoffHistories = result.newHistories;
    eqHistory = result.equilibriumHistory;
    eqStats = result.equilibriumStats;
  }

  console.log(`Round 20 - Equilibrium: ${eqStats.equilibrium}, Confidence: ${eqStats.confidence}%, Stability: ${eqStats.stabilityScore}%`);
  if (!eqStats.equilibrium || eqStats.confidence !== 100) {
    throw new Error('Test 2 failed: Equilibrium not reached at round 20!');
  }

  // Round 25 (5 rounds post-update) -> confidence should be 75%
  for (let r = 21; r <= 25; r++) {
    const result = simulationStep(flows, payoffHistories, testLinks, 0.3, 2.0, eqHistory, eqStats);
    flows = result.flows;
    payoffHistories = result.newHistories;
    eqHistory = result.equilibriumHistory;
    eqStats = result.equilibriumStats;
  }
  console.log(`Round 25 - Equilibrium: ${eqStats.equilibrium}, Confidence: ${eqStats.confidence}% (Expected: 75%)`);
  if (eqStats.confidence !== 75 || !eqStats.equilibrium) {
    throw new Error('Test 2 failed: confidence did not decay correctly to 75%!');
  }

  // Round 35 (15 rounds post-update) -> confidence = 25% < 30% -> equilibrium should drop to false
  for (let r = 26; r <= 35; r++) {
    const result = simulationStep(flows, payoffHistories, testLinks, 0.3, 2.0, eqHistory, eqStats);
    flows = result.flows;
    payoffHistories = result.newHistories;
    eqHistory = result.equilibriumHistory;
    eqStats = result.equilibriumStats;
  }
  console.log(`Round 35 - Equilibrium: ${eqStats.equilibrium} (Expected: false), Confidence: ${eqStats.confidence}% (Expected: 25%)`);
  if (eqStats.equilibrium !== false || eqStats.confidence !== 25) {
    throw new Error('Test 2 failed: equilibrium did not drop to false when confidence < 30%!');
  }
  console.log('✓ Test 2 Passed!');

  // Test 3: Sudden anomaly detection breaks equilibrium immediately
  console.log('\n[Test 3] Verifying immediate anomaly breaker...');
  // Reset and run to round 20 to establish stable equilibrium
  ({ flows, payoffHistories } = initSimulation(testFlows));
  eqHistory = [];
  eqStats = null;

  for (let r = 1; r <= 20; r++) {
    const result = simulationStep(flows, payoffHistories, testLinks, 0.3, 2.0, eqHistory, eqStats);
    flows = result.flows;
    payoffHistories = result.newHistories;
    eqHistory = result.equilibriumHistory;
    eqStats = result.equilibriumStats;
  }
  
  if (!eqStats.equilibrium) {
    throw new Error('Test 3 preconditions failed: no stable equilibrium!');
  }

  // At Round 21, introduce a massive utilization spike (reduce link capacity to 5 Mbps)
  console.log('Simulating spike anomaly by squeezing link capacity...');
  const bottleneckLink = [{ from: 'A', to: 'B', capacity: 5 }];
  const resultAnom = simulationStep(flows, payoffHistories, bottleneckLink, 0.3, 2.0, eqHistory, eqStats);
  
  console.log(`Round 21 (Spiked) - Equilibrium: ${resultAnom.equilibriumStats.equilibrium} (Expected: false), Confidence: ${resultAnom.equilibriumStats.confidence}% (Expected: 0%)`);
  if (resultAnom.equilibriumStats.equilibrium !== false || resultAnom.equilibriumStats.confidence !== 0) {
    throw new Error('Test 3 failed: anomaly was not detected immediately!');
  }
  console.log('✓ Test 3 Passed!');

  console.log('\n=== All Step 2.5 Tests Passed Successfully! ===');
}

try {
  runTests();
} catch (e) {
  console.error('Verification script failed:', e);
  process.exit(1);
}
