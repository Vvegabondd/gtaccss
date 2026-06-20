import { initSimulation, simulationStep } from '../src/simulation/engine.js';

async function runVerification() {
  console.log('--- Starting Step 2 Verification ---');

  // Test 1: Single flow of 40 Mbps on a 100 Mbps link
  console.log('\n[Test 1] Single flow of 40 Mbps on a 100 Mbps link...');
  const test1Flows = [
    { id: 'F1', path: ['A', 'B'], strategy: 'conservative', trafficProfile: 'conservative', rate: 40, baseRate: 40 }
  ];
  const test1Links = [
    { from: 'A', to: 'B', capacity: 100 }
  ];
  
  const { flows: f1, payoffHistories: h1 } = initSimulation(test1Flows);
  const res1 = simulationStep(f1, h1, test1Links);
  const link1 = res1.links[0];
  
  console.log(`Link: ${link1.from} -> ${link1.to}`);
  console.log(`Load: ${link1.stats.currentLoad} Mbps (Expected: ~40)`);
  console.log(`Utilization: ${(link1.stats.utilization * 100).toFixed(1)}% (Expected: ~40%)`);
  console.log(`Congested: ${link1.stats.congested} (Expected: false)`);
  
  // Account for Conservative profile variance (+/- 2 Mbps)
  if (Math.abs(link1.stats.utilization - 0.4) > 0.05) {
    throw new Error(`Test 1 failed: utilization ${link1.stats.utilization} is out of expected range!`);
  }
  if (link1.stats.congested !== false) {
    throw new Error('Test 1 failed: link marked congested!');
  }
  console.log('✓ Test 1 Passed!');

  // Test 2: Two flows of 80 Mbps and 70 Mbps on a 50 Mbps link
  console.log('\n[Test 2] Two aggressive flows (80 Mbps and 70 Mbps) on a 50 Mbps link...');
  const test2Flows = [
    { id: 'F1', path: ['A', 'B'], strategy: 'aggressive', trafficProfile: 'conservative', rate: 80, baseRate: 80 },
    { id: 'F2', path: ['A', 'B'], strategy: 'aggressive', trafficProfile: 'conservative', rate: 70, baseRate: 70 }
  ];
  const test2Links = [
    { from: 'A', to: 'B', capacity: 50 }
  ];
  
  const { flows: f2, payoffHistories: h2 } = initSimulation(test2Flows);
  const res2 = simulationStep(f2, h2, test2Links);
  const link2 = res2.links[0];
  
  console.log(`Link: ${link2.from} -> ${link2.to}`);
  console.log(`Load: ${link2.stats.currentLoad} Mbps (Expected: ~150)`);
  console.log(`Utilization: ${(link2.stats.utilization * 100).toFixed(1)}% (Expected: ~300%)`);
  console.log(`Congested: ${link2.stats.congested} (Expected: true)`);

  // Account for Conservative profile variance (+/- 4 Mbps total)
  if (Math.abs(link2.stats.utilization - 3.0) > 0.1) {
    throw new Error(`Test 2 failed: utilization ${link2.stats.utilization} is out of expected range!`);
  }
  if (link2.stats.congested !== true) {
    throw new Error('Test 2 failed: link not marked congested!');
  }
  console.log('✓ Test 2 Passed!');
  
  console.log('\n--- All Verification Tests Passed Successfully! ---');
}

runVerification().catch(e => {
  console.error('Verification failed:', e);
  process.exit(1);
});
