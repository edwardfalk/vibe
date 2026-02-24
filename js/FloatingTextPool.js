export class FloatingTextPool {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.pool = [];
    this.stats = {
      acquired: 0,
      released: 0,
      created: 0,
      reused: 0,
      inUse: 0,
      peakInUse: 0,
      peakPoolSize: 0,
    };
  }

  acquire(initialState) {
    this.stats.acquired++;
    const text = this.pool.pop() || {};
    if (Object.keys(text).length === 0) {
      this.stats.created++;
    } else {
      this.stats.reused++;
    }
    for (const key in text) {
      delete text[key];
    }
    Object.assign(text, initialState);
    this.stats.inUse++;
    this.stats.peakInUse = Math.max(this.stats.peakInUse, this.stats.inUse);
    return text;
  }

  release(text) {
    if (!text || this.pool.length >= this.maxSize) return;
    this.pool.push(text);
    this.stats.released++;
    this.stats.inUse = Math.max(0, this.stats.inUse - 1);
    this.stats.peakPoolSize = Math.max(this.stats.peakPoolSize, this.pool.length);
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      maxPoolSize: this.maxSize,
    };
  }
}
