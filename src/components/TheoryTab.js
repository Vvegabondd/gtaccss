import React, { useState } from 'react';

export default function TheoryTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <h2 style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 700, color: '#1a2340' }}>
        Game Theory & Network Concepts
      </h2>

      {/* Nash Equilibrium */}
      <div className="card">
        <div className="card-header">
          <span>🎯</span>
          <span className="card-title">Nash Equilibrium</span>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
              A <strong>Nash Equilibrium</strong> is a situation where no player can improve their outcome by unilaterally changing
              their strategy — assuming all other players keep theirs fixed. In GTACCS, this corresponds to a stable bandwidth
              allocation where no flow has incentive to deviate.
            </p>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12,
              fontFamily: 'JetBrains Mono', fontSize: 12, color: '#1e3a8a', lineHeight: 1.8 }}>
              If F2 increases rate → congestion ↑ → payoff ↓<br/>
              If F3 increases rate → congestion ↑ → payoff ↓<br/>
              If F1 decreases rate → throughput ↓ → payoff ↓<br/>
              <br/>
              ∴ No flow can improve → Nash Equilibrium
            </div>
          </div>
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>Prisoner's Dilemma Analogy</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Space Grotesk', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', background: '#f0f4ff', border: '1px solid #dde3f0', textAlign: 'left' }}></th>
                  <th style={{ padding: '8px 12px', background: '#f0f4ff', border: '1px solid #dde3f0' }}>Stay Silent</th>
                  <th style={{ padding: '8px 12px', background: '#f0f4ff', border: '1px solid #dde3f0' }}>Betray</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 12px', border: '1px solid #dde3f0', fontWeight: 600 }}>Stay Silent</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #dde3f0', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>(1, 1)</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #dde3f0', textAlign: 'center', color: '#dc2626' }}>(3, 0)</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', border: '1px solid #dde3f0', fontWeight: 600 }}>Betray</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #dde3f0', textAlign: 'center', color: '#dc2626' }}>(0, 3)</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #dde3f0', textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>(2, 2) ←NE</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
              Both betray = Nash Equilibrium (even though (1,1) would be better for both). Neither player can improve by
              switching alone.
            </p>
          </div>
        </div>
      </div>

      {/* Payoff Function */}
      <div className="card">
        <div className="card-header">
          <span>📐</span>
          <span className="card-title">Payoff Function & Live Solver</span>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
          <div>
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
              borderRadius: 10, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, color: '#60a5fa',
                letterSpacing: 1, lineHeight: 2 }}>
                U = T − (α × D) − (β × L × 100)
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { symbol: 'U', label: 'Payoff', desc: 'Overall satisfaction score.' },
                { symbol: 'T', label: 'Throughput', desc: 'Actual data (Mbps).' },
                { symbol: 'α', label: 'Delay wt', desc: 'Sensitivity to latency.' },
                { symbol: 'β', label: 'Loss pen', desc: 'Penalty for drops.' },
              ].map(({ symbol, label, desc }) => (
                <div key={symbol} style={{ background: '#f8faff', border: '1px solid #dde3f0',
                  borderRadius: 8, padding: 10 }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 700,
                    color: '#1d4ed8' }}>{symbol}</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 11,
                    color: '#374151' }}>{label}</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, color: '#64748b' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#f8faff', borderRadius: 12, padding: 20, border: '1px solid #dde3f0' }}>
            <div className="section-title">Live Formula Solver</div>
            <PayoffSolver />
          </div>
        </div>
      </div>

      {/* Jain's Fairness */}
      <div className="card">
        <div className="card-header">
          <span>⚖️</span>
          <span className="card-title">Jain's Fairness Index</span>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
              borderRadius: 10, padding: 16, marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 15, color: '#60a5fa', lineHeight: 2 }}>
                J = (Σxᵢ)² / (n × Σxᵢ²)
              </div>
            </div>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              J = 1.0 → Perfect fairness (all flows get equal share)<br/>
              J = 1/n → Maximum unfairness (one flow gets everything)<br/>
              J ≥ 0.85 → Generally accepted as "fair"
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              For the GTACCS equilibrium state with rates {'{30, 10, 5, 5}'}:
            </p>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#1e3a8a',
              background: '#eff6ff', borderRadius: 8, padding: 12, lineHeight: 1.8 }}>
              Σxᵢ = 50<br/>
              Σxᵢ² = 900+100+25+25 = 1050<br/>
              J = 2500 / (4 × 1050) = 2500/4200 ≈ 0.595
            </div>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 12, color: '#64748b' }}>
              J = 0.595 indicates moderate unfairness — the aggressive flow (F1 = 30 Mbps) dominates over conservative flows (5 Mbps each).
            </p>
          </div>
        </div>
      </div>

      {/* AIMD / TCP connection */}
      <div className="card">
        <div className="card-header">
          <span>📡</span>
          <span className="card-title">TCP AIMD & Network Congestion Control</span>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            {
              title: 'Congestion Model',
              color: '#2563eb',
              points: [
                'Demand aggregated per link each round',
                'Loss = (Demand − Capacity) / Demand',
                'Throughput = Rate × (1 − Loss)',
                'Delay = BaseDelay × (1 + 5 × Loss)',
                'Models tail-drop router queue behavior',
              ],
            },
            {
              title: 'AIMD (Adaptive Strategy)',
              color: '#16a34a',
              points: [
                'Additive Increase: Rate += 1.0 Mbps/round',
                'Multiplicative Decrease: Rate × 0.5 on loss',
                'Mirrors TCP Reno/Cubic behavior',
                'Produces fair share allocation at equilibrium',
                'Classic TCP sawtooth throughput pattern',
              ],
            },
            {
              title: 'Bottleneck Link D→E',
              color: '#ef4444',
              points: [
                'Capacity: 50 Mbps (lowest in network)',
                'All 4 flows pass through this link',
                'Initial total demand: 160 Mbps (3.2×)',
                'Round 1 loss: 68.75%, delay: 44.375 ms',
                'Equilibrium rates sum to exactly 50 Mbps',
              ],
            },
          ].map(({ title, color, points }) => (
            <div key={title} style={{ background: '#f8faff', border: `1px solid #dde3f0`,
              borderTop: `3px solid ${color}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13,
                color, marginBottom: 10 }}>{title}</div>
              <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
                {points.map((pt, i) => (
                  <li key={i} style={{ fontFamily: 'Space Grotesk', fontSize: 12, color: '#374151',
                    lineHeight: 1.6, paddingLeft: 14, position: 'relative', marginBottom: 2 }}>
                    <span style={{ position: 'absolute', left: 0, color }}>·</span>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Academic scope */}
      <div className="card">
        <div className="card-header">
          <span>🎓</span>
          <span className="card-title">Academic Scope</span>
        </div>
        <div className="card-body">
          <table className="flow-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Concepts Applied</th>
                <th>Role in GTACCS</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Discrete Mathematics', 'Graph theory, relations, payoff matrices, strategy sets', 'Network topology modeling, logical strategy decisions'],
                ['Design & Analysis of Algorithms', 'Greedy algorithms, optimization, complexity O(F×L)', 'Flow rate allocation, congestion detection algorithms'],
                ['Computer Networks', 'TCP congestion control, QoS metrics, packet loss', 'Network simulation layer, realistic behavior modeling'],
                ['Game Theory', 'Nash Equilibrium, payoff functions, evolutionary strategies', 'Core intelligence layer — the strategic dimension'],
              ].map(([subj, concepts, role]) => (
                <tr key={subj}>
                  <td style={{ fontWeight: 600, color: '#1d4ed8', fontFamily: 'Space Grotesk', whiteSpace: 'nowrap' }}>{subj}</td>
                  <td style={{ fontSize: 12, color: '#374151' }}>{concepts}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function PayoffSolver() {
  const [t, setT] = useState(40);
  const [d, setD] = useState(25);
  const [l, setL] = useState(5);
  const [a, setA] = useState(0.3);
  const [b, setB] = useState(2.0);

  const payoff = t - (a * d) - (b * l);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ fontSize: 11 }}>
          <label style={{ display: 'block', fontWeight: 600 }}>Throughput (T)</label>
          <input type="range" min="0" max="100" value={t} onChange={e => setT(+e.target.value)} style={{ width: '100%' }} />
          <span>{t} Mbps</span>
        </div>
        <div style={{ fontSize: 11 }}>
          <label style={{ display: 'block', fontWeight: 600 }}>Delay (D)</label>
          <input type="range" min="0" max="100" value={d} onChange={e => setD(+e.target.value)} style={{ width: '100%' }} />
          <span>{d} ms</span>
        </div>
        <div style={{ fontSize: 11 }}>
          <label style={{ display: 'block', fontWeight: 600 }}>Loss % (L)</label>
          <input type="range" min="0" max="50" value={l} onChange={e => setL(+e.target.value)} style={{ width: '100%' }} />
          <span>{l}%</span>
        </div>
        <div style={{ fontSize: 11 }}>
          <label style={{ display: 'block', fontWeight: 600 }}>Alpha (α)</label>
          <input type="range" min="0" max="1" step="0.1" value={a} onChange={e => setA(+e.target.value)} style={{ width: '100%' }} />
          <span>{a}</span>
        </div>
      </div>
      <div style={{ marginTop: 10, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #bfdbfe', textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Calculated Payoff</div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 24, fontWeight: 700, color: payoff > 0 ? '#16a34a' : '#ef4444' }}>
          {payoff.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
