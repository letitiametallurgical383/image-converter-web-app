import { DEFAULT_SETTINGS } from "@core/constants";
import { ConversionError } from "@core/errors";
import { ConverterWorker } from "@data/workerClient";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ConverterWorker", () => {
  let workerMock: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  };
  const originalWorker = globalThis.Worker;

  beforeEach(() => {
    workerMock = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };

    class MockWorker {
      constructor() {
        return workerMock;
      }
    }

    globalThis.Worker = MockWorker as unknown as typeof Worker;
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  it("instantiates a worker and attaches listeners", () => {
    const client = new ConverterWorker();
    expect(client).toBeDefined();
    expect(workerMock.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    expect(workerMock.addEventListener).toHaveBeenCalledWith(
      "error",
      expect.any(Function),
    );
  });

  it("posts a message to the worker when converting", () => {
    const client = new ConverterWorker();
    const bytes = new ArrayBuffer(8);
    const promise = client.convert({
      bytes,
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });
    expect(promise).toBeDefined();

    expect(workerMock.postMessage).toHaveBeenCalled();
    const req = workerMock.postMessage.mock.calls[0][0];
    expect(req.kind).toBe("convert");
    expect(req.mimeType).toBe("image/jpeg");
    expect(req.bytes).toBe(bytes);
  });

  it("resolves the promise when worker sends done message", async () => {
    const client = new ConverterWorker();
    const bytes = new ArrayBuffer(8);

    const promise = client.convert({
      bytes,
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const reqId = workerMock.postMessage.mock.calls[0][0].id;
    const messageHandler = workerMock.addEventListener.mock.calls.find(
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

    const result = await promise;
    expect(result.outputFormat).toBe("webp");
    expect(result.durationMs).toBe(50);
  });

  it("rejects the promise when worker sends error message", async () => {
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const reqId = workerMock.postMessage.mock.calls[0][0].id;
    const messageHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: {
        id: reqId,
        kind: "error",
        message: "Failed to process",
      },
    } as MessageEvent);

    await expect(promise).rejects.toThrow(ConversionError);
    await expect(promise).rejects.toThrow("Failed to process");
  });

  it("rejects all pending promises on worker error event", async () => {
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const errorHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "error",
    )?.[1] as ((event: ErrorEvent) => void) | undefined;
    errorHandler?.(new ErrorEvent("error", { message: "fatal" }));

    await expect(promise).rejects.toThrow("fatal");
  });

  it("rejects all pending promises on terminate", async () => {
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    client.terminate();
    expect(workerMock.terminate).toHaveBeenCalled();
    await expect(promise).rejects.toThrow("Worker terminated");
  });

  it("calls onProgress when progress message received", () => {
    const client = new ConverterWorker();
    const progressSpy = vi.fn();

    client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
      onProgress: progressSpy,
    });

    const reqId = workerMock.postMessage.mock.calls[0][0].id;
    const messageHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: {
        id: reqId,
        kind: "progress",
        progress: 0.5,
      },
    } as MessageEvent);

    expect(progressSpy).toHaveBeenCalledWith(0.5);
  });

  it("cancels task if AbortSignal is aborted", async () => {
    const client = new ConverterWorker();
    const controller = new AbortController();

    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
      signal: controller.signal,
    });

    controller.abort();
    await expect(promise).rejects.toThrow("Cancelled");
    expect(workerMock.terminate).toHaveBeenCalled();
  });

  it("cancels task immediately if AbortSignal is already aborted", async () => {
    const client = new ConverterWorker();
    const controller = new AbortController();
    controller.abort();

    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
      signal: controller.signal,
    });

    await expect(promise).rejects.toThrow("Cancelled");
  });

  it("rejects immediately when postMessage throws synchronously (lines 151-153)", async () => {
    workerMock.postMessage.mockImplementation(() => {
      throw new Error("DataCloneError");
    });
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });
    await expect(promise).rejects.toThrow("DataCloneError");
  });

  it("rejects immediately with string when postMessage throws non-Error (line 154)", async () => {
    workerMock.postMessage.mockImplementationOnce(() => {
      throw "StringError";
    });
    const client = new ConverterWorker();
    await expect(
      client.convert({
        bytes: new ArrayBuffer(8),
        mimeType: "image/jpeg",
        settings: DEFAULT_SETTINGS,
        originalName: "test.jpg",
      }),
    ).rejects.toThrow("StringError");
  });

  it("isValidWorkerResponse returns false for missing kind (line 16)", async () => {
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const reqId = workerMock.postMessage.mock.calls[0][0].id;
    const messageHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: { id: reqId },
    } as MessageEvent);

    await expect(promise).rejects.toThrow("Invalid worker response format");
  });

  it("isValidWorkerResponse returns false for missing id (line 15)", async () => {
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const messageHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: { kind: "progress" }, // no ID
    } as MessageEvent);

    await expect(promise).rejects.toThrow("Invalid worker response format");
  });

  it("ignores message if pending entry is not found (line 175)", async () => {
    new ConverterWorker();
    const messageHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    expect(() => {
      messageHandler?.({
        data: {
          id: "non-existent-id",
          kind: "error",
          message: "test",
        },
      } as MessageEvent);
    }).not.toThrow();
  });

  it("ignores abort event if pending entry is not found (line 112)", async () => {
    const client = new ConverterWorker();
    const controller = new AbortController();

    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
      signal: controller.signal,
    });

    const reqId = workerMock.postMessage.mock.calls[0][0].id;
    const messageHandler = workerMock.addEventListener.mock.calls.find(
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

    await promise;
    expect(() => controller.abort()).not.toThrow();
  });

  it("handleError falls back to default message if event.message is empty (line 196)", async () => {
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const errorHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "error",
    )?.[1] as ((event: ErrorEvent) => void) | undefined;

    errorHandler?.({ message: "" } as ErrorEvent);

    await expect(promise).rejects.toThrow("Worker error");
  });

  it("rejects pending tasks when receiving an invalid worker response (lines 169-171)", async () => {
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const messageHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: { id: "req-123", kind: "unknown-kind" },
    } as MessageEvent);

    await expect(promise).rejects.toThrow("Invalid worker response format");
  });

  it("isValidWorkerResponse returns false for unknown kind (line 40)", async () => {
    const client = new ConverterWorker();
    const promise = client.convert({
      bytes: new ArrayBuffer(8),
      mimeType: "image/jpeg",
      settings: DEFAULT_SETTINGS,
      originalName: "test.jpg",
    });

    const messageHandler = workerMock.addEventListener.mock.calls.find(
      (call) => call[0] === "message",
    )?.[1] as ((event: MessageEvent) => void) | undefined;

    messageHandler?.({
      data: null,
    } as MessageEvent);

    await expect(promise).rejects.toThrow("Invalid worker response format");
  });
});
