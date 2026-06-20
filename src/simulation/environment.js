import {
  initSimulation,
  simulationStep,
  DEFAULT_FLOWS,
  DEFAULT_LINKS,
  DEFAULT_NODES,
} from './engine.js';

export const MAX_EPISODE_ROUNDS = 100;

export class GTACCSEnvironment {
  constructor(customFlows = null, customLinks = null, customNodes = null) {
    this.initialFlows = customFlows || DEFAULT_FLOWS;
    this.initialLinks = customLinks || DEFAULT_LINKS;
    this.initialNodes = customNodes || DEFAULT_NODES;

    this.reset();
  }

  reset() {
    const init = initSimulation(this.initialFlows, this.initialNodes, this.initialLinks);
    this.flows = init.flows;
    this.payoffHistories = init.payoffHistories;
    this.nodeQueueStats = init.nodeQueueStats;
    this.links = this.initialLinks.map(l => ({
      ...l,
      stats: { capacity: l.capacity, currentLoad: 0, utilization: 0, congested: false }
    }));
    this.equilibriumHistory = [];
    this.equilibriumStats = {
      lastUpdateRound: 0,
      averagePayoff: 0,
      averageFairness: 0,
      stabilityScore: 0,
      volatilityIndex: 0,
      confidence: 0,
      equilibrium: false
    };

    this.currentRound = 0;
    this.cumulativeReward = 0;
    this.averageReward = 0;

    return this.getState();
  }

  getState() {
    // Collect all nodes to get queue stats
    const queueValues = Object.values(this.nodeQueueStats);
    const avgQueueUtil = queueValues.length
      ? queueValues.reduce((s, n) => s + n.queueUtilization, 0) / queueValues.length
      : 0;

    // Collect flow path latencies
    const latencyValues = this.flows.map(f => f.pathLatency || 0);
    const avgLatency = latencyValues.length
      ? latencyValues.reduce((s, x) => s + x, 0) / latencyValues.length
      : 0;

    // Packet loss: average of lossRate across flows
    const lossValues = this.flows.map(f => f.lossRate || 0);
    const avgPacketLoss = lossValues.length
      ? lossValues.reduce((s, x) => s + x, 0) / lossValues.length
      : 0;

    // Jain fairness
    const fairness = this.getJainsIndex();

    // Throughput
    const totalThroughput = this.flows.reduce((s, f) => s + (f.throughput || 0), 0);

    // Link utilization
    const linkDemand = {};
    this.links.forEach(l => { linkDemand[`${l.from}-${l.to}`] = 0; });
    this.flows.forEach(flow => {
      this.pathEdges(flow.path).forEach(e => {
        if (linkDemand[e] !== undefined) {
          linkDemand[e] += flow.rate;
        }
      });
    });
    const linkUtils = this.links.map(l => {
      const key = `${l.from}-${l.to}`;
      const demand = linkDemand[key] || 0;
      return l.capacity > 0 ? (demand / l.capacity) : 0;
    });
    const avgLinkUtil = linkUtils.length
      ? linkUtils.reduce((s, u) => s + u, 0) / linkUtils.length
      : 0;

    return [
      parseFloat(avgQueueUtil.toFixed(4)),
      parseFloat(avgLatency.toFixed(2)),
      parseFloat(avgPacketLoss.toFixed(4)),
      parseFloat(avgLinkUtil.toFixed(4)),
      parseFloat(fairness.toFixed(4)),
      parseFloat(totalThroughput.toFixed(2))
    ];
  }

  getReward(stateMetrics = null) {
    let fairness = 0;
    let throughput = 0;
    let avgPacketLoss = 0;
    let avgLatency = 0;

    if (stateMetrics) {
      fairness = stateMetrics.fairness;
      throughput = stateMetrics.throughput;
      avgPacketLoss = stateMetrics.avgPacketLoss;
      avgLatency = stateMetrics.avgLatency;
    } else {
      const state = this.getState();
      avgLatency = state[1];
      avgPacketLoss = state[2];
      fairness = state[4];
      throughput = state[5];
    }

    const bottleneckCap = Math.min(...this.links.map(l => l.capacity));
    const throughputNormalized = Math.min(1.5, throughput / Math.max(1, bottleneckCap));
    const reliability = 1 - avgPacketLoss;
    const latencyNormalized = avgLatency / 100.0;

    const reward = (0.3 * fairness)
      + (0.3 * throughputNormalized)
      + (0.2 * reliability)
      - (0.1 * latencyNormalized)
      - (0.1 * avgPacketLoss);

    return parseFloat(reward.toFixed(4));
  }

  step(action) {
    this.currentRound++;

    // Map action to flow F2's strategy
    // Action: 0 = conservative, 1 = aimd (adaptive), 2 = aggressive
    const strategyMap = {
      0: 'conservative',
      1: 'aimd',
      2: 'aggressive'
    };
    const strategy = strategyMap[action] || 'aimd';

    // Apply action to flow F2
    if (this.flows.length > 1) {
      this.flows[1].strategy = strategy;
    }

    // Run one round of simulationStep
    const result = simulationStep(
      this.flows,
      this.payoffHistories,
      this.links,
      0.3, // alpha
      2.0, // beta
      this.equilibriumHistory,
      this.equilibriumStats,
      this.nodeQueueStats
    );

    // Update internal state references
    this.flows = result.flows;
    this.payoffHistories = result.newHistories;
    this.nodeQueueStats = result.nodeQueueStats;
    this.links = result.links;
    this.equilibriumHistory = result.equilibriumHistory;
    this.equilibriumStats = result.equilibriumStats;

    // Get next state and reward
    const nextState = this.getState();
    const reward = this.getReward({
      fairness: result.fairness,
      throughput: result.totalThroughput,
      avgPacketLoss: result.flowsWithPayoff.length
        ? result.flowsWithPayoff.reduce((s, f) => s + (f.lossRate || 0), 0) / result.flowsWithPayoff.length
        : 0,
      avgLatency: result.flowsWithPayoff.length
        ? result.flowsWithPayoff.reduce((s, f) => s + (f.pathLatency || 0), 0) / result.flowsWithPayoff.length
        : 0
    });

    // Update cumulative and average reward stats
    this.cumulativeReward += reward;
    this.averageReward = this.cumulativeReward / this.currentRound;

    const done = this.currentRound >= MAX_EPISODE_ROUNDS;

    return {
      state: nextState,
      reward,
      done
    };
  }

  get environmentStats() {
    return {
      currentRound: this.currentRound,
      cumulativeReward: parseFloat(this.cumulativeReward.toFixed(4)),
      averageReward: parseFloat(this.averageReward.toFixed(4))
    };
  }

  // Helpers
  getJainsIndex() {
    const x = this.flows.map(f => f.throughput || 0);
    const n = x.length;
    if (!n) return 0;
    const s = x.reduce((a, b) => a + b, 0);
    const s2 = x.reduce((a, b) => a + b * b, 0);
    return s2 === 0 ? 1 : (s * s) / (n * s2);
  }

  pathEdges(path) {
    const edges = [];
    for (let i = 0; i < path.length - 1; i++) {
      edges.push(`${path[i]}-${path[i + 1]}`);
    }
    return edges;
  }
}
