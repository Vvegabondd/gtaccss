import React from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import NetworkTopology from './NetworkTopology';
import FairnessGauge from './FairnessGauge';
import { STRATEGY_META, TRAFFIC_PROFILES } from '../simulation/engine';

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
    flows = [], linkUtil = {}, linkDemand = {}, fairness = 0, totalThroughput = 0,
    congestedNodes = new Set(), historyChart = [], flowsWithPayoff = [],
    equilibrium = false, equilibriumRound = null, round = 0,
    equilibriumStats = {}, equilibriumHistory = [],
    nodeQueueStats = {}, networkQueueStats = {}, networkLatencyStats = {},
  } = state;

  const activeLinks = Array.isArray(links) && links.length ? links : (topology?.links || []);
  const congestedLinks = activeLinks.filter(l => (linkUtil[`${l.from}-${l.to}`] || 0) > 1.0);

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
          <div className="metric-label">Avg / Max Util</div>
          <div className="metric-value" style={{ fontSize: 20, marginTop: 4 }}>
            {state.networkStats?.averageUtilization !== undefined ? Math.round(state.networkStats.averageUtilization) : 0}% / {state.networkStats?.maxUtilization !== undefined ? Math.round(state.networkStats.maxUtilization) : 0}%
          </div>
          <div className="metric-sub">Avg Packet Loss: {(avgLoss * 100).toFixed(1)}%</div>
        </div>
        <div className="metric-card red">
          <div className="metric-label">Congested Links</div>
          <div className="metric-value">{state.networkStats?.congestedLinks !== undefined ? state.networkStats.congestedLinks : 0}</div>
          <div className="metric-sub">{congestedNodes.size} node{congestedNodes.size !== 1 ? 's' : ''} congested</div>
        </div>
        <div className="metric-card purple">
          <div className="metric-label">Equilibrium</div>
          <div className="metric-value" style={{ color: equilibrium ? '#16a34a' : '#6b7280' }}>{equilibrium ? 'REACHED' : 'SEARCHING'}</div>
          <div className="metric-sub">
            {equilibrium ? `Round ${equilibriumRound ?? round}` : `${round} rounds`} · Stability: {equilibriumStats?.stabilityScore || 0}%
          </div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid #7c3aed', background: 'linear-gradient(135deg,#faf5ff,#ede9fe)' }}>
          <div className="metric-label" style={{ color: '#6d28d9' }}>Queue Pressure</div>
          <div className="metric-value" style={{ fontSize: 20, marginTop: 4, color: (networkQueueStats?.averageQueueUtil || 0) > 80 ? '#ef4444' : (networkQueueStats?.averageQueueUtil || 0) > 50 ? '#f59e0b' : '#16a34a' }}>
            {(networkQueueStats?.averageQueueUtil || 0).toFixed(1)}%
          </div>
          <div className="metric-sub">{(networkQueueStats?.totalDroppedPackets || 0).toFixed(0)} pkt dropped· max {(networkQueueStats?.maxQueueSize || 0).toFixed(0)} in queue</div>
        </div>
        <div className="metric-card" style={{
          borderTop: `3px solid ${ (networkLatencyStats?.averageLatency || 0) > 50 ? '#ef4444' : (networkLatencyStats?.averageLatency || 0) > 20 ? '#f59e0b' : '#16a34a' }`,
          background: (networkLatencyStats?.averageLatency || 0) > 50 ? 'linear-gradient(135deg,#fff1f1,#fee2e2)' : (networkLatencyStats?.averageLatency || 0) > 20 ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : 'linear-gradient(135deg,#f0fdf4,#dcfce7)'
        }}>
          <div className="metric-label" style={{ color: (networkLatencyStats?.averageLatency || 0) > 50 ? '#dc2626' : (networkLatencyStats?.averageLatency || 0) > 20 ? '#d97706' : '#16a34a' }}>Avg Latency</div>
          <div className="metric-value" style={{ fontSize: 20, marginTop: 4, color: (networkLatencyStats?.averageLatency || 0) > 50 ? '#ef4444' : (networkLatencyStats?.averageLatency || 0) > 20 ? '#f59e0b' : '#16a34a' }}>
            {(networkLatencyStats?.averageLatency || 0).toFixed(1)} ms
          </div>
          <div className="metric-sub">Peak: {(networkLatencyStats?.maxLatency || 0).toFixed(1)} ms · Min: {(networkLatencyStats?.minLatency || 0).toFixed(1)} ms</div>
        </div>
        <div className="metric-card" style={{
          borderTop: `3px solid ${ (networkQueueStats?.networkReliability ?? 100) > 98 ? '#16a34a' : (networkQueueStats?.networkReliability ?? 100) > 90 ? '#f59e0b' : '#ef4444' }`,
          background: (networkQueueStats?.networkReliability ?? 100) > 98 ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : (networkQueueStats?.networkReliability ?? 100) > 90 ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : 'linear-gradient(135deg,#fff1f1,#fee2e2)'
        }}>
          <div className="metric-label" style={{ color: (networkQueueStats?.networkReliability ?? 100) > 98 ? '#16a34a' : (networkQueueStats?.networkReliability ?? 100) > 90 ? '#d97706' : '#dc2626' }}>Network Reliability</div>
          <div className="metric-value" style={{ fontSize: 20, marginTop: 4, color: (networkQueueStats?.networkReliability ?? 100) > 98 ? '#16a34a' : (networkQueueStats?.networkReliability ?? 100) > 90 ? '#f59e0b' : '#ef4444' }}>
            {(networkQueueStats?.networkReliability ?? 100.00).toFixed(2)}%
          </div>
          <div className="metric-sub">Dropped: {(networkQueueStats?.totalDroppedPacketsCumulative || 0).toFixed(0)} / {(networkQueueStats?.totalIncomingPacketsCumulative || 0).toFixed(0)} pkt</div>
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
              <NetworkTopology flows={flows} linkUtil={linkUtil} congestedNodes={congestedNodes} topology={topology} links={activeLinks} nodeQueueStats={nodeQueueStats} />
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
            <div className="card-header"><span>⚡</span><span className="card-title">Equilibrium Status</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Traffic Regime:</span>
                {(() => {
                  const vol = equilibriumStats?.volatilityIndex || 0;
                  let trafficRegimeLabel = 'Stable';
                  let regimeColor = '#16a34a';
                  let regimeBg = '#f0fdf4';
                  let regimeBorder = '#bbf7d0';
                  if (vol > 25) {
                    trafficRegimeLabel = 'Highly Volatile';
                    regimeColor = '#ef4444';
                    regimeBg = '#fef2f2';
                    regimeBorder = '#fecaca';
                  } else if (vol > 10) {
                    trafficRegimeLabel = 'Variable';
                    regimeColor = '#f59e0b';
                    regimeBg = '#fffbeb';
                    regimeBorder = '#fde68a';
                  }
                  return (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: regimeColor,
                      backgroundColor: regimeBg,
                      border: `1.5px solid ${regimeBorder}`
                    }}>
                      {trafficRegimeLabel}
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Nash Equilibrium:</span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: equilibrium ? '#16a34a' : '#6b7280'
                }}>
                  {equilibrium ? 'Stable' : 'Searching...'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Confidence Level:</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: equilibrium ? '#16a34a' : '#6b7280' }}>
                  {equilibriumStats?.confidence || 0}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Window Size:</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700 }}>20 Rounds</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Stability Score:</span>
                <span style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: 13,
                  fontWeight: 700,
                  color: (equilibriumStats?.stabilityScore || 0) > 80 ? '#16a34a' : (equilibriumStats?.stabilityScore || 0) > 50 ? '#f59e0b' : '#ef4444'
                }}>
                  {equilibriumStats?.stabilityScore || 0}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Volatility Index:</span>
                <span style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: 13,
                  fontWeight: 700,
                  color: (equilibriumStats?.volatilityIndex || 0) > 25 ? '#ef4444' : (equilibriumStats?.volatilityIndex || 0) > 10 ? '#f59e0b' : '#16a34a'
                }}>
                  {equilibriumStats?.volatilityIndex || 0}%
                </span>
              </div>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ textAlign: 'center', background: '#f8faff', padding: 6, borderRadius: 6, border: '1px solid #dde3f0' }}>
                  <div style={{ fontSize: 9, color: '#8892b0', textTransform: 'uppercase' }}>Last Update</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#475569' }}>
                    Round {equilibriumStats?.lastUpdateRound || 0}
                  </div>
                </div>
                <div style={{ textAlign: 'center', background: '#f8faff', padding: 6, borderRadius: 6, border: '1px solid #dde3f0' }}>
                  <div style={{ fontSize: 9, color: '#8892b0', textTransform: 'uppercase' }}>Next Update</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
                    Round {Math.ceil((round + 1) / 20) * 20}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span>🔗</span><span className="card-title">Link Load & Utilization</span></div>
            <div className="table-scroll" style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table className="flow-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Link</th>
                    <th>Load</th>
                    <th>Capacity</th>
                    <th>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLinks.map(l => {
                    const key = `${l.from}-${l.to}`;
                    const load = linkDemand[key] || 0;
                    const util = linkUtil[key] || 0;
                    const pct = util * 100;
                    const isCongested = util > 1.0;
                    return (
                      <tr key={key}>
                        <td><span className="mono" style={{ fontWeight: 700 }}>{l.from}→{l.to}</span></td>
                        <td className="mono">{load.toFixed(1)}</td>
                        <td className="mono">{l.capacity}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, minWidth: 40, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(pct, 100)}%`,
                                height: '100%',
                                background: isCongested ? '#ef4444' : util > 0.7 ? '#f59e0b' : '#22c55e'
                              }} />
                            </div>
                            <span className="mono" style={{
                              fontWeight: 700,
                              color: isCongested ? '#ef4444' : util > 0.7 ? '#f59e0b' : '#22c55e',
                              fontSize: 11
                            }}>
                              {pct.toFixed(0)}%{isCongested ? '🔴' : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span>📦</span><span className="card-title">Queue Monitor</span>
              <span className="tag" style={{ marginLeft: 'auto', fontSize: 10 }}>cap={100} pkt/node</span>
            </div>
            <div className="table-scroll" style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table className="flow-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Queue</th>
                    <th>Cap</th>
                    <th>Util</th>
                    <th>Latency</th>
                    <th>Loss Rate</th>
                    <th>Dropped</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(nodeQueueStats).sort((a, b) => b[1].queueUtilization - a[1].queueUtilization).map(([nodeId, q]) => {
                    const pct = q.queueUtilization * 100;
                    const isCritical = pct > 80;
                    const isWarning = pct > 50;
                    const statusEmoji = isCritical ? '🔴' : isWarning ? '🟡' : '🟢';
                    const barColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#22c55e';
                    return (
                      <tr key={nodeId}>
                        <td><span className="mono" style={{ fontWeight: 700, color: isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#16a34a' }}>{nodeId}</span></td>
                        <td className="mono">{q.queueSize.toFixed(0)}</td>
                        <td className="mono">{q.queueCapacity}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ flex: 1, minWidth: 36, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, transition: 'width 0.3s ease' }} />
                            </div>
                            <span className="mono" style={{ fontWeight: 700, color: barColor, minWidth: 32 }}>{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="mono" style={{ color: q.latency > 50 ? '#ef4444' : q.latency > 20 ? '#f59e0b' : '#16a34a', fontWeight: 700 }}>
                          {(q.latency || 0).toFixed(1)} ms
                        </td>
                        <td className="mono" style={{ color: (q.packetLossRate || 0) > 0.05 ? '#ef4444' : (q.packetLossRate || 0) > 0.01 ? '#f59e0b' : '#16a34a', fontWeight: 700 }}>
                          {((q.packetLossRate || 0) * 100).toFixed(1)}%
                        </td>
                        <td className="mono" style={{ color: q.droppedThisRound > 0 ? '#ef4444' : '#64748b' }}>
                          {q.droppedPackets.toFixed(0)}
                          {q.droppedThisRound > 0 && <span style={{ color: '#ef4444', fontSize: 9, marginLeft: 2 }}>+{q.droppedThisRound.toFixed(0)}</span>}
                        </td>
                        <td>{statusEmoji}</td>
                      </tr>
                    );
                  })}
                  {Object.keys(nodeQueueStats).length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>Play simulation to see queue data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span>📊</span><span className="card-title">Live Flow Statistics</span></div>
          <div className="table-scroll">
            <table className="flow-table">
              <thead>
                <tr>
                  <th>Flow</th><th>Profile</th><th>Strategy</th><th>Rate (Offered/Sent)</th><th>Throughput</th>
                  <th>Path Latency</th><th>Loss</th><th>Payoff</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(flowsWithPayoff.length ? flowsWithPayoff : flows).map(f => {
                  const meta = STRATEGY_META[f.strategy] || {};
                  const loss = (f.lossRate || 0) * 100;
                  const payoff = f.payoff || 0;
                  const offered = f.trafficStats?.offeredRate !== undefined ? f.trafficStats.offeredRate : (f.baseRate || f.rate || 0);
                  const sending = f.trafficStats?.sendingRate !== undefined ? f.trafficStats.sendingRate : (f.rate || 0);
                  return (
                    <tr key={f.id}>
                      <td><span className="mono" style={{ color: f.color }}>{f.id}</span></td>
                      <td>
                        <span className="strategy-badge" style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}>
                          📦 {TRAFFIC_PROFILES[f.trafficProfile]?.label || f.trafficProfile || 'Conservative'}
                        </span>
                      </td>
                      <td><span className="strategy-badge" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>{meta.icon} {meta.label}</span></td>
                      <td className="mono">{offered.toFixed(1)} / {sending.toFixed(1)}</td>
                      <td className="mono">{(f.throughput || 0).toFixed(1)}</td>
                      <td className="mono" style={{ color: (f.trafficStats?.latency || f.pathLatency || 0) > 50 ? '#ef4444' : (f.trafficStats?.latency || f.pathLatency || 0) > 20 ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>{(f.trafficStats?.latency || f.pathLatency || 0).toFixed(1)} ms</td>
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
