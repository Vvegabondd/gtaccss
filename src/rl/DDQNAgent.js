import { DenseLayer } from './neural.js';
import { ReplayBuffer } from './ReplayBuffer.js';

export class DDQNAgent {
  constructor(options = {}) {
    this.stateDim = options.stateDim || 6;
    this.hiddenDim = options.hiddenDim || 16;
    this.actionDim = options.actionDim || 3;

    this.lr = options.lr || 0.01;
    this.gamma = options.gamma || 0.95;
    this.epsilon = options.epsilon !== undefined ? options.epsilon : 1.0;
    this.minEpsilon = options.minEpsilon || 0.05;
    this.epsilonDecay = options.epsilonDecay || 0.98; // per-episode decay

    this.batchSize = options.batchSize || 16;
    this.targetSyncInterval = options.targetSyncInterval || 100; // training steps

    // Online Network
    this.onlineL1 = new DenseLayer(this.stateDim, this.hiddenDim, 'relu');
    this.onlineL2 = new DenseLayer(this.hiddenDim, this.actionDim, 'linear');

    // Target Network
    this.targetL1 = new DenseLayer(this.stateDim, this.hiddenDim, 'relu');
    this.targetL2 = new DenseLayer(this.hiddenDim, this.actionDim, 'linear');

    this.replayBuffer = new ReplayBuffer(options.bufferSize || 2000);
    this.stepCounter = 0;

    this.actionCounts = { 0: 0, 1: 0, 2: 0 };

    this.bestWeights = null;
    this.bestReward = -Infinity;

    this.episodeCount = 0;
    this.episodeRewards = [];

    // Sync initially
    this.syncTargetWeights();
  }

  syncTargetWeights() {
    this.targetL1.setWeights(this.onlineL1.getWeights());
    this.targetL2.setWeights(this.onlineL2.getWeights());
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
    // Epsilon-greedy action selection
    if (!evalMode && Math.random() < this.epsilon) {
      const action = Math.floor(Math.random() * this.actionDim);
      this.actionCounts[action]++;
      return { action, isRandom: true };
    }

    const normState = this.normalizeState(state);
    const h = this.onlineL1.forward(normState);
    const qValues = this.onlineL2.forward(h);

    let action = 0;
    let maxQ = qValues[0];
    for (let i = 1; i < this.actionDim; i++) {
      if (qValues[i] > maxQ) {
        maxQ = qValues[i];
        action = i;
      }
    }

    this.actionCounts[action]++;
    return { action, qValues, isRandom: false };
  }

  train(state, action, reward, nextState, done) {
    // Store in experience replay buffer
    this.replayBuffer.add({ state, action, reward, nextState, done });

    // Train only if buffer has enough samples
    if (this.replayBuffer.size() < this.batchSize) {
      return null;
    }

    // Sample mini-batch
    const batch = this.replayBuffer.sample(this.batchSize);

    // Process batch elements
    for (const transition of batch) {
      const normState = this.normalizeState(transition.state);
      const normNextState = this.normalizeState(transition.nextState);

      // Compute target Q value using Double Q learning update rule:
      // 1. Select optimal action from ONLINE network at next state:
      let bestNextAction = 0;
      let maxNextQ = -Infinity;

      const hNextOnline = this.onlineL1.forward(normNextState);
      const qValuesNextOnline = this.onlineL2.forward(hNextOnline);
      for (let i = 0; i < this.actionDim; i++) {
        if (qValuesNextOnline[i] > maxNextQ) {
          maxNextQ = qValuesNextOnline[i];
          bestNextAction = i;
        }
      }

      // 2. Evaluate Q-value of that selected action from TARGET network:
      let targetQ = transition.reward;
      if (!transition.done) {
        const hNextTarget = this.targetL1.forward(normNextState);
        const qValuesNextTarget = this.targetL2.forward(hNextTarget);
        targetQ = transition.reward + this.gamma * qValuesNextTarget[bestNextAction];
      }

      // 3. Forward pass online network for current state to establish activation caches:
      const hCurr = this.onlineL1.forward(normState);
      const qValuesCurr = this.onlineL2.forward(hCurr);

      // 4. Backpropagate MSE gradient: Loss = 0.5 * (Q(s,a) - target)^2 => dLoss/dQ = Q(s,a) - target
      const dOutputs = [0, 0, 0];
      dOutputs[transition.action] = qValuesCurr[transition.action] - targetQ;

      // Online network backward pass
      const dHidden = this.onlineL2.backward(dOutputs, this.lr);
      this.onlineL1.backward(dHidden, this.lr);
    }

    // Step counter and target synchronization
    this.stepCounter++;
    if (this.stepCounter % this.targetSyncInterval === 0) {
      this.syncTargetWeights();
    }
  }

  saveCheckpoint(episodeReward) {
    this.episodeCount++;
    this.episodeRewards.push(episodeReward);

    // Decay epsilon per episode
    this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);

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
      onlineL1: this.onlineL1.getWeights(),
      onlineL2: this.onlineL2.getWeights(),
      targetL1: this.targetL1.getWeights(),
      targetL2: this.targetL2.getWeights(),
      epsilon: this.epsilon,
      stepCounter: this.stepCounter
    };
  }

  loadWeights(weights) {
    if (!weights) return;
    if (weights.onlineL1) this.onlineL1.setWeights(weights.onlineL1);
    if (weights.onlineL2) this.onlineL2.setWeights(weights.onlineL2);
    if (weights.targetL1) this.targetL1.setWeights(weights.targetL1);
    if (weights.targetL2) this.targetL2.setWeights(weights.targetL2);
    if (weights.epsilon !== undefined) this.epsilon = weights.epsilon;
    if (weights.stepCounter !== undefined) this.stepCounter = weights.stepCounter;
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

export default DDQNAgent;
