import PQueue from 'p-queue';

export class RateLimiter {
  private barsQueue: PQueue;
  private defaultQueue: PQueue;

  constructor() {
    this.barsQueue = new PQueue({
      intervalCap: 50,
      interval: 30_000,
      strict: true,
    });
    this.defaultQueue = new PQueue({
      intervalCap: 200,
      interval: 60_000,
      strict: true,
    });
  }

  async execute<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const queue = endpoint.includes('/api/History/retrieveBars')
      ? this.barsQueue
      : this.defaultQueue;
    return queue.add(() => fn());
  }

  get pending(): { bars: number; default: number } {
    return { bars: this.barsQueue.pending, default: this.defaultQueue.pending };
  }

  get size(): { bars: number; default: number } {
    return { bars: this.barsQueue.size, default: this.defaultQueue.size };
  }
}
