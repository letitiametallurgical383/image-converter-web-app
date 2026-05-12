import type { SourceFile } from "@core/types";
import { validateImageFile } from "@domain/validation";
import { generateId } from "@utils/id";
import { useCallback, useState } from "react";

export function useImageDrop(onAdd: (sources: SourceFile[]) => void): {
  onFilesSelected: (files: FileList | File[]) => Promise<void>;
  rejected: string[];
  clearRejected: () => void;
} {
  const [rejected, setRejected] = useState<string[]>([]);

  const onFilesSelected = useCallback(
    async (files: FileList | File[]) => {
      const accepted: SourceFile[] = [];
      const failed: string[] = [];
      const list = Array.from(files);
      await Promise.all(
        list.map(async (file) => {
          try {
            await validateImageFile(file);
            accepted.push({
              id: generateId(),
              file,
              sizeBytes: file.size,
              mimeType: (file.type || "").toLowerCase(),
              name: file.name,
            });
          } catch (err) {
            failed.push(
              `${file.name}: ${err instanceof Error ? err.message : "rejected"}`,
            );
          }
        }),
      );
      if (accepted.length > 0) onAdd(accepted);
      if (failed.length > 0) setRejected((prev) => [...prev, ...failed]);
    },
    [onAdd],
  );

  const clearRejected = useCallback(() => setRejected([]), []);

  return { onFilesSelected, rejected, clearRejected };
}
