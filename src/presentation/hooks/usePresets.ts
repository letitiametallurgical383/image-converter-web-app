import type { Preset } from "@core/types";
import { downloadBlob } from "@data/download";
import {
  exportPresetsToBlob,
  importPresetsFromFile,
  loadPresets,
  savePresets,
} from "@data/presets";
import { useConverterStore } from "@presentation/store/converterStore";
import { generateId } from "@utils/id";
import { useCallback, useEffect, useState } from "react";

export function usePresets(): {
  presets: Preset[];
  saveCurrent: (name: string) => void;
  apply: (id: string) => void;
  remove: (id: string) => void;
  exportAll: () => void;
  importFrom: (file: File) => Promise<void>;
} {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const settings = useConverterStore((s) => s.settings);
  const replaceSettings = useConverterStore((s) => s.replaceSettings);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const saveCurrent = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset: Preset = {
        id: generateId(),
        name: trimmed,
        createdAt: Date.now(),
        settings,
      };
      setPresets((prev) => [...prev, preset]);
    },
    [settings],
  );

  const apply = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      replaceSettings(preset.settings);
    },
    [presets, replaceSettings],
  );

  const remove = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const exportAll = useCallback(() => {
    const blob = exportPresetsToBlob(presets);
    downloadBlob(blob, "image-converter-presets.json");
  }, [presets]);

  const importFrom = useCallback(async (file: File) => {
    const imported = await importPresetsFromFile(file);
    setPresets((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      for (const preset of imported) {
        byId.set(preset.id, preset);
      }
      return Array.from(byId.values());
    });
  }, []);

  return { presets, saveCurrent, apply, remove, exportAll, importFrom };
}
