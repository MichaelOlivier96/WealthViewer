class SQLiteClient {
  constructor() {
    this.worker = new Worker(new URL('./worker.js', import.meta.url), {
      type: 'module',
    });
    this.promises = new Map();
    this.messageId = 0;
    this.isReady = false;
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.worker.onmessage = (event) => {
      const { id, result, error, type } = event.data;

      if (type === 'ready') {
        this.isReady = true;
        this.resolveReady();
        return;
      }

      if (type === 'error') {
        this.rejectReady(new Error(error));
        return;
      }

      const promise = this.promises.get(id);
      if (promise) {
        if (error) {
          const err = new Error(error.message || error);
          err.details = error;
          promise.reject(err);
        } else {
          promise.resolve(result);
        }
        this.promises.delete(id);
      }
    };
  }

  async execute(sql, params = []) {
    await this.readyPromise;
    const id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.promises.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'exec', payload: { sql, params }, id });
    });
  }

  async query(sql, params = []) {
    await this.readyPromise;
    const id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.promises.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'query', payload: { sql, params }, id });
    });
  }

  async exportDb() {
    await this.readyPromise;
    const id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.promises.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'export', id });
    });
  }

  async importDb(buffer) {
    await this.readyPromise;
    const id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.promises.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'import', payload: { buffer }, id });
    });
  }
}

export const sqliteClient = new SQLiteClient();
