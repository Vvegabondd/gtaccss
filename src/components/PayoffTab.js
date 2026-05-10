import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import FairnessGauge from './FairnessGauge';
import { STRATEGY_META } from '../simulation/engine';

export default function PayoffTab({ state, alpha, beta, onAlpha, onBeta }) {
  const { flows = [], fairness = 0, totalThroughput = 0, historyChart = [], flowsWithPayoff = [], equilibrium = false } = state;

  const avgPayoff = flowsWithPayoff.length
    ? flowsWithPayoff.reduce((s, f) => s + (f.payoff || 0), 0) / flowsWithPayoff.length
    : 0;

  const worstPayoff = flowsWithPayoff.length
    ? Math.min(...flowsWithPayoff.map(f => f.payoff || 0))
    : 0;

  const sorted = [...flowsWithPayoff].sort((a, b) => (b.payoff || 0) - (a.payoff || 0));

  // Payoff matrix (strategy vs strategy)
  const strategies = ['aggressive', 'conservative', 'adaptive'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <h2 style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, color: '#1a2340' }}>
        Payoff Calculator & Fairness Dashboard
      </h2>

      {/* Metrics row */}
      <div className="metrics-strip">
        <div className="metric-card green">
          <div className="metric-label">Jain's Fairness Index</div>
          <div className="metric-value">{fairness.toFixed(3)}</div>
          <div className="metric-sub">{fairness > 0.85 ? '✓ High fairness' : fairness > 0.6 ? '~ Moderate' : '✗ Low fairness'}</div>
        </div>
        <div className="metric-card blue">
          <div className="metric-label">Network Utility</div>
          <div className="metric-value">{totalThroughput.toFixed(1)}</div>
          <div className="metric-sub">Total Mbps delivered</div>
        </div>
        <div className="metric-card amber">
          <div className="metric-label">Avg Payoff</div>
          <div className="metric-value" style={{ fontSize: 22 }}>{avgPayoff.toFixed(2)}</div>
          <div className="metric-sub">Across all flows</div>
        </div>
        <div className="metric-card red">
          <div className="metric-label">Worst Payoff</div>
          <div className="metric-value" style={{ fontSize: 22, color: worstPayoff < 0 ? '#ef4444' : '#1a2340' }}>
            {worstPayoff.toFixed(2)}
          </div>
          <div className="metric-sub">Lowest scoring flow</div>
        </div>
      </div>

      <div className="grid-23">
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Fairness gauge */}
          <div className="card">
            <div className="card-header">
              <span>⚖️</span>
              <span className="card-title">Fairness Gauge</span>
            </div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
              <FairnessGauge value={fairness}/>
            </div>
          </div>

          {/* Alpha/Beta tuners */}
          <div className="card">
            <div className="card-header">
              <span>🎛️</span>
              <span className="card-title">Payoff Function Weights</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f0f7ff', borderRadius: 8, padding: 12,
                fontFamily: 'JetBrains Mono', fontSize: 11, color: '#1e3a8a', lineHeight: 1.7 }}>
                U = Throughput − (α × Delay) − (β × Loss × 100)
              </div>

              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 12, color: '#4a5578',
                  fontWeight: 600, marginBottom: 6 }}>
                  α (delay sensitivity) = <span style={{ color: '#2563eb', fontFamily: 'JetBrains Mono' }}>{alpha.toFixed(2)}</span>
                </div>
                <input type="range" min="0" max="2" step="0.05" value={alpha}
                  onChange={e => onAlpha(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#2563eb' }}/>
              </div>

              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 12, color: '#4a5578',
                  fontWeight: 600, marginBottom: 6 }}>
                  β (loss penalty) = <span style={{ color: '#dc2626', fontFamily: 'JetBrains Mono' }}>{beta.toFixed(2)}</span>
                </div>
                <input type="range" min="0" max="5" step="0.1" value={beta}
                  onChange={e => onBeta(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#dc2626' }}/>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="card">
            <div className="card-header">
              <span>🏆</span>
              <span className="card-title">Payoff Leaderboard</span>
            </div>
            <div className="card-body">
              {sorted.map((f, rank) => {
                const meta = STRATEGY_META[f.strategy] || {};
                const pct = Math.min(Math.max((f.payoff + 50) / 100, 0), 1) * 100;
                return (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 10 }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11,
                      color: '#94a3b8', width: 16 }}>#{rank+1}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700,
                      fontSize: 14, color: f.color, width: 28 }}>{f.id}</span>
                    <span className="strategy-badge" style={{
                      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                      fontSize: 10,
                    }}>{meta.icon}</span>
                    <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`,
                        background: f.payoff > 0 ? '#16a34a' : '#ef4444',
                        borderRadius: 100, transition: 'width 0.4s' }}/>
                    </div>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12,
                      color: f.payoff > 0 ? '#16a34a' : '#ef4444', fontWeight: 600, width: 48, textAlign: 'right' }}>
                      {(f.payoff || 0).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Payoff trend chart + Equilibrium */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Equilibrium status */}
          <div className="card">
            <div className="card-header">
              <span>🎯</span>
              <span className="card-title">Nash Equilibrium Detector</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{
                  padding: '10px 24px', borderRadius: 100, fontFamily: 'JetBrains Mono',
                  fontSize: 13, fontWeight: 700, letterSpacing: 1,
                  background: equilibrium ? '#f0fdf4' : '#f8faff',
                  border: `2px solid ${equilibrium ? '#16a34a' : '#94a3b8'}`,
                  color: equilibrium ? '#16a34a' : '#64748b',
                  animation: equilibrium ? 'pulse 2s infinite' : 'none',
                  boxShadow: equilibrium ? '0 0 16px rgba(22,163,74,0.3)' : 'none',
                }}>
                  {equilibrium ? '⚡ NASH EQUILIBRIUM REACHED' : '🔍 SEARCHING FOR EQUILIBRIUM...'}
                </div>
              </div>
              <div className="info-box" style={{ fontSize: 12, lineHeight: 1.6 }}>
                <strong>Nash Equilibrium</strong> is reached when no flow can improve its payoff by unilaterally changing strategy.
                The detector uses a sliding window of payoff variance — equilibrium is declared when all flows show variance below threshold over 8 consecutive rounds.
              </div>

              {/* Per-flow stability bars */}
              <div style={{ marginTop: 16 }}>
                <div className="section-title">Per-Flow Stability</div>
                {flows.map(f => {
                  // Compute stability from last payoffs in history
                  const stable = Math.random() > 0.4; // placeholder visual
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: f.color, width: 28 }}>{f.id}</span>
                      <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: equilibrium ? '100%' : historyChart.length > 5 ? `${Math.min(historyChart.length * 4, 85)}%` : '20%',
                          background: equilibrium ? '#16a34a' : '#3b82f6',
                          borderRadius: 100, transition: 'width 0.5s',
                        }}/>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'Space Grotesk', color: equilibrium ? '#16a34a' : '#94a3b8', fontWeight: 600, width: 48 }}>
                        {equilibrium ? 'Stable ✓' : 'Adapting'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Payoff trend chart */}
          <div className="card">
            <div className="card-header">
              <span>📉</span>
              <span className="card-title">Payoff Trend (All Flows)</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={historyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff"/>
                  <XAxis dataKey="round" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    label={{ value: 'Round', position: 'insideBottom', offset: -2, fontSize: 10 }}/>
                  <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    label={{ value: 'Payoff', angle: -90, position: 'insideLeft', fontSize: 10 }}/>
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: '0', fontSize: 9 }}/>
                  <Tooltip contentStyle={{ fontFamily: 'Space Grotesk', fontSize: 12 }}/>
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Space Grotesk' }} iconType="circle"/>
                  {flows.map(f => (
                    <Line key={f.id} type="monotone" dataKey={`payoff_${f.id}`}
                      name={`${f.id}`} stroke={f.color} strokeWidth={2} dot={false}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
