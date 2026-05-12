import type { BatchItem, SourceFile } from "@core/types";
import { useImageDrop } from "@presentation/hooks/useImageDrop";
import { formatBytes } from "@utils/format";
import { memo, useCallback, useState } from "react";
import { TrashIcon, UploadIcon } from "./ui/Icon";

interface QueueItemProps {
  item: BatchItem;
  onRemove: (id: string) => void;
}

const QueueItem = memo(function QueueItem({ item, onRemove }: QueueItemProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">
            {item.source.name}
          </span>
          {item.status === "done" && (
            <span
              aria-hidden="true"
              className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0"
            >
              ✓
            </span>
          )}
          {item.status === "failed" && (
            <span
              aria-hidden="true"
              className="text-xs text-red-600 dark:text-red-400 font-medium shrink-0"
            >
              ✗
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatBytes(item.source.sizeBytes)}
          </span>
          {item.status === "processing" && (
            <span className="text-xs text-accent">
              Converting... {Math.round(item.progress * 100)}%
            </span>
          )}
          {item.status === "done" && item.artifact && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              → {formatBytes(item.artifact.outputBytes)}
            </span>
          )}
          {item.status === "failed" && item.error && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {item.error}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.source.id)}
        className="shrink-0 p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        aria-label={`Remove ${item.source.name}`}
      >
        <TrashIcon width={16} height={16} />
      </button>
    </div>
  );
});

interface ImageQueueProps {
  items: BatchItem[];
  onRemoveItem: (id: string) => void;
  onAddItems: (sources: SourceFile[]) => void;
  onClear?: () => void;
}

export function ImageQueue({
  items,
  onRemoveItem,
  onAddItems,
  onClear,
}: ImageQueueProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { onFilesSelected } = useImageDrop(onAddItems);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer?.files) {
        await onFilesSelected(event.dataTransfer.files);
      }
    },
    [onFilesSelected],
  );

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.setAttribute("aria-label", "Select images to convert");
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) await onFilesSelected(files);
    };
    input.click();
  }, [onFilesSelected]);

  const hasItems = items.length > 0;

  if (!hasItems) {
    return (
      <div
        className="flex flex-col rounded-2xl border border-white/20 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark-subtle/70 min-h-[400px]"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex-1 flex items-center justify-center">
          <button
            type="button"
            onClick={handleClick}
            className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors py-10 ${
              isDragging
                ? "border-accent bg-accent/10"
                : "border-neutral-300 hover:border-accent/70 dark:border-neutral-700"
            }`}
          >
            <UploadIcon width={40} height={40} />
            <span className="text-base font-medium text-neutral-700 dark:text-neutral-300">
              Drop images here or click to browse
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              JPG · PNG · WEBP · AVIF · HEIC · GIF · BMP
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col rounded-2xl border border-white/20 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark-subtle/70 min-h-[400px]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Images ({items.length})
        </h2>
        <div className="flex items-center gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={handleClick}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
          >
            <UploadIcon width={14} height={14} />
            Add Image
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
        {items.map((item) => (
          <QueueItem key={item.source.id} item={item} onRemove={onRemoveItem} />
        ))}
      </div>
    </div>
  );
}
