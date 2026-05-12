import { DEFAULT_SETTINGS } from "@core/constants";
import { WorkerPool } from "@data/workerPool";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("WorkerPool", () => {
  let workerMocks: Array<{
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  }>;
  const originalWorker = globalThis.Worker;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    workerMocks = [];

    class MockWorker {
      constructor() {
        const mock = {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          postMessage: vi.fn(),
          terminate: vi.fn(),
        };
        workerMocks.push(mock);
        return mock;
      }
    }

    globalThis.Worker = MockWorker as unknown as typeof Worker;

    Object.defineProperty(globalThis, "navigator", {
      value: { hardwareConcurrency: 4 },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("creates workers up to maxWorkers limit", async () => {
    const pool = new WorkerPool(2);

    const promises = [
      pool.convert({
        bytes: new ArrayBuffer(8),
        mimeType: "image/jpeg",
        settings: DEFAULT_SETTINGS,
        originalName: "test1.jpg",
      }),
      pool.convert({
        bytes: new ArrayBuffer(8),
        mimeType: "image/jpeg",
        settings: DEFAULT_SETTINGS,
        originalName: "test2.jpg",
      }),
    ];

    expect(workerMocks.length).toBe(2);

    for (const mock of workerMocks) {
      const reqId = mock.postMessage.mock.calls[0][0].id;
      const messageHandler = mock.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as ((event: MessageEvent) => void) | undefined;

      messageHandler?.({
        data: {
          id: reqId,
          kind: "done",
          blob: new Blob(["out"]),
          width: 100,
          height: 100,
          outputFormat: "webp",
          durationMs: 50,
        },
      } as MessageEvent);
    }

    await Promise.all(promises);
    pool.terminate();
  });

  it("queues tasks when all workers are busy", async () => {
    const pool = new WorkerPool(1);

    const promise1 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test1.jpg",
    });

    const promise2 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test2.jpg",
    });

    expect(workerMocks.length).toBe(1);

    const stats = pool.getStats();
    expect(stats.totalWorkers).toBe(1);
    expect(stats.busyWorkers).toBe(1);
    expect(stats.queueLength).toBe(1);

    const mock = workerMocks[0];
    const reqId1 = mock.postMessage.mock.calls[0][0].id;
    const messageHandler = mock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: {
        id: reqId1,
        kind: "done",
        blob: new Blob(["out"]),
        width: 100,
        height: 100,
        outputFormat: "webp",
        durationMs: 50,
      },
    } as MessageEvent);

    await promise1;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const reqId2 = mock.postMessage.mock.calls[1][0].id;
    messageHandler?.({
      data: {
        id: reqId2,
        kind: "done",
        blob: new Blob(["out"]),
        width: 100,
        height: 100,
        outputFormat: "webp",
        durationMs: 50,
      },
    } as MessageEvent);

    await promise2;
    pool.terminate();
  });

  it("returns pool statistics", async () => {
    const pool = new WorkerPool(4);

    const promise = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const stats = pool.getStats();
    expect(stats.maxWorkers).toBe(4);
    expect(stats.totalWorkers).toBe(1);
    expect(stats.busyWorkers).toBe(1);
    expect(stats.queueLength).toBe(0);

    pool.terminate();

    await expect(promise).rejects.toThrow("Worker terminated");
  });

  it("terminates all workers and rejects queued tasks", async () => {
    const pool = new WorkerPool(1);

    const promise1 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test1.jpg",
    });

    const promise2 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test2.jpg",
    });

    pool.terminate();

    await expect(promise2).rejects.toThrow("Worker pool terminated");
    await expect(promise1).rejects.toThrow("Worker terminated");
    expect(workerMocks[0].terminate).toHaveBeenCalled();
  });

  it("removes queued tasks when their signal is aborted", async () => {
    const pool = new WorkerPool(1);
    const controller = new AbortController();

    const promise1 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test1.jpg",
    });

    const promise2 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test2.jpg",
      signal: controller.signal,
    });

    expect(pool.getStats().queueLength).toBe(1);

    controller.abort();

    await expect(promise2).rejects.toThrow("Cancelled");
    expect(pool.getStats().queueLength).toBe(0);

    const mock = workerMocks[0];
    const reqId = mock.postMessage.mock.calls[0][0].id;
    const messageHandler = mock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: {
        id: reqId,
        kind: "done",
        blob: new Blob(["out"]),
        width: 100,
        height: 100,
        outputFormat: "webp",
        durationMs: 50,
      },
    } as MessageEvent);

    await promise1;
    pool.terminate();
  });

  it("respects hardware concurrency limits", () => {
    const pool = new WorkerPool();
    const stats = pool.getStats();
    expect(stats.maxWorkers).toBeLessThanOrEqual(8);
    expect(stats.maxWorkers).toBeGreaterThanOrEqual(1);
    pool.terminate();
  });

  it("rejects immediately when convert() called with a pre-aborted signal (lines 127-128)", async () => {
    const pool = new WorkerPool(2);
    const controller = new AbortController();
    controller.abort();

    const promise = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
      signal: controller.signal,
    });

    await expect(promise).rejects.toThrow("Cancelled");
    pool.terminate();
  });

  it("recycles a worker after maxTasksPerWorker tasks (lines 74-87)", async () => {
    const pool = new WorkerPool(1, 1);

    const resolveTask = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const mock = workerMocks[workerMocks.length - 1];
      const reqId =
        mock.postMessage.mock.calls[mock.postMessage.mock.calls.length - 1][0]
          .id;
      const messageHandler = mock.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as ((event: MessageEvent) => void) | undefined;
      messageHandler?.({
        data: {
          id: reqId,
          kind: "done",
          blob: new Blob(["out"]),
          width: 100,
          height: 100,
          outputFormat: "webp",
          durationMs: 10,
        },
      } as MessageEvent);
    };

    const p1 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "task1.jpg",
    });
    await resolveTask();
    await p1;

    expect(workerMocks[0].terminate).toHaveBeenCalled();
    expect(workerMocks.length).toBeGreaterThanOrEqual(2);

    pool.terminate();
  });

  it("processes queued tasks after recycling creates a new worker (lines 86-117)", async () => {
    const pool = new WorkerPool(1, 1);

    const resolveTask = (mockIndex: number) => {
      const mock = workerMocks[mockIndex];
      const reqId = mock.postMessage.mock.calls[0][0].id;
      const messageHandler = mock.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as ((event: MessageEvent) => void) | undefined;
      messageHandler?.({
        data: {
          id: reqId,
          kind: "done",
          blob: new Blob(["out"]),
          width: 100,
          height: 100,
          outputFormat: "webp",
          durationMs: 10,
        },
      } as MessageEvent);
    };

    const p1 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "task1.jpg",
    });

    const p2 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "task2.jpg",
    });

    expect(pool.getStats().queueLength).toBe(1);

    resolveTask(0);
    await p1;

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(workerMocks.length).toBeGreaterThanOrEqual(2);

    resolveTask(workerMocks.length - 1);
    await p2;

    pool.terminate();
  });

  it("handles undefined navigator.hardwareConcurrency (line 26)", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      value: { hardwareConcurrency: undefined },
      configurable: true,
      writable: true,
    });

    try {
      const pool = new WorkerPool();
      const stats = pool.getStats();
      expect(stats.maxWorkers).toBe(2);
      pool.terminate();
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "navigator", original);
      }
    }
  });

  it("handles worker rejection inside executeTask (line 116)", async () => {
    const pool = new WorkerPool(1);

    const resolveTask = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const mock = workerMocks[0];
      const reqId = mock.postMessage.mock.calls[0][0].id;
      const messageHandler = mock.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as ((event: MessageEvent) => void) | undefined;

      messageHandler?.({
        data: {
          id: reqId,
          kind: "error",
          message: "worker crashed",
        },
      } as MessageEvent);
    };

    const p1 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "task1.jpg",
    });

    await resolveTask();
    await expect(p1).rejects.toThrow("worker crashed");

    pool.terminate();
  });

  it("abortHandler returns early if task is not in queue (line 140)", async () => {
    const pool = new WorkerPool(1);
    const controller = new AbortController();

    const p1 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "task1.jpg",
    });

    const p2 = pool.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "task2.jpg",
      signal: controller.signal,
    });

    // p2 is currently in queue.
    expect(pool.getStats().queueLength).toBe(1);

    // Resolve p1 so p2 moves from queue to execution
    await new Promise((resolve) => setTimeout(resolve, 0));
    const mock = workerMocks[0];
    const reqId1 = mock.postMessage.mock.calls[0][0].id;
    const messageHandler = mock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: {
        id: reqId1,
        kind: "done",
        blob: new Blob(["out"]),
        width: 100,
        height: 100,
        outputFormat: "webp",
        durationMs: 50,
      },
    } as MessageEvent);

    await p1;

    expect(() => controller.abort()).not.toThrow();
    await expect(p2).rejects.toThrow("Cancelled");

    pool.terminate();
  });
});
