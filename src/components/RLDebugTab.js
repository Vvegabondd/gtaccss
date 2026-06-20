import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { A2CAgent } from '../rl/A2CAgent';
import { DDQNAgent } from '../rl/DDQNAgent';
import { A3CAgent } from '../rl/A3CAgent';
import { GTACCSEnvironment } from '../simulation/environment';

export default function RLDebugTab({ topology, a2cAgent, ddqnAgent, a3cAgent }) {
  const [algo, setAlgo] = useState('a2c');

  // Hyperparameters
  const [lrActor, setLrActor] = useState(0.01);
  const [lrCritic, setLrCritic] = useState(0.02);
  const [lrDdqn, setLrDdqn] = useState(0.01);
  const [gamma, setGamma] = useState(0.95);

  const [isLive, setIsLive] = useState(false);

  // A2C States
  const [a2cEpisodeCount, setA2cEpisodeCount] = useState(0);
  const [a2cHistory, setA2cHistory] = useState([]);
  const [a2cMetrics, setA2cMetrics] = useState({
    episode: 0,
    round: 0,
    cumulativeReward: 0,
    avgLatency: 0,
    avgLoss: 0,
    jainFairness: 1.0,
    actionPercentages: { 0: 33.33, 1: 33.33, 2: 33.33 }
  });

  // DDQN States
  const [ddqnEpisodeCount, setDdqnEpisodeCount] = useState(0);
  const [ddqnHistory, setDdqnHistory] = useState([]);
  const [ddqnMetrics, setDdqnMetrics] = useState({
    episode: 0,
    round: 0,
    cumulativeReward: 0,
    avgLatency: 0,
    avgLoss: 0,
    jainFairness: 1.0,
    actionPercentages: { 0: 33.33, 1: 33.33, 2: 33.33 }
  });

  // A3C States
  const [a3cEpisodeCount, setA3cEpisodeCount] = useState(0);
  const [a3cHistory, setA3cHistory] = useState([]);
  const [a3cMetrics, setA3cMetrics] = useState({
    episode: 0,
    round: 0,
    cumulativeReward: 0,
    avgLatency: 0,
    avgLoss: 0,
    jainFairness: 1.0,
    actionPercentages: { 0: 33.33, 1: 33.33, 2: 33.33 }
  });

  // Map state accessors dynamically based on selected algorithm
  const history = algo === 'a2c' ? a2cHistory : (algo === 'ddqn' ? ddqnHistory : a3cHistory);
  const setHistory = algo === 'a2c' ? setA2cHistory : (algo === 'ddqn' ? setDdqnHistory : setA3cHistory);
  
  const episodeCount = algo === 'a2c' ? a2cEpisodeCount : (algo === 'ddqn' ? ddqnEpisodeCount : a3cEpisodeCount);
  const setEpisodeCount = algo === 'a2c' ? setA2cEpisodeCount : (algo === 'ddqn' ? setDdqnEpisodeCount : setA3cEpisodeCount);

  const metrics = algo === 'a2c' ? a2cMetrics : (algo === 'ddqn' ? ddqnMetrics : a3cMetrics);
  const setMetrics = algo === 'a2c' ? setA2cMetrics : (algo === 'ddqn' ? setDdqnMetrics : setA3cMetrics);

  const agent = algo === 'a2c' ? a2cAgent : (algo === 'ddqn' ? ddqnAgent : a3cAgent);

  // Keep references to environment instances (mainly for A2C and DDQN local runs)
  const env = useRef(null);
  const currentLiveState = useRef(null);

  if (!env.current) {
    env.current = new GTACCSEnvironment(topology?.flows, topology?.links, topology?.nodes);
    currentLiveState.current = env.current.reset();
  }

  // Update agent hyperparameters dynamically when changed in UI
  useEffect(() => {
    if (a2cAgent && a2cAgent.current) {
      a2cAgent.current.lrActor = lrActor;
      a2cAgent.current.lrCritic = lrCritic;
      a2cAgent.current.gamma = gamma;
    }
  }, [lrActor, lrCritic, gamma, a2cAgent]);

  useEffect(() => {
    if (ddqnAgent && ddqnAgent.current) {
      ddqnAgent.current.lr = lrDdqn;
      ddqnAgent.current.gamma = gamma;
    }
  }, [lrDdqn, gamma, ddqnAgent]);

  useEffect(() => {
    if (a3cAgent && a3cAgent.current) {
      a3cAgent.current.lrActor = lrActor;
      a3cAgent.current.lrCritic = lrCritic;
      a3cAgent.current.gamma = gamma;
      a3cAgent.current.workers.forEach(w => {
        w.lrActor = lrActor;
        w.lrCritic = lrCritic;
      });
    }
  }, [lrActor, lrCritic, gamma, a3cAgent]);

  // Synchronize environment topology when user changes it in TopologyBuilder
  useEffect(() => {
    if (env.current) {
      env.current = new GTACCSEnvironment(topology?.flows, topology?.links, topology?.nodes);
      currentLiveState.current = env.current.reset();
      setMetrics(prev => ({
        ...prev,
        round: 0,
        cumulativeReward: 0
      }));
    }
  }, [topology]);

  // Handle Algorithm Switch
  const handleAlgoChange = (newAlgo) => {
    setIsLive(false);
    setAlgo(newAlgo);
    if (env.current) {
      env.current.reset();
      currentLiveState.current = env.current.getState();
    }
  };

  // Live step training loop
  useEffect(() => {
    let timer = null;
    if (isLive) {
      timer = setInterval(() => {
        if (algo === 'a3c') {
          // Train one step across all A3C Workers synchronously
          agent.current.train();
          
          const activeWorkers = agent.current.workers;
          const avgLatency = activeWorkers.reduce((s, w) => s + (w.env.flows[1]?.pathLatency || 0), 0) / activeWorkers.length;
          const avgLoss = activeWorkers.reduce((s, w) => s + (w.env.flows[1]?.lossRate || 0), 0) / activeWorkers.length;
          const avgFairness = activeWorkers.reduce((s, w) => s + w.env.getJainsIndex(), 0) / activeWorkers.length;
          const globalReward = agent.current.episodeRewards.length
            ? agent.current.episodeRewards.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, agent.current.episodeRewards.length)
            : 0;

          setMetrics({
            episode: agent.current.episodeCount,
            round: activeWorkers[0].env.currentRound, // show first worker's round
            cumulativeReward: parseFloat(globalReward.toFixed(4)),
            avgLatency,
            avgLoss,
            jainFairness: avgFairness,
            actionPercentages: agent.current.getActionPercentages()
          });

          if (agent.current.episodeCount > episodeCount) {
            const lastReward = agent.current.episodeRewards[agent.current.episodeRewards.length - 1];
            setHistory(prev => [
              ...prev,
              {
                episode: agent.current.episodeCount,
                reward: parseFloat(lastReward.toFixed(4)),
                fairness: avgFairness,
                latency: avgLatency,
                loss: avgLoss
              }
            ]);
            setEpisodeCount(agent.current.episodeCount);
          }
        } else {
          // A2C or DDQN training updates step-by-step
          const state = currentLiveState.current;
          const { action } = agent.current.selectAction(state, false);
          const { state: nextState, reward, done } = env.current.step(action);

          agent.current.train(state, action, reward, nextState, done);
          currentLiveState.current = nextState;

          setMetrics(prev => ({
            episode: episodeCount + 1,
            round: env.current.currentRound,
            cumulativeReward: parseFloat(env.current.cumulativeReward.toFixed(4)),
            avgLatency: nextState[1],
            avgLoss: nextState[2],
            jainFairness: nextState[4],
            actionPercentages: agent.current.getActionPercentages()
          }));

          if (done) {
            const epReward = env.current.cumulativeReward;
            agent.current.saveCheckpoint(epReward);

            setHistory(prev => [
              ...prev,
              {
                episode: episodeCount + 1,
                reward: parseFloat(epReward.toFixed(4)),
                fairness: nextState[4],
                latency: nextState[1],
                loss: nextState[2]
              }
            ]);

            setEpisodeCount(prev => prev + 1);
            currentLiveState.current = env.current.reset();
            agent.current.resetActionCounts();
          }
        }
      }, 30);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLive, episodeCount, algo]);

  // Synchronous batch episode trainer
  const trainBatch = (numEpisodes) => {
    setIsLive(false);

    if (algo === 'a3c') {
      const newHistory = [...history];
      let currentEp = episodeCount;

      for (let e = 0; e < numEpisodes; e++) {
        // Runs 100 simulation rounds to finish one episode step on all workers
        for (let step = 0; step < 100; step++) {
          agent.current.train();
        }

        currentEp = agent.current.episodeCount;
        const lastReward = agent.current.episodeRewards[agent.current.episodeRewards.length - 1] || 0;

        const activeWorkers = agent.current.workers;
        const avgLatency = activeWorkers.reduce((s, w) => s + (w.env.flows[1]?.pathLatency || 0), 0) / activeWorkers.length;
        const avgLoss = activeWorkers.reduce((s, w) => s + (w.env.flows[1]?.lossRate || 0), 0) / activeWorkers.length;
        const avgFairness = activeWorkers.reduce((s, w) => s + w.env.getJainsIndex(), 0) / activeWorkers.length;

        newHistory.push({
          episode: currentEp,
          reward: parseFloat(lastReward.toFixed(4)),
          fairness: parseFloat(avgFairness.toFixed(4)),
          latency: parseFloat(avgLatency.toFixed(2)),
          loss: parseFloat(avgLoss.toFixed(4))
        });
      }

      setEpisodeCount(currentEp);
      setHistory(newHistory);

      if (newHistory.length > 0) {
        const last = newHistory[newHistory.length - 1];
        setMetrics({
          episode: last.episode,
          round: 100,
          cumulativeReward: last.reward,
          avgLatency: last.latency,
          avgLoss: last.loss,
          jainFairness: last.fairness,
          actionPercentages: agent.current.getActionPercentages()
        });
      }
      return;
    }

    // A2C or DDQN batch training loop
    const newHistory = [...history];
    let currentEp = episodeCount;

    for (let e = 0; e < numEpisodes; e++) {
      currentEp++;
      let state = env.current.reset();
      let done = false;
      let epReward = 0;
      agent.current.resetActionCounts();

      let sumFairness = 0;
      let sumLatency = 0;
      let sumLoss = 0;
      let steps = 0;

      while (!done) {
        const { action } = agent.current.selectAction(state, false);
        const { state: nextState, reward, done: isDone } = env.current.step(action);
        agent.current.train(state, action, reward, nextState, isDone);

        state = nextState;
        done = isDone;
        epReward += reward;

        sumFairness += nextState[4];
        sumLatency += nextState[1];
        sumLoss += nextState[2];
        steps++;
      }

      agent.current.saveCheckpoint(epReward);

      newHistory.push({
        episode: currentEp,
        reward: parseFloat(epReward.toFixed(4)),
        fairness: parseFloat((sumFairness / steps).toFixed(4)),
        latency: parseFloat((sumLatency / steps).toFixed(2)),
        loss: parseFloat((sumLoss / steps).toFixed(4))
      });
    }

    setEpisodeCount(currentEp);
    setHistory(newHistory);

    if (newHistory.length > 0) {
      const last = newHistory[newHistory.length - 1];
      setMetrics({
        episode: last.episode,
        round: 100,
        cumulativeReward: last.reward,
        avgLatency: last.latency,
        avgLoss: last.loss,
        jainFairness: last.fairness,
        actionPercentages: agent.current.getActionPercentages()
      });
    }
  };

  const handleResetAgent = () => {
    setIsLive(false);
    if (algo === 'a2c') {
      agent.current = new A2CAgent({ lrActor, lrCritic, gamma });
    } else if (algo === 'ddqn') {
      agent.current = new DDQNAgent({ lr: lrDdqn, gamma });
    } else {
      agent.current = new A3CAgent({ topology, lrActor, lrCritic, gamma });
    }
    currentLiveState.current = env.current.reset();
    setEpisodeCount(0);
    setHistory([]);
    setMetrics({
      episode: 0,
      round: 0,
      cumulativeReward: 0,
      avgLatency: 0,
      avgLoss: 0,
      jainFairness: 1.0,
      actionPercentages: { 0: 33.33, 1: 33.33, 2: 33.33 }
    });
  };

  // Recharts Chart Data (Rolling average over last 10 episodes)
  const chartData = useMemo(() => {
    return history.map((item, idx) => {
      const start = Math.max(0, idx - 9);
      const subset = history.slice(start, idx + 1);
      const rollingAvg = subset.reduce((sum, d) => sum + d.reward, 0) / subset.length;
      return {
        ...item,
        rollingAvg: parseFloat(rollingAvg.toFixed(4))
      };
    });
  }, [history]);

  // Compute average of last 10 metrics for top strip
  const avgMetrics = useMemo(() => {
    if (history.length === 0) return null;
    const last10 = history.slice(-10);
    const count = last10.length;
    return {
      fairness: last10.reduce((s, h) => s + h.fairness, 0) / count,
      latency: last10.reduce((s, h) => s + h.latency, 0) / count,
      loss: last10.reduce((s, h) => s + h.loss, 0) / count,
      reward: last10.reduce((s, h) => s + h.reward, 0) / count
    };
  }, [history]);

  return (
    <div className="rl-debug-container">
      {/* Algorithm selector */}
      <div className="rl-card" style={{ padding: '12px var(--sp-5)', flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>🤖 Target RL Algorithm:</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`rl-btn ${algo === 'a2c' ? 'rl-btn-primary' : 'rl-btn-secondary'}`}
            onClick={() => handleAlgoChange('a2c')}
          >
            A2C (Actor-Critic)
          </button>
          <button
            className={`rl-btn ${algo === 'ddqn' ? 'rl-btn-primary' : 'rl-btn-secondary'}`}
            onClick={() => handleAlgoChange('ddqn')}
          >
            DDQN (Value-Based)
          </button>
          <button
            className={`rl-btn ${algo === 'a3c' ? 'rl-btn-primary' : 'rl-btn-secondary'}`}
            onClick={() => handleAlgoChange('a3c')}
          >
            A3C (Asynchronous AC)
          </button>
        </div>
        {algo === 'ddqn' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 15, fontSize: 12 }}>
            <span style={{ background: 'var(--accent-lt)', border: '1px solid var(--accent-md)', borderRadius: 5, padding: '4px 10px', color: 'var(--accent)', fontWeight: 600 }}>
              Epsilon: {agent.current?.epsilon?.toFixed(3) || '1.000'}
            </span>
            <span style={{ background: 'var(--surface3)', borderRadius: 5, padding: '4px 10px', color: 'var(--text2)', fontWeight: 600 }}>
              Replay Size: {agent.current?.replayBuffer?.size() || 0}
            </span>
          </div>
        )}
      </div>

      {/* Metrics strip */}
      <div className="metrics-strip">
        <div className="metric-card blue">
          <div className="metric-label">{algo.toUpperCase()} Episode</div>
          <div className="metric-value">{metrics.episode}</div>
          <div className="metric-sub">Round {metrics.round} / 100</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">{algo === 'a3c' ? 'Global Reward' : 'Episode Reward'}</div>
          <div className="metric-value">
            {isLive ? metrics.cumulativeReward.toFixed(1) : (avgMetrics ? avgMetrics.reward.toFixed(1) : '0.0')}
          </div>
          <div className="metric-sub">{isLive ? 'Current cumulative' : 'Average (last 10 eps)'}</div>
        </div>
        <div className="metric-card amber">
          <div className="metric-label">Jain's Fairness</div>
          <div className="metric-value">
            {isLive ? metrics.jainFairness.toFixed(3) : (avgMetrics ? avgMetrics.fairness.toFixed(3) : '1.000')}
          </div>
          <div className="metric-sub">{isLive ? 'Live flow equity' : 'Average (last 10 eps)'}</div>
        </div>
        <div className="metric-card red">
          <div className="metric-label">Avg Packet Loss</div>
          <div className="metric-value">
            {isLive ? `${(metrics.avgLoss * 100).toFixed(1)}%` : (avgMetrics ? `${(avgMetrics.loss * 100).toFixed(1)}%` : '0.0%')}
          </div>
          <div className="metric-sub">{isLive ? 'Live drop rate' : 'Average (last 10 eps)'}</div>
        </div>
        <div className="metric-card purple" style={{ borderTop: '3px solid #7c3aed', background: 'linear-gradient(135deg,#faf5ff,#ede9fe)' }}>
          <div className="metric-label" style={{ color: '#6d28d9' }}>Avg Latency</div>
          <div className="metric-value" style={{ color: '#7c3aed' }}>
            {isLive ? `${metrics.avgLatency.toFixed(1)} ms` : (avgMetrics ? `${avgMetrics.latency.toFixed(1)} ms` : '0.0 ms')}
          </div>
          <div className="metric-sub">{isLive ? 'Live propagation + queue' : 'Average (last 10 eps)'}</div>
        </div>
      </div>

      {/* A3C Workers view */}
      {algo === 'a3c' && (
        <div className="rl-card" style={{ marginBottom: 10 }}>
          <div className="rl-card-title">🌐 A3C Multi-Worker Training Dashboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15 }}>
            {agent.current?.workers?.map(w => {
              const epRewards = w.episodeRewards;
              const lastEpReward = epRewards.length ? epRewards[epRewards.length - 1].toFixed(1) : '0.0';
              return (
                <div key={w.id} style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: 'var(--accent)' }}>Worker {w.id}</span>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text2)' }}>{w.scenarioKey}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--f-mono)', color: 'var(--text)' }}>
                    {w.cumulativeReward.toFixed(1)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
                    <span>Round {w.currentRound}/100</span>
                    <span>Last Ep: {lastEpReward}</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${w.currentRound}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Control panel and charts */}
      <div className="rl-debug-grid">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Controls Card */}
          <div className="rl-card">
            <div className="rl-card-title">⚙️ Training Controls ({algo.toUpperCase()})</div>
            
            <div className="rl-controls-row">
              <button
                className={`rl-btn ${isLive ? 'rl-btn-danger' : 'rl-btn-primary'}`}
                onClick={() => setIsLive(!isLive)}
              >
                {isLive ? '⏸ Stop Live' : '▶ Start Live'}
              </button>
              <button
                className="rl-btn rl-btn-secondary"
                onClick={() => trainBatch(1)}
                disabled={isLive}
              >
                🏋️ Train 1 Ep
              </button>
              <button
                className="rl-btn rl-btn-secondary"
                onClick={() => trainBatch(50)}
                disabled={isLive}
              >
                🚀 Train 50 Eps
              </button>
              <button
                className="rl-btn rl-btn-danger"
                onClick={handleResetAgent}
              >
                ↺ Reset Agent
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

            <div className="rl-sliders-grid">
              {algo !== 'ddqn' ? (
                <>
                  <div className="rl-slider-group">
                    <div className="rl-slider-label">
                      <span>Actor LR</span>
                      <span className="rl-slider-value">{lrActor.toFixed(4)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0005"
                      max="0.05"
                      step="0.0005"
                      className="rl-slider"
                      value={lrActor}
                      onChange={e => setLrActor(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="rl-slider-group">
                    <div className="rl-slider-label">
                      <span>Critic LR</span>
                      <span className="rl-slider-value">{lrCritic.toFixed(4)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.001"
                      max="0.1"
                      step="0.001"
                      className="rl-slider"
                      value={lrCritic}
                      onChange={e => setLrCritic(parseFloat(e.target.value))}
                    />
                  </div>
                </>
              ) : (
                <div className="rl-slider-group" style={{ gridColumn: 'span 2' }}>
                  <div className="rl-slider-label">
                    <span>Q-Network Learning Rate</span>
                    <span className="rl-slider-value">{lrDdqn.toFixed(4)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0005"
                    max="0.05"
                    step="0.0005"
                    className="rl-slider"
                    value={lrDdqn}
                    onChange={e => setLrDdqn(parseFloat(e.target.value))}
                  />
                </div>
              )}

              <div className="rl-slider-group" style={{ gridColumn: 'span 2' }}>
                <div className="rl-slider-label">
                  <span>Discount Factor (Gamma)</span>
                  <span className="rl-slider-value">{gamma.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  className="rl-slider"
                  value={gamma}
                  onChange={e => setGamma(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Exploration Tracker Card */}
          <div className="rl-card">
            <div className="rl-card-title">🎯 Action Exploration Tracker</div>
            
            <div className="rl-bar-container">
              <div className="rl-bar-group">
                <div className="rl-bar-header">
                  <span style={{ color: 'var(--green)' }}>🛡️ Conservative Action (0)</span>
                  <span>{metrics.actionPercentages[0]}%</span>
                </div>
                <div className="rl-bar-outer">
                  <div
                    className="rl-bar-inner"
                    style={{
                      width: `${metrics.actionPercentages[0]}%`,
                      backgroundColor: 'var(--green)'
                    }}
                  />
                </div>
              </div>

              <div className="rl-bar-group">
                <div className="rl-bar-header">
                  <span style={{ color: 'var(--blue)' }}>📈 TCP AIMD / Adaptive (1)</span>
                  <span>{metrics.actionPercentages[1]}%</span>
                </div>
                <div className="rl-bar-outer">
                  <div
                    className="rl-bar-inner"
                    style={{
                      width: `${metrics.actionPercentages[1]}%`,
                      backgroundColor: 'var(--blue)'
                    }}
                  />
                </div>
              </div>

              <div className="rl-bar-group">
                <div className="rl-bar-header">
                  <span style={{ color: 'var(--red)' }}>⚡ Aggressive Action (2)</span>
                  <span>{metrics.actionPercentages[2]}%</span>
                </div>
                <div className="rl-bar-outer">
                  <div
                    className="rl-bar-inner"
                    style={{
                      width: `${metrics.actionPercentages[2]}%`,
                      backgroundColor: 'var(--red)'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Learning Curve Chart) */}
        <div className="rl-card" style={{ height: '100%', minHeight: 400 }}>
          <div className="rl-card-title">📈 {algo.toUpperCase()} Agent Learning Curve</div>
          
          <div style={{ flex: 1, width: '100%', minHeight: 300 }}>
            {chartData.length === 0 ? (
              <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span>No training data. Click "Start Live" or "Train 50 Eps" to begin learning.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="episode"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      fontFamily: 'var(--f-body)',
                      fontSize: 12,
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    name="Episode Reward"
                    type="monotone"
                    dataKey="reward"
                    stroke="#93c5fd"
                    strokeWidth={1}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    name="10-Ep Rolling Avg"
                    type="monotone"
                    dataKey="rollingAvg"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
