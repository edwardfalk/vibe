export class FloatingTextPool {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.pool = [];
  }

  acquire(initialState) {
    const text = this.pool.pop();
    if (text === undefined) {
      return Object.assign({}, initialState);
    }
    for (const key in text) {
      delete text[key];
    }
    Object.assign(text, initialState);
    return text;
  }

  release(text) {
    if (!text) return;
    if (this.pool.length >= this.maxSize) return;
    this.pool.push(text);
  }
}
