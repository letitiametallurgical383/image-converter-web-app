import type { BatchItem } from "@core/types";
import { downloadBlob } from "@data/download";
import { artifactsAsZipEntries, createZip } from "@data/zip";
import { useCallback, useState } from "react";

export function useBatchDownload() {
  const [zipProgress, setZipProgress] = useState(0);
  const [isZipping, setIsZipping] = useState(false);

  const downloadAll = useCallback((items: BatchItem[]) => {
    for (const item of items) {
      if (item.artifact) {
        downloadBlob(item.artifact.blob, item.artifact.outputName);
      }
    }
  }, []);

  const downloadZip = useCallback(async (items: BatchItem[]) => {
    if (items.length <= 1) return;
    setIsZipping(true);
    setZipProgress(0);
    try {
      const artifacts = items
        .map((i) => i.artifact)
        .filter((a): a is NonNullable<typeof a> => Boolean(a));
      const entries = artifactsAsZipEntries(artifacts);
      const blob = await createZip(entries, setZipProgress);
      downloadBlob(blob, `converted-${Date.now()}.zip`);
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  }, []);

  const downloadBatch = useCallback(
    async (items: BatchItem[]) => {
      const done = items.filter((i) => i.status === "done" && i.artifact);
      if (done.length === 0) return;
      if (done.length === 1) {
        const artifact = done[0].artifact;
        if (artifact) downloadBlob(artifact.blob, artifact.outputName);
        return;
      }
      await downloadZip(done);
    },
    [downloadZip],
  );

  return { downloadAll, downloadZip, downloadBatch, isZipping, zipProgress };
}
