import { DenseLayer, softmax } from './neural.js';

export class A2CAgent {
  constructor(options = {}) {
    this.stateDim = options.stateDim || 6;
    this.hiddenDim = options.hiddenDim || 16;
    this.actionDim = options.actionDim || 3;
    
    this.lrActor = options.lrActor || 0.01;
    this.lrCritic = options.lrCritic || 0.02;
    this.gamma = options.gamma || 0.95;

    // Actor Layers
    this.actorL1 = new DenseLayer(this.stateDim, this.hiddenDim, 'relu');
    this.actorL2 = new DenseLayer(this.hiddenDim, this.actionDim, 'linear');

    // Critic Layers
    this.criticL1 = new DenseLayer(this.stateDim, this.hiddenDim, 'relu');
    this.criticL2 = new DenseLayer(this.hiddenDim, 1, 'linear');

    // Action Exploration metrics
    this.actionCounts = { 0: 0, 1: 0, 2: 0 };
    
    // Checkpoint weights
    this.bestWeights = null;
    this.bestReward = -Infinity;
    
    // Track stats
    this.episodeCount = 0;
    this.episodeRewards = [];
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
  
  selectAction(state) {
    const normState = this.normalizeState(state);
    
    // Forward pass through Actor
    const h = this.actorL1.forward(normState);
    const logits = this.actorL2.forward(h);
    const probs = softmax(logits);
    
    // Sample action according to probabilities
    const r = Math.random();
    let cumulative = 0;
    let action = 2; // default to aggressive if numerical issues
    for (let i = 0; i < this.actionDim; i++) {
      cumulative += probs[i];
      if (r <= cumulative) {
        action = i;
        break;
      }
    }
    
    this.actionCounts[action]++;
    return { action, probs, logits };
  }
  
  train(state, action, reward, nextState, done) {
    const normState = this.normalizeState(state);
    const normNextState = this.normalizeState(nextState);
    
    // 1. Critic Forward pass for NEXT state first to avoid overwriting cache for current state
    let V_s_prime = 0;
    if (!done) {
      const hc_prime = this.criticL1.forward(normNextState);
      V_s_prime = this.criticL2.forward(hc_prime)[0];
    }
    
    // 2. Critic Forward pass for CURRENT state (leaves current state activations in cache)
    const hc = this.criticL1.forward(normState);
    const V_s = this.criticL2.forward(hc)[0];
    
    // 3. TD Target and Advantage
    const target = reward + this.gamma * V_s_prime;
    const advantage = target - V_s;
    
    // 4. Critic Backward pass (uses cache set to current state)
    // Loss = 0.5 * (V_s - target)^2 => dLoss/dV_s = V_s - target = -advantage
    const dValue = [-advantage];
    const dHiddenCritic = this.criticL2.backward(dValue, this.lrCritic);
    this.criticL1.backward(dHiddenCritic, this.lrCritic);
    
    // 5. Actor Backward pass
    // Forward actor again to ensure caches are fresh/correct
    const ha = this.actorL1.forward(normState);
    const logits = this.actorL2.forward(ha);
    const probs = softmax(logits);
    
    // Policy gradient loss derivative w.r.t logits: (P_i - delta_ia) * advantage
    const dLogits = probs.map((p, i) => (i === action ? p - 1 : p) * advantage);
    
    const dHiddenActor = this.actorL2.backward(dLogits, this.lrActor);
    this.actorL1.backward(dHiddenActor, this.lrActor);
    
    return { advantage, V_s };
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

export default A2CAgent;
