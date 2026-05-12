import { ConversionError, toErrorMessage } from "@core/errors";
import type {
  BatchItem,
  ConvertedArtifact,
  ConverterSettings,
} from "@core/types";
import { estimateMemoryUsage } from "@data/streamingConverter";
import type { ConvertResult } from "@data/workerClient";
import { WorkerPool } from "@data/workerPool";
import { buildOutputName, ensureUniqueName } from "@domain/naming";
import { useConverterStore } from "@presentation/store/converterStore";
import { logger } from "@utils/logger";
import { ConcurrencyQueue } from "@utils/queue";
import { useCallback, useEffect, useMemo, useRef } from "react";

export function useConverter(): {
  runBatch: () => Promise<void>;
  cancelBatch: () => void;
  artifacts: ConvertedArtifact[];
  doneItems: BatchItem[];
} {
  const poolRef = useRef<WorkerPool | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runTokenRef = useRef(0);
  const activeBatchRef = useRef<{ token: number; ids: Set<string> } | null>(
    null,
  );

  if (poolRef.current === null) {
    poolRef.current = new WorkerPool();
  }

  useEffect(() => {
    return () => {
      poolRef.current?.terminate();
      poolRef.current = null;
      abortRef.current?.abort();
    };
  }, []);

  const mode = useConverterStore((s) => s.mode);
  const simpleItems = useConverterStore((s) => s.simpleItems);
  const advancedItems = useConverterStore((s) => s.advancedItems);
  const items = mode === "simple" ? simpleItems : advancedItems;
  const setRunning = useConverterStore((s) => s.setRunning);
  const updateItem = useConverterStore((s) => s.updateItem);

  const updateActiveItem = useCallback(
    (token: number, id: string, next: Partial<BatchItem>) => {
      const active = activeBatchRef.current;
      if (!active || active.token !== token || !active.ids.has(id)) return;
      updateItem(id, next);
    },
    [updateItem],
  );

  const createArtifact = useCallback(
    (
      item: BatchItem,
      result: ConvertResult,
      taken: Set<string>,
      snapshotSettings: ConverterSettings,
    ): ConvertedArtifact => {
      const desiredName = buildOutputName(
        item.source.name,
        snapshotSettings,
        result.outputFormat,
      );
      const uniqueName = ensureUniqueName(desiredName, taken);
      return {
        blob: result.blob,
        outputName: uniqueName,
        outputFormat: result.outputFormat,
        originalBytes: item.source.sizeBytes,
        outputBytes: result.blob.size,
        width: result.width,
        height: result.height,
        durationMs: result.durationMs,
      };
    },
    [],
  );

  const runBatch = useCallback(async () => {
    const pool = poolRef.current;
    if (!pool) return;
    const state = useConverterStore.getState();
    const currentMode = state.mode;
    const currentItems =
      currentMode === "simple" ? state.simpleItems : state.advancedItems;
    const currentSettings = state.settings;
    const pending = currentItems.filter(
      (i) => i.status === "pending" || i.status === "failed",
    );
    if (pending.length === 0) return;

    const controller = new AbortController();
    const token = runTokenRef.current + 1;
    runTokenRef.current = token;
    activeBatchRef.current = {
      token,
      ids: new Set(pending.map((item) => item.source.id)),
    };
    abortRef.current = controller;
    setRunning(true);
    const queue = new ConcurrencyQueue(currentSettings.concurrency);
    const taken = new Set<string>(
      currentItems
        .filter((i) => i.artifact)
        .map((i) => i.artifact?.outputName ?? ""),
    );

    const tasks = pending.map((item) =>
      queue.enqueue({
        run: async () => {
          if (controller.signal.aborted) {
            updateActiveItem(token, item.source.id, { status: "cancelled" });
            return;
          }
          updateActiveItem(token, item.source.id, {
            status: "processing",
            progress: 0,
          });
          try {
            const memoryEstimate = await estimateMemoryUsage(item.source.file);
            if (memoryEstimate.recommendation === "reject") {
              logger.warn(
                "File rejected before conversion because estimated memory is unsafe",
                {
                  fileName: item.source.name,
                  fileSize: item.source.sizeBytes,
                  estimatedBytes: memoryEstimate.estimatedBytes,
                },
              );
              throw new ConversionError(
                "File is too large for safe browser memory processing",
              );
            }

            if (controller.signal.aborted) {
              updateActiveItem(token, item.source.id, { status: "cancelled" });
              return;
            }

            const bytes = await item.source.file.arrayBuffer();
            const result = await pool.convert({
              bytes,
              mimeType: item.source.mimeType,
              settings: currentSettings,
              originalName: item.source.name,
              signal: controller.signal,
              onProgress: (progress) => {
                updateActiveItem(token, item.source.id, {
                  progress,
                  status: "processing",
                });
              },
            });

            if (controller.signal.aborted) {
              updateActiveItem(token, item.source.id, { status: "cancelled" });
              return;
            }

            const artifact = createArtifact(
              item,
              result,
              taken,
              currentSettings,
            );
            updateActiveItem(token, item.source.id, {
              status: "done",
              progress: 1,
              artifact,
              error: undefined,
            });
          } catch (err) {
            updateActiveItem(token, item.source.id, {
              status: controller.signal.aborted ? "cancelled" : "failed",
              error: toErrorMessage(err),
            });
          }
        },
      }),
    );

    await Promise.allSettled(tasks);
    if (activeBatchRef.current?.token === token) {
      setRunning(false);
      abortRef.current = null;
      activeBatchRef.current = null;
    }
  }, [createArtifact, setRunning, updateActiveItem]);

  const cancelBatch = useCallback(() => {
    const active = activeBatchRef.current;
    abortRef.current?.abort();
    if (!active) return;
    for (const id of active.ids) {
      updateItem(id, { status: "cancelled" });
    }
  }, [updateItem]);

  const doneItems = useMemo(
    () => items.filter((i) => i.status === "done" && i.artifact),
    [items],
  );
  const artifacts = useMemo(
    () =>
      doneItems
        .map((i) => i.artifact)
        .filter((a): a is ConvertedArtifact => Boolean(a)),
    [doneItems],
  );

  return { runBatch, cancelBatch, artifacts, doneItems };
}
