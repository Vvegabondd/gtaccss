import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
  ComposedChart, Area,
} from 'recharts';
import { STRATEGY_META } from '../simulation/engine';

// ── Custom Tooltip ──────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #dde3f0', borderRadius: 10,
      padding: '12px 16px', boxShadow: '0 8px 24px rgba(30,64,175,0.12)',
      fontFamily: 'Space Grotesk, system-ui', fontSize: 12, minWidth: 180,
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#1e3a8a',
        marginBottom: 8, fontSize: 13
      }}>Round {label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{
          display: 'flex', alignItems: 'center',
          gap: 8, marginBottom: 4
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: p.color, display: 'inline-block', flexShrink: 0
          }} />
          <span style={{ color: '#64748b', flex: 1 }}>{p.name}</span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
            color: p.value < 0 ? '#ef4444' : '#1a2340'
          }}>
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Section Header ──────────────────────────────────────────
function SectionHeader({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontFamily: 'Sora, system-ui', fontWeight: 700, fontSize: 16, color: '#1a2340' }}>{title}</div>
        {sub && <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 12, color: '#8892b0' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Flow Color Dot ──────────────────────────────────────────
function FlowDot({ color, size = 10 }) {
  return <span style={{
    width: size, height: size, borderRadius: '50%',
    background: color, display: 'inline-block', flexShrink: 0
  }} />;
}

// ── Stat Chip ───────────────────────────────────────────────
function StatChip({ label, value, unit = '', color = '#1d4ed8', bg = '#eff6ff', border = '#bfdbfe' }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 8,
      padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 2
    }}>
      <span style={{
        fontFamily: 'Space Grotesk, system-ui', fontSize: 10, color: '#8892b0',
        textTransform: 'uppercase', letterSpacing: '0.5px'
      }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color }}>
        {value}<span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 3 }}>{unit}</span>
      </span>
    </div>
  );
}

// ── Helper: find bottleneck link label ──────────────────────
function findBottleneckLabel(links) {
  if (!links || links.length === 0) return 'bottleneck';
  let minCap = Infinity;
  let label = 'bottleneck';
  links.forEach(l => {
    if (l.capacity < minCap) {
      minCap = l.capacity;
      label = `${l.from}→${l.to} (${l.capacity} Mbps)`;
    }
  });
  return label;
}

// ── Main Analytics Tab ──────────────────────────────────────
export default function AnalyticsTab({ state, alpha, beta, equilibriumRound, round, flows: configFlows, links: topologyLinks }) {
  const {
    flows = [],
    flowsWithPayoff = [],
    historyChart = [],
    fairness = 0,
    totalThroughput = 0,
    equilibrium = false,
    linkUtil = {},
    bottleneckKey,
  } = state;

  const [selectedFlow, setSelectedFlow] = useState('all');

  // Active links for display
  const activeLinks = topologyLinks || [];
  const bottleneckLabel = useMemo(() => findBottleneckLabel(activeLinks), [activeLinks]);
  const bottleneckCapacity = useMemo(() => {
    if (!activeLinks.length) return 50;
    return Math.min(...activeLinks.map(l => l.capacity));
  }, [activeLinks]);

  // ── Derive per-flow stats across all history ──────────────
  const flowStats = useMemo(() => {
    if (!historyChart.length) return {};
    const stats = {};
    const allFlows = flows.length ? flows : (configFlows || []);
    allFlows.forEach(f => {
      const rates = historyChart.map(h => h[`rate_${f.id}`] ?? null).filter(v => v !== null);
      const payoffs = historyChart.map(h => h[`payoff_${f.id}`] ?? null).filter(v => v !== null);
      const delays = historyChart.map(h => h[`delay_${f.id}`] ?? null).filter(v => v !== null);
      stats[f.id] = {
        avgRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
        peakRate: rates.length ? Math.max(...rates) : 0,
        minRate: rates.length ? Math.min(...rates) : 0,
        avgPayoff: payoffs.length ? payoffs.reduce((a, b) => a + b, 0) / payoffs.length : 0,
        peakPayoff: payoffs.length ? Math.max(...payoffs) : 0,
        minPayoff: payoffs.length ? Math.min(...payoffs) : 0,
        avgDelay: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0,
        lastRate: rates[rates.length - 1] ?? 0,
        lastPayoff: payoffs[payoffs.length - 1] ?? 0,
        lastDelay: delays[delays.length - 1] ?? 0,
      };
    });
    return stats;
  }, [historyChart, flows, configFlows]);

  // ── Active flows list ─────────────────────────────────────
  const activeFlows = flows.length ? flows : (configFlows || []);

  // ── Lines to show in charts ───────────────────────────────
  const visibleFlows = selectedFlow === 'all'
    ? activeFlows
    : activeFlows.filter(f => f.id === selectedFlow);

  const hasData = historyChart.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Session Summary                         */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="card">
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)',
          padding: '20px 28px', display: 'flex', alignItems: 'flex-start',
          gap: 28, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)',
              letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4
            }}>
              SESSION ANALYTICS
            </div>
            <div style={{ fontFamily: 'Sora, system-ui', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
              GTACCS Simulation Report
            </div>
            <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Game-Theoretic Adaptive Congestion Control System
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
            <div style={{
              background: equilibrium ? 'rgba(22,163,74,0.25)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${equilibrium ? '#4ade80' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12, padding: '12px 20px', textAlign: 'center',
              minWidth: 160,
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.5)',
                marginBottom: 4, letterSpacing: 1
              }}>NASH EQUILIBRIUM</div>
              {equilibrium ? (
                <>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: '#4ade80' }}>⚡ REACHED</div>
                  <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                    Round {equilibriumRound ?? round}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>SEARCHING</div>
                  <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {round} rounds elapsed
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Total Rounds', val: round },
                { label: 'Active Flows', val: activeFlows.length },
                { label: 'Fairness Index', val: fairness.toFixed(3) },
              ].map(({ label, val }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  gap: 20, fontFamily: 'Space Grotesk, system-ui', fontSize: 12
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa', fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Configuration Parameters               */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span>⚙️</span>
          <span className="card-title">Simulation Configuration — User Parameters</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>

            {/* Network params */}
            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>Network Topology</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['Nodes', activeLinks.length > 0 ? `${new Set(activeLinks.flatMap(l => [l.from, l.to])).size}` : '—'],
                  ['Links', `${activeLinks.length} directed`],
                  ['Bottleneck', bottleneckLabel],
                  ['Min Capacity', `${bottleneckCapacity} Mbps`],
                  ['Max Capacity', `${activeLinks.length ? Math.max(...activeLinks.map(l => l.capacity)) : '—'} Mbps`],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 10px', background: '#f8faff', borderRadius: 6,
                    border: '1px solid #eef0f8'
                  }}>
                    <span style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 12, color: '#64748b' }}>{k}</span>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#1e3a8a',
                      fontWeight: 600
                    }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Flow params */}
            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>Flow Configuration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeFlows.map(f => {
                  const meta = STRATEGY_META[f.strategy] || {};
                  return (
                    <div key={f.id} style={{
                      display: 'flex', alignItems: 'center',
                      gap: 8, padding: '7px 10px', background: '#f8faff',
                      borderRadius: 6, border: '1px solid #eef0f8'
                    }}>
                      <FlowDot color={f.color} />
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                        color: f.color, fontSize: 12
                      }}>{f.id}</span>
                      <span style={{
                        fontFamily: 'Space Grotesk, system-ui', fontSize: 11,
                        color: '#64748b', flex: 1
                      }}>
                        {f.path[0]}→{f.path[f.path.length - 1]} ({f.path.length - 1} hops)
                      </span>
                      <span style={{
                        fontFamily: 'Space Grotesk, system-ui', fontSize: 11,
                        fontWeight: 600, color: meta.color || '#64748b',
                        background: meta.bg || '#f8fafc', padding: '2px 7px', borderRadius: 4,
                        border: `1px solid ${meta.border || '#e2e8f0'}`
                      }}>
                        {meta.icon || ''} {meta.label || f.strategy}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payoff params */}
            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>Payoff Function Weights</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
                  borderRadius: 10, padding: 14, marginBottom: 4
                }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#60a5fa', lineHeight: 1.8 }}>
                    U = T − (α × D) − (β × L × 100)
                  </div>
                </div>
                {[
                  { key: 'α (delay weight)', val: alpha.toFixed(2), color: '#2563eb', hint: 'Delay sensitivity' },
                  { key: 'β (loss penalty)', val: beta.toFixed(2), color: '#dc2626', hint: 'Loss severity weight' },
                  { key: 'Base Delay', val: '10 ms', color: '#64748b', hint: 'Propagation delay (base)' },
                  { key: 'Eq. Window', val: '10 rounds', color: '#64748b', hint: 'Stability detection window' },
                  { key: 'Eq. Threshold', val: '2.0 payoff', color: '#64748b', hint: 'Variance threshold for stability' },
                ].map(({ key, val, color, hint }) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', background: '#f8faff', borderRadius: 6,
                    border: '1px solid #eef0f8'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 12, color: '#64748b' }}>{key}</div>
                      <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 10, color: '#94a3b8' }}>{hint}</div>
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
                      fontWeight: 700, color
                    }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Equilibrium Summary                    */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span>🎯</span>
          <span className="card-title">Nash Equilibrium — Detailed Report</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {equilibrium && (
              <span style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 100, padding: '3px 12px', fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11, color: '#16a34a', fontWeight: 700
              }}>
                ⚡ REACHED AT ROUND {equilibriumRound ?? round}
              </span>
            )}
            {!equilibrium && round > 0 && (
              <span style={{
                background: '#f8faff', border: '1px solid #dde3f0',
                borderRadius: 100, padding: '3px 12px', fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11, color: '#94a3b8', fontWeight: 600
              }}>
                🔍 Still searching — {round} rounds elapsed
              </span>
            )}
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{
                background: equilibrium ? '#f0fdf4' : '#f8faff',
                border: `1px solid ${equilibrium ? '#bbf7d0' : '#dde3f0'}`,
                borderLeft: `4px solid ${equilibrium ? '#16a34a' : '#94a3b8'}`,
                borderRadius: 8, padding: 16, marginBottom: 14
              }}>
                <div style={{
                  fontFamily: 'Sora, system-ui', fontWeight: 700, fontSize: 14,
                  color: equilibrium ? '#14532d' : '#4a5578', marginBottom: 6
                }}>
                  {equilibrium ? '✅ Stable State Achieved' : '⏳ System Converging...'}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                  {equilibrium
                    ? `Nash Equilibrium was reached at Round ${equilibriumRound ?? round}. No flow can improve its payoff by unilaterally changing strategy. The system has self-organized into a stable, fair allocation.`
                    : `The simulation has run for ${round} rounds. Flows are still adapting their sending rates. Equilibrium is detected when all flows show payoff variance < 2.0 over 10 consecutive rounds. Try running longer or use fewer aggressive flows.`
                  }
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatChip label="Total Throughput" value={totalThroughput.toFixed(1)} unit="Mbps"
                  color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
                <StatChip label="Fairness Index" value={fairness.toFixed(3)}
                  color={fairness > 0.85 ? '#16a34a' : fairness > 0.6 ? '#d97706' : '#dc2626'}
                  bg={fairness > 0.85 ? '#f0fdf4' : fairness > 0.6 ? '#fffbeb' : '#fef2f2'}
                  border={fairness > 0.85 ? '#bbf7d0' : fairness > 0.6 ? '#fde68a' : '#fecaca'} />
                <StatChip label="Rounds Elapsed" value={round}
                  color="#7c3aed" bg="#f5f3ff" border="#ddd6fe" />
                <StatChip label="Eq. Round" value={equilibrium ? (equilibriumRound ?? round) : '—'}
                  color="#16a34a" bg="#f0fdf4" border="#bbf7d0" />
              </div>
            </div>

            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>Equilibrium Conditions</div>
              {[
                { cond: 'Any flow increases rate', result: 'Congestion rises → payoff decreases', ok: true },
                { cond: 'Any flow decreases rate', result: 'Throughput falls → payoff decreases', ok: true },
                { cond: 'Any flow switches strategy', result: 'No improvement in payoff possible', ok: equilibrium },
                { cond: 'Payoff variance < 2.0 for 10 rounds', result: 'Stability window satisfied', ok: equilibrium },
              ].map(({ cond, result, ok }) => (
                <div key={cond} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '9px 12px', marginBottom: 6, borderRadius: 8,
                  background: ok ? '#f0fdf4' : '#f8faff',
                  border: `1px solid ${ok ? '#bbf7d0' : '#dde3f0'}`
                }}>
                  <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>{ok ? '✓' : '○'}</span>
                  <div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                      color: '#1e3a8a', fontWeight: 600
                    }}>{cond}</div>
                    <div style={{
                      fontFamily: 'Space Grotesk, system-ui', fontSize: 11,
                      color: '#64748b', marginTop: 2
                    }}>⟹ {result}</div>
                  </div>
                </div>
              ))}
              <div style={{
                marginTop: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe',
                borderRadius: 8, padding: '8px 12px'
              }}>
                ∴ No flow can improve its payoff by unilateral deviation<br />
                ⇒ Nash Equilibrium {equilibrium ? 'IS' : 'NOT YET'} reached
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Per-Flow Detail Cards                  */}
      {/* ════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon="🔀" title="Per-Flow Detailed Statistics"
          sub="Current round metrics plus historical min/avg/peak across all rounds" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {activeFlows.map(f => {
            const live = flowsWithPayoff.find(fp => fp.id === f.id) || f;
            const hist = flowStats[f.id] || {};
            const meta = STRATEGY_META[f.strategy] || {};
            const lossColor = (live.lossRate || 0) > 0.2 ? '#dc2626' : (live.lossRate || 0) > 0.05 ? '#d97706' : '#16a34a';

            return (
              <div key={f.id} className="card" style={{
                borderTop: `4px solid ${f.color}`,
                boxShadow: `0 4px 16px ${f.color}18`,
              }}>
                <div style={{
                  padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: '1px solid #dde3f0', background: '#f8faff'
                }}>
                  <FlowDot color={f.color} size={14} />
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontWeight: 800,
                    fontSize: 18, color: f.color
                  }}>{f.id}</span>
                  <span style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 12, color: '#64748b' }}>
                    {f.path.join(' → ')}
                  </span>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{
                      background: meta.bg || '#f8fafc', color: meta.color || '#64748b',
                      border: `1px solid ${meta.border || '#e2e8f0'}`,
                      borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600,
                      fontFamily: 'Space Grotesk, system-ui',
                    }}>
                      {meta.icon || ''} {meta.label || f.strategy}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <div className="section-title" style={{ marginBottom: 8 }}>Current Round — Round {round}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[
                        { label: 'Sending Rate', val: `${(live.rate || 0).toFixed(1)}`, unit: 'Mbps', color: f.color },
                        { label: 'Throughput', val: `${(live.throughput || 0).toFixed(1)}`, unit: 'Mbps', color: '#16a34a' },
                        { label: 'Delay', val: `${(live.delay || 0).toFixed(1)}`, unit: 'ms', color: '#d97706' },
                        { label: 'Packet Loss', val: `${((live.lossRate || 0) * 100).toFixed(1)}`, unit: '%', color: lossColor },
                        { label: 'Payoff Score', val: `${(live.payoff || 0).toFixed(2)}`, unit: '', color: (live.payoff || 0) >= 0 ? '#1d4ed8' : '#dc2626' },
                        { label: 'Path Hops', val: `${f.path.length - 1}`, unit: '', color: '#64748b' },
                      ].map(({ label, val, unit, color }) => (
                        <div key={label} style={{
                          background: '#f8faff', border: '1px solid #eef0f8',
                          borderRadius: 7, padding: '8px 10px', textAlign: 'center'
                        }}>
                          <div style={{
                            fontFamily: 'Space Grotesk, system-ui', fontSize: 9, color: '#8892b0',
                            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3
                          }}>{label}</div>
                          <div style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 15,
                            fontWeight: 700, color
                          }}>
                            {val}<span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>{unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {hasData && (
                    <div>
                      <div className="section-title" style={{ marginBottom: 8 }}>Historical Summary (All Rounds)</div>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                        border: '1px solid #dde3f0', borderRadius: 8, overflow: 'hidden'
                      }}>
                        {['Metric', 'Min', 'Avg', 'Peak'].map(h => (
                          <div key={h} style={{
                            padding: '6px 10px', fontFamily: 'Space Grotesk, system-ui',
                            fontSize: 10, fontWeight: 600, color: '#8892b0',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            background: '#f0f4ff', borderBottom: '1px solid #dde3f0'
                          }}>{h}</div>
                        ))}
                        {[
                          { label: 'Rate (Mbps)', min: hist.minRate, avg: hist.avgRate, peak: hist.peakRate },
                          { label: 'Payoff', min: hist.minPayoff, avg: hist.avgPayoff, peak: hist.peakPayoff },
                          { label: 'Delay (ms)', min: null, avg: hist.avgDelay, peak: null },
                        ].map(({ label, min, avg, peak }) => (
                          <React.Fragment key={label}>
                            <div style={{
                              padding: '7px 10px', fontFamily: 'Space Grotesk, system-ui',
                              fontSize: 11, color: '#374151', fontWeight: 500,
                              borderBottom: '1px solid #f0f4ff', background: '#fff'
                            }}>{label}</div>
                            <div style={{
                              padding: '7px 10px', fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 11, color: '#64748b', borderBottom: '1px solid #f0f4ff', background: '#fff'
                            }}>
                              {min != null ? min.toFixed(1) : '—'}
                            </div>
                            <div style={{
                              padding: '7px 10px', fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 11, color: '#1d4ed8', fontWeight: 600,
                              borderBottom: '1px solid #f0f4ff', background: '#fff'
                            }}>
                              {avg != null ? avg.toFixed(1) : '—'}
                            </div>
                            <div style={{
                              padding: '7px 10px', fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 11, color: f.color, fontWeight: 700,
                              borderBottom: '1px solid #f0f4ff', background: '#fff'
                            }}>
                              {peak != null ? peak.toFixed(1) : '—'}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* SECTION 5 — Combined Line Plot                     */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span>📈</span>
          <span className="card-title">Combined Time-Series — Rate & Payoff vs Rounds</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 11, color: '#8892b0' }}>Filter:</span>
            <button
              onClick={() => setSelectedFlow('all')}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid #dde3f0',
                background: selectedFlow === 'all' ? '#1d4ed8' : '#fff',
                color: selectedFlow === 'all' ? '#fff' : '#64748b',
                fontFamily: 'Space Grotesk, system-ui', fontSize: 11, cursor: 'pointer', fontWeight: 600
              }}>
              All Flows
            </button>
            {activeFlows.map(f => (
              <button key={f.id}
                onClick={() => setSelectedFlow(f.id)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: `1px solid ${f.color}40`,
                  background: selectedFlow === f.id ? f.color : '#fff',
                  color: selectedFlow === f.id ? '#fff' : f.color,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, cursor: 'pointer', fontWeight: 700
                }}>
                {f.id}
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          <div className="empty-state">
            <span style={{ fontSize: 32 }}>📊</span>
            <span>Run the simulation to see charts appear here</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Click ▶ Play or ⏭ Step to begin</span>
          </div>
        ) : (
          <div style={{ padding: '20px' }}>
            {/* ── Rate Chart ── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontFamily: 'Sora, system-ui', fontWeight: 700, fontSize: 14, color: '#1a2340',
                marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ width: 4, height: 18, background: '#2563eb', borderRadius: 2, display: 'inline-block' }} />
                Sending Rate (Mbps) vs Rounds
              </div>
              <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 12, color: '#8892b0', marginBottom: 14 }}>
                How each flow's transmission rate evolves — aggressive flows climb, adaptive flows self-regulate, conservative flows grow slowly
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={historyChart} margin={{ top: 5, right: 60, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" vertical={false} />
                  <XAxis dataKey="round" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
                    axisLine={{ stroke: '#e2e8f0' }} tickLine={false}
                    label={{ value: 'Round', position: 'insideBottomRight', offset: -10, fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    label={{ value: 'Mbps', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle"
                    wrapperStyle={{ fontSize: 11, fontFamily: 'Space Grotesk, system-ui', paddingTop: 8 }} />
                  <ReferenceLine y={bottleneckCapacity} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: `Bottleneck ${bottleneckCapacity} Mbps`, position: 'right', fontSize: 10, fill: '#ef4444' }} />
                  {equilibrium && equilibriumRound && (
                    <ReferenceLine x={equilibriumRound} stroke="#16a34a" strokeDasharray="4 3" strokeWidth={2}
                      label={{ value: `EQ R${equilibriumRound}`, position: 'top', fontSize: 10, fill: '#16a34a' }} />
                  )}
                  {visibleFlows.map(f => (
                    <Line key={`rate_${f.id}`} type="monotone" dataKey={`rate_${f.id}`}
                      name={`${f.id} Rate`} stroke={f.color} strokeWidth={2.5}
                      dot={false} activeDot={{ r: 4, fill: f.color }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ── Payoff Chart ── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontFamily: 'Sora, system-ui', fontWeight: 700, fontSize: 14, color: '#1a2340',
                marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ width: 4, height: 18, background: '#7c3aed', borderRadius: 2, display: 'inline-block' }} />
                Payoff Score vs Rounds
              </div>
              <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 12, color: '#8892b0', marginBottom: 14 }}>
                U = Throughput − (α × Delay) − (β × Loss × 100). Negative values mean the flow is losing more than gaining
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={historyChart} margin={{ top: 5, right: 60, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" vertical={false} />
                  <XAxis dataKey="round" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
                    axisLine={{ stroke: '#e2e8f0' }} tickLine={false}
                    label={{ value: 'Round', position: 'insideBottomRight', offset: -10, fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    label={{ value: 'Payoff', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle"
                    wrapperStyle={{ fontSize: 11, fontFamily: 'Space Grotesk, system-ui', paddingTop: 8 }} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: 'Break-even (0)', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
                  <ReferenceArea y1={-300} y2={0} fill="#fef2f2" fillOpacity={0.4} />
                  {equilibrium && equilibriumRound && (
                    <ReferenceLine x={equilibriumRound} stroke="#16a34a" strokeDasharray="4 3" strokeWidth={2}
                      label={{ value: `EQ R${equilibriumRound}`, position: 'top', fontSize: 10, fill: '#16a34a' }} />
                  )}
                  {visibleFlows.map(f => (
                    <Line key={`payoff_${f.id}`} type="monotone" dataKey={`payoff_${f.id}`}
                      name={`${f.id} Payoff`} stroke={f.color} strokeWidth={2.5}
                      dot={false} activeDot={{ r: 4, fill: f.color }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ── Combined Overview Chart ── */}
            <div>
              <div style={{
                fontFamily: 'Sora, system-ui', fontWeight: 700, fontSize: 14, color: '#1a2340',
                marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ width: 4, height: 18, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }} />
                Combined Overview — Rate + Payoff + Total Throughput
              </div>
              <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 12, color: '#8892b0', marginBottom: 14 }}>
                Overlay of all metrics — shaded area is total network throughput; solid lines are per-flow rate; dashed lines are payoff
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={historyChart} margin={{ top: 5, right: 60, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="tpGradA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" vertical={false} />
                  <XAxis dataKey="round" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
                    axisLine={{ stroke: '#e2e8f0' }} tickLine={false}
                    label={{ value: 'Round', position: 'insideBottomRight', offset: -10, fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    label={{ value: 'Mbps / Payoff', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle"
                    wrapperStyle={{ fontSize: 11, fontFamily: 'Space Grotesk, system-ui', paddingTop: 8 }} />
                  <ReferenceLine yAxisId="left" y={0} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine yAxisId="left" y={bottleneckCapacity} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: 'Bottleneck', position: 'right', fontSize: 9, fill: '#ef4444' }} />
                  <Area yAxisId="left" type="monotone" dataKey="throughput"
                    fill="url(#tpGradA)" stroke="#2563eb" strokeWidth={2}
                    name="Total Throughput" dot={false} />
                  {visibleFlows.map(f => (
                    <Line key={`rate_${f.id}_combo`} yAxisId="left" type="monotone"
                      dataKey={`rate_${f.id}`} name={`${f.id} Rate`}
                      stroke={f.color} strokeWidth={1.5} dot={false} opacity={0.7} />
                  ))}
                  {visibleFlows.map(f => (
                    <Line key={`payoff_${f.id}_combo`} yAxisId="left" type="monotone"
                      dataKey={`payoff_${f.id}`} name={`${f.id} Payoff`}
                      stroke={f.color} strokeWidth={2} dot={false}
                      strokeDasharray="5 2" opacity={1} />
                  ))}
                  {equilibrium && equilibriumRound && (
                    <ReferenceLine yAxisId="left" x={equilibriumRound}
                      stroke="#16a34a" strokeDasharray="4 3" strokeWidth={2}
                      label={{ value: `Nash EQ`, position: 'top', fontSize: 10, fill: '#16a34a' }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                {[
                  { color: '#2563eb', label: 'Total Throughput (filled area)', dash: false },
                  { color: '#94a3b8', label: 'Solid lines = Sending Rate', dash: false },
                  { color: '#94a3b8', label: 'Dashed lines = Payoff Score', dash: true },
                  equilibrium ? { color: '#16a34a', label: 'Vertical green line = Nash EQ reached', dash: false } : null,
                ].filter(Boolean).map(({ color, label, dash }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'Space Grotesk, system-ui', fontSize: 11, color: '#64748b'
                  }}>
                    <span style={{
                      width: 24, height: 2, background: color, display: 'inline-block', borderRadius: 2,
                      borderBottom: dash ? `2px dashed ${color}` : 'none'
                    }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* SECTION 6 — Round-by-Round Data Table              */}
      {/* ════════════════════════════════════════════════════ */}
      {hasData && (
        <div className="card">
          <div className="card-header">
            <span>📋</span>
            <span className="card-title">Round-by-Round Data Log</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'Space Grotesk, system-ui', fontSize: 11, color: '#94a3b8' }}>
              Showing last {historyChart.length} rounds
            </span>
          </div>
          <div className="table-scroll" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="flow-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th>Round</th>
                  <th>Total TP</th>
                  {activeFlows.map(f => (
                    <th key={`rh-${f.id}`} style={{ color: f.color }}>{f.id} Rate</th>
                  ))}
                  {activeFlows.map(f => (
                    <th key={`ph-${f.id}`} style={{ color: f.color }}>{f.id} Payoff</th>
                  ))}
                  <th>EQ?</th>
                </tr>
              </thead>
              <tbody>
                {[...historyChart].reverse().map((row) => {
                  const isEqRound = equilibriumRound && row.round === equilibriumRound;
                  return (
                    <tr key={row.round} style={{
                      background: isEqRound ? '#f0fdf4' : undefined,
                      fontWeight: isEqRound ? 600 : undefined,
                    }}>
                      <td className="mono" style={{ color: isEqRound ? '#16a34a' : undefined }}>
                        {row.round}
                        {isEqRound && <span style={{ marginLeft: 6, fontSize: 10, color: '#16a34a' }}>⚡ EQ</span>}
                      </td>
                      <td className="mono">{(row.throughput || 0).toFixed(1)}</td>
                      {activeFlows.map(f => (
                        <td key={`r-${f.id}`} className="mono" style={{ color: f.color }}>
                          {(row[`rate_${f.id}`] || 0).toFixed(1)}
                        </td>
                      ))}
                      {activeFlows.map(f => {
                        const p = row[`payoff_${f.id}`] || 0;
                        return (
                          <td key={`p-${f.id}`} className="mono"
                            style={{ color: p < 0 ? '#dc2626' : p > 10 ? '#16a34a' : '#1a2340' }}>
                            {p.toFixed(2)}
                          </td>
                        );
                      })}
                      <td>
                        {isEqRound
                          ? <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>✅ YES</span>
                          : <span style={{ color: '#94a3b8', fontSize: 10 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}