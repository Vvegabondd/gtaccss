import React, { useMemo, useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { SCENARIOS, initSimulation, simulationStep, DEFAULT_FLOWS } from '../simulation/engine';

const SCENARIO_COLORS = {
  heavy_congestion: '#ef4444',
  fairness_critical: '#3b82f6',
  low_traffic: '#22c55e',
  mixed: '#f59e0b',
  adaptive_env: '#8b5cf6',
  burst_traffic: '#06b6d4',
};

const SCENARIO_KEYS = Object.keys(SCENARIOS);

function stddev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + ((b - mean) * (b - mean)), 0) / values.length;
  return Math.sqrt(variance);
}

function buildScenarioFlows(baseFlows, scenarioKey) {
  const safeBase = (baseFlows && baseFlows.length ? baseFlows : DEFAULT_FLOWS).map(f => ({ ...f }));

  switch (scenarioKey) {
    case 'low_traffic':
      return safeBase.map((f, i) => ({
        ...f,
        strategy: i % 2 === 0 ? 'conservative' : 'adaptive',
        rate: Math.max(8, Math.round((f.rate || 25) * 0.45)),
      }));
    case 'heavy_congestion':
      return safeBase.map(f => ({ ...f, strategy: 'aggressive', rate: Math.max(55, Math.round((f.rate || 40) * 1.55)) }));
    case 'burst_traffic':
      return safeBase.map((f, i) => ({
        ...f,
        strategy: i % 2 === 0 ? 'aggressive' : 'aimd',
        rate: Math.max(35, Math.round((f.rate || 35) * (i % 2 === 0 ? 1.45 : 1.15))),
      }));
    case 'fairness_critical':
      return safeBase.map(f => ({ ...f, strategy: 'adaptive', rate: Math.max(25, Math.round((f.rate || 30) * 0.9)) }));
    case 'adaptive_env':
      return safeBase.map((f, i) => ({ ...f, strategy: i % 2 === 0 ? 'adaptive' : 'aimd', rate: Math.max(28, Math.round((f.rate || 32) * 1.0)) }));
    case 'mixed':
    default: {
      const cycle = ['aggressive', 'adaptive', 'conservative', 'aimd'];
      return safeBase.map((f, i) => ({ ...f, strategy: cycle[i % cycle.length], rate: Math.max(30, Math.round(f.rate || 35)) }));
    }
  }
}

function summarizeStability(eqRound, tpSeries) {
  if (eqRound != null) {
    if (eqRound <= 20) return 'Perfect';
    if (eqRound <= 40) return 'Stable';
    return 'Moderate';
  }
  const recent = tpSeries.slice(-12);
  const mean = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const cv = Math.abs(mean) < 1e-6 ? 1 : (stddev(recent) / Math.abs(mean));
  if (cv < 0.08) return 'Stable';
  if (cv < 0.18) return 'Moderate';
  if (cv < 0.32) return 'Low';
  return 'Chaotic';
}

function buildInsight(result) {
  if (result.loss > 40) return 'High offered load is causing sustained packet loss and payoff collapse. Consider less aggressive strategies or lower initial rates.';
  if (result.fairness > 0.9 && result.loss < 10) return 'Flows are sharing bandwidth effectively with low loss and strong payoff, indicating healthy decentralized adaptation.';
  if (result.equilibriumText.startsWith('Round')) return 'The system converged to a stable operating point; flows now have little incentive to deviate unilaterally.';
  return 'The network remains adaptive with partial convergence; strategy mix and offered load still create trade-offs across fairness, loss, and payoff.';
}

export default function ComparisonTab({ baseFlows = DEFAULT_FLOWS, links = [], alpha = 0.3, beta = 2.0 }) {
  const [active, setActive] = useState('mixed');

  const simulationResults = useMemo(() => {
    const rounds = 60;
    const out = {};

    SCENARIO_KEYS.forEach(key => {
      const seededFlows = buildScenarioFlows(baseFlows, key);
      let { flows, payoffHistories } = initSimulation(seededFlows);

      let eqRound = null;
      const tpSeries = [];
      const fairnessSeries = [];
      const lossSeries = [];
      const payoffSeries = [];

      for (let r = 1; r <= rounds; r += 1) {
        const result = simulationStep(flows, payoffHistories, links, alpha, beta);
        flows = result.flows;
        payoffHistories = result.newHistories;

        if (result.equilibrium && eqRound == null) eqRound = r;

        tpSeries.push(result.totalThroughput || 0);
        fairnessSeries.push(result.fairness || 0);
        const avgLoss = (result.flowsWithPayoff || []).length
          ? result.flowsWithPayoff.reduce((s, f) => s + (f.lossRate || 0), 0) / result.flowsWithPayoff.length
          : 0;
        const avgPayoff = (result.flowsWithPayoff || []).length
          ? result.flowsWithPayoff.reduce((s, f) => s + (f.payoff || 0), 0) / result.flowsWithPayoff.length
          : 0;
        lossSeries.push(avgLoss * 100);
        payoffSeries.push(avgPayoff);
      }

      const tail = 10;
      const avg = arr => {
        const recent = arr.slice(-tail);
        return recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      };

      const throughput = avg(tpSeries);
      const fairness = avg(fairnessSeries);
      const loss = avg(lossSeries);
      const payoff = avg(payoffSeries);
      const equilibriumText = eqRound == null ? 'Not reached' : `Round ${eqRound}`;
      const stability = summarizeStability(eqRound, tpSeries);

      out[key] = {
        throughput,
        fairness,
        loss,
        payoff,
        eqRound,
        equilibriumText,
        stability,
      };
    });

    return out;
  }, [baseFlows, links, alpha, beta]);

  const radarData = useMemo(() => {
    const keys = SCENARIO_KEYS;
    const maxThroughput = Math.max(...keys.map(k => simulationResults[k]?.throughput || 0), 1);
    const minPayoff = Math.min(...keys.map(k => simulationResults[k]?.payoff || 0));
    const maxPayoff = Math.max(...keys.map(k => simulationResults[k]?.payoff || 0));
    const payoffRange = Math.max(1, maxPayoff - minPayoff);

    const row = (axis, scoreFn) => {
      const obj = { axis };
      keys.forEach(k => {
        obj[k] = Math.max(0, Math.min(100, scoreFn(simulationResults[k])));
      });
      return obj;
    };

    return [
      row('Throughput', r => ((r?.throughput || 0) / maxThroughput) * 100),
      row('Fairness', r => (r?.fairness || 0) * 100),
      row('Stability', r => {
        if (!r) return 0;
        if (r.stability === 'Perfect') return 98;
        if (r.stability === 'Stable') return 85;
        if (r.stability === 'Moderate') return 65;
        if (r.stability === 'Low') return 40;
        return 15;
      }),
      row('Low Loss', r => 100 - (r?.loss || 0)),
      row('Payoff', r => (((r?.payoff || 0) - minPayoff) / payoffRange) * 100),
    ];
  }, [simulationResults]);

  const result = simulationResults[active] || simulationResults.mixed || {
    throughput: 0,
    fairness: 0,
    loss: 0,
    payoff: 0,
    eqRound: null,
    equilibriumText: 'Not reached',
    stability: 'Low',
  };
  const sc = SCENARIOS[active] || SCENARIOS.mixed;

  // Bar chart comparing all scenarios
  const barData = SCENARIO_KEYS.map(key => {
    const r = simulationResults[key] || result;
    return {
      name: SCENARIOS[key].name,
      Throughput: Math.round(r.throughput),
      Fairness: Math.round(r.fairness * 100),
      LowLoss: Math.round(100 - r.loss),
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <h2 style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, color: '#1a2340' }}>
        Strategy Comparison Module
      </h2>

      <div className="info-box">
        Compare how different strategy compositions affect network performance, fairness, and stability.
        These values are computed dynamically by simulating each scenario over your current topology and parameters.
      </div>

      {/* Scenario selector tabs */}
      <div className="scenario-tabs">
        {SCENARIO_KEYS.map(key => (
          <button key={key} className={`scenario-tab ${active === key ? 'active' : ''}`}
            onClick={() => setActive(key)}>
            {SCENARIOS[key].name}
          </button>
        ))}
      </div>

      {/* Active scenario detail */}
      <div className="grid-32">
        {/* Left: metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <span>📋</span>
              <span className="card-title">{sc.name} — Results</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Avg Throughput', val: `${result.throughput.toFixed(1)} Mbps`, color: '#2563eb' },
                  { label: 'Jain Fairness', val: result.fairness.toFixed(3), color: '#16a34a' },
                  { label: 'Packet Loss', val: `${result.loss.toFixed(1)}%`, color: result.loss > 20 ? '#ef4444' : '#16a34a' },
                  { label: 'Equilibrium', val: result.equilibriumText, color: result.eqRound == null ? '#ef4444' : '#3b82f6' },
                  { label: 'Stability', val: result.stability, color: '#f59e0b' },
                  { label: 'Avg Payoff', val: result.payoff.toFixed(1), color: result.payoff < 0 ? '#ef4444' : '#16a34a' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: '#f8faff', border: '1px solid #dde3f0',
                    borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, color: '#8892b0',
                      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Insight */}
              <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe',
                borderLeft: '4px solid #2563eb', borderRadius: 8, padding: 14 }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12,
                  color: '#1d4ed8', marginBottom: 6 }}>💡 Analysis</div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, color: '#1e3a8a', lineHeight: 1.6 }}>
                  {buildInsight(result)}
                </div>
              </div>
            </div>
          </div>

          {/* Summary table */}
          <div className="card">
            <div className="card-header">
              <span>📊</span>
              <span className="card-title">All Scenarios — Quick Compare</span>
            </div>
            <div className="table-scroll">
              <table className="flow-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Throughput</th>
                    <th>Fairness</th>
                    <th>Loss</th>
                    <th>Equilibrium</th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIO_KEYS.map(key => {
                    const r = simulationResults[key] || result;
                    const isActive = key === active;
                    return (
                      <tr key={key} onClick={() => setActive(key)} style={{
                        cursor: 'pointer',
                        background: isActive ? '#eff6ff' : undefined,
                      }}>
                        <td style={{ fontWeight: isActive ? 700 : 400, color: isActive ? '#1d4ed8' : undefined }}>
                          {SCENARIOS[key].name}
                        </td>
                        <td className="mono">{r.throughput.toFixed(1)} Mbps</td>
                        <td className="mono">{r.fairness.toFixed(3)}</td>
                        <td className="mono" style={{ color: r.loss > 20 ? '#ef4444' : '#16a34a' }}>{r.loss.toFixed(1)}%</td>
                        <td>
                          <span style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 600,
                            color: r.eqRound == null ? '#ef4444' : '#3b82f6' }}>
                            {r.equilibriumText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Radar + Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <span>🕸️</span>
              <span className="card-title">Strategy Radar (5-Axis Comparison)</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0"/>
                  <PolarAngleAxis dataKey="axis"
                    tick={{ fontSize: 11, fontFamily: 'Space Grotesk', fill: '#4a5578' }}/>
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false}/>
                  {SCENARIO_KEYS.map(key => (
                    <Radar
                      key={key}
                      name={SCENARIOS[key].name}
                      dataKey={key}
                      stroke={SCENARIO_COLORS[key] || '#64748b'}
                      fill={SCENARIO_COLORS[key] || '#64748b'}
                      fillOpacity={active === key ? 0.24 : 0.1}
                      strokeWidth={active === key ? 2.4 : 1.6}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Space Grotesk' }}/>
                  <Tooltip contentStyle={{ fontFamily: 'Space Grotesk', fontSize: 12 }}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span>📊</span>
              <span className="card-title">Performance Bar Chart</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff"/>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Space Grotesk' }}/>
                  <YAxis tick={{ fontSize: 10 }}/>
                  <Tooltip contentStyle={{ fontFamily: 'Space Grotesk', fontSize: 12 }}/>
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Space Grotesk' }}/>
                  <Bar dataKey="Throughput" fill="#2563eb" radius={[4,4,0,0]}/>
                  <Bar dataKey="Fairness" fill="#16a34a" radius={[4,4,0,0]}/>
                  <Bar dataKey="LowLoss" fill="#f59e0b" radius={[4,4,0,0]} name="Low-Loss Score"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
