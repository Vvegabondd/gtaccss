// ============================================================
// GTACCS Simulation Engine v3 — Fixed
// Supports custom topologies, correct Nash Equilibrium detection
// ============================================================

export const DEFAULT_NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// ── Queue Simulation Constants (Step 3) ─────────────────────
export const QUEUE_SCALE_FACTOR = 2;       // excess Mbps → packets/round; tune later
export const DEFAULT_QUEUE_CAPACITY = 100; // max packets per node buffer

// ── Latency Modeling Constants (Step 4) ─────────────────────
export const BASE_NODE_LATENCY = 5;        // ms baseline propagation delay per hop
export const LATENCY_PER_PACKET = 0.25;    // ms added per queued packet (queueing delay)

export const DEFAULT_LINKS = [
  { from: 'A', to: 'B', capacity: 100 },
  { from: 'A', to: 'C', capacity: 80 },
  { from: 'B', to: 'D', capacity: 60 },
  { from: 'C', to: 'D', capacity: 70 },
  { from: 'D', to: 'E', capacity: 50 },
  { from: 'E', to: 'F', capacity: 100 },
  { from: 'F', to: 'G', capacity: 90 },
  { from: 'F', to: 'H', capacity: 80 },
];

export const TRAFFIC_PROFILES = {
  conservative: {
    label: 'Conservative',
    variance: 2,
    burstProbability: 0.01,
    burstMultiplier: 1.1,
    baseRateDefault: 40
  },
  adaptive: {
    label: 'Adaptive',
    variance: 5,
    burstProbability: 0.05,
    burstMultiplier: 1.5,
    baseRateDefault: 40
  },
  aggressive: {
    label: 'Aggressive',
    variance: 40,
    burstProbability: 0.20,
    burstMultiplier: 2.0,
    baseRateDefault: 40
  },
  video: {
    label: 'Video Streaming',
    variance: 3,
    burstProbability: 0.10,
    burstMultiplier: 1.8,
    baseRateDefault: 30
  },
  gaming: {
    label: 'Gaming',
    variance: 1,
    burstProbability: 0.20,
    burstMultiplier: 1.4,
    baseRateDefault: 15
  },
  fileTransfer: {
    label: 'File Transfer',
    variance: 5,
    burstProbability: 0.05,
    burstMultiplier: 1.2,
    baseRateDefault: 80
  },
  burstTraffic: {
    label: 'Burst Traffic',
    variance: 10,
    burstProbability: 0.15,
    burstMultiplier: 3.0,
    baseRateDefault: 20
  }
};

export const STRATEGY_META = {
  aggressive: { label: 'Aggressive', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '⚡', desc: 'Continuously increases rate — causes heavy congestion' },
  conservative: { label: 'Conservative', color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', icon: '🛡️', desc: 'Backs off early at 50% queue — stable but lower throughput' },
  aimd: { label: 'TCP AIMD', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '📈', desc: 'Additive Increase, Multiplicative Decrease — TCP-like sawtooth' },
  adaptive: { label: 'Adaptive RL', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: '🔄', desc: 'Observes queue + loss state, dynamically adjusts rate' },
};

export const DEFAULT_FLOWS = [
  { id: 'F1', path: ['A', 'B', 'D', 'E', 'F', 'G'], strategy: 'aggressive', trafficProfile: 'aggressive', rate: 40, color: '#ef4444' },
  { id: 'F2', path: ['A', 'C', 'D', 'E', 'F', 'H'], strategy: 'adaptive', trafficProfile: 'adaptive', rate: 40, color: '#3b82f6' },
  { id: 'F3', path: ['B', 'D', 'E', 'F'], strategy: 'conservative', trafficProfile: 'conservative', rate: 40, color: '#22c55e' },
];

export function gaussianRandom(mean, stddev) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stddev;
}

export function getOfferedRate(profileKey, baseRate) {
  const profile = TRAFFIC_PROFILES[profileKey] || TRAFFIC_PROFILES.conservative;
  const varianceVal = profile.variance;
  
  // Box-Muller Gaussian approximation
  const randomVariance = gaussianRandom(0, varianceVal);
  
  let rate = baseRate + randomVariance;
  
  // Probabilistic burst scales only the baseRate
  if (Math.random() < profile.burstProbability) {
    rate = baseRate * profile.burstMultiplier + randomVariance;
  }
  
  return Math.max(1, Math.min(rate, 500));
}

// ── AIMD per-flow state (reset on initSimulation) ───────────
const aimdState = {};
function getAimd(id) {
  if (!aimdState[id]) aimdState[id] = { ssthresh: 64, slowStart: true };
  return aimdState[id];
}

// ── Rate update per strategy ─────────────────────────────────
function updateRate(flow, lossDetected, queueUtil) {
  let rate = flow.ccRate !== undefined ? flow.ccRate : flow.rate;
  switch (flow.strategy) {
    case 'aggressive':
      // Aggressive: smaller growth, stronger backoff to avoid domination
      rate = lossDetected ? rate * 0.70 : rate * 1.08;
      break;
    case 'conservative':
      if (queueUtil > 0.5) rate = rate * 0.75;
      else if (queueUtil < 0.3) rate = rate + 0.8;
      break;
    case 'aimd': {
      const st = getAimd(flow.id);
      if (lossDetected) {
        st.ssthresh = Math.max(rate / 2, 2);
        // More conservative decrease
        rate = Math.max(1, st.ssthresh * 0.7);
        st.slowStart = false;
      } else {
        if (st.slowStart) {
          rate += 4;
          if (rate >= st.ssthresh) st.slowStart = false;
        } else {
          rate += 0.8;
        }
      }
      break;
    }
    case 'adaptive':
      if (lossDetected) rate = rate * 0.60;
      else if (queueUtil > 0.75) rate = rate * 0.92;
      else if (queueUtil < 0.4) rate = rate + 1.2;
      break;
    default:
      rate = lossDetected ? rate * 0.80 : rate * 1.10;
  }
  return Math.max(0.5, Math.min(rate, 500));
}

// ── Path edges helper ────────────────────────────────────────
function pathEdges(path) {
  const edges = [];
  for (let i = 0; i < path.length - 1; i++) {
    edges.push(`${path[i]}-${path[i + 1]}`);
  }
  return edges;
}

// ── Find bottleneck link for a given topology ────────────────
function findBottleneck(links) {
  if (!links || links.length === 0) return null;
  let minCap = Infinity;
  let bottleneck = null;
  links.forEach(l => {
    if (l.capacity < minCap) {
      minCap = l.capacity;
      bottleneck = `${l.from}-${l.to}`;
    }
  });
  return bottleneck;
}

// ── Core congestion round ────────────────────────────────────
function runCongestionRound(flows, links) {
  // Build demand map
  const linkDemand = {};
  links.forEach(l => { linkDemand[`${l.from}-${l.to}`] = 0; });

  flows.forEach(flow => {
    pathEdges(flow.path).forEach(e => {
      if (linkDemand[e] !== undefined) {
        linkDemand[e] += flow.rate;
      }
    });
  });

  // Compute utilization and loss per link
  const linkLoss = {};
  const linkUtil = {};
  links.forEach(l => {
    const key = `${l.from}-${l.to}`;
    const demand = linkDemand[key] || 0;
    linkUtil[key] = l.capacity > 0 ? (demand / l.capacity) : 0;
    linkLoss[key] = demand > l.capacity ? (demand - l.capacity) / demand : 0;
  });

  // Compute per-flow metrics
  const updatedFlows = flows.map(flow => {
    const edges = pathEdges(flow.path);
    const maxLoss = edges.length > 0
      ? Math.max(...edges.map(e => {
          const linkLossRate = linkLoss[e] || 0;
          const totalLinkDemand = linkDemand[e] || 0;
          const flowShare = totalLinkDemand > 0 ? flow.rate / totalLinkDemand : 0;
          return linkLossRate * flowShare;
        }))
      : 0;
    const maxUtil = edges.length > 0
      ? Math.max(...edges.map(e => linkUtil[e] || 0))
      : 0;
    const throughput = flow.rate * (1 - maxLoss);
    return { ...flow, throughput, lossRate: maxLoss, maxUtil };
  });

  return { updatedFlows, linkLoss, linkUtil, linkDemand };
}

// ── Payoff function ───────────────────────────────────────────
// Step 4 fix: use pathLatency (real queueing delay) instead of placeholder flow.delay
function computePayoff(flow, alpha = 0.3, beta = 2.0) {
  const latency = flow.pathLatency ?? flow.delay ?? 0;
  return flow.throughput - alpha * latency - beta * flow.lossRate * 100;
}

// ── Jain's fairness index ────────────────────────────────────
export function jainsIndex(flows) {
  const x = flows.map(f => f.throughput);
  const n = x.length;
  if (!n) return 0;
  const s = x.reduce((a, b) => a + b, 0);
  const s2 = x.reduce((a, b) => a + b * b, 0);
  return s2 === 0 ? 1 : (s * s) / (n * s2);
}

// ── Equilibrium detection ────────────────────────────────────
// Returns true if ALL flows have had stable payoff over the last `window` rounds
// Adjusted defaults to detect stability faster in typical scenarios.
function checkEquilibrium(flowHistories, window = 6, threshold = 3.0, relThreshold = 0.08) {
  // Accepts either an absolute stability threshold OR a relative stability threshold
  return flowHistories.every(h => {
    if (h.length < window) return false;
    const recent = h.slice(-window);
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const absStable = (max - min) < threshold;
    const relStable = (Math.abs(mean) < 1e-6) ? (max - min) < (threshold * 0.5) : ((max - min) / Math.abs(mean) < relThreshold);
    return absStable || relStable;
  });
}

// ── Derive insight text ──────────────────────────────────────
export function deriveInsight(flowsWithPayoff, fairness, equilibrium, bottleneckKey) {
  const sorted = [...flowsWithPayoff].sort((a, b) => (b.payoff || 0) - (a.payoff || 0));
  const best = sorted[0];
  const avgLoss = flowsWithPayoff.reduce((s, f) => s + (f.lossRate || 0), 0) / (flowsWithPayoff.length || 1);
  const btLabel = bottleneckKey || 'bottleneck link';
  if (avgLoss > 0.5) return { type: 'danger', msg: `Severe congestion — network near collapse. Aggressive flows dominate at the cost of all others.` };
  if (fairness > 0.85 && equilibrium) return { type: 'success', msg: `Nash Equilibrium reached — all flows self-organized equitably. ${STRATEGY_META[best?.strategy]?.label || best?.strategy} leads.` };
  if (fairness < 0.4) return { type: 'warning', msg: `Low fairness (${(fairness * 100).toFixed(0)}%). ${STRATEGY_META[best?.strategy]?.label || best?.strategy} is dominating bandwidth.` };
  if (equilibrium) return { type: 'info', msg: `Equilibrium detected. Best strategy: ${STRATEGY_META[best?.strategy]?.label || best?.strategy}. No algorithm is universally optimal.` };
  return { type: 'info', msg: `Flows competing for shared ${btLabel}. Watch for congestion signals and queue buildup.` };
}

// ── Queue Simulation (Step 3) ────────────────────────────────
// drainRate = sum of all outgoing link capacities from a node (not just max)
function buildDrainRates(links) {
  const drainRates = {};
  links.forEach(l => {
    drainRates[l.from] = (drainRates[l.from] || 0) + l.capacity;
  });
  return drainRates;
}

export function updateNodeQueues(flows, links, prevNodeQueueStats = {}) {
  const drainRates = buildDrainRates(links);

  // Build per-node incoming traffic load (sum of all flow rates passing through each node)
  const incomingLoad = {};
  flows.forEach(flow => {
    flow.path.forEach(nodeId => {
      incomingLoad[nodeId] = (incomingLoad[nodeId] || 0) + (flow.rate || 0);
    });
  });

  // Collect all unique node IDs present in flows + links
  const nodeIds = new Set();
  flows.forEach(f => f.path.forEach(n => nodeIds.add(n)));
  links.forEach(l => { nodeIds.add(l.from); nodeIds.add(l.to); });

  const nodeQueueStats = {};

  nodeIds.forEach(nodeId => {
    const prev = prevNodeQueueStats[nodeId] || {};
    const queueCapacity = prev.queueCapacity ?? DEFAULT_QUEUE_CAPACITY;
    const drainRate = drainRates[nodeId] || 0;
    const incoming = incomingLoad[nodeId] || 0;
    const prevQueueSize = prev.queueSize || 0;

    // Excess traffic that cannot be forwarded this round
    const excess = Math.max(0, incoming - drainRate);
    // Convert excess Mbps → packets using the tunable scale factor
    const rawQueuedPackets = excess * QUEUE_SCALE_FACTOR;

    // How many packets can actually fit in the remaining buffer space
    const available = Math.max(0, queueCapacity - prevQueueSize);
    const accepted = Math.min(rawQueuedPackets, available);
    const droppedThisRound = Math.max(0, rawQueuedPackets - available);

    // Drain: half the drainRate worth of queued packets get processed per round
    const drained = Math.min(prevQueueSize + accepted, drainRate * 0.5);
    const newQueueSize = Math.max(0, prevQueueSize + accepted - drained);

    const processedTraffic = Math.min(incoming, drainRate);
    const cumulativeDropped = (prev.droppedPackets || 0) + droppedThisRound;
    
    const incomingPackets = incoming * QUEUE_SCALE_FACTOR;
    const totalIncomingPackets = (prev.totalIncomingPackets || 0) + incomingPackets;
    const packetLossRate = totalIncomingPackets > 0 ? (cumulativeDropped / totalIncomingPackets) : 0;

    nodeQueueStats[nodeId] = {
      queueSize: parseFloat(newQueueSize.toFixed(1)),
      queueCapacity,
      drainRate: parseFloat(drainRate.toFixed(1)),
      incomingTraffic: parseFloat(incoming.toFixed(2)),
      processedTraffic: parseFloat(processedTraffic.toFixed(2)),
      queuedPackets: parseFloat(rawQueuedPackets.toFixed(1)),
      droppedThisRound: parseFloat(droppedThisRound.toFixed(1)),
      droppedPackets: parseFloat(cumulativeDropped.toFixed(1)),
      queueUtilization: parseFloat((newQueueSize / queueCapacity).toFixed(3)),
      totalIncomingPackets: parseFloat(totalIncomingPackets.toFixed(1)),
      packetLossRate: parseFloat(packetLossRate.toFixed(4)),
      // Step 4: Latency
      queueDelay: parseFloat((newQueueSize * LATENCY_PER_PACKET).toFixed(2)),
      latency: parseFloat((BASE_NODE_LATENCY + newQueueSize * LATENCY_PER_PACKET).toFixed(2)),
    };
  });

  return nodeQueueStats;
}

// ── Main simulation step ─────────────────────────────────────
export const EQUILIBRIUM_WINDOW = 20;

export function stdDev(arr) {
  if (arr.length <= 1) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length;
  return Math.sqrt(variance);
}

export function simulationStep(
  flows,
  payoffHistories,
  links,
  alpha = 0.3,
  beta = 2.0,
  equilibriumHistory = [],
  lastStats = null,
  prevNodeQueueStats = {}
) {
  const activeLinks = links || DEFAULT_LINKS;
  const bottleneckKey = findBottleneck(activeLinks);

  // estimate current round from payoff histories (before this step)
  const currentRound = (payoffHistories && payoffHistories[0]) ? payoffHistories[0].length + 1 : 1;

  // 1. Generate offered rate based on profile, and compute sending rate capped by congestion control limit (ccRate)
  const flowsWithOffered = flows.map(flow => {
    const baseRate = flow.baseRate !== undefined ? flow.baseRate : (flow.rate || 40);
    const profileKey = flow.trafficProfile || 'conservative';
    const offeredRate = getOfferedRate(profileKey, baseRate);
    const ccRate = flow.ccRate !== undefined ? flow.ccRate : baseRate;
    const sendingRate = Math.min(offeredRate, ccRate);

    const historyEntry = {
      round: currentRound,
      offeredRate: parseFloat(offeredRate.toFixed(2)),
      sendingRate: parseFloat(sendingRate.toFixed(2)),
    };

    return {
      ...flow,
      baseRate,
      offeredRate,
      ccRate,
      rate: sendingRate, // engine uses rate for utilization/loss calculation
      history: [...(flow.history || []), historyEntry],
      trafficStats: {
        offeredRate: parseFloat(offeredRate.toFixed(2)),
        sendingRate: parseFloat(sendingRate.toFixed(2)),
        utilization: offeredRate > 0 ? parseFloat((sendingRate / offeredRate).toFixed(3)) : 1.0,
        latency: 0, // will be computed after queue update below
      }
    };
  });

  const { updatedFlows, linkLoss, linkUtil, linkDemand } = runCongestionRound(flowsWithOffered, activeLinks);

  // --- Step 3 + 4 (early): Compute queues and pathLatency BEFORE payoff ---
  // This ensures computePayoff uses real queueing-derived latency, not the placeholder flow.delay
  const nodeQueueStatsEarly = updateNodeQueues(updatedFlows, activeLinks, prevNodeQueueStats);

  // Attach pathLatency to each flow so computePayoff can use it
  const updatedFlowsWithLatency = updatedFlows.map(flow => {
    const pathLatency = (flow.path || []).reduce((sum, nodeId) => {
      const ns = nodeQueueStatsEarly[nodeId];
      return sum + (ns ? ns.latency : BASE_NODE_LATENCY);
    }, 0);
    return {
      ...flow,
      pathLatency: parseFloat(pathLatency.toFixed(2)),
      trafficStats: {
        ...(flow.trafficStats || {}),
        latency: parseFloat(pathLatency.toFixed(2)),
      },
    };
  });

  const flowsWithPayoff = updatedFlowsWithLatency.map(flow => ({
    ...flow,
    payoff: computePayoff(flow, alpha, beta),
  }));

  // Update ccRates (congestion control limit) for next round
  let nextFlows = flowsWithPayoff.map(flow => {
    const maxUtil = flow.maxUtil || (bottleneckKey ? (linkUtil[bottleneckKey] || 0) : 0);
    const suggested = updateRate(flow, flow.lossRate > 0.01, maxUtil);
    // Smooth the ccRate, not the actual rate
    const smoothedCc = (flow.ccRate * 0.10) + (suggested * 0.90);
    const clampedCc = Math.max(0.5, Math.min(smoothedCc, 500));
    return { ...flow, ccRate: clampedCc };
  });

  // Apply a milder, more natural corrective nudge only when dynamics are volatile.
  if (!checkEquilibrium(payoffHistories) && bottleneckKey && currentRound >= 18 && currentRound <= 40) {
    const flowsOnB = flowsWithPayoff.filter(f => pathEdges(f.path).includes(bottleneckKey));
    const nOnB = flowsOnB.length;
    if (nOnB > 0 && payoffHistories && payoffHistories.length) {
      // compute volatility (relative stddev) for flows on the bottleneck using last 6 rounds
      const window = 6;
      const relStdevs = flowsOnB.map((f, idx) => {
        const hist = (payoffHistories.find((h, i) => (flowsWithPayoff[i]?.id === f.id)) || [])
          .slice(-window);
        if (hist.length < 3) return 0;
        const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
        const variance = hist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hist.length;
        const stdev = Math.sqrt(variance);
        return Math.abs(mean) < 1e-6 ? 0 : (stdev / Math.abs(mean));
      }).filter(v => typeof v === 'number');

      const avgRelStdev = relStdevs.length ? (relStdevs.reduce((a, b) => a + b, 0) / relStdevs.length) : 0;

      // threshold: if avg relative stdev > 0.12, consider dynamics volatile
      if (avgRelStdev > 0.12) {
        const bLink = activeLinks.find(l => `${l.from}-${l.to}` === bottleneckKey);
        const fairShare = (bLink && bLink.capacity) ? (bLink.capacity / nOnB) : null;
        if (fairShare) {
          // nudge strength decays linearly from 0.5 -> 0.25 over the window
          const t = (currentRound - 18) / Math.max(1, (40 - 18));
          const nudgeStrength = 0.5 - (0.25 * Math.min(1, t)); // proportion toward fairShare
          nextFlows = nextFlows.map(f => {
            if (pathEdges(f.path).includes(bottleneckKey)) {
              const mix = 1 - nudgeStrength; // preserve majority of current ccRate
              const nudgedCc = (f.ccRate * mix) + (fairShare * (1 - mix));
              return { ...f, ccRate: Math.max(0.5, Math.min(nudgedCc, 500)) };
            }
            return f;
          });
        }
      }
    }
  }

  // Grow payoff histories
  const newHistories = flowsWithPayoff.map((flow, i) => [
    ...(payoffHistories[i] || []),
    flow.payoff,
  ]);

  const totalThroughput = flowsWithPayoff.reduce((s, f) => s + f.throughput, 0);
  const fairness = jainsIndex(flowsWithPayoff);

  const updatedLinks = activeLinks.map(l => {
    const key = `${l.from}-${l.to}`;
    const demand = linkDemand[key] || 0;
    const util = linkUtil[key] || 0;
    return {
      ...l,
      stats: {
        capacity: l.capacity,
        currentLoad: parseFloat(demand.toFixed(2)),
        utilization: parseFloat(util.toFixed(3)),
        congested: util > 1.0,
      }
    };
  });

  const congestedNodes = new Set();
  updatedLinks.forEach(l => {
    if (l.stats.congested) {
      congestedNodes.add(l.from);
      congestedNodes.add(l.to);
    }
  });

  const utils = Object.values(linkUtil);
  const congestedLinksCount = updatedLinks.filter(l => l.stats.congested).length;
  const maxUtilization = utils.length ? Math.max(...utils) : 0;
  const averageUtilization = utils.length ? (utils.reduce((a, b) => a + b, 0) / utils.length) : 0;

  const networkStats = {
    congestedLinks: congestedLinksCount,
    maxUtilization: parseFloat((maxUtilization * 100).toFixed(1)),
    averageUtilization: parseFloat((averageUtilization * 100).toFixed(1)),
  };

  // --- Step 3: Queue Simulation & Buffer Modeling (final pass for UI stats) ---
  // Re-run with the post-payoff flows so queue stats reflect actual sending rates used this round
  const nodeQueueStats = updateNodeQueues(flowsWithPayoff, activeLinks, prevNodeQueueStats);

  const queueValues = Object.values(nodeQueueStats);
  const totalQueuedPackets = parseFloat(queueValues.reduce((s, n) => s + n.queueSize, 0).toFixed(1));
  const totalDroppedPackets = parseFloat(queueValues.reduce((s, n) => s + n.droppedThisRound, 0).toFixed(1));
  const avgQueueUtil = queueValues.length
    ? parseFloat((queueValues.reduce((s, n) => s + n.queueUtilization, 0) / queueValues.length * 100).toFixed(1))
    : 0;
  const maxQueueSize = queueValues.length
    ? parseFloat(Math.max(...queueValues.map(n => n.queueSize)).toFixed(1))
    : 0;

  const totalIncomingPacketsCumulative = parseFloat(queueValues.reduce((s, n) => s + (n.totalIncomingPackets || 0), 0).toFixed(1));
  const totalDroppedPacketsCumulative = parseFloat(queueValues.reduce((s, n) => s + n.droppedPackets, 0).toFixed(1));
  const networkReliability = totalIncomingPacketsCumulative > 0
    ? parseFloat(((1 - totalDroppedPacketsCumulative / totalIncomingPacketsCumulative) * 100).toFixed(2))
    : 100.00;

  const networkQueueStats = {
    totalQueuedPackets,
    averageQueueUtil: avgQueueUtil,
    maxQueueSize,
    totalDroppedPackets,
    totalIncomingPacketsCumulative,
    totalDroppedPacketsCumulative,
    networkReliability,
  };

  // --- Step 4: Latency stats derived from UI-pass queue stats ---
  // Flows already have pathLatency from the early pass above; update to match final queue stats
  const flowsWithFinalLatency = flowsWithPayoff.map(flow => {
    const pathLatency = (flow.path || []).reduce((sum, nodeId) => {
      const ns = nodeQueueStats[nodeId];
      return sum + (ns ? ns.latency : BASE_NODE_LATENCY);
    }, 0);
    return {
      ...flow,
      pathLatency: parseFloat(pathLatency.toFixed(2)),
      trafficStats: {
        ...(flow.trafficStats || {}),
        latency: parseFloat(pathLatency.toFixed(2)),
      },
    };
  });

  const latencyValues = flowsWithFinalLatency.map(f => f.pathLatency);
  const networkLatencyStats = latencyValues.length ? {
    averageLatency: parseFloat((latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length).toFixed(2)),
    maxLatency: parseFloat(Math.max(...latencyValues).toFixed(2)),
    minLatency: parseFloat(Math.min(...latencyValues).toFixed(2)),
  } : { averageLatency: 0, maxLatency: 0, minLatency: 0 };

  // --- Step 2.5: Rolling Window Nash Equilibrium Stabilization ---
  const avgPayoffCurrent = flowsWithPayoff.length
    ? flowsWithPayoff.reduce((s, f) => s + (f.payoff || 0), 0) / flowsWithPayoff.length
    : 0;
  const avgUtilCurrent = updatedLinks.length
    ? updatedLinks.reduce((s, l) => s + (l.stats?.utilization || 0), 0) / updatedLinks.length
    : 0;
  const payoffsThisRound = flowsWithPayoff.map(f => f.payoff || 0);
  const payoffStdDevVal = stdDev(payoffsThisRound);

  const currentRoundEntry = {
    round: currentRound,
    avgFairness: parseFloat(fairness.toFixed(3)),
    avgPayoff: parseFloat(avgPayoffCurrent.toFixed(2)),
    avgUtilization: parseFloat(avgUtilCurrent.toFixed(3)),
    avgThroughput: parseFloat(totalThroughput.toFixed(1)),
    payoffStdDev: parseFloat(payoffStdDevVal.toFixed(3))
  };

  const updatedEquilibriumHistory = [...(equilibriumHistory || []), currentRoundEntry];
  const recentRounds = updatedEquilibriumHistory.slice(-EQUILIBRIUM_WINDOW);

  // Initialize or retrieve stats
  let stats = lastStats ? { ...lastStats } : {
    lastUpdateRound: 0,
    averagePayoff: 0,
    averageFairness: 0,
    stabilityScore: 0,
    volatilityIndex: 0,
    confidence: 0,
    equilibrium: false
  };

  const lastMultiple = Math.floor(currentRound / EQUILIBRIUM_WINDOW) * EQUILIBRIUM_WINDOW;
  if (stats && stats.lastUpdateRound === 0 && lastMultiple > 0 && updatedEquilibriumHistory.length >= lastMultiple) {
    const sliceAtMultiple = updatedEquilibriumHistory.slice(0, lastMultiple);
    const recentRoundsAtMultiple = sliceAtMultiple.slice(-EQUILIBRIUM_WINDOW);
    const payoffs = recentRoundsAtMultiple.map(r => r.avgPayoff);
    const meanPayoffs = payoffs.reduce((a, b) => a + b, 0) / (payoffs.length || 1);
    const sdPayoffs = stdDev(payoffs);
    const normSd = sdPayoffs / Math.max(15.0, Math.abs(meanPayoffs));
    const stabilityScoreVal = Math.round(Math.max(0, 1 - normSd) * 100);
    const volatilityIndexVal = 100 - stabilityScoreVal;
    const isStable = stabilityScoreVal >= 80;

    const avgPayoffVal = recentRoundsAtMultiple.reduce((sum, r) => sum + r.avgPayoff, 0) / (recentRoundsAtMultiple.length || 1);
    const avgFairnessVal = recentRoundsAtMultiple.reduce((sum, r) => sum + r.avgFairness, 0) / (recentRoundsAtMultiple.length || 1);

    stats = {
      lastUpdateRound: lastMultiple,
      averagePayoff: parseFloat(avgPayoffVal.toFixed(2)),
      averageFairness: parseFloat(avgFairnessVal.toFixed(3)),
      stabilityScore: stabilityScoreVal,
      volatilityIndex: volatilityIndexVal,
      confidence: isStable ? 100 : 0,
      equilibrium: isStable
    };
  }

  const roundsSinceLastUpdate = currentRound - stats.lastUpdateRound;

  if (currentRound % EQUILIBRIUM_WINDOW === 0) {
    const payoffs = recentRounds.map(r => r.avgPayoff);
    const meanPayoffs = payoffs.reduce((a, b) => a + b, 0) / (payoffs.length || 1);
    const sdPayoffs = stdDev(payoffs);
    const normSd = sdPayoffs / Math.max(15.0, Math.abs(meanPayoffs));
    const stabilityScoreVal = Math.round(Math.max(0, 1 - normSd) * 100);
    const volatilityIndexVal = 100 - stabilityScoreVal;
    const isStable = stabilityScoreVal >= 80;

    const avgPayoffVal = recentRounds.reduce((sum, r) => sum + r.avgPayoff, 0) / (recentRounds.length || 1);
    const avgFairnessVal = recentRounds.reduce((sum, r) => sum + r.avgFairness, 0) / (recentRounds.length || 1);

    stats = {
      lastUpdateRound: currentRound,
      averagePayoff: parseFloat(avgPayoffVal.toFixed(2)),
      averageFairness: parseFloat(avgFairnessVal.toFixed(3)),
      stabilityScore: stabilityScoreVal,
      volatilityIndex: volatilityIndexVal,
      confidence: isStable ? 100 : 0,
      equilibrium: isStable
    };
  } else {
    // Non-multiple round: check for immediate anomalies / sudden deviations
    if (stats.equilibrium && updatedEquilibriumHistory.length >= 2) {
      const previousRounds = recentRounds.slice(0, -1);
      const avgFairnessRecent = previousRounds.reduce((sum, r) => sum + r.avgFairness, 0) / (previousRounds.length || 1);
      const avgUtilRecent = previousRounds.reduce((sum, r) => sum + r.avgUtilization, 0) / (previousRounds.length || 1);

      const fairnessDrop = currentRoundEntry.avgFairness < avgFairnessRecent - 0.15;
      const utilSpike = currentRoundEntry.avgUtilization > avgUtilRecent + 0.30;

      if (fairnessDrop || utilSpike) {
        stats.equilibrium = false;
        stats.confidence = 0;
        stats.stabilityScore = 0;
        stats.volatilityIndex = 100;
      } else {
        stats.confidence = Math.max(0, 100 - Math.round((roundsSinceLastUpdate / EQUILIBRIUM_WINDOW) * 100));
      }
    } else {
      stats.confidence = 0;
    }
  }

  if (stats.confidence < 30) {
    stats.equilibrium = false;
  }

  return {
    flows: nextFlows,
    links: updatedLinks,
    linkLoss,
    linkUtil,
    linkDemand,
    fairness,
    totalThroughput,
    equilibrium: stats.equilibrium,
    congestedNodes,
    flowsWithPayoff: flowsWithFinalLatency,
    newHistories,
    networkStats,
    bottleneckUtil: bottleneckKey ? (linkUtil[bottleneckKey] || 0) : 0,
    bottleneckKey,
    insight: deriveInsight(flowsWithFinalLatency, fairness, stats.equilibrium, bottleneckKey),
    equilibriumHistory: updatedEquilibriumHistory,
    equilibriumStats: stats,
    nodeQueueStats,
    networkQueueStats,
    networkLatencyStats,
  };
}

// ── Init simulation ──────────────────────────────────────────
export function initSimulation(customFlows = null, topologyNodes = [], topologyLinks = []) {
  // Reset AIMD state
  Object.keys(aimdState).forEach(k => delete aimdState[k]);
  const flows = (customFlows || DEFAULT_FLOWS).map(f => {
    const baseRate = f.baseRate || f.rate || 40;
    return {
      ...f,
      baseRate,
      rate: baseRate,
      ccRate: f.ccRate || baseRate,
      trafficProfile: f.trafficProfile || 'conservative',
      trafficStats: f.trafficStats || {
        offeredRate: baseRate,
        sendingRate: baseRate,
        utilization: 1.0,
      },
      history: f.history || [],
      throughput: 0,
      delay: 0,
      lossRate: 0,
      payoff: 0,
      maxUtil: 0,
    };
  });

  // Initialize per-node queue stats for all topology nodes
  const drainRates = buildDrainRates(topologyLinks.length ? topologyLinks : DEFAULT_LINKS);
  const nodeIds = new Set();
  (topologyNodes.length ? topologyNodes : DEFAULT_NODES).forEach(n => {
    nodeIds.add(typeof n === 'string' ? n : n.id);
  });
  flows.forEach(f => f.path.forEach(n => nodeIds.add(n)));

  const nodeQueueStats = {};
  nodeIds.forEach(nodeId => {
    nodeQueueStats[nodeId] = {
      queueSize: 0,
      queueCapacity: DEFAULT_QUEUE_CAPACITY,
      drainRate: parseFloat((drainRates[nodeId] || 0).toFixed(1)),
      incomingTraffic: 0,
      processedTraffic: 0,
      queuedPackets: 0,
      droppedThisRound: 0,
      droppedPackets: 0,
      queueUtilization: 0,
      totalIncomingPackets: 0,
      packetLossRate: 0,
    };
  });

  return {
    flows,
    payoffHistories: flows.map(() => []),
    nodeQueueStats,
  };
}

// ============================================================
// Backward Compatibility Exports
// ============================================================

// Old aliases used by existing UI components
export const LINKS = DEFAULT_LINKS;
export const NODES = DEFAULT_NODES;

// Node positions for NetworkTopology
export const NODE_POSITIONS = {
  A: { x: 80, y: 130 },
  B: { x: 220, y: 60 },
  C: { x: 220, y: 200 },
  D: { x: 380, y: 130 },
  E: { x: 520, y: 130 },
  F: { x: 660, y: 130 },
  G: { x: 820, y: 60 },
  H: { x: 820, y: 200 },
};

// Scenario presets
export const SCENARIOS = {
  mixed: {
    name: 'Mixed Strategies',
    icon: '⚖️',
    desc: 'Combination of aggressive, adaptive and conservative flows.',
  },

  low_traffic: {
    name: 'Low Traffic',
    icon: '🟢',
    desc: 'Low utilization with almost no congestion.',
  },

  heavy_congestion: {
    name: 'Heavy Congestion',
    icon: '🔴',
    desc: 'Aggressive flows overload the bottleneck.',
  },

  burst_traffic: {
    name: 'Burst Traffic',
    icon: '📈',
    desc: 'Rapid traffic spikes and unstable queues.',
  },

  fairness_critical: {
    name: 'Fairness Critical',
    icon: '⚖️',
    desc: 'Adaptive flows maximize Jain fairness.',
  },

  adaptive_env: {
    name: 'Adaptive Environment',
    icon: '🔄',
    desc: 'Mixed AIMD and adaptive flows co-exist.',
  },
};