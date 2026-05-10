import React from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import NetworkTopology from './NetworkTopology';
import FairnessGauge from './FairnessGauge';
import { STRATEGY_META } from '../simulation/engine';

function utilColor(u) {
  if (u > 0.9) return '#ef4444';
  if (u > 0.7) return '#f59e0b';
  return '#16a34a';
}

function payoffClass(p) {
  if (p > 5) return 'payoff-positive';
  if (p < 0) return 'payoff-negative';
  return 'payoff-neutral';
}

function lossTag(pct) {
  if (pct > 30) return <span className="tag-red" style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>⚠ CONGESTED</span>;
  if (pct > 5) return <span className="tag-amber" style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>~ Moderate</span>;
  return <span className="tag-green" style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>✓ OK</span>;
}

export default function Dashboard({ state = {}, mode = 'arena', topology = null, links = null }) {
  const {
    flows = [], linkUtil = {}, fairness = 0, totalThroughput = 0,
    congestedNodes = new Set(), historyChart = [], flowsWithPayoff = [],
    equilibrium = false, equilibriumRound = null, round = 0,
  } = state;

  const activeLinks = Array.isArray(links) && links.length ? links : (topology?.links || []);
  const congestedLinks = activeLinks.filter(l => (linkUtil[`${l.from}-${l.to}`] || 0) > 0.85);

  const nodeCongestion = {};
  congestedLinks.forEach(l => {
    nodeCongestion[l.from] = (nodeCongestion[l.from] || 0) + 1;
    nodeCongestion[l.to] = (nodeCongestion[l.to] || 0) + 1;
  });
  const nodeCongList = Object.entries(nodeCongestion).sort((a, b) => b[1] - a[1]);

  const avgLoss = flowsWithPayoff.length ? flowsWithPayoff.reduce((s, f) => s + (f.lossRate || 0), 0) / flowsWithPayoff.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="metrics-strip">
        <div className="metric-card blue">
          <div className="metric-label">Total Throughput</div>
          <div className="metric-value">{totalThroughput.toFixed(1)}</div>
          <div className="metric-sub">Mbps across all flows</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">Jain's Fairness</div>
          <div className="metric-value">{fairness.toFixed(3)}</div>
          <div className="metric-sub">{fairness > 0.85 ? 'High equity' : fairness > 0.6 ? 'Moderate equity' : 'Low equity'}</div>
        </div>
        <div className="metric-card amber">
          <div className="metric-label">Avg Packet Loss</div>
          <div className="metric-value">{(avgLoss * 100).toFixed(1)}%</div>
          <div className="metric-sub">{congestedLinks.length} congested link{congestedLinks.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="metric-card red">
          <div className="metric-label">Congested Nodes</div>
          <div className="metric-value">{congestedNodes.size}</div>
          <div className="metric-sub">{congestedNodes.size > 0 ? Array.from(congestedNodes).join(', ') : 'None — network clear'}</div>
        </div>
        <div className="metric-card purple">
          <div className="metric-label">Equilibrium</div>
          <div className="metric-value" style={{ color: equilibrium ? '#16a34a' : '#6b7280' }}>{equilibrium ? 'REACHED' : 'SEARCHING'}</div>
          <div className="metric-sub">{equilibrium ? `Round ${equilibriumRound ?? round}` : `${round} rounds elapsed`}</div>
        </div>
      </div>

      <div className={mode === 'arena' ? 'grid-32' : 'grid-1'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <span>🌐</span>
              <span className="card-title">{mode === 'arena' ? 'Scenario Topology' : 'Algorithm Playground'}</span>
              <span className="tag" style={{ marginLeft: 'auto' }}>{(topology?.nodes?.length || 0)} Nodes · Bottleneck {activeLinks.length ? `${activeLinks[0].from}→${activeLinks[0].to}` : ''}</span>
            </div>
            <div className="card-sub-header">
              <div className="no-congestion"><span>✅</span><span>Topology ready — edit or launch simulation</span></div>
            </div>
            <div style={{ padding: 16 }}>
              <NetworkTopology flows={flows} linkUtil={linkUtil} congestedNodes={congestedNodes} topology={topology} links={activeLinks} />
            </div>
          </div>
        </div>

        {mode === 'arena' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header"><span>🚨</span><span className="card-title">Congested Nodes</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: 160 }}>
                  <div style={{ overflowY: 'auto', paddingRight: 8, flex: 1 }}>
                    {congestedLinks.length > 0 && congestedLinks.map(l => (
                      <div className="congestion-alert" key={`${l.from}-${l.to}`}>
                        <span>🔴</span>
                        <span><strong>Congestion</strong> on <strong>{l.from}→{l.to}</strong> — {((linkUtil[`${l.from}-${l.to}`] || 0) * 100).toFixed(0)}% utilized</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Detected congested nodes: {congestedNodes.size}</div>
                    <div style={{ maxHeight: 180, overflowY: 'auto', paddingRight: 8 }}>
                      {nodeCongList.length > 0 ? nodeCongList.map(([node, count]) => {
                        const incidentLinks = activeLinks.filter(l => l.from === node || l.to === node);
                        const worstUtil = Math.max(...incidentLinks.map(l => (linkUtil[`${l.from}-${l.to}`] || 0)), 0);
                        return (
                          <div key={node} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 6, background: '#ef4444' }} />
                              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{node}</div>
                              <div style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{count} congested link{count !== 1 ? 's' : ''}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: worstUtil > 0.9 ? '#ef4444' : worstUtil > 0.7 ? '#f59e0b' : '#16a34a' }}>{(worstUtil * 100).toFixed(0)}%</div>
                          </div>
                        );
                      }) : (
                        <div style={{ color: '#64748b' }}>No congested nodes detected</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span>🔗</span><span className="card-title">Bottleneck Utilization</span></div>
              <div className="card-body">
                <div className="link-util-list">
                  {activeLinks.filter(l => `${l.from}-${l.to}` === 'D-E').map(l => {
                    const key = `${l.from}-${l.to}`;
                    const util = linkUtil[key] || 0;
                    const pct = Math.min(util * 100, 100);
                    return (
                      <div className="link-util-item" key={key} style={{ gridTemplateColumns: '1fr 60px' }}>
                        <div className="link-util-bar-bg" style={{ height: 12 }}>
                          <div className="link-util-bar-fill" style={{ width: `${pct}%`, background: utilColor(util) }} />
                        </div>
                        <span className="link-util-pct" style={{ color: utilColor(util), fontSize: 14, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span>📈</span><span className="card-title">Total Throughput</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={historyChart}>
                <defs>
                  <linearGradient id="tpG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
                <XAxis dataKey="round" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <Tooltip contentStyle={{ fontFamily: 'Space Grotesk', fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="throughput" stroke="#2563eb" strokeWidth={2} fill="url(#tpG)" name="Mbps" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span>🔀</span><span className="card-title">Per-Flow Sending Rates</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={historyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
                <XAxis dataKey="round" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <Tooltip contentStyle={{ fontFamily: 'Space Grotesk', fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: 'Space Grotesk' }} />
                {flows.map(f => (
                  <Line key={f.id} type="monotone" dataKey={'rate_' + f.id}
                    name={`${f.id} (${STRATEGY_META[f.strategy]?.label || f.strategy})`}
                    stroke={f.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom: Fairness + Links + Table */}
      <div className="grid-23">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><span>⚖️</span><span className="card-title">Fairness Index</span></div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
              <FairnessGauge value={fairness} />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span>🔗</span><span className="card-title">Link Utilization</span></div>
            <div className="card-body">
              <div className="link-util-list">
                {activeLinks.map(l => {
                  const key = `${l.from}-${l.to}`;
                  const util = linkUtil[key] || 0;
                  const pct = Math.min(util * 100, 100);
                  const isBottleneck = key === 'R1-R2';
                  return (
                    <div className="link-util-item" key={key}>
                      <span className="link-util-label" style={isBottleneck ? { color: '#f59e0b', fontWeight: 700 } : { }}>{l.from}→{l.to}{isBottleneck ? ' ⬟' : ''}</span>
                      <div className="link-util-bar-bg"><div className="link-util-bar-fill" style={{ width: `${pct}%`, background: utilColor(util) }} /></div>
                      <span className="link-util-pct" style={{ color: utilColor(util) }}>{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span>📊</span><span className="card-title">Live Flow Statistics</span></div>
          <div className="table-scroll">
            <table className="flow-table">
              <thead>
                <tr>
                  <th>Flow</th><th>Strategy</th><th>Rate</th><th>Throughput</th>
                  <th>Delay</th><th>Loss</th><th>Payoff</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(flowsWithPayoff.length ? flowsWithPayoff : flows).map(f => {
                  const meta = STRATEGY_META[f.strategy] || {};
                  const loss = (f.lossRate || 0) * 100;
                  const payoff = f.payoff || 0;
                  return (
                    <tr key={f.id}>
                      <td><span className="mono" style={{ color: f.color }}>{f.id}</span></td>
                      <td><span className="strategy-badge" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>{meta.icon} {meta.label}</span></td>
                      <td className="mono">{(f.rate || 0).toFixed(1)}</td>
                      <td className="mono">{(f.throughput || 0).toFixed(1)}</td>
                      <td className="mono">{(f.delay || 0).toFixed(1)}</td>
                      <td className="mono" style={{ color: loss > 20 ? '#ef4444' : loss > 5 ? '#f59e0b' : '#16a34a' }}>{loss.toFixed(1)}%</td>
                      <td className={'mono ' + payoffClass(payoff)}>{payoff.toFixed(2)}</td>
                      <td>{lossTag(loss)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
