import { ConversionError } from "@core/errors";
import { logger } from "@utils/logger";
import type { ConvertOptions, ConvertResult } from "./workerClient";
import { ConverterWorker } from "./workerClient";

interface PooledWorker {
  worker: ConverterWorker;
  busy: boolean;
  taskCount: number;
}

interface QueuedTask {
  options: ConvertOptions;
  resolve: (result: ConvertResult) => void;
  reject: (error: Error) => void;
  cleanup?: () => void;
}

export class WorkerPool {
  private workers: PooledWorker[] = [];
  private queue: QueuedTask[] = [];
  private readonly maxWorkers: number;
  private readonly maxTasksPerWorker: number;

  constructor(
    maxWorkers: number = Math.max(2, (navigator.hardwareConcurrency || 4) - 2),
    maxTasksPerWorker: number = 100,
  ) {
    this.maxWorkers = maxWorkers;
    this.maxTasksPerWorker = maxTasksPerWorker;

    logger.info("Worker pool initialized", {
      maxWorkers: this.maxWorkers,
      maxTasksPerWorker: this.maxTasksPerWorker,
      hardwareConcurrency: navigator.hardwareConcurrency,
      utilizationStrategy: "dynamic-scaling",
    });
  }

  private createWorker(): PooledWorker {
    const worker = new ConverterWorker();
    const pooledWorker: PooledWorker = {
      worker,
      busy: false,
      taskCount: 0,
    };

    logger.debug("Created new worker", {
      totalWorkers: this.workers.length + 1,
      maxWorkers: this.maxWorkers,
    });

    return pooledWorker;
  }

  private getAvailableWorker(): PooledWorker | null {
    for (const pooledWorker of this.workers) {
      if (!pooledWorker.busy) {
        return pooledWorker;
      }
    }

    if (this.workers.length < this.maxWorkers) {
      const newWorker = this.createWorker();
      this.workers.push(newWorker);
      return newWorker;
    }

    return null;
  }

  private recycleWorkerIfNeeded(pooledWorker: PooledWorker): void {
    if (pooledWorker.taskCount >= this.maxTasksPerWorker) {
      logger.debug("Recycling worker after max tasks", {
        taskCount: pooledWorker.taskCount,
        maxTasksPerWorker: this.maxTasksPerWorker,
      });

      pooledWorker.worker.terminate();
      const index = this.workers.indexOf(pooledWorker);
      /* v8 ignore next 3 */
      if (index !== -1) {
        this.workers.splice(index, 1);
      }

      if (this.workers.length < this.maxWorkers) {
        const newWorker = this.createWorker();
        this.workers.push(newWorker);
      }
    }
  }

  private processQueue(): void {
    while (this.queue.length > 0) {
      const availableWorker = this.getAvailableWorker();
      if (!availableWorker) break;

      const task = this.queue.shift();
      if (!task) break;

      this.executeTask(availableWorker, task);
    }
  }

  private async executeTask(
    pooledWorker: PooledWorker,
    task: QueuedTask,
  ): Promise<void> {
    task.cleanup?.();
    pooledWorker.busy = true;
    pooledWorker.taskCount++;

    try {
      const result = await pooledWorker.worker.convert(task.options);
      task.resolve(result);
    } catch (error) {
      task.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      pooledWorker.busy = false;
      this.recycleWorkerIfNeeded(pooledWorker);
      this.processQueue();
    }
  }

  async convert(options: ConvertOptions): Promise<ConvertResult> {
    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(new ConversionError("Cancelled"));
        return;
      }

      const availableWorker = this.getAvailableWorker();
      const task: QueuedTask = { options, resolve, reject };

      if (availableWorker) {
        this.executeTask(availableWorker, task);
      } else {
        if (options.signal) {
          const abortHandler = () => {
            const index = this.queue.indexOf(task);
            /* v8 ignore next */
            if (index === -1) return;
            this.queue.splice(index, 1);
            task.cleanup?.();
            reject(new ConversionError("Cancelled"));
          };
          task.cleanup = () =>
            options.signal?.removeEventListener("abort", abortHandler);
          options.signal.addEventListener("abort", abortHandler, {
            once: true,
          });
        }
        this.queue.push(task);
        logger.debug("Task queued", {
          queueLength: this.queue.length,
          busyWorkers: this.workers.filter((w) => w.busy).length,
          totalWorkers: this.workers.length,
        });
      }
    });
  }

  getStats(): {
    totalWorkers: number;
    busyWorkers: number;
    queueLength: number;
    maxWorkers: number;
  } {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      queueLength: this.queue.length,
      maxWorkers: this.maxWorkers,
    };
  }

  terminate(): void {
    logger.info("Terminating worker pool", {
      totalWorkers: this.workers.length,
      queuedTasks: this.queue.length,
    });

    for (const pooledWorker of this.workers) {
      pooledWorker.worker.terminate();
    }

    this.workers = [];

    for (const task of this.queue) {
      task.cleanup?.();
      task.reject(new Error("Worker pool terminated"));
    }

    this.queue = [];
  }
}
