import type { BatchItem } from "@core/types";
import { useBatchDownload } from "@presentation/hooks/useBatchDownload";
import { Button } from "./ui/Button";
import { DownloadIcon, PackageIcon, PlayIcon, StopIcon } from "./ui/Icon";

export interface BatchActionsProps {
  items: BatchItem[];
  isRunning: boolean;
  onStart: () => void;
  onCancel: () => void;
}

export function BatchActions({
  items,
  isRunning,
  onStart,
  onCancel,
}: BatchActionsProps) {
  const { downloadBatch, isZipping, zipProgress } = useBatchDownload();

  const done = items.filter((i) => i.status === "done" && i.artifact);
  const hasPending = items.some(
    (i) => i.status === "pending" || i.status === "failed",
  );

  const handleDownloadAll = async () => {
    await downloadBatch(items);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white p-3 shadow-sm dark:border-border-dark dark:bg-surface-dark-subtle">
      {isRunning ? (
        <Button variant="danger" onClick={onCancel} leading={<StopIcon />}>
          Cancel batch
        </Button>
      ) : (
        <Button onClick={onStart} disabled={!hasPending} leading={<PlayIcon />}>
          Start conversion
        </Button>
      )}
      <Button
        variant="secondary"
        onClick={handleDownloadAll}
        disabled={done.length === 0 || isZipping}
        leading={done.length > 1 ? <PackageIcon /> : <DownloadIcon />}
      >
        {done.length > 1
          ? isZipping
            ? `Zipping… ${Math.round(zipProgress * 100)}%`
            : `Download ZIP (${done.length})`
          : "Download"}
      </Button>
      <div className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">
        {items.length === 0
          ? "Idle"
          : `${done.length}/${items.length} complete`}
      </div>
    </div>
  );
}
