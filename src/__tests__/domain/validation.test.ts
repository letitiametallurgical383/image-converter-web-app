import { DEFAULT_SETTINGS, PRESET_SCHEMA_VERSION } from "@core/constants";
import { InvalidFileError, ValidationError } from "@core/errors";
import {
  assertFileSize,
  clamp,
  detectMagicMime,
  isAcceptedMime,
  isCompatibleDeclaredMime,
  parsePreset,
  parsePresetFile,
  validateCropPercent,
  validateImageFile,
  validateSettings,
} from "@domain/validation";
import { describe, expect, it } from "vitest";

describe("clamp", () => {
  it("clamps value to minimum", () => expect(clamp(-5, 0, 100)).toBe(0));
  it("clamps value to maximum", () => expect(clamp(150, 0, 100)).toBe(100));
  it("returns value unchanged when within range", () =>
    expect(clamp(50, 0, 100)).toBe(50));
  it("returns min for NaN", () => expect(clamp(NaN, 0, 100)).toBe(0));
  it("handles boundary values exactly", () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe("assertFileSize", () => {
  it("throws InvalidFileError for empty file (size 0)", () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    expect(() => assertFileSize(file)).toThrow(InvalidFileError);
  });

  it("does not throw for a valid-sized file", () => {
    const file = new File([new Uint8Array(1024)], "valid.jpg", {
      type: "image/jpeg",
    });
    expect(() => assertFileSize(file)).not.toThrow();
  });

  it("throws for files exceeding 256MB limit", () => {
    const overLimit = 256 * 1024 * 1024 + 1;
    const file = { size: overLimit, name: "big.jpg" } as File;
    expect(() => assertFileSize(file)).toThrow(InvalidFileError);
  });
});

describe("validateImageFile", () => {
  it("accepts file based on magic bytes even if declared type is unsupported", async () => {
    const buffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]).buffer;
    const file = new File([buffer], "test.bin", {
      type: "application/octet-stream",
    });
    await expect(validateImageFile(file)).resolves.toBeUndefined();
  });

  it("rejects HEIC extension when content signature is missing", async () => {
    const file = new File([new Uint8Array(20)], "photo.heic", { type: "" });
    await expect(validateImageFile(file)).rejects.toThrow(InvalidFileError);
  });

  it("rejects HEIF extension when content signature is missing", async () => {
    const file = new File([new Uint8Array(20)], "photo.heif", { type: "" });
    await expect(validateImageFile(file)).rejects.toThrow(InvalidFileError);
  });

  it("accepts HEIC when ISO brand is detected", async () => {
    const file = new File(
      [
        new Uint8Array([
          0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0,
          0,
        ]),
      ],
      "photo.heic",
      { type: "image/heic" },
    );
    await expect(validateImageFile(file)).resolves.toBeUndefined();
  });

  it("rejects declared image type when content does not match", async () => {
    const file = new File([new Uint8Array(20)], "photo.jpg", {
      type: "image/jpeg",
    });
    await expect(validateImageFile(file)).rejects.toThrow(
      "File content does not match declared type: image/jpeg",
    );
  });

  it("throws for unknown file type with no matching magic bytes or extension", async () => {
    const file = new File([new Uint8Array(20)], "doc.txt", { type: "" });
    await expect(validateImageFile(file)).rejects.toThrow(InvalidFileError);
    await expect(validateImageFile(file)).rejects.toThrow(
      "Unsupported file type: unknown",
    );
  });
});

describe("isAcceptedMime", () => {
  const accepted = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
    "image/bmp",
    "image/heic",
    "image/heif",
  ];
  const rejected = [
    "image/tiff",
    "image/svg+xml",
    "application/pdf",
    "text/plain",
    "",
  ];

  for (const mime of accepted) {
    it(`accepts ${mime}`, () => expect(isAcceptedMime(mime)).toBe(true));
  }

  for (const mime of rejected) {
    it(`rejects ${mime}`, () => expect(isAcceptedMime(mime)).toBe(false));
  }

  it("is case-insensitive", () =>
    expect(isAcceptedMime("IMAGE/JPEG")).toBe(true));
});

describe("detectMagicMime", () => {
  const makeFile = (bytes: number[], name = "test") => {
    return new File([new Uint8Array(bytes)], name);
  };

  it("detects JPEG from FFD8FF magic bytes", async () => {
    const file = makeFile([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00]);
    expect(await detectMagicMime(file)).toBe("image/jpeg");
  });

  it("detects PNG from 8-byte signature", async () => {
    const file = makeFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(await detectMagicMime(file)).toBe("image/png");
  });

  it("detects GIF87a", async () => {
    const file = makeFile([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    expect(await detectMagicMime(file)).toBe("image/gif");
  });

  it("detects GIF89a", async () => {
    const file = makeFile([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(await detectMagicMime(file)).toBe("image/gif");
  });

  it("detects WebP from RIFF WEBP signature", async () => {
    const file = makeFile([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(await detectMagicMime(file)).toBe("image/webp");
  });

  it("does not detect WebP from RIFF without WEBP brand", async () => {
    const file = makeFile([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
    ]);
    expect(await detectMagicMime(file)).toBeNull();
  });

  it("detects AVIF from ISO brand", async () => {
    const file = makeFile([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0, 0, 0, 0,
    ]);
    expect(await detectMagicMime(file)).toBe("image/avif");
  });

  it("detects BMP from BM signature", async () => {
    const file = makeFile([0x42, 0x4d, 0x00, 0x00]);
    expect(await detectMagicMime(file)).toBe("image/bmp");
  });

  it("returns null for unknown binary", async () => {
    const file = makeFile([0x00, 0x01, 0x02, 0x03]);
    expect(await detectMagicMime(file)).toBeNull();
  });
});

describe("validateCropPercent", () => {
  it("accepts all-zero crop", () => {
    expect(() =>
      validateCropPercent({ top: 0, right: 0, bottom: 0, left: 0 }),
    ).not.toThrow();
  });

  it("accepts valid partial crop", () => {
    expect(() =>
      validateCropPercent({ top: 10, right: 10, bottom: 10, left: 10 }),
    ).not.toThrow();
  });

  it("throws when top + bottom >= 100", () => {
    expect(() =>
      validateCropPercent({ top: 50, right: 0, bottom: 50, left: 0 }),
    ).toThrow(ValidationError);
  });

  it("throws when left + right >= 100", () => {
    expect(() =>
      validateCropPercent({ top: 0, right: 50, bottom: 0, left: 50 }),
    ).toThrow(ValidationError);
  });

  it("throws for negative values", () => {
    expect(() =>
      validateCropPercent({ top: -1, right: 0, bottom: 0, left: 0 }),
    ).toThrow(ValidationError);
  });

  it("throws for values over 100", () => {
    expect(() =>
      validateCropPercent({ top: 101, right: 0, bottom: 0, left: 0 }),
    ).toThrow(ValidationError);
  });
});

describe("validateSettings", () => {
  const valid = { ...DEFAULT_SETTINGS };

  it("accepts default settings without throwing", () => {
    expect(() => validateSettings(valid)).not.toThrow();
  });

  it("throws for unsupported output format", () => {
    expect(() =>
      validateSettings({ ...valid, format: "bmp" as never }),
    ).toThrow(ValidationError);
  });

  it("throws when quality is below 0", () => {
    expect(() => validateSettings({ ...valid, quality: -0.1 })).toThrow(
      ValidationError,
    );
  });

  it("throws when quality is above 1", () => {
    expect(() => validateSettings({ ...valid, quality: 1.1 })).toThrow(
      ValidationError,
    );
  });

  it("throws when concurrency is below minimum (1)", () => {
    expect(() => validateSettings({ ...valid, concurrency: 0 })).toThrow(
      ValidationError,
    );
  });

  it("throws when concurrency is above maximum (8)", () => {
    expect(() => validateSettings({ ...valid, concurrency: 9 })).toThrow(
      ValidationError,
    );
  });

  it("throws for non-integer concurrency", () => {
    expect(() => validateSettings({ ...valid, concurrency: 2.5 })).toThrow(
      ValidationError,
    );
  });
});

describe("parsePresetFile", () => {
  const validPreset = {
    id: "test-id",
    name: "Test Preset",
    createdAt: Date.now(),
    settings: { ...DEFAULT_SETTINGS },
  };

  it("parses a valid preset file", () => {
    const file = {
      schemaVersion: PRESET_SCHEMA_VERSION,
      presets: [validPreset],
    };
    const result = parsePresetFile(file);
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0].name).toBe("Test Preset");
  });

  it("throws for wrong schema version", () => {
    const file = { schemaVersion: 999, presets: [] };
    expect(() => parsePresetFile(file)).toThrow(ValidationError);
  });

  it("throws when presets is not an array", () => {
    const file = { schemaVersion: PRESET_SCHEMA_VERSION, presets: "invalid" };
    expect(() => parsePresetFile(file)).toThrow(ValidationError);
  });

  it("throws for non-object input", () => {
    expect(() => parsePresetFile("string")).toThrow(ValidationError);
    expect(() => parsePresetFile(null)).toThrow(ValidationError);
    expect(() => parsePresetFile(42)).toThrow(ValidationError);
  });
});

describe("parsePreset", () => {
  it("throws when input is not an object", () => {
    expect(() => parsePreset(null)).toThrow(ValidationError);
    expect(() => parsePreset("string")).toThrow(ValidationError);
  });

  it("throws when id is missing", () => {
    expect(() =>
      parsePreset({
        name: "Test",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      }),
    ).toThrow(ValidationError);
  });

  it("throws when name is missing", () => {
    expect(() =>
      parsePreset({
        id: "abc",
        createdAt: Date.now(),
        settings: DEFAULT_SETTINGS,
      }),
    ).toThrow(ValidationError);
  });

  it("throws when settings is missing", () => {
    expect(() =>
      parsePreset({ id: "abc", name: "Test", createdAt: Date.now() }),
    ).toThrow(ValidationError);
  });

  it("throws when settings format is invalid", () => {
    expect(() =>
      parsePreset({
        id: "abc",
        name: "Test",
        createdAt: Date.now(),
        settings: { ...DEFAULT_SETTINGS, format: "tiff" },
      }),
    ).toThrow(ValidationError);
  });

  it("throws when crop is not an object", () => {
    expect(() =>
      parsePreset({
        id: "abc",
        name: "Test",
        createdAt: Date.now(),
        settings: { ...DEFAULT_SETTINGS, crop: "invalid" },
      }),
    ).toThrow(ValidationError);
  });

  it("uses fallback values when optional settings are missing or invalid (lines 230-240)", () => {
    const preset = parsePreset({
      id: "abc",
      name: "Test",
      createdAt: Date.now(),
      settings: {
        format: "webp",
        quality: 0.8,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        // Omitting optional string/bool fields
      },
    });
    expect(preset.settings.prefix).toBe("");
    expect(preset.settings.findText).toBe("");
    expect(preset.settings.replaceText).toBe("");
    expect(preset.settings.findReplaceCaseSensitive).toBe(false);
    expect(preset.settings.keepMetadata).toBe(false);
    expect(preset.settings.compressionMode).toBe("lossy");
  });

  it("parses compressionMode as lossless when explicitly set (line 239)", () => {
    const preset = parsePreset({
      id: "abc",
      name: "Test",
      createdAt: Date.now(),
      settings: {
        format: "webp",
        quality: 0.8,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        compressionMode: "lossless",
      },
    });
    expect(preset.settings.compressionMode).toBe("lossless");
  });
});

describe("additional validation coverage", () => {
  it("detectMagicMime handles file too short for ISO detection — readAscii returns empty (line 66)", async () => {
    const tiny = new File(
      [new Uint8Array([0x00, 0x00, 0x00, 0x00])],
      "tiny.avif",
      {
        type: "image/avif",
      },
    );
    const result = await detectMagicMime(tiny);
    expect(result).toBeNull();
  });

  it("detectIsoImageMime returns null for unknown brands (line 74)", async () => {
    const brand = (s: string) => s.split("").map((c) => c.charCodeAt(0));
    const bytes = new Uint8Array([
      0,
      0,
      0,
      24,
      ...brand("ftyp"),
      ...brand("abcd"),
      0,
      0,
      0,
      0,
      ...brand("efgh"),
      ...brand("ijkl"),
    ]);
    const file = new File([bytes.buffer], "unknown.mp4");
    const result = await detectMagicMime(file);
    expect(result).toBeNull();
  });

  it("detects HEIC from mif1 brand (loop iteration — line 80)", async () => {
    const brand = (s: string) => s.split("").map((c) => c.charCodeAt(0));
    const bytes = new Uint8Array([
      0,
      0,
      0,
      24,
      ...brand("ftyp"),
      ...brand("mif1"),
      0,
      0,
      0,
      0,
    ]);
    const file = new File([bytes.buffer], "test.heic");
    const result = await detectMagicMime(file);
    expect(result).toBe("image/heic");
  });

  it("isCompatibleDeclaredMime handles short-circuits (lines 105-106)", () => {
    // covers `(declared === "image/heif" || declared === "image/heic") && detected === "image/heic"` short-circuits
    expect(isCompatibleDeclaredMime("image/heic", "image/jpeg")).toBe(false);
    expect(isCompatibleDeclaredMime("image/heif", "image/png")).toBe(false);
  });

  it("isCompatibleDeclaredMime returns true when declared is empty (line 102)", () => {
    expect(isCompatibleDeclaredMime("", "image/jpeg")).toBe(true);
  });

  it("validateImageFile throws on declared/detected mismatch: PNG content with jpeg mime (line 124)", async () => {
    const pngSignature = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...new Array(56).fill(0),
    ]);
    const file = new File([pngSignature], "fake.jpg", { type: "image/jpeg" });
    await expect(validateImageFile(file)).rejects.toThrow(InvalidFileError);
    await expect(validateImageFile(file)).rejects.toThrow("mismatch");
  });
});
