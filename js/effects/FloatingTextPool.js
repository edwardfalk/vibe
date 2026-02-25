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
    const text = this.pool.pop();
    if (text === undefined) {
      this.stats.created++;
      const newText = {};
      for (const key in newText) delete newText[key];
      Object.assign(newText, initialState);
      this.stats.inUse++;
      this.stats.peakInUse = Math.max(this.stats.peakInUse, this.stats.inUse);
      return newText;
    }
    this.stats.reused++;
    for (const key in text) {
      delete text[key];
    }
    Object.assign(text, initialState);
    this.stats.inUse++;
    this.stats.peakInUse = Math.max(this.stats.peakInUse, this.stats.inUse);
    return text;
  }

  release(text) {
    if (!text) return;
    if (this.pool.length >= this.maxSize) {
      this.stats.released++;
      this.stats.inUse = Math.max(0, this.stats.inUse - 1);
      return;
    }
    this.pool.push(text);
    this.stats.released++;
    this.stats.inUse = Math.max(0, this.stats.inUse - 1);
    this.stats.peakPoolSize = Math.max(
      this.stats.peakPoolSize,
      this.pool.length
    );
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      maxPoolSize: this.maxSize,
    };
  }
}
