export class GameContext {
  constructor(initial = {}) {
    this.state = { ...initial };
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    return value;
  }

  assign(values) {
    Object.assign(this.state, values);
  }

  toObject() {
    return { ...this.state };
  }
}
