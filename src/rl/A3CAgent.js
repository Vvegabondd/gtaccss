import { DenseLayer, softmax } from './neural.js';
import { GTACCSEnvironment } from '../simulation/environment.js';

export class A3CWorker {
  constructor(id, scenarioKey, topology, options = {}) {
    this.id = id;
    this.scenarioKey = scenarioKey;

    // Configure scenario flows
    const baseFlows = topology?.flows || [];
    const flows = baseFlows.map((f, i) => {
      let profile = 'adaptive';
      let strategy = 'aimd';
      let rate = f.rate || 40;

      switch (scenarioKey) {
        case 'conservative':
          profile = 'conservative';
          strategy = 'conservative';
          rate = Math.max(15, Math.round(rate * 0.7));
          break;
        case 'adaptive':
          profile = 'adaptive';
          strategy = 'adaptive';
          rate = Math.max(20, Math.round(rate * 0.9));
          break;
        case 'burst':
          profile = 'burstTraffic';
          strategy = i % 2 === 0 ? 'aggressive' : 'aimd';
          rate = Math.max(30, Math.round(rate * 1.2));
          break;
        case 'mixed':
        default:
          const strategies = ['aggressive', 'aimd', 'conservative'];
          const profiles = ['aggressive', 'adaptive', 'conservative'];
          strategy = strategies[i % strategies.length];
          profile = profiles[i % profiles.length];
          break;
      }
      return { ...f, strategy, trafficProfile: profile, rate };
    });

    this.env = new GTACCSEnvironment(flows, topology?.links, topology?.nodes);
    this.state = this.env.reset();

    this.lrActor = options.lrActor || 0.01;
    this.lrCritic = options.lrCritic || 0.02;

    // Local worker Actor networks
    this.actorL1 = new DenseLayer(6, 16, 'relu');
    this.actorL2 = new DenseLayer(16, 3, 'linear');

    // Local worker Critic networks
    this.criticL1 = new DenseLayer(6, 16, 'relu');
    this.criticL2 = new DenseLayer(16, 1, 'linear');

    this.cumulativeReward = 0;
    this.currentRound = 0;
    this.episodeCount = 0;
    this.episodeRewards = [];
  }

  syncWithGlobal(globalAgent) {
    this.actorL1.setWeights(globalAgent.actorL1.getWeights());
    this.actorL2.setWeights(globalAgent.actorL2.getWeights());
    this.criticL1.setWeights(globalAgent.criticL1.getWeights());
    this.criticL2.setWeights(globalAgent.criticL2.getWeights());
  }

  stepAndTrain(globalAgent) {
    // 1. Sync local parameters from global network
    this.syncWithGlobal(globalAgent);

    // Save current weight snapshots before running local update step (to compute parameter deltas)
    const oldActorL1 = this.actorL1.getWeights();
    const oldActorL2 = this.actorL2.getWeights();
    const oldCriticL1 = this.criticL1.getWeights();
    const oldCriticL2 = this.criticL2.getWeights();

    // 2. Sample local action from probabilities
    const normState = globalAgent.normalizeState(this.state);
    const hActor = this.actorL1.forward(normState);
    const logits = this.actorL2.forward(hActor);
    const probs = softmax(logits);

    const r = Math.random();
    let cumulative = 0;
    let action = 2;
    for (let i = 0; i < 3; i++) {
      cumulative += probs[i];
      if (r <= cumulative) {
        action = i;
        break;
      }
    }

    // 3. Step local environment
    const { state: nextState, reward, done } = this.env.step(action);
    this.cumulativeReward += reward;
    this.currentRound = this.env.currentRound;

    // 4. Calculate gradients locally (local backpropagation)
    const normNextState = globalAgent.normalizeState(nextState);

    // V(s')
    let V_s_prime = 0;
    if (!done) {
      const hc_prime = this.criticL1.forward(normNextState);
      V_s_prime = this.criticL2.forward(hc_prime)[0];
    }

    // V(s)
    const hc = this.criticL1.forward(normState);
    const V_s = this.criticL2.forward(hc)[0];

    const target = reward + globalAgent.gamma * V_s_prime;
    const advantage = target - V_s;

    // Critic gradient backprop
    const dValue = [-advantage];
    const dHiddenCritic = this.criticL2.backward(dValue, this.lrCritic);
    this.criticL1.backward(dHiddenCritic, this.lrCritic);

    // Actor policy gradient backprop
    const ha = this.actorL1.forward(normState);
    const actorLogits = this.actorL2.forward(ha);
    const actorProbs = softmax(actorLogits);
    const dLogits = actorProbs.map((p, i) => (i === action ? p - 1 : p) * advantage);

    const dHiddenActor = this.actorL2.backward(dLogits, this.lrActor);
    this.actorL1.backward(dHiddenActor, this.lrActor);

    // 5. Apply (push) weight adjustments to global agent networks
    this.pushLayerWeights(globalAgent.actorL1, this.actorL1, oldActorL1);
    this.pushLayerWeights(globalAgent.actorL2, this.actorL2, oldActorL2);
    this.pushLayerWeights(globalAgent.criticL1, this.criticL1, oldCriticL1);
    this.pushLayerWeights(globalAgent.criticL2, this.criticL2, oldCriticL2);

    this.state = nextState;

    if (done) {
      this.episodeCount++;
      this.episodeRewards.push(this.cumulativeReward);

      this.state = this.env.reset();
      const finalReward = this.cumulativeReward;
      this.cumulativeReward = 0;
      this.currentRound = 0;
      return finalReward;
    }

    return null;
  }

  pushLayerWeights(globalLayer, localLayer, oldWeights) {
    const localWeights = localLayer.getWeights();
    const globalWeights = globalLayer.getWeights();

    const newWeights = globalWeights.weights.map((row, i) => {
      return row.map((val, j) => {
        const delta = localWeights.weights[i][j] - oldWeights.weights[i][j];
        return val + delta;
      });
    });

    const newBiases = globalWeights.biases.map((val, j) => {
      const delta = localWeights.biases[j] - oldWeights.biases[j];
      return val + delta;
    });

    globalLayer.setWeights({ weights: newWeights, biases: newBiases });
  }
}

export class A3CAgent {
  constructor(options = {}) {
    this.stateDim = options.stateDim || 6;
    this.hiddenDim = options.hiddenDim || 16;
    this.actionDim = options.actionDim || 3;

    this.lrActor = options.lrActor || 0.01;
    this.lrCritic = options.lrCritic || 0.02;
    this.gamma = options.gamma || 0.95;

    // Global networks
    this.actorL1 = new DenseLayer(this.stateDim, this.hiddenDim, 'relu');
    this.actorL2 = new DenseLayer(this.hiddenDim, this.actionDim, 'linear');

    this.criticL1 = new DenseLayer(this.stateDim, this.hiddenDim, 'relu');
    this.criticL2 = new DenseLayer(this.hiddenDim, 1, 'linear');

    this.actionCounts = { 0: 0, 1: 0, 2: 0 };

    this.bestWeights = null;
    this.bestReward = -Infinity;

    this.episodeCount = 0;
    this.episodeRewards = [];

    // Spawns workers
    this.topology = options.topology || null;
    this.workers = [];
    if (this.topology) {
      this.initWorkers(this.topology);
    }
  }

  initWorkers(topology) {
    this.topology = topology;
    const scenarios = ['conservative', 'adaptive', 'burst', 'mixed'];
    this.workers = scenarios.map((sc, idx) => {
      return new A3CWorker(idx + 1, sc, topology, {
        lrActor: this.lrActor,
        lrCritic: this.lrCritic
      });
    });
  }

  normalizeState(state) {
    return [
      state[0],          // avgQueueUtil (0 to 1)
      state[1] / 100.0,  // avgLatency (~0 to 1+)
      state[2],          // avgPacketLoss (0 to 1)
      state[3],          // avgLinkUtil (0 to 1)
      state[4],          // jainFairness (0 to 1)
      state[5] / 100.0   // totalThroughput (scaled)
    ];
  }

  selectAction(state, evalMode = false) {
    const normState = this.normalizeState(state);
    const h = this.actorL1.forward(normState);
    const logits = this.actorL2.forward(h);
    const probs = softmax(logits);

    let action = 0;
    if (evalMode) {
      let maxP = -1;
      for (let i = 0; i < this.actionDim; i++) {
        if (probs[i] > maxP) {
          maxP = probs[i];
          action = i;
        }
      }
    } else {
      const r = Math.random();
      let cumulative = 0;
      action = 2;
      for (let i = 0; i < this.actionDim; i++) {
        cumulative += probs[i];
        if (r <= cumulative) {
          action = i;
          break;
        }
      }
    }

    this.actionCounts[action]++;
    return { action, probs, logits };
  }

  train(state, action, reward, nextState, done) {
    // Synchronous interleaved step training across all worker environments
    let epRewardFinished = null;
    this.workers.forEach(w => {
      const res = w.stepAndTrain(this);
      if (res !== null) {
        epRewardFinished = res;
      }
    });

    if (epRewardFinished !== null) {
      this.saveCheckpoint(epRewardFinished);
    }
  }

  saveCheckpoint(episodeReward) {
    this.episodeCount++;
    this.episodeRewards.push(episodeReward);

    if (this.episodeCount % 10 === 0) {
      const last10 = this.episodeRewards.slice(-10);
      const avgReward = last10.reduce((a, b) => a + b, 0) / last10.length;
      if (avgReward > this.bestReward) {
        this.bestReward = avgReward;
        this.bestWeights = this.getWeights();
      }
    }
  }

  getWeights() {
    return {
      actorL1: this.actorL1.getWeights(),
      actorL2: this.actorL2.getWeights(),
      criticL1: this.criticL1.getWeights(),
      criticL2: this.criticL2.getWeights()
    };
  }

  loadWeights(weights) {
    if (!weights) return;
    if (weights.actorL1) this.actorL1.setWeights(weights.actorL1);
    if (weights.actorL2) this.actorL2.setWeights(weights.actorL2);
    if (weights.criticL1) this.criticL1.setWeights(weights.criticL1);
    if (weights.criticL2) this.criticL2.setWeights(weights.criticL2);
  }

  resetActionCounts() {
    this.actionCounts = { 0: 0, 1: 0, 2: 0 };
  }

  getActionPercentages() {
    const total = Object.values(this.actionCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return { 0: 33.33, 1: 33.33, 2: 33.33 };
    return {
      0: parseFloat(((this.actionCounts[0] / total) * 100).toFixed(2)),
      1: parseFloat(((this.actionCounts[1] / total) * 100).toFixed(2)),
      2: parseFloat(((this.actionCounts[2] / total) * 100).toFixed(2))
    };
  }
}

export default A3CAgent;
