import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import TopologyBuilder from './components/TopologyBuilder';
import ImportTab from './components/ImportTab';
import Dashboard from './components/Dashboard';
import FlowsTab from './components/FlowsTab';
import PayoffTab from './components/PayoffTab';
import ComparisonTab from './components/ComparisonTab';
import AnalyticsTab from './components/AnalyticsTab';
import { simulationStep, initSimulation, DEFAULT_FLOWS } from './simulation/engine';

const SPEED_MAP = { '0.5x': 2000, '1x': 1000, '2x': 500, '5x': 200, '10x': 100 };

const TABS = [
  { id: 'topology', label: '🗺 Topology' },
  { id: 'import', label: '📥 Import Data' },
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'analytics', label: '🧮 Analytics' },
  { id: 'flows', label: '🔀 Flows' },
  { id: 'payoff', label: '💰 Payoff' },
  { id: 'comparison', label: '⚔️ Compare' },
];

// Default topology mirrors the builder's defaults
const DEFAULT_TOPOLOGY = {
  nodes: [
    { id: 'A', x: 80, y: 190 },
    { id: 'B', x: 220, y: 100 },
    { id: 'C', x: 220, y: 290 },
    { id: 'D', x: 380, y: 190 },
    { id: 'E', x: 500, y: 190 },
    { id: 'F', x: 620, y: 190 },
    { id: 'G', x: 750, y: 100 },
    { id: 'H', x: 750, y: 290 },
  ],
  links: [
    { from: 'A', to: 'B', capacity: 100 },
    { from: 'A', to: 'C', capacity: 80 },
    { from: 'B', to: 'D', capacity: 60 },
    { from: 'C', to: 'D', capacity: 70 },
    { from: 'D', to: 'E', capacity: 50 },
    { from: 'E', to: 'F', capacity: 100 },
    { from: 'F', to: 'G', capacity: 90 },
    { from: 'F', to: 'H', capacity: 80 },
  ],
  flows: [
    { id: 'F1', path: ['A', 'B', 'D', 'E', 'F', 'G'], strategy: 'aggressive', rate: 40, color: '#ef4444' },
    { id: 'F2', path: ['A', 'C', 'D', 'E', 'F', 'H'], strategy: 'adaptive', rate: 40, color: '#3b82f6' },
    { id: 'F3', path: ['B', 'D', 'E', 'F'], strategy: 'conservative', rate: 40, color: '#22c55e' },
  ],
};

export default function App() {
  const [tab, setTab] = useState('topology');

  // ── Topology state (source of truth from TopologyBuilder) ──
  const [topology, setTopology] = useState(DEFAULT_TOPOLOGY);

  // ── Simulation state ──────────────────────────────────────
  const [round, setRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState('1x');
  const [alpha, setAlpha] = useState(0.3);
  const [beta, setBeta] = useState(2.0);
  const [equilibrium, setEquilibrium] = useState(false);
  const [equilibriumRound, setEquilibriumRound] = useState(null);

  const [flows, setFlows] = useState(() => {
    const init = initSimulation(DEFAULT_TOPOLOGY.flows);
    return init.flows;
  });
  const [payoffHistories, setPayoffHistories] = useState(() => {
    const init = initSimulation(DEFAULT_TOPOLOGY.flows);
    return init.payoffHistories;
  });
  const [linkUtil, setLinkUtil] = useState({});
  const [linkLoss, setLinkLoss] = useState({});
  const [linkDemand, setLinkDemand] = useState({});
  const [fairness, setFairness] = useState(0);
  const [totalThroughput, setTotalThroughput] = useState(0);
  const [congestedNodes, setCongestedNodes] = useState(new Set());
  const [flowsWithPayoff, setFlowsWithPayoff] = useState([]);
  const [historyChart, setHistoryChart] = useState([]);

  const timerRef = useRef(null);
  const stateRef = useRef({ flows, payoffHistories, alpha, beta, topology });
  const equilibriumRef = useRef(false);

  useEffect(() => {
    stateRef.current = { flows, payoffHistories, alpha, beta, topology };
  }, [flows, payoffHistories, alpha, beta, topology]);

  // When topology flows change (from builder), reinit simulation
  const prevFlowIdsRef = useRef(topology.flows.map(f => f.id).join(','));
  useEffect(() => {
    const newIds = topology.flows.map(f => f.id).join(',');
    // Only reinit if something meaningful changed (avoids reinit on every canvas drag)
    const flowsChanged = newIds !== prevFlowIdsRef.current ||
      topology.flows.some((f, i) => {
        const old = flows[i];
        return !old || old.id !== f.id || old.strategy !== f.strategy ||
          JSON.stringify(old.path) !== JSON.stringify(f.path);
      });

    if (flowsChanged) {
      prevFlowIdsRef.current = newIds;
      doReset(topology.flows);
    }
  }, [topology.flows]);

  const doStep = useCallback(() => {
    const {
      flows: curFlows,
      payoffHistories: curHistories,
      alpha: a,
      beta: b,
      topology: topo,
    } = stateRef.current;

    // Safety fallback
    const links = Array.isArray(topo?.links) ? topo.links : [];

    const result = simulationStep(
      curFlows,
      curHistories,
      links,
      a,
      b
    );

    setFlows(result.flows);
    setPayoffHistories(result.newHistories);
    setLinkUtil(result.linkUtil);
    setLinkLoss(result.linkLoss);
    setLinkDemand(result.linkDemand);
    setFairness(result.fairness);
    setTotalThroughput(result.totalThroughput);
    const isEquilibriumLatched = equilibriumRef.current || result.equilibrium;
    setEquilibrium(isEquilibriumLatched);
    setCongestedNodes(result.congestedNodes);
    setFlowsWithPayoff(result.flowsWithPayoff);

    setRound(r => {
      const newRound = r + 1;
      if (result.equilibrium && !equilibriumRef.current) {
        equilibriumRef.current = true;
        setEquilibriumRound(newRound);
      }
      const point = {
        round: newRound,
        throughput: parseFloat(result.totalThroughput.toFixed(1)),
        fairness: parseFloat(result.fairness.toFixed(3)),
      };
      result.flowsWithPayoff.forEach(f => {
        point[`rate_${f.id}`] = parseFloat((f.rate || 0).toFixed(2));
        point[`payoff_${f.id}`] = parseFloat((f.payoff || 0).toFixed(2));
        point[`delay_${f.id}`] = parseFloat((f.delay || 0).toFixed(2));
        point[`loss_${f.id}`] = parseFloat(((f.lossRate || 0) * 100).toFixed(2));
        point[`throughput_${f.id}`] = parseFloat((f.throughput || 0).toFixed(2));
      });
      setHistoryChart(prev => [...prev, point]);
      return newRound;
    });
  }, []);

  useEffect(() => {
    if (running) {
      const interval = SPEED_MAP[speed] || 1000;
      timerRef.current = setInterval(doStep, interval);
    }
    return () => clearInterval(timerRef.current);
  }, [running, speed, doStep]);

  function doReset(flowDefs) {
    setRunning(false);
    clearInterval(timerRef.current);
    equilibriumRef.current = false;
    setRound(0);
    setEquilibrium(false);
    setEquilibriumRound(null);
    setFairness(0);
    setTotalThroughput(0);
    setLinkUtil({});
    setLinkLoss({});
    setLinkDemand({});
    setCongestedNodes(new Set());
    setFlowsWithPayoff([]);
    setHistoryChart([]);
    const init = initSimulation(flowDefs || topology.flows);
    setFlows(init.flows);
    setPayoffHistories(init.payoffHistories);
  }

  function handlePlayPause() { setRunning(r => !r); }
  function handleStep() { if (!running) doStep(); }
  function handleReset() { doReset(); }

  function handleUpdateFlows(newFlows) {
    equilibriumRef.current = false;
    const init = initSimulation(newFlows);
    setFlows(init.flows);
    setPayoffHistories(init.payoffHistories);
    setRound(0);
    setEquilibrium(false);
    setEquilibriumRound(null);
    setFairness(0);
    setTotalThroughput(0);
    setLinkUtil({});
    setLinkLoss({});
    setCongestedNodes(new Set());
    setFlowsWithPayoff([]);
    setHistoryChart([]);
    // Also sync back to topology
    setTopology(prev => ({ ...prev, flows: newFlows }));
  }

  const handleTopologyChange = useCallback((newTopology) => {
    setTopology(newTopology);
  }, []);

  function handleGoToDashboard() {
    // Reinit with current topology flows and switch to dashboard
    doReset(topology.flows);
    setTab('dashboard');
  }

  const handleImportSuccess = (payload) => {
    setTopology(payload.topology);

    const linkDemand = {};
    const linkUtil = {};
    const linkLoss = {};

    const activeLinks = payload.topology.links;
    activeLinks.forEach(l => {
      linkDemand[`${l.from}-${l.to}`] = 0;
    });

    payload.flows.forEach(flow => {
      for (let i = 0; i < flow.path.length - 1; i++) {
        const key = `${flow.path[i]}-${flow.path[i + 1]}`;
        if (linkDemand[key] !== undefined) {
          linkDemand[key] += flow.throughput;
        }
      }
    });

    activeLinks.forEach(l => {
      const key = `${l.from}-${l.to}`;
      const demand = linkDemand[key] || 0;
      linkUtil[key] = Math.min(demand / l.capacity, 1.0);
      linkLoss[key] = demand > l.capacity ? (demand - l.capacity) / demand : 0;
    });

    const x = payload.flows.map(f => f.throughput);
    const n = x.length;
    let fairness = 0;
    if (n > 0) {
      const s = x.reduce((a, b) => a + b, 0);
      const s2 = x.reduce((a, b) => a + b * b, 0);
      fairness = s2 === 0 ? 1 : (s * s) / (n * s2);
    }

    const totalThroughput = payload.flows.reduce((s, f) => s + f.throughput, 0);

    const congestedNodes = new Set();
    activeLinks.forEach(l => {
      const key = `${l.from}-${l.to}`;
      if ((linkUtil[key] || 0) > 0.85) {
        congestedNodes.add(l.from);
        congestedNodes.add(l.to);
      }
    });

    const flowsWithPayoff = payload.flows.map(flow => {
      let maxLoss = 0;
      let maxUtil = 0;
      for (let i = 0; i < flow.path.length - 1; i++) {
        const key = `${flow.path[i]}-${flow.path[i + 1]}`;
        maxLoss = Math.max(maxLoss, linkLoss[key] || 0);
        maxUtil = Math.max(maxUtil, linkUtil[key] || 0);
      }
      const payoff = flow.throughput - alpha * flow.delay - beta * (flow.lossRate * 100);
      return {
        ...flow,
        maxUtil,
        payoff
      };
    });

    const initialRoundPoint = {
      round: 1,
      throughput: parseFloat(totalThroughput.toFixed(1)),
      fairness: parseFloat(fairness.toFixed(3)),
    };
    flowsWithPayoff.forEach(f => {
      initialRoundPoint[`rate_${f.id}`] = parseFloat((f.rate || 0).toFixed(2));
      initialRoundPoint[`payoff_${f.id}`] = parseFloat((f.payoff || 0).toFixed(2));
      initialRoundPoint[`delay_${f.id}`] = parseFloat((f.delay || 0).toFixed(2));
      initialRoundPoint[`loss_${f.id}`] = parseFloat(((f.lossRate || 0) * 100).toFixed(2));
      initialRoundPoint[`throughput_${f.id}`] = parseFloat((f.throughput || 0).toFixed(2));
    });

    setRound(1);
    setRunning(false);
    equilibriumRef.current = false;
    setEquilibrium(false);
    setEquilibriumRound(null);
    setFairness(fairness);
    setTotalThroughput(totalThroughput);
    setLinkUtil(linkUtil);
    setLinkLoss(linkLoss);
    setLinkDemand(linkDemand);
    setCongestedNodes(congestedNodes);
    setFlowsWithPayoff(flowsWithPayoff);
    setHistoryChart([initialRoundPoint]);
    setFlows(payload.flows);
    setPayoffHistories(flowsWithPayoff.map(f => [f.payoff]));

    setTab('dashboard');
  };

  const sharedState = {
    flows,
    linkUtil,
    linkLoss,
    linkDemand,
    fairness,
    totalThroughput,
    equilibrium,
    equilibriumRound,
    round,
    congestedNodes,
    flowsWithPayoff,
    historyChart: historyChart.slice(-40),
  };

  const isSimTab = tab !== 'topology' && tab !== 'import';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo">GT<span>ACCS</span></div>
        <div className="header-pill">Game-Theoretic Adaptive Congestion Control</div>
        {tab !== 'topology' && tab !== 'import' && (
          <div className="header-pill" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {flows.map(f => (
              <span key={f.id} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: f.color, display: 'inline-block'
              }} />
            ))}
            {flows.length} Flows · {topology.nodes.length} Nodes · {topology.links.length} Links
          </div>
        )}
        <div className="header-spacer" />
        <nav className="nav-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`nav-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">

        {/* Sim controls — only on non-topology tabs */}
        {isSimTab && (
          <div className="sim-controls">
            <div className="sim-round">Round <span>{round}</span></div>

            <button className="ctrl-btn primary" onClick={handlePlayPause}>
              {running ? '⏸ Pause' : '▶ Play'}
            </button>
            <button className="ctrl-btn ghost" onClick={handleStep} disabled={running}>
              ⏭ Step
            </button>
            <button className="ctrl-btn danger" onClick={handleReset}>
              ↺ Reset
            </button>

            <select className="speed-select" value={speed} onChange={e => setSpeed(e.target.value)}>
              {Object.keys(SPEED_MAP).map(s => (
                <option key={s} value={s}>{s} Speed</option>
              ))}
            </select>

            <div className="ctrl-spacer" />

            {/* Edit topology shortcut */}
            <button onClick={() => { setRunning(false); setTab('topology'); }} style={{
              fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
              padding: '4px 12px', borderRadius: 100, cursor: 'pointer',
              border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text2)',
            }}>
              🗺 Edit Topology
            </button>

            <div className={`eq-badge ${equilibrium ? 'reached' : 'searching'}`}>
              {equilibrium
                ? `⚡ NASH EQ — Round ${equilibriumRound}`
                : '🔍 Searching...'}
            </div>

            {congestedNodes.size > 0 && (
              <div style={{
                background: '#dc2626', color: '#fff', borderRadius: 100,
                fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700,
                padding: '5px 12px', letterSpacing: 0.5, animation: 'pulse 1s infinite',
              }}>
                🔴 [{Array.from(congestedNodes).join(', ')}]
              </div>
            )}
          </div>
        )}

        {tab === 'topology' && (
          <TopologyBuilder
            topology={topology}
            onTopologyChange={handleTopologyChange}
            onGoToDashboard={handleGoToDashboard}
          />
        )}

        {tab === 'import' && (
          <ImportTab onImportSuccess={handleImportSuccess} />
        )}

        {tab === 'dashboard' && (
          <Dashboard
            state={sharedState}
            topology={topology}
            links={topology.links}
          />)}

        {tab === 'analytics' && (
          <AnalyticsTab
            state={{ ...sharedState, historyChart }}
            alpha={alpha}
            beta={beta}
            equilibriumRound={equilibriumRound}
            round={round}
            flows={flows}
            links={topology.links}
          />
        )}

        {tab === 'flows' && (
          <FlowsTab flows={flows} onUpdateFlows={handleUpdateFlows} running={running} />
        )}

        {tab === 'payoff' && (
          <PayoffTab state={sharedState} alpha={alpha} beta={beta}
            onAlpha={setAlpha} onBeta={setBeta} />
        )}

        {tab === 'comparison' && (
          <ComparisonTab
            baseFlows={topology.flows}
            links={topology.links}
            alpha={alpha}
            beta={beta}
          />
        )}
      </main>
    </div>
  );
}
