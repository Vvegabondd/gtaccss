export function randNormal(r, c, scale = 1.0) {
  const mat = [];
  for (let i = 0; i < r; i++) {
    const row = [];
    for (let j = 0; j < c; j++) {
      const u = 1 - Math.random();
      const v = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      row.push(z * scale);
    }
    mat.push(row);
  }
  return mat;
}

export function zeros(n) {
  return new Array(n).fill(0);
}

export function relu(x) {
  return Math.max(0, x);
}

export function reluDerivative(x) {
  return x > 0 ? 1 : 0;
}

export function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / (sum || 1));
}

export class DenseLayer {
  constructor(inputSize, outputSize, activation = 'relu') {
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.activation = activation;

    // He initialization
    const scale = Math.sqrt(2 / inputSize);
    this.weights = randNormal(inputSize, outputSize, scale);
    this.biases = zeros(outputSize);

    // Cache for backpropagation
    this.lastInput = null;
    this.lastPreActivation = null;
    this.lastOutput = null;
  }

  forward(input) {
    this.lastInput = input;
    const output = zeros(this.outputSize);
    
    for (let j = 0; j < this.outputSize; j++) {
      let sum = this.biases[j];
      for (let i = 0; i < this.inputSize; i++) {
        sum += input[i] * this.weights[i][j];
      }
      output[j] = sum;
    }

    this.lastPreActivation = [...output];

    if (this.activation === 'relu') {
      this.lastOutput = output.map(this.relu);
    } else if (this.activation === 'softmax') {
      this.lastOutput = softmax(output);
    } else {
      this.lastOutput = [...output]; // linear
    }

    return this.lastOutput;
  }

  relu(x) {
    return Math.max(0, x);
  }

  backward(dOutput, lr) {
    // dOutput is dLoss/dOutput of size this.outputSize
    const dPreActivation = zeros(this.outputSize);
    
    for (let j = 0; j < this.outputSize; j++) {
      if (this.activation === 'relu') {
        dPreActivation[j] = dOutput[j] * (this.lastPreActivation[j] > 0 ? 1 : 0);
      } else {
        dPreActivation[j] = dOutput[j];
      }
    }

    // Gradient w.r.t input (for backpropagating to previous layer)
    const dInput = zeros(this.inputSize);
    for (let i = 0; i < this.inputSize; i++) {
      let sum = 0;
      for (let j = 0; j < this.outputSize; j++) {
        sum += dPreActivation[j] * this.weights[i][j];
      }
      dInput[i] = sum;
    }

    // Compute gradients and update weights & biases
    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        const dW = dPreActivation[j] * this.lastInput[i];
        this.weights[i][j] -= lr * dW;
      }
    }

    for (let j = 0; j < this.outputSize; j++) {
      this.biases[j] -= lr * dPreActivation[j];
    }

    return dInput;
  }

  getWeights() {
    return {
      weights: this.weights.map(row => [...row]),
      biases: [...this.biases]
    };
  }

  setWeights(data) {
    if (data.weights) this.weights = data.weights.map(row => [...row]);
    if (data.biases) this.biases = [...data.biases];
  }
}
