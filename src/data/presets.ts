import { PRESET_SCHEMA_VERSION, PRESET_STORAGE_KEY } from "@core/constants";
import type { Preset, PresetFile } from "@core/types";
import { parsePresetFile } from "@domain/validation";
import { createJsonStorage } from "./storage";

const storage = createJsonStorage<PresetFile>(PRESET_STORAGE_KEY, (raw) =>
  parsePresetFile(raw),
);

export function loadPresets(): Preset[] {
  const file = storage.read();
  return file ? file.presets : [];
}

export function savePresets(presets: Preset[]): void {
  const file: PresetFile = { schemaVersion: PRESET_SCHEMA_VERSION, presets };
  storage.write(file);
}

export function exportPresetsToBlob(presets: Preset[]): Blob {
  const file: PresetFile = { schemaVersion: PRESET_SCHEMA_VERSION, presets };
  return new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
}

export async function importPresetsFromFile(file: File): Promise<Preset[]> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  return parsePresetFile(parsed).presets;
}
