import React, { useState } from 'react';
import { STRATEGY_META, NODES, DEFAULT_FLOWS } from '../simulation/engine';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

const FLOW_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function FlowsTab({ flows, onUpdateFlows, running }) {
  const [editIdx, setEditIdx] = useState(null);
  const [draft, setDraft] = useState(null);

  function startEdit(idx) {
    setEditIdx(idx);
    setDraft({ ...flows[idx] });
  }

  function cancelEdit() { setEditIdx(null); setDraft(null); }

  function saveEdit() {
    const next = flows.map((f, i) => i === editIdx ? { ...f, ...draft } : f);
    onUpdateFlows(next);
    setEditIdx(null);
    setDraft(null);
  }

  function addFlow() {
    if (flows.length >= 6) return;
    const used = new Set(flows.map(f => f.id));
    let nextNum = 1;
    while (used.has(`F${nextNum}`)) nextNum += 1;
    const id = `F${nextNum}`;
    const newFlow = {
      id,
      path: ['A', 'B', 'D', 'E', 'F'],
      strategy: 'adaptive',
      rate: 30,
      color: FLOW_COLORS[flows.length % FLOW_COLORS.length],
      throughput: 0, delay: 0, lossRate: 0, payoff: 0,
    };
    onUpdateFlows([...flows, newFlow]);
  }

  function removeFlow(idx) {
    onUpdateFlows(flows.filter((_, i) => i !== idx));
  }

  function resetFlows() {
    onUpdateFlows(DEFAULT_FLOWS.map(f => ({ ...f, throughput: 0, delay: 0, lossRate: 0, payoff: 0 })));
  }

  const chartFlows = (flows || []).map((f, idx) => ({
    ...f,
    flowKey: f.id || `F${idx + 1}`,
    chartLabel: `${f.id || `F${idx + 1}`}`,
  }));

  const safeMax = (vals, fallback = 1) => {
    const m = Math.max(...vals, fallback);
    return m > 0 ? m : fallback;
  };

  // Radar chart data: axis rows, per-flow keys as series.
  // This makes each flow appear as its own polygon across the same 5 dimensions.
  const maxRate = safeMax(chartFlows.map(f => f.rate || 0), 10);
  const maxThroughput = safeMax(chartFlows.map(f => f.throughput || 0), 10);
  const payoffValues = chartFlows.map(f => f.payoff || 0);
  const minPayoff = Math.min(...payoffValues, 0);
  const maxPayoff = Math.max(...payoffValues, 1);
  const payoffRange = Math.max(1, maxPayoff - minPayoff);

  const radarData = ['Rate', 'Throughput', 'Payoff', 'Low Loss', 'Low Delay'].map(metric => {
    const row = { metric };
    chartFlows.forEach(f => {
      const rateScore = ((f.rate || 0) / maxRate) * 100;
      const tpScore = ((f.throughput || 0) / maxThroughput) * 100;
      const payoffScore = (((f.payoff || 0) - minPayoff) / payoffRange) * 100;
      const lowLossScore = Math.max(0, 100 - ((f.lossRate || 0) * 100));
      const lowDelayScore = Math.max(0, 100 - Math.min(100, (f.delay || 0) * 2));

      if (metric === 'Rate') row[f.flowKey] = Math.round(rateScore);
      if (metric === 'Throughput') row[f.flowKey] = Math.round(tpScore);
      if (metric === 'Payoff') row[f.flowKey] = Math.round(payoffScore);
      if (metric === 'Low Loss') row[f.flowKey] = Math.round(lowLossScore);
      if (metric === 'Low Delay') row[f.flowKey] = Math.round(lowDelayScore);
    });
    return row;
  });

  // Bar chart — current rates
  const barData = chartFlows.map(f => ({
    name: f.chartLabel,
    Rate: parseFloat((f.rate || 0).toFixed(1)),
    Throughput: parseFloat((f.throughput || 0).toFixed(1)),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, color: '#1a2340', flex: 1 }}>
          Flow Configuration — Players & Strategies
        </h2>
        <button className="ctrl-btn ghost" style={{ background: '#fff', color: '#4a5578', border: '1px solid #dde3f0' }}
          onClick={resetFlows} disabled={running}>
          ↺ Reset Default
        </button>
        <button className="ctrl-btn primary" onClick={addFlow}
          disabled={running || flows.length >= 6}>
          + Add Flow
        </button>
      </div>

      <div className="info-box">
        Each flow is a <strong>rational player</strong> in the network game. Strategies determine how each flow adjusts its sending rate in response to congestion signals.
        The system detects Nash Equilibrium when no flow can improve its payoff by unilaterally switching strategy.
      </div>

      {/* Flow cards */}
      <div className="flow-config-grid">
        {flows.map((flow, idx) => {
          const meta = STRATEGY_META[flow.strategy] || {};
          const isEditing = editIdx === idx;
          return (
            <div key={flow.id} className="flow-config-item" style={{
              borderLeft: `4px solid ${flow.color}`,
              background: isEditing ? '#f0f7ff' : undefined,
            }}>
              <div className="flow-config-header">
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700,
                  fontSize: 16, color: flow.color }}>{flow.id}</span>
                <span className="strategy-badge" style={{
                  background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                }}>
                  {meta.icon} {meta.label}
                </span>
                <span style={{ flex: 1 }}/>
                {!isEditing && (
                  <>
                    <button onClick={() => startEdit(idx)} disabled={running}
                      style={{ fontSize: 12, fontFamily: 'Space Grotesk', background: '#eff6ff',
                        color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6,
                        padding: '4px 10px', cursor: 'pointer' }}>
                      ✏ Edit
                    </button>
                    {flows.length > 1 && (
                      <button onClick={() => removeFlow(idx)} disabled={running}
                        style={{ fontSize: 12, fontFamily: 'Space Grotesk', background: '#fef2f2',
                          color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6,
                          padding: '4px 10px', cursor: 'pointer', marginLeft: 6 }}>
                        ✕
                      </button>
                    )}
                  </>
                )}
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Strategy selector */}
                  <div>
                    <div className="section-title">Strategy</div>
                    <div className="strategy-select">
                      {Object.entries(STRATEGY_META).map(([key, m]) => (
                        <button key={key} className="strategy-option"
                          style={{
                            background: draft.strategy === key ? m.bg : '#fff',
                            color: m.color,
                            borderColor: draft.strategy === key ? m.color : '#dde3f0',
                          }}
                          onClick={() => setDraft(d => ({ ...d, strategy: key }))}>
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Initial rate */}
                  <div>
                    <div className="section-title">Initial Rate: <span style={{ fontFamily: 'JetBrains Mono', color: '#1d4ed8' }}>{draft.rate} Mbps</span></div>
                    <input type="range" min="5" max="100" value={draft.rate}
                      onChange={e => setDraft(d => ({ ...d, rate: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#2563eb' }}/>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="ctrl-btn primary" onClick={saveEdit} style={{ flex: 1 }}>Save</button>
                    <button className="ctrl-btn ghost" onClick={cancelEdit}
                      style={{ background: '#fff', color: '#4a5578', border: '1px solid #dde3f0', flex: 1 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                  {[
                    { label: 'Rate', val: `${(flow.rate||0).toFixed(1)} Mbps` },
                    { label: 'Throughput', val: `${(flow.throughput||0).toFixed(1)} Mbps` },
                    { label: 'Delay', val: `${(flow.delay||0).toFixed(1)} ms` },
                    { label: 'Packet Loss', val: `${((flow.lossRate||0)*100).toFixed(1)}%` },
                    { label: 'Payoff', val: (flow.payoff||0).toFixed(2) },
                    { label: 'Path Hops', val: flow.path.length - 1 },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 10, color: '#8892b0', fontFamily: 'Space Grotesk',
                        textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
                      <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono',
                        color: '#1a2340', fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Path display */}
              {!isEditing && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {flow.path.map((n, i) => (
                    <React.Fragment key={i}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700,
                        background: flow.color + '18', color: flow.color, padding: '2px 7px',
                        borderRadius: 4, border: `1px solid ${flow.color}40` }}>
                        {n}
                      </span>
                      {i < flow.path.length - 1 && (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span>📊</span>
            <span className="card-title">Rate vs Throughput Comparison</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff"/>
                <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}/>
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'Mbps', angle: -90, position: 'insideLeft', fontSize: 10 }}/>
                <Tooltip contentStyle={{ fontFamily: 'Space Grotesk', fontSize: 12 }}/>
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Space Grotesk' }}/>
                <Bar dataKey="Rate" fill="#2563eb" radius={[4,4,0,0]} name="Sending Rate"/>
                <Bar dataKey="Throughput" fill="#16a34a" radius={[4,4,0,0]} name="Actual Throughput"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span>🕸️</span>
            <span className="card-title">Multi-Dimension Flow Comparison</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0"/>
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fontFamily: 'Space Grotesk' }}/>
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false}/>
                <Tooltip contentStyle={{ fontFamily: 'Space Grotesk', fontSize: 12 }}/>
                {chartFlows.map(f => (
                  <Radar
                    key={f.flowKey}
                    name={f.flowKey}
                    dataKey={f.flowKey}
                    stroke={f.color}
                    fill={f.color}
                    fillOpacity={0.08}
                    strokeWidth={2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategy explanations */}
      <div className="card">
        <div className="card-header">
          <span>📖</span>
          <span className="card-title">Strategy Reference</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { key: 'aggressive', rule: 'Rate × 1.20 each round (always)', analogy: 'Greedy user maximizing bandwidth regardless of network state.' },
              { key: 'conservative', rule: 'Rate × 1.05 (clear) / Rate × 0.70 (loss)', analogy: 'Polite user that backs off heavily on any signal of congestion.' },
              { key: 'adaptive', rule: 'Rate + 1.0 (clear) / Rate × 0.50 (loss) — TCP AIMD', analogy: 'Models TCP Reno/Cubic: additive increase, multiplicative decrease.' },
            ].map(({ key, rule, analogy }) => {
              const m = STRATEGY_META[key];
              return (
                <div key={key} style={{ background: m.bg, border: `1px solid ${m.border}`,
                  borderRadius: 8, padding: 14, borderTop: `3px solid ${m.color}` }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14,
                    color: m.color, marginBottom: 6 }}>{m.icon} {m.label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#475569',
                    marginBottom: 8, lineHeight: 1.5 }}>{rule}</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 12, color: '#64748b',
                    lineHeight: 1.5 }}>{analogy}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
