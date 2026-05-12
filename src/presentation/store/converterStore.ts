import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "@core/constants";
import type {
  BatchItem,
  ConverterSettings,
  CropPercent,
  SourceFile,
} from "@core/types";
import { createJsonStorage } from "@data/storage";
import { validateSettings } from "@domain/validation";
import { create } from "zustand";

interface ConverterState {
  settings: ConverterSettings;
  simpleItems: BatchItem[];
  advancedItems: BatchItem[];
  isRunning: boolean;
  mode: "simple" | "advanced";
  setMode: (mode: "simple" | "advanced") => void;
  setSettings: (next: Partial<ConverterSettings>) => void;
  setCrop: (next: Partial<CropPercent>) => void;
  resetSettings: () => void;
  addItems: (sources: SourceFile[]) => void;
  updateItem: (id: string, next: Partial<BatchItem>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  setRunning: (value: boolean) => void;
  replaceSettings: (next: ConverterSettings) => void;
}

const settingsStorage = createJsonStorage<ConverterSettings>(
  SETTINGS_STORAGE_KEY,
  (raw) => {
    if (typeof raw !== "object" || raw === null) throw new Error("invalid");
    const merged: ConverterSettings = {
      ...DEFAULT_SETTINGS,
      ...(raw as Partial<ConverterSettings>),
      crop: {
        ...DEFAULT_SETTINGS.crop,
        ...((raw as { crop?: Partial<CropPercent> }).crop ?? {}),
      },
    };
    validateSettings(merged);
    return merged;
  },
);

const initialSettings = settingsStorage.read() ?? DEFAULT_SETTINGS;

export const useConverterStore = create<ConverterState>((set, get) => ({
  settings: initialSettings,
  simpleItems: [],
  advancedItems: [],
  isRunning: false,
  mode: "simple",
  setMode: (mode) => set({ mode }),
  setSettings: (next) => {
    const merged = { ...get().settings, ...next };
    try {
      validateSettings(merged);
      set({ settings: merged });
      settingsStorage.write(merged);
    } catch {
      return;
    }
  },
  setCrop: (next) => {
    const crop = { ...get().settings.crop, ...next };
    const merged = { ...get().settings, crop };
    try {
      validateSettings(merged);
      set({ settings: merged });
      settingsStorage.write(merged);
    } catch {
      return;
    }
  },
  resetSettings: () => {
    set({ settings: DEFAULT_SETTINGS });
    settingsStorage.write(DEFAULT_SETTINGS);
  },
  replaceSettings: (next) => {
    validateSettings(next);
    set({ settings: next });
    settingsStorage.write(next);
  },
  addItems: (sources) => {
    const mode = get().mode;
    const currentItems =
      mode === "simple" ? get().simpleItems : get().advancedItems;
    const existingIds = new Set(currentItems.map((i) => i.source.id));
    const incoming: BatchItem[] = sources
      .filter((s) => !existingIds.has(s.id))
      .map((s) => ({ source: s, status: "pending", progress: 0 }));
    if (incoming.length === 0) return;

    if (mode === "simple") {
      set({ simpleItems: [...currentItems, ...incoming] });
      return;
    }
    set({ advancedItems: [...currentItems, ...incoming] });
  },
  updateItem: (id, next) => {
    const mode = get().mode;
    if (mode === "simple") {
      set({
        simpleItems: get().simpleItems.map((item) =>
          item.source.id === id ? { ...item, ...next } : item,
        ),
      });
    } else {
      set({
        advancedItems: get().advancedItems.map((item) =>
          item.source.id === id ? { ...item, ...next } : item,
        ),
      });
    }
  },
  removeItem: (id) => {
    const mode = get().mode;
    if (mode === "simple") {
      set({
        simpleItems: get().simpleItems.filter((item) => item.source.id !== id),
      });
    } else {
      set({
        advancedItems: get().advancedItems.filter(
          (item) => item.source.id !== id,
        ),
      });
    }
  },
  clearItems: () => {
    set({ simpleItems: [], advancedItems: [] });
  },
  setRunning: (value) => {
    set({ isRunning: value });
  },
}));
