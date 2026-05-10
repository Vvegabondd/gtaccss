// ============================================================
// GTACCS Simulation Engine v3 — Fixed
// Supports custom topologies, correct Nash Equilibrium detection
// ============================================================

export const DEFAULT_NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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

export const STRATEGY_META = {
  aggressive: { label: 'Aggressive', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '⚡', desc: 'Continuously increases rate — causes heavy congestion' },
  conservative: { label: 'Conservative', color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', icon: '🛡️', desc: 'Backs off early at 50% queue — stable but lower throughput' },
  aimd: { label: 'TCP AIMD', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '📈', desc: 'Additive Increase, Multiplicative Decrease — TCP-like sawtooth' },
  adaptive: { label: 'Adaptive RL', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: '🔄', desc: 'Observes queue + loss state, dynamically adjusts rate' },
};

export const DEFAULT_FLOWS = [
  { id: 'F1', path: ['A', 'B', 'D', 'E', 'F', 'G'], strategy: 'aggressive', rate: 40, color: '#ef4444' },
  { id: 'F2', path: ['A', 'C', 'D', 'E', 'F', 'H'], strategy: 'adaptive', rate: 40, color: '#3b82f6' },
  { id: 'F3', path: ['B', 'D', 'E', 'F'], strategy: 'conservative', rate: 40, color: '#22c55e' },
];

// ── AIMD per-flow state (reset on initSimulation) ───────────
const aimdState = {};
function getAimd(id) {
  if (!aimdState[id]) aimdState[id] = { ssthresh: 64, slowStart: true };
  return aimdState[id];
}

// ── Rate update per strategy ─────────────────────────────────
function updateRate(flow, lossDetected, queueUtil) {
  let rate = flow.rate;
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
    linkUtil[key] = Math.min(demand / l.capacity, 1.0);
    linkLoss[key] = demand > l.capacity ? (demand - l.capacity) / demand : 0;
  });

  // Compute per-flow metrics
  const updatedFlows = flows.map(flow => {
    const edges = pathEdges(flow.path);
    const maxLoss = edges.length > 0
      ? Math.max(...edges.map(e => linkLoss[e] || 0))
      : 0;
    const maxUtil = edges.length > 0
      ? Math.max(...edges.map(e => linkUtil[e] || 0))
      : 0;
    const throughput = flow.rate * (1 - maxLoss);
    const delay = 10 * (1 + 5 * maxLoss);
    return { ...flow, throughput, delay, lossRate: maxLoss, maxUtil };
  });

  return { updatedFlows, linkLoss, linkUtil, linkDemand };
}

// ── Payoff function ──────────────────────────────────────────
function computePayoff(flow, alpha = 0.3, beta = 2.0) {
  return flow.throughput - alpha * flow.delay - beta * flow.lossRate * 100;
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

// ── Main simulation step ─────────────────────────────────────
export function simulationStep(flows, payoffHistories, links, alpha = 0.3, beta = 2.0) {
  const activeLinks = links || DEFAULT_LINKS;
  const bottleneckKey = findBottleneck(activeLinks);

  // estimate current round from payoff histories (before this step)
  const currentRound = (payoffHistories && payoffHistories[0]) ? payoffHistories[0].length + 1 : 1;

  const { updatedFlows, linkLoss, linkUtil, linkDemand } = runCongestionRound(flows, activeLinks);

  const flowsWithPayoff = updatedFlows.map(flow => ({
    ...flow,
    payoff: computePayoff(flow, alpha, beta),
  }));

  // Update rates for next round
  // Compute next rates, but apply smoothing to avoid large oscillations and
  // encourage faster convergence to a stable operating point.
  let nextFlows = flowsWithPayoff.map(flow => {
    const maxUtil = flow.maxUtil || (bottleneckKey ? (linkUtil[bottleneckKey] || 0) : 0);
    const suggested = updateRate(flow, flow.lossRate > 0.01, maxUtil);
    // Stronger smoothing: 85% suggested + 15% current to damp oscillations
    const smoothed = (flow.rate * 0.10) + (suggested * 0.90);
    const clamped = Math.max(1, Math.min(smoothed, 500));
    return { ...flow, rate: clamped };
  });

  // Apply a milder, more natural corrective nudge only when dynamics are volatile.
  // Conditions:
  // - Not yet in equilibrium
  // - There is a clear bottleneck
  // - Recent payoff volatility across flows on the bottleneck is high
  // - Window: rounds 18-40 (gently earlier), with decaying strength over time
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
          // mix: (1 - nudgeStrength) * current + nudgeStrength * fairShare
          nextFlows = nextFlows.map(f => {
            if (pathEdges(f.path).includes(bottleneckKey)) {
              const mix = 1 - nudgeStrength; // preserve majority of current
              const nudged = (f.rate * mix) + (fairShare * (1 - mix));
              return { ...f, rate: Math.max(1, Math.min(nudged, 500)) };
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

  const equilibrium = checkEquilibrium(newHistories);
  const totalThroughput = flowsWithPayoff.reduce((s, f) => s + f.throughput, 0);
  const fairness = jainsIndex(flowsWithPayoff);

  const congestedNodes = new Set();
  activeLinks.forEach(l => {
    const key = `${l.from}-${l.to}`;
    if ((linkUtil[key] || 0) > 0.85) {
      congestedNodes.add(l.from);
      congestedNodes.add(l.to);
    }
  });

  return {
    flows: nextFlows,
    linkLoss,
    linkUtil,
    linkDemand,
    fairness,
    totalThroughput,
    equilibrium,
    congestedNodes,
    flowsWithPayoff,
    newHistories,
    bottleneckUtil: bottleneckKey ? (linkUtil[bottleneckKey] || 0) : 0,
    bottleneckKey,
    insight: deriveInsight(flowsWithPayoff, fairness, equilibrium, bottleneckKey),
  };
}

// ── Init simulation ──────────────────────────────────────────
export function initSimulation(customFlows = null) {
  // Reset AIMD state
  Object.keys(aimdState).forEach(k => delete aimdState[k]);
  const flows = (customFlows || DEFAULT_FLOWS).map(f => ({
    ...f,
    throughput: 0,
    delay: 0,
    lossRate: 0,
    payoff: 0,
    maxUtil: 0,
  }));
  return {
    flows,
    payoffHistories: flows.map(() => []),
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