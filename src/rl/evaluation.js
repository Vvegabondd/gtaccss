import { initSimulation, simulationStep } from '../simulation/engine.js';
import { GTACCSEnvironment } from '../simulation/environment.js';

export const EVAL_SCENARIOS = {
  conservative: {
    name: 'Conservative Traffic',
    desc: 'Low-variance traffic with early backoffs to maintain stable queues.'
  },
  adaptive: {
    name: 'Adaptive Traffic',
    desc: 'Dynamic environment dominated by adaptive flows.'
  },
  aggressive: {
    name: 'Aggressive Traffic',
    desc: 'High-throughput, high-variance traffic leading to severe queue pressure.'
  },
  burst: {
    name: 'Burst Traffic',
    desc: 'Frequent burst spikes generating high packet drops.'
  },
  mixed: {
    name: 'Mixed Traffic',
    desc: 'A heterogeneous blend of aggressive, conservative, and adaptive strategies.'
  }
};

function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / (sum || 1));
}

export function configureFlowsForScenario(baseFlows, scenarioKey) {
  const flows = baseFlows || [];
  return flows.map((f, i) => {
    let profile = 'adaptive';
    let strategy = 'aimd';
    let rate = f.rate || 40;

    switch (scenarioKey) {
      case 'conservative':
        profile = 'conservative';
        strategy = 'conservative';
        rate = Math.max(15, Math.round(rate * 0.7));
        break;
      case 'adaptive':
        profile = 'adaptive';
        strategy = 'adaptive';
        rate = Math.max(20, Math.round(rate * 0.9));
        break;
      case 'aggressive':
        profile = 'aggressive';
        strategy = 'aggressive';
        rate = Math.max(35, Math.round(rate * 1.3));
        break;
      case 'burst':
        profile = 'burstTraffic';
        strategy = i % 2 === 0 ? 'aggressive' : 'aimd';
        rate = Math.max(30, Math.round(rate * 1.2));
        break;
      case 'mixed':
      default:
        const strategies = ['aggressive', 'aimd', 'conservative'];
        const profiles = ['aggressive', 'adaptive', 'conservative'];
        strategy = strategies[i % strategies.length];
        profile = profiles[i % profiles.length];
        break;
    }

    return {
      ...f,
      strategy,
      trafficProfile: profile,
      rate
    };
  });
}

function computeAverageMetrics(steps) {
  const n = steps.length;
  if (!n) return { fairness: 0, throughput: 0, latency: 0, packetLoss: 0, reliability: 0, reward: 0 };
  
  let sumFairness = 0;
  let sumThroughput = 0;
  let sumLatency = 0;
  let sumPacketLoss = 0;
  let sumReliability = 0;
  let sumReward = 0;
  
  steps.forEach(s => {
    sumFairness += s.fairness;
    sumThroughput += s.throughput;
    sumLatency += s.latency;
    sumPacketLoss += s.packetLoss;
    sumReliability += s.reliability;
    sumReward += s.reward;
  });
  
  return {
    fairness: parseFloat((sumFairness / n).toFixed(4)),
    throughput: parseFloat((sumThroughput / n).toFixed(2)),
    latency: parseFloat((sumLatency / n).toFixed(2)),
    packetLoss: parseFloat((sumPacketLoss / n).toFixed(4)),
    reliability: parseFloat((sumReliability / n).toFixed(4)),
    reward: parseFloat((sumReward / n).toFixed(4))
  };
}

export function runNashEvaluation(topology, scenarioKey, rounds = 100) {
  const scenarioFlows = configureFlowsForScenario(topology.flows, scenarioKey);
  const init = initSimulation(scenarioFlows, topology.nodes, topology.links);
  let flows = init.flows;
  let payoffHistories = init.payoffHistories;
  let nodeQueueStats = init.nodeQueueStats || {};
  let links = topology.links.map(l => ({
    ...l,
    stats: { capacity: l.capacity, currentLoad: 0, utilization: 0, congested: false }
  }));
  let equilibriumHistory = [];
  let equilibriumStats = {
    lastUpdateRound: 0,
    averagePayoff: 0,
    averageFairness: 0,
    stabilityScore: 0,
    volatilityIndex: 0,
    confidence: 0,
    equilibrium: false
  };

  const stepsData = [];

  for (let r = 1; r <= rounds; r++) {
    const result = simulationStep(
      flows,
      payoffHistories,
      links,
      0.3, // alpha
      2.0, // beta
      equilibriumHistory,
      equilibriumStats,
      nodeQueueStats
    );

    flows = result.flows;
    payoffHistories = result.newHistories;
    nodeQueueStats = result.nodeQueueStats;
    links = result.links;
    equilibriumHistory = result.equilibriumHistory;
    equilibriumStats = result.equilibriumStats;

    const avgLatency = result.flowsWithPayoff.length
      ? result.flowsWithPayoff.reduce((s, f) => s + (f.pathLatency || 0), 0) / result.flowsWithPayoff.length
      : 0;

    const avgPacketLoss = result.flowsWithPayoff.length
      ? result.flowsWithPayoff.reduce((s, f) => s + (f.lossRate || 0), 0) / result.flowsWithPayoff.length
      : 0;

    const fairness = result.fairness;
    const throughput = result.totalThroughput;

    const bottleneckCap = Math.min(...links.map(l => l.capacity));
    const throughputNormalized = Math.min(1.5, throughput / Math.max(1, bottleneckCap));
    const reliability = 1 - avgPacketLoss;
    const latencyNormalized = avgLatency / 100.0;

    const reward = (0.3 * fairness)
      + (0.3 * throughputNormalized)
      + (0.2 * reliability)
      - (0.1 * latencyNormalized)
      - (0.1 * avgPacketLoss);

    stepsData.push({
      round: r,
      fairness,
      throughput,
      latency: avgLatency,
      packetLoss: avgPacketLoss,
      reliability,
      reward: parseFloat(reward.toFixed(4))
    });
  }

  const summary = computeAverageMetrics(stepsData);
  return {
    steps: stepsData,
    summary
  };
}

export function runA2CEvaluation(topology, scenarioKey, agent, rounds = 100) {
  const scenarioFlows = configureFlowsForScenario(topology.flows, scenarioKey);
  const env = new GTACCSEnvironment(scenarioFlows, topology.links, topology.nodes);
  
  const stepsData = [];
  let state = env.reset();

  for (let r = 1; r <= rounds; r++) {
    const normState = agent.normalizeState(state);
    const h = agent.actorL1.forward(normState);
    const logits = agent.actorL2.forward(h);
    const probs = softmax(logits);

    let action = 0;
    let maxP = -1;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > maxP) {
        maxP = probs[i];
        action = i;
      }
    }

    const { state: nextState, reward } = env.step(action);

    const queueValues = Object.values(env.nodeQueueStats);
    const avgQueueUtil = queueValues.length
      ? queueValues.reduce((s, n) => s + n.queueUtilization, 0) / queueValues.length
      : 0;

    const latencyValues = env.flows.map(f => f.pathLatency || 0);
    const avgLatency = latencyValues.length
      ? latencyValues.reduce((s, x) => s + x, 0) / latencyValues.length
      : 0;

    const lossValues = env.flows.map(f => f.lossRate || 0);
    const avgPacketLoss = lossValues.length
      ? lossValues.reduce((s, x) => s + x, 0) / lossValues.length
      : 0;

    const fairness = env.getJainsIndex();
    const throughput = env.flows.reduce((s, f) => s + (f.throughput || 0), 0);

    stepsData.push({
      round: r,
      fairness,
      throughput,
      latency: avgLatency,
      packetLoss: avgPacketLoss,
      reliability: 1 - avgPacketLoss,
      reward
    });

    state = nextState;
  }

  const summary = computeAverageMetrics(stepsData);
  return {
    steps: stepsData,
    summary
  };
}

export function runDDQNEvaluation(topology, scenarioKey, agent, rounds = 100) {
  const scenarioFlows = configureFlowsForScenario(topology.flows, scenarioKey);
  const env = new GTACCSEnvironment(scenarioFlows, topology.links, topology.nodes);
  
  const stepsData = [];
  let state = env.reset();

  for (let r = 1; r <= rounds; r++) {
    const { action } = agent.selectAction(state, true);

    const { state: nextState, reward } = env.step(action);

    const queueValues = Object.values(env.nodeQueueStats);
    const avgQueueUtil = queueValues.length
      ? queueValues.reduce((s, n) => s + n.queueUtilization, 0) / queueValues.length
      : 0;

    const latencyValues = env.flows.map(f => f.pathLatency || 0);
    const avgLatency = latencyValues.length
      ? latencyValues.reduce((s, x) => s + x, 0) / latencyValues.length
      : 0;

    const lossValues = env.flows.map(f => f.lossRate || 0);
    const avgPacketLoss = lossValues.length
      ? lossValues.reduce((s, x) => s + x, 0) / lossValues.length
      : 0;

    const fairness = env.getJainsIndex();
    const throughput = env.flows.reduce((s, f) => s + (f.throughput || 0), 0);

    stepsData.push({
      round: r,
      fairness,
      throughput,
      latency: avgLatency,
      packetLoss: avgPacketLoss,
      reliability: 1 - avgPacketLoss,
      reward
    });

    state = nextState;
  }

  const summary = computeAverageMetrics(stepsData);
  return {
    steps: stepsData,
    summary
  };
}

export function runA3CEvaluation(topology, scenarioKey, agent, rounds = 100) {
  const scenarioFlows = configureFlowsForScenario(topology.flows, scenarioKey);
  const env = new GTACCSEnvironment(scenarioFlows, topology.links, topology.nodes);
  
  const stepsData = [];
  let state = env.reset();

  for (let r = 1; r <= rounds; r++) {
    // Act deterministically using the Global Actor policy (argmax probabilities)
    const { action } = agent.selectAction(state, true);

    const { state: nextState, reward } = env.step(action);

    const queueValues = Object.values(env.nodeQueueStats);
    const avgQueueUtil = queueValues.length
      ? queueValues.reduce((s, n) => s + n.queueUtilization, 0) / queueValues.length
      : 0;

    const latencyValues = env.flows.map(f => f.pathLatency || 0);
    const avgLatency = latencyValues.length
      ? latencyValues.reduce((s, x) => s + x, 0) / latencyValues.length
      : 0;

    const lossValues = env.flows.map(f => f.lossRate || 0);
    const avgPacketLoss = lossValues.length
      ? lossValues.reduce((s, x) => s + x, 0) / lossValues.length
      : 0;

    const fairness = env.getJainsIndex();
    const throughput = env.flows.reduce((s, f) => s + (f.throughput || 0), 0);

    stepsData.push({
      round: r,
      fairness,
      throughput,
      latency: avgLatency,
      packetLoss: avgPacketLoss,
      reliability: 1 - avgPacketLoss,
      reward
    });

    state = nextState;
  }

  const summary = computeAverageMetrics(stepsData);
  return {
    steps: stepsData,
    summary
  };
}

export function compareResults(topology, a2cAgent, ddqnAgent, a3cAgent, scenarioKey, rounds = 100) {
  const nashRes = runNashEvaluation(topology, scenarioKey, rounds);
  const a2cRes = runA2CEvaluation(topology, scenarioKey, a2cAgent, rounds);
  const ddqnRes = runDDQNEvaluation(topology, scenarioKey, ddqnAgent, rounds);
  const a3cRes = runA3CEvaluation(topology, scenarioKey, a3cAgent, rounds);

  const nashSum = nashRes.summary;
  const a2cSum = a2cRes.summary;
  const ddqnSum = ddqnRes.summary;
  const a3cSum = a3cRes.summary;

  const calcImprovement = (agentVal, baselineVal) => {
    if (baselineVal === 0) return 0;
    const diff = agentVal - baselineVal;
    return parseFloat(((diff / baselineVal) * 100).toFixed(2));
  };

  const getWinner = (nashVal, a2cVal, ddqnVal, a3cVal, lowerIsBetter = false) => {
    const vals = [
      { name: 'Nash', value: nashVal },
      { name: 'A2C', value: a2cVal },
      { name: 'DDQN', value: ddqnVal },
      { name: 'A3C', value: a3cVal }
    ];
    if (lowerIsBetter) {
      vals.sort((a, b) => a.value - b.value);
    } else {
      vals.sort((a, b) => b.value - a.value);
    }
    return vals[0].name;
  };

  const comparison = {
    fairness: {
      nash: nashSum.fairness,
      a2c: a2cSum.fairness,
      ddqn: ddqnSum.fairness,
      a3c: a3cSum.fairness,
      a2cPctChange: calcImprovement(a2cSum.fairness, nashSum.fairness),
      ddqnPctChange: calcImprovement(ddqnSum.fairness, nashSum.fairness),
      a3cPctChange: calcImprovement(a3cSum.fairness, nashSum.fairness),
      winner: getWinner(nashSum.fairness, a2cSum.fairness, ddqnSum.fairness, a3cSum.fairness)
    },
    throughput: {
      nash: nashSum.throughput,
      a2c: a2cSum.throughput,
      ddqn: ddqnSum.throughput,
      a3c: a3cSum.throughput,
      a2cPctChange: calcImprovement(a2cSum.throughput, nashSum.throughput),
      ddqnPctChange: calcImprovement(ddqnSum.throughput, nashSum.throughput),
      a3cPctChange: calcImprovement(a3cSum.throughput, nashSum.throughput),
      winner: getWinner(nashSum.throughput, a2cSum.throughput, ddqnSum.throughput, a3cSum.throughput)
    },
    latency: {
      nash: nashSum.latency,
      a2c: a2cSum.latency,
      ddqn: ddqnSum.latency,
      a3c: a3cSum.latency,
      a2cPctChange: calcImprovement(a2cSum.latency, nashSum.latency),
      ddqnPctChange: calcImprovement(ddqnSum.latency, nashSum.latency),
      a3cPctChange: calcImprovement(a3cSum.latency, nashSum.latency),
      winner: getWinner(nashSum.latency, a2cSum.latency, ddqnSum.latency, a3cSum.latency, true)
    },
    packetLoss: {
      nash: nashSum.packetLoss,
      a2c: a2cSum.packetLoss,
      ddqn: ddqnSum.packetLoss,
      a3c: a3cSum.packetLoss,
      a2cPctChange: calcImprovement(a2cSum.packetLoss, nashSum.packetLoss),
      ddqnPctChange: calcImprovement(ddqnSum.packetLoss, nashSum.packetLoss),
      a3cPctChange: calcImprovement(a3cSum.packetLoss, nashSum.packetLoss),
      winner: getWinner(nashSum.packetLoss, a2cSum.packetLoss, ddqnSum.packetLoss, a3cSum.packetLoss, true)
    },
    reward: {
      nash: nashSum.reward,
      a2c: a2cSum.reward,
      ddqn: ddqnSum.reward,
      a3c: a3cSum.reward,
      a2cPctChange: calcImprovement(a2cSum.reward, nashSum.reward),
      ddqnPctChange: calcImprovement(ddqnSum.reward, nashSum.reward),
      a3cPctChange: calcImprovement(a3cSum.reward, nashSum.reward),
      winner: getWinner(nashSum.reward, a2cSum.reward, ddqnSum.reward, a3cSum.reward)
    }
  };

  return {
    scenarioKey,
    nash: nashRes,
    a2c: a2cRes,
    ddqn: ddqnRes,
    a3c: a3cRes,
    comparison
  };
}
