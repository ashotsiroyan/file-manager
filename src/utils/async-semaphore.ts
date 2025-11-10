/**
 * Minimal async semaphore used to cap simultaneous storage operations.
 */
export class AsyncSemaphore {
  private readonly max: number;
  private available: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    if (!Number.isFinite(max) || max < 1) {
      throw new Error('AsyncSemaphore max must be a positive number.');
    }
    this.max = Math.floor(max);
    this.available = this.max;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(() => resolve());
    });
  }

  private release() {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    if (this.available < this.max) {
      this.available += 1;
    }
  }
}
