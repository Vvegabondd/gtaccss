export class ReplayBuffer {
  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
    this.buffer = [];
  }

  add(transition) {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(transition);
  }

  sample(batchSize) {
    const samples = [];
    const n = this.buffer.length;
    for (let i = 0; i < batchSize; i++) {
      const idx = Math.floor(Math.random() * n);
      samples.push(this.buffer[idx]);
    }
    return samples;
  }

  size() {
    return this.buffer.length;
  }

  clear() {
    this.buffer = [];
  }
}

export default ReplayBuffer;
