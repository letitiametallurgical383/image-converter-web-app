import type { ConvertedArtifact } from "@core/types";
import JSZip from "jszip";

export interface ZipEntry {
  name: string;
  blob: Blob;
}

export async function createZip(
  entries: ZipEntry[],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.blob, { binary: true });
  }
  return zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      streamFiles: true,
    },
    (meta) => {
      if (onProgress) onProgress(meta.percent / 100);
    },
  );
}

export function toZipEntries(
  artifacts: Array<{ outputName: string; blob: Blob }>,
): ZipEntry[] {
  return artifacts.map((item) => ({ name: item.outputName, blob: item.blob }));
}

export function artifactsAsZipEntries(
  artifacts: ConvertedArtifact[],
): ZipEntry[] {
  return artifacts.map((artifact) => ({
    name: artifact.outputName,
    blob: artifact.blob,
  }));
}
