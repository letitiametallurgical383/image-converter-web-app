import { ConversionError } from "@core/errors";
import type {
  ConverterSettings,
  OutputFormat,
  WorkerRequest,
  WorkerResponse,
} from "@core/types";
import { generateId } from "@utils/id";
import { logger } from "@utils/logger";

function isValidWorkerResponse(data: unknown): data is WorkerResponse {
  if (!data || typeof data !== "object") return false;
  const response = data as Record<string, unknown>;

  if (typeof response.id !== "string") return false;
  if (typeof response.kind !== "string") return false;

  if (response.kind === "progress") {
    return (
      typeof response.progress === "number" &&
      response.progress >= 0 &&
      response.progress <= 1
    );
  }

  if (response.kind === "done") {
    return (
      response.blob instanceof Blob &&
      typeof response.width === "number" &&
      typeof response.height === "number" &&
      typeof response.durationMs === "number" &&
      typeof response.outputFormat === "string"
    );
  }

  if (response.kind === "error") {
    return typeof response.message === "string";
  }

  return false;
}

export interface ConvertResult {
  blob: Blob;
  width: number;
  height: number;
  outputFormat: OutputFormat;
  durationMs: number;
}

export interface ConvertOptions {
  bytes: ArrayBuffer;
  mimeType: string;
  settings: ConverterSettings;
  originalName: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export class ConverterWorker {
  private worker: Worker;
  private pending = new Map<
    string,
    {
      resolve: (value: ConvertResult) => void;
      reject: (err: Error) => void;
      onProgress?: (progress: number) => void;
      cleanup?: () => void;
    }
  >();

  constructor() {
    this.worker = this.createWorker();
  }

  private createWorker(): Worker {
    const worker = new Worker(
      new URL("../workers/converter.worker.ts", import.meta.url),
      { type: "module", name: "image-converter" },
    );
    worker.addEventListener("message", this.handleMessage);
    worker.addEventListener("error", this.handleError);
    return worker;
  }

  private disposeWorker(): void {
    this.worker.removeEventListener("message", this.handleMessage);
    this.worker.removeEventListener("error", this.handleError);
    this.worker.terminate();
  }

  private rejectPending(message: string): void {
    for (const entry of this.pending.values()) {
      entry.cleanup?.();
      entry.reject(new ConversionError(message));
    }
    this.pending.clear();
  }

  private restartWorker(reason: string): void {
    this.disposeWorker();
    this.rejectPending(reason);
    this.worker = this.createWorker();
  }

  public convert(options: ConvertOptions): Promise<ConvertResult> {
    const id = generateId();
    return new Promise<ConvertResult>((resolve, reject) => {
      let posted = false;
      const abortHandler = () => {
        const entry = this.pending.get(id);
        /* v8 ignore next */
        if (!entry) return;
        entry.cleanup?.();
        this.pending.delete(id);
        entry.reject(new ConversionError("Cancelled"));
        if (posted) {
          this.restartWorker("Worker restarted after cancellation");
        }
      };
      const cleanup = options.signal
        ? () => options.signal?.removeEventListener("abort", abortHandler)
        : undefined;

      this.pending.set(id, {
        resolve,
        reject,
        onProgress: options.onProgress,
        cleanup,
      });

      if (options.signal) {
        if (options.signal.aborted) {
          abortHandler();
          return;
        }
        options.signal.addEventListener("abort", abortHandler, { once: true });
      }
      const request: WorkerRequest = {
        id,
        kind: "convert",
        bytes: options.bytes,
        mimeType: options.mimeType,
        settings: options.settings,
        originalName: options.originalName,
      };

      try {
        this.worker.postMessage(request, [options.bytes]);
        posted = true;
      } catch (error) {
        cleanup?.();
        this.pending.delete(id);
        reject(
          error instanceof Error ? error : new ConversionError(String(error)),
        );
      }
    });
  }

  public terminate(): void {
    this.disposeWorker();
    this.rejectPending("Worker terminated");
  }

  private handleMessage = (event: MessageEvent<WorkerResponse>): void => {
    const data = event.data;

    if (!isValidWorkerResponse(data)) {
      logger.error("Invalid worker response received", { data });
      this.rejectPending("Invalid worker response format");
      return;
    }

    const entry = this.pending.get(data.id);
    if (!entry) return;
    if (data.kind === "progress") {
      entry.onProgress?.(data.progress);
      return;
    }
    entry.cleanup?.();
    this.pending.delete(data.id);
    if (data.kind === "done") {
      entry.resolve({
        blob: data.blob,
        width: data.width,
        height: data.height,
        outputFormat: data.outputFormat,
        durationMs: data.durationMs,
      });
    } else {
      entry.reject(new ConversionError(data.message));
    }
  };

  private handleError = (event: ErrorEvent): void => {
    this.rejectPending(event.message || "Worker error");
  };
}
