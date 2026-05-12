export interface Task<T> {
  run: () => Promise<T>;
}

export class ConcurrencyQueue {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (limit < 1) throw new Error("Concurrency limit must be >= 1");
  }

  public enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const attempt = (): void => {
        this.active += 1;
        task
          .run()
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            const next = this.queue.shift();
            if (next) next();
          });
      };
      if (this.active < this.limit) {
        attempt();
      } else {
        this.queue.push(attempt);
      }
    });
  }

  public get inFlight(): number {
    return this.active;
  }

  public get pending(): number {
    return this.queue.length;
  }
}
