import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { compareResults, EVAL_SCENARIOS } from '../rl/evaluation';

const calculateStdDev = (rewards) => {
  if (!rewards || rewards.length < 2) return 0;
  const recent = rewards.slice(-15);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (recent.length - 1);
  return Math.sqrt(variance);
};

export default function RLEvaluationTab({ topology, a2cAgent, ddqnAgent, a3cAgent }) {
  const [activeScenario, setActiveScenario] = useState('mixed');
  const [evalData, setEvalData] = useState(null);

  // Run the evaluation whenever the scenario, topology, or agents change
  useEffect(() => {
    if (
      a2cAgent && a2cAgent.current &&
      ddqnAgent && ddqnAgent.current &&
      a3cAgent && a3cAgent.current
    ) {
      const results = compareResults(
        topology,
        a2cAgent.current,
        ddqnAgent.current,
        a3cAgent.current,
        activeScenario,
        100
      );
      setEvalData(results);
    }
  }, [topology, a2cAgent, ddqnAgent, a3cAgent, activeScenario]);

  // Handler to manually re-run evaluation
  const handleRefresh = () => {
    if (
      a2cAgent && a2cAgent.current &&
      ddqnAgent && ddqnAgent.current &&
      a3cAgent && a3cAgent.current
    ) {
      const results = compareResults(
        topology,
        a2cAgent.current,
        ddqnAgent.current,
        a3cAgent.current,
        activeScenario,
        100
      );
      setEvalData(results);
    }
  };

  const a2cTrained = useMemo(() => a2cAgent?.current?.episodeCount > 0, [a2cAgent?.current?.episodeCount]);
  const ddqnTrained = useMemo(() => ddqnAgent?.current?.episodeCount > 0, [ddqnAgent?.current?.episodeCount]);
  const a3cTrained = useMemo(() => a3cAgent?.current?.episodeCount > 0, [a3cAgent?.current?.episodeCount]);

  // Learning Curve and Stability metrics (Hooks moved here to prevent violation of rules of hooks)
  const maxEpisodes = Math.max(
    a2cAgent?.current?.episodeRewards?.length || 0,
    ddqnAgent?.current?.episodeRewards?.length || 0,
    a3cAgent?.current?.episodeRewards?.length || 0
  );

  const convergenceData = useMemo(() => {
    const data = [];
    for (let i = 0; i < maxEpisodes; i++) {
      data.push({
        episode: i + 1,
        'A2C Reward': a2cAgent?.current?.episodeRewards?.[i] !== undefined ? parseFloat(a2cAgent.current.episodeRewards[i].toFixed(4)) : null,
        'DDQN Reward': ddqnAgent?.current?.episodeRewards?.[i] !== undefined ? parseFloat(ddqnAgent.current.episodeRewards[i].toFixed(4)) : null,
        'A3C Reward': a3cAgent?.current?.episodeRewards?.[i] !== undefined ? parseFloat(a3cAgent.current.episodeRewards[i].toFixed(4)) : null
      });
    }
    return data;
  }, [maxEpisodes, a2cAgent, ddqnAgent, a3cAgent]);

  const stabilityData = useMemo(() => {
    return [
      {
        name: 'A2C RL',
        value: parseFloat(calculateStdDev(a2cAgent?.current?.episodeRewards).toFixed(4)),
        color: '#10b981'
      },
      {
        name: 'DDQN RL',
        value: parseFloat(calculateStdDev(ddqnAgent?.current?.episodeRewards).toFixed(4)),
        color: '#2563eb'
      },
      {
        name: 'A3C RL',
        value: parseFloat(calculateStdDev(a3cAgent?.current?.episodeRewards).toFixed(4)),
        color: '#8b5cf6'
      }
    ];
  }, [a2cAgent, ddqnAgent, a3cAgent]);

  if (!evalData) {
    return (
      <div className="empty-state">
        <span>No evaluation data available. Configure a topology and train your agents first.</span>
      </div>
    );
  }

  const { comparison, nash, a2c, ddqn, a3c } = evalData;

  // Format percent changes for display
  const formatPct = (val, invert = false) => {
    if (val === 0) return '0.0%';
    const sign = val > 0 ? '+' : '';
    const color = (val > 0 !== invert) ? 'var(--green)' : 'var(--red)';
    return <span style={{ color, fontWeight: 700 }}>{sign}{val.toFixed(1)}%</span>;
  };

  // Generate executive summary statements
  const summaryPoints = [];
  
  // Designate who is the overall winner for major metrics
  const getImprovementSummary = (metricKey, label, invert = false) => {
    const winner = comparison[metricKey].winner;
    if (winner === 'A2C' && comparison[metricKey].a2cPctChange !== 0) {
      const val = comparison[metricKey].a2cPctChange;
      if (invert && val < 0) {
        summaryPoints.push({ text: `A2C: ${label} reduction of ${Math.abs(val).toFixed(1)}%`, icon: '🤖' });
      } else if (!invert && val > 0) {
        summaryPoints.push({ text: `A2C: ${label} increase of +${val.toFixed(1)}%`, icon: '🤖' });
      }
    } else if (winner === 'DDQN' && comparison[metricKey].ddqnPctChange !== 0) {
      const val = comparison[metricKey].ddqnPctChange;
      if (invert && val < 0) {
        summaryPoints.push({ text: `DDQN: ${label} reduction of ${Math.abs(val).toFixed(1)}%`, icon: '⚡' });
      } else if (!invert && val > 0) {
        summaryPoints.push({ text: `DDQN: ${label} increase of +${val.toFixed(1)}%`, icon: '⚡' });
      }
    } else if (winner === 'A3C' && comparison[metricKey].a3cPctChange !== 0) {
      const val = comparison[metricKey].a3cPctChange;
      if (invert && val < 0) {
        summaryPoints.push({ text: `A3C: ${label} reduction of ${Math.abs(val).toFixed(1)}%`, icon: '🧬' });
      } else if (!invert && val > 0) {
        summaryPoints.push({ text: `A3C: ${label} increase of +${val.toFixed(1)}%`, icon: '🧬' });
      }
    }
  };

  getImprovementSummary('fairness', 'Fairness');
  getImprovementSummary('throughput', 'Throughput');
  getImprovementSummary('latency', 'Latency', true);
  getImprovementSummary('packetLoss', 'Packet Loss', true);

  // Round-by-round chart data
  const lineChartData = nash.steps.map((step, idx) => ({
    round: step.round,
    'Nash Reward': step.reward,
    'A2C Reward': a2c.steps[idx] ? a2c.steps[idx].reward : 0,
    'DDQN Reward': ddqn.steps[idx] ? ddqn.steps[idx].reward : 0,
    'A3C Reward': a3c.steps[idx] ? a3c.steps[idx].reward : 0
  }));

  // Grouped Bar Data Maker
  const makeBarData = (metricKey, isPercentage = false) => {
    const nashVal = comparison[metricKey].nash;
    const a2cVal = comparison[metricKey].a2c;
    const ddqnVal = comparison[metricKey].ddqn;
    const a3cVal = comparison[metricKey].a3c;
    return [
      {
        name: 'Nash',
        value: isPercentage ? parseFloat((nashVal * 100).toFixed(2)) : nashVal,
        color: '#f59e0b'
      },
      {
        name: 'A2C RL',
        value: isPercentage ? parseFloat((a2cVal * 100).toFixed(2)) : a2cVal,
        color: '#10b981'
      },
      {
        name: 'DDQN RL',
        value: isPercentage ? parseFloat((ddqnVal * 100).toFixed(2)) : ddqnVal,
        color: '#2563eb'
      },
      {
        name: 'A3C RL',
        value: isPercentage ? parseFloat((a3cVal * 100).toFixed(2)) : a3cVal,
        color: '#8b5cf6'
      }
    ];
  };

  const getWinnerTagClass = (winner) => {
    switch (winner) {
      case 'Nash': return 'tag-amber';
      case 'A2C': return 'tag-green';
      case 'DDQN': return 'tag-blue';
      case 'A3C': return 'tag-purple';
      default: return 'tag';
    }
  };

  return (
    <div className="rl-debug-container">
      {/* Untrained Alert Banner */}
      {(!a2cTrained || !ddqnTrained || !a3cTrained) && (
        <div style={{
          background: 'var(--amber-lt)',
          border: '1px solid var(--amber-md)',
          borderRadius: 'var(--r)',
          padding: '12px 16px',
          color: '#d97706',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <div>⚠️ <strong>Untrained Algorithm Alert:</strong></div>
          <div style={{ fontSize: 12 }}>
            {!a2cTrained && <span>• <strong>A2C agent</strong> is untrained. </span>}
            {!ddqnTrained && <span>• <strong>DDQN agent</strong> is untrained. </span>}
            {!a3cTrained && <span>• <strong>A3C agent</strong> is untrained. </span>}
            Go to the <strong>🤖 RL Debug</strong> tab, select the target algorithm, and run training episodes to retrieve comparison data.
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="rl-debug-grid">
        {/* Left Column: Presets & Scorecard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Scenario Selector */}
          <div className="rl-card">
            <div className="rl-card-title">Select Benchmarking Scenario</div>
            
            <div className="rl-controls-row">
              {Object.keys(EVAL_SCENARIOS).map(key => (
                <button
                  key={key}
                  className={`rl-btn ${activeScenario === key ? 'rl-btn-primary' : 'rl-btn-secondary'}`}
                  onClick={() => setActiveScenario(key)}
                >
                  {EVAL_SCENARIOS[key].name}
                </button>
              ))}
              <button
                className="rl-btn rl-btn-secondary"
                style={{ marginLeft: 'auto', background: 'var(--surface3)' }}
                onClick={handleRefresh}
              >
                🔄 Refresh Eval
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text2)', margin: '5px 0 0 0' }}>
              <strong>Scenario Description:</strong> {EVAL_SCENARIOS[activeScenario].desc}
            </p>
          </div>

          {/* Comparison Summary Card */}
          <div className="rl-card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderColor: 'var(--accent-md)' }}>
            <div className="rl-card-title" style={{ color: 'var(--accent)' }}>📋 Executive Performance Summary</div>
            
            {summaryPoints.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                Nash baseline is currently leading. Train A2C, DDQN, and A3C algorithms to achieve positive reinforcement optimization curves.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Under identical traffic conditions, the winning RL algorithm achieved:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {summaryPoints.map((p, idx) => (
                    <div key={idx} style={{
                      background: '#fff',
                      borderRadius: 'var(--r-sm)',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: '1px solid var(--accent-md)'
                    }}>
                      <span style={{ fontSize: 16 }}>{p.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{p.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comparison Scorecard Table */}
          <div className="rl-card">
            <div className="rl-card-title">📈 Metric Evaluation Scorecard</div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Metric</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Nash</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>A2C</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>DDQN</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>A3C</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600, textAlign: 'center' }}>Winner</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600, textAlign: 'right' }}>A2C / DDQN / A3C vs Nash</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 4px', fontWeight: 600 }}>Jain Fairness</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.fairness.nash.toFixed(3)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.fairness.a2c.toFixed(3)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.fairness.ddqn.toFixed(3)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.fairness.a3c.toFixed(3)}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <span className={getWinnerTagClass(comparison.fairness.winner)}>
                      {comparison.fairness.winner}
                    </span>
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                    {formatPct(comparison.fairness.a2cPctChange)} / {formatPct(comparison.fairness.ddqnPctChange)} / {formatPct(comparison.fairness.a3cPctChange)}
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 4px', fontWeight: 600 }}>Throughput (Mbps)</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.throughput.nash.toFixed(1)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.throughput.a2c.toFixed(1)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.throughput.ddqn.toFixed(1)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.throughput.a3c.toFixed(1)}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <span className={getWinnerTagClass(comparison.throughput.winner)}>
                      {comparison.throughput.winner}
                    </span>
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                    {formatPct(comparison.throughput.a2cPctChange)} / {formatPct(comparison.throughput.ddqnPctChange)} / {formatPct(comparison.throughput.a3cPctChange)}
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 4px', fontWeight: 600 }}>Latency (ms)</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.latency.nash.toFixed(1)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.latency.a2c.toFixed(1)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.latency.ddqn.toFixed(1)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.latency.a3c.toFixed(1)}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <span className={getWinnerTagClass(comparison.latency.winner)}>
                      {comparison.latency.winner}
                    </span>
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                    {formatPct(comparison.latency.a2cPctChange, true)} / {formatPct(comparison.latency.ddqnPctChange, true)} / {formatPct(comparison.latency.a3cPctChange, true)}
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 4px', fontWeight: 600 }}>Packet Loss (%)</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{(comparison.packetLoss.nash * 100).toFixed(1)}%</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{(comparison.packetLoss.a2c * 100).toFixed(1)}%</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{(comparison.packetLoss.ddqn * 100).toFixed(1)}%</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{(comparison.packetLoss.a3c * 100).toFixed(1)}%</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <span className={getWinnerTagClass(comparison.packetLoss.winner)}>
                      {comparison.packetLoss.winner}
                    </span>
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                    {formatPct(comparison.packetLoss.a2cPctChange, true)} / {formatPct(comparison.packetLoss.ddqnPctChange, true)} / {formatPct(comparison.packetLoss.a3cPctChange, true)}
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 4px', fontWeight: 600 }}>Average Reward</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.reward.nash.toFixed(3)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.reward.a2c.toFixed(3)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.reward.ddqn.toFixed(3)}</td>
                  <td style={{ padding: '10px 4px', fontFamily: 'var(--f-mono)' }}>{comparison.reward.a3c.toFixed(3)}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <span className={getWinnerTagClass(comparison.reward.winner)}>
                      {comparison.reward.winner}
                    </span>
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                    {formatPct(comparison.reward.a2cPctChange)} / {formatPct(comparison.reward.ddqnPctChange)} / {formatPct(comparison.reward.a3cPctChange)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Step-by-Step Trajectory comparison */}
        <div className="rl-card" style={{ height: '100%', minHeight: 400 }}>
          <div className="rl-card-title">⚡ Step-by-Step Reward Comparison</div>
          
          <div style={{ flex: 1, width: '100%', minHeight: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={lineChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="round" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 12
                  }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Line
                  name="Nash Equilibrium"
                  type="monotone"
                  dataKey="Nash Reward"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  name="A2C RL Agent"
                  type="monotone"
                  dataKey="A2C Reward"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  name="DDQN RL Agent"
                  type="monotone"
                  dataKey="DDQN Reward"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  name="A3C RL Agent"
                  type="monotone"
                  dataKey="A3C Reward"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grouped Bar Charts */}
      <div className="rl-card" style={{ marginTop: 10 }}>
        <div className="rl-card-title">📊 Key Metrics Distribution (Nash Baseline vs. A2C vs. DDQN vs. A3C)</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, minHeight: 220 }}>
          {/* Fairness Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Average Jain Fairness</span>
            <div style={{ width: '100%', height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={makeBarData('fairness')} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 1.0]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip formatter={(value) => value.toFixed(3)} />
                  <Bar dataKey="value" barSize={25} radius={[4, 4, 0, 0]}>
                    {makeBarData('fairness').map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Latency Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Average Latency (ms)</span>
            <div style={{ width: '100%', height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={makeBarData('latency')} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip formatter={(value) => `${value.toFixed(1)} ms`} />
                  <Bar dataKey="value" barSize={25} radius={[4, 4, 0, 0]}>
                    {makeBarData('latency').map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Packet Loss Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Average Packet Loss (%)</span>
            <div style={{ width: '100%', height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={makeBarData('packetLoss', true)} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                  <Bar dataKey="value" barSize={25} radius={[4, 4, 0, 0]}>
                    {makeBarData('packetLoss', true).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Convergence & Stability Section */}
      <div className="rl-card" style={{ marginTop: 20 }}>
        <div className="rl-card-title">📉 Training Convergence Speed & Stability Analysis</div>
        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '5px 0 15px 0' }}>
          Compare the convergence rates and policy reward stability of each algorithm during their active training phases. Lower instability (standard deviation) represents smoother policy optimization.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, minHeight: 280 }}>
          {/* Learning Curves line chart */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>
              Learning Curves (Episode Reward Convergence)
            </span>
            {maxEpisodes === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border)', minHeight: 220 }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>No training history available. Train agents in the RL Debug tab to generate learning curves.</span>
              </div>
            ) : (
              <div style={{ flex: 1, width: '100%', minHeight: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={convergenceData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="episode" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        fontSize: 12
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <Line name="A2C RL" type="monotone" dataKey="A2C Reward" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                    <Line name="DDQN RL" type="monotone" dataKey="DDQN Reward" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
                    <Line name="A3C RL" type="monotone" dataKey="A3C Reward" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Reward standard deviation bar chart */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>
              Reward Instability (Standard Deviation of Last 15 Episodes)
            </span>
            {maxEpisodes === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border)', minHeight: 220 }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>No training history available.</span>
              </div>
            ) : (
              <div style={{ flex: 1, width: '100%', minHeight: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stabilityData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip formatter={(value) => value.toFixed(4)} />
                    <Bar dataKey="value" barSize={35} radius={[4, 4, 0, 0]}>
                      {stabilityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
