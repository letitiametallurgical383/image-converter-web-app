import { DEFAULT_SETTINGS, PRESET_SCHEMA_VERSION } from "@core/constants";
import { ValidationError } from "@core/errors";
import type { Preset } from "@core/types";
import {
  exportPresetsToBlob,
  importPresetsFromFile,
  loadPresets,
  savePresets,
} from "@data/presets";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const makePreset = (id = "id-1", name = "Test Preset"): Preset => ({
  id,
  name,
  createdAt: 1000000,
  settings: { ...DEFAULT_SETTINGS },
});

describe("loadPresets / savePresets", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns empty array when no presets are stored", () => {
    expect(loadPresets()).toEqual([]);
  });

  it("roundtrips a preset through save and load", () => {
    const preset = makePreset();
    savePresets([preset]);
    const loaded = loadPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("id-1");
    expect(loaded[0].name).toBe("Test Preset");
    expect(loaded[0].settings).toEqual(DEFAULT_SETTINGS);
  });

  it("persists multiple presets correctly", () => {
    savePresets([makePreset("a", "A"), makePreset("b", "B")]);
    expect(loadPresets()).toHaveLength(2);
  });

  it("overwrites existing presets on subsequent save", () => {
    savePresets([makePreset("old", "Old")]);
    savePresets([makePreset("new", "New")]);
    const loaded = loadPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("new");
  });
});

describe("exportPresetsToBlob", () => {
  it("returns a Blob with application/json MIME type", () => {
    const blob = exportPresetsToBlob([makePreset()]);
    expect(blob.type).toBe("application/json");
  });

  it("exported JSON contains correct schema version", async () => {
    const blob = exportPresetsToBlob([makePreset()]);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.schemaVersion).toBe(PRESET_SCHEMA_VERSION);
  });

  it("exported JSON contains all presets", async () => {
    const blob = exportPresetsToBlob([
      makePreset("a", "A"),
      makePreset("b", "B"),
    ]);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.presets).toHaveLength(2);
  });
});

describe("importPresetsFromFile", () => {
  it("imports presets from a valid JSON file", async () => {
    const preset = makePreset();
    const json = JSON.stringify({
      schemaVersion: PRESET_SCHEMA_VERSION,
      presets: [preset],
    });
    const file = new File([json], "presets.json", { type: "application/json" });
    const imported = await importPresetsFromFile(file);
    expect(imported).toHaveLength(1);
    expect(imported[0].id).toBe("id-1");
  });

  it("throws ValidationError for wrong schema version", async () => {
    const json = JSON.stringify({ schemaVersion: 999, presets: [] });
    const file = new File([json], "presets.json", { type: "application/json" });
    await expect(importPresetsFromFile(file)).rejects.toThrow(ValidationError);
  });

  it("throws on invalid JSON", async () => {
    const file = new File(["not-json{{{"], "presets.json", {
      type: "application/json",
    });
    await expect(importPresetsFromFile(file)).rejects.toThrow();
  });

  it("throws when preset is missing required fields", async () => {
    const json = JSON.stringify({
      schemaVersion: PRESET_SCHEMA_VERSION,
      presets: [{ id: "", name: "" }],
    });
    const file = new File([json], "presets.json", { type: "application/json" });
    await expect(importPresetsFromFile(file)).rejects.toThrow(ValidationError);
  });
});
