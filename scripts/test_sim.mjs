import { initSimulation, simulationStep, LINKS } from '../src/simulation/engine.js';

async function runTest({ rounds = 200, alpha = 0.3, beta = 2.0 } = {}) {
  const { flows, payoffHistories } = initSimulation();
  let currentFlows = flows;
  let histories = payoffHistories;
  let eqRound = null;

  for (let r = 1; r <= rounds; r++) {
    const res = simulationStep(currentFlows, histories, LINKS, alpha, beta);
    currentFlows = res.flows;
    histories = res.newHistories;
    if (res.equilibrium && eqRound === null) {
      eqRound = r;
      console.log(`Equilibrium detected at round ${r}`);
      break;
    }
    if (r % 10 === 0) {
      // print brief status
      const payoffs = histories.map(h => ({ min: Math.min(...h.slice(-10)), max: Math.max(...h.slice(-10)) }));
      console.log(`Round ${r}: totalTP=${res.totalThroughput.toFixed(2)}, fairness=${res.fairness.toFixed(3)}, congested=${res.congestedNodes.size}`);
      console.log('Recent payoff ranges:', payoffs.map((p,i)=>`F${i+1}:${(p.max-p.min).toFixed(2)}`).join(' | '));
    }
  }

  if (eqRound === null) {
    console.log('No equilibrium detected within', rounds, 'rounds');
  }
  console.log('Final fairness:', histories.length ? undefined : undefined);
}

runTest().catch(e => { console.error(e); process.exit(1); });
