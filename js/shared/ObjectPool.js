export class ObjectPool {
  constructor(maxSize = 100) {
    this.pool = [];
    this.maxSize = maxSize;
  }

  acquire(initializer) {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
      // Clear stale properties
      for (const key in obj) delete obj[key];
    } else {
      obj = {};
    }
    if (initializer) Object.assign(obj, initializer);
    return obj;
  }

  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  get size() {
    return this.pool.length;
  }

  clear() {
    this.pool.length = 0;
  }
}
