import { ConcurrencyQueue } from "@utils/queue";
import { describe, expect, it, vi } from "vitest";

describe("ConcurrencyQueue", () => {
  it("throws when concurrency limit is less than 1", () => {
    expect(() => new ConcurrencyQueue(0)).toThrow();
  });

  it("executes a single task immediately", async () => {
    const queue = new ConcurrencyQueue(1);
    const fn = vi.fn().mockResolvedValue("done");
    const result = await queue.enqueue({ run: fn });
    expect(result).toBe("done");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("executes tasks up to concurrency limit in parallel", async () => {
    const queue = new ConcurrencyQueue(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const makeTask = () => ({
      run: async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 10));
        concurrent--;
      },
    });

    await Promise.all([
      queue.enqueue(makeTask()),
      queue.enqueue(makeTask()),
      queue.enqueue(makeTask()),
    ]);
    expect(maxConcurrent).toBe(2);
  });

  it("never exceeds the concurrency limit", async () => {
    const queue = new ConcurrencyQueue(1);
    const order: number[] = [];

    const task = (n: number) => ({
      run: async () => {
        await new Promise((r) => setTimeout(r, 5));
        order.push(n);
      },
    });

    await Promise.all([
      queue.enqueue(task(1)),
      queue.enqueue(task(2)),
      queue.enqueue(task(3)),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("resolves all tasks even if some reject", async () => {
    const queue = new ConcurrencyQueue(2);
    const ok = { run: () => Promise.resolve("ok") };
    const fail = { run: () => Promise.reject(new Error("fail")) };

    const results = await Promise.allSettled([
      queue.enqueue(ok),
      queue.enqueue(fail),
      queue.enqueue(ok),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(1);
  });

  it("reports correct inFlight count during execution", async () => {
    const queue = new ConcurrencyQueue(3);
    let resolveTask!: () => void;

    const longTask = {
      run: () =>
        new Promise<void>((resolve) => {
          resolveTask = resolve;
        }),
    };

    const promise = queue.enqueue(longTask);
    expect(queue.inFlight).toBe(1);
    resolveTask();
    await promise;
    await Promise.resolve();
    expect(queue.inFlight).toBe(0);
  });

  it("reports correct pending count when queue is full", async () => {
    const queue = new ConcurrencyQueue(1);
    let resolveTask!: () => void;

    const holdTask = {
      run: () =>
        new Promise<void>((resolve) => {
          resolveTask = resolve;
        }),
    };

    const promise = queue.enqueue(holdTask);
    queue.enqueue({ run: () => Promise.resolve() });
    queue.enqueue({ run: () => Promise.resolve() });

    expect(queue.pending).toBe(2);
    resolveTask();
    await promise;
  });
});
