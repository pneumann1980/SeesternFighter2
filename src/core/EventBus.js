export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this._handlers.has(event)) {
      this._handlers.set(event, this._handlers.get(event).filter(h => h !== handler));
    }
  }

  emit(event, data) {
    if (this._handlers.has(event)) {
      this._handlers.get(event).forEach(h => h(data));
    }
  }
}
