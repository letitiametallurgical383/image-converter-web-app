import { DEFAULT_SETTINGS } from "@core/constants";
import {
  applyFindReplace,
  buildOutputName,
  ensureUniqueName,
  sanitizeFilename,
  sanitizePrefix,
  splitBaseAndExt,
} from "@domain/naming";
import { describe, expect, it } from "vitest";

describe("sanitizeFilename", () => {
  it("returns filename unchanged when already safe", () => {
    expect(sanitizeFilename("photo.jpg")).toBe("photo.jpg");
  });

  it("replaces control characters with underscores", () => {
    const result = sanitizeFilename("file\x00name");
    expect(result).not.toContain("\x00");
  });

  it("replaces forbidden path characters", () => {
    const result = sanitizeFilename('file<>:"/\\|?*name');
    expect(result).not.toMatch(/[<>:"/\\|?*]/);
  });

  it("collapses path traversal sequences", () => {
    const result = sanitizeFilename("../../etc/passwd");
    expect(result).not.toContain("..");
  });

  it("removes leading dots", () => {
    const result = sanitizeFilename(".hidden");
    expect(result).not.toMatch(/^\./);
  });

  it("returns 'file' for empty string", () => {
    expect(sanitizeFilename("")).toBe("file");
  });

  it("returns 'file' for dot-only input", () => {
    expect(sanitizeFilename("...")).toBe("file");
  });

  it("truncates to MAX_FILENAME_LENGTH (200 chars)", () => {
    const longName = "a".repeat(300);
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(200);
  });

  it("collapses multiple spaces", () => {
    const result = sanitizeFilename("my   file");
    expect(result).toBe("my file");
  });
});

describe("sanitizePrefix", () => {
  it("strips trailing dots and spaces", () => {
    expect(sanitizePrefix("web-prefix.")).toBe("web-prefix");
  });

  it("allows standard prefix without trailing junk", () => {
    expect(sanitizePrefix("web-")).toBe("web-");
  });
});

describe("splitBaseAndExt", () => {
  it("splits standard filename correctly", () => {
    expect(splitBaseAndExt("photo.jpg")).toEqual({ base: "photo", ext: "jpg" });
  });

  it("handles file with no extension", () => {
    expect(splitBaseAndExt("README")).toEqual({ base: "README", ext: "" });
  });

  it("handles multi-dot filenames (uses last dot)", () => {
    const { base, ext } = splitBaseAndExt("archive.tar.gz");
    expect(ext).toBe("gz");
    expect(base).toBe("archive.tar");
  });

  it("handles leading-dot files — sanitizes leading dot", () => {
    const { ext } = splitBaseAndExt(".gitignore");
    expect(ext).toBe("");
  });
});

describe("applyFindReplace", () => {
  it("replaces all occurrences (case-sensitive)", () => {
    expect(applyFindReplace("my-photo-photo", "photo", "img", true)).toBe(
      "my-img-img",
    );
  });

  it("replaces case-insensitively when flag is false", () => {
    expect(applyFindReplace("MyPhoto", "myphoto", "img", false)).toBe("img");
  });

  it("replaces case-insensitively when flag is false, leaving non-matching chars intact", () => {
    expect(applyFindReplace("prefix-TeSt-suffix", "test", "demo", false)).toBe(
      "prefix-demo-suffix",
    );
  });

  it("returns original when find is empty", () => {
    expect(applyFindReplace("hello", "", "world", false)).toBe("hello");
  });

  it("returns original when no match found", () => {
    expect(applyFindReplace("photo", "video", "img", true)).toBe("photo");
  });

  it("sanitizes replacement to prevent path injection", () => {
    const result = applyFindReplace("photo", "photo", "../../../etc", true);
    expect(result).not.toContain("..");
  });
});

describe("buildOutputName", () => {
  const baseSettings = { ...DEFAULT_SETTINGS };

  it("builds name with correct extension for target format", () => {
    const name = buildOutputName(
      "photo.jpg",
      { ...baseSettings, prefix: "out-" },
      "webp",
    );
    expect(name).toBe("out-photo.webp");
  });

  it("applies prefix correctly", () => {
    const name = buildOutputName(
      "photo.png",
      { ...baseSettings, prefix: "web-" },
      "jpeg",
    );
    expect(name).toBe("web-photo.jpg");
  });

  it("applies find/replace correctly", () => {
    const name = buildOutputName(
      "my-photo.jpg",
      {
        ...baseSettings,
        prefix: "out-",
        findText: "photo",
        replaceText: "image",
        findReplaceCaseSensitive: true,
      },
      "png",
    );
    expect(name).toBe("out-my-image.png");
  });

  it("falls back to 'image' when base becomes empty after sanitization", () => {
    const name = buildOutputName(
      "...",
      { ...baseSettings, prefix: "x-" },
      "webp",
    );
    expect(name.endsWith(".webp")).toBe(true);
    expect(name.length).toBeGreaterThan(4);
  });
});

describe("ensureUniqueName", () => {
  it("returns name unchanged when not in taken set", () => {
    const taken = new Set<string>();
    expect(ensureUniqueName("photo.jpg", taken)).toBe("photo.jpg");
    expect(taken.has("photo.jpg")).toBe(true);
  });

  it("appends counter suffix when name is taken", () => {
    const taken = new Set(["photo.jpg"]);
    const result = ensureUniqueName("photo.jpg", taken);
    expect(result).toBe("photo (1).jpg");
    expect(taken.has("photo (1).jpg")).toBe(true);
  });

  it("increments counter until unique", () => {
    const taken = new Set(["photo.jpg", "photo (1).jpg", "photo (2).jpg"]);
    const result = ensureUniqueName("photo.jpg", taken);
    expect(result).toBe("photo (3).jpg");
  });

  it("handles names without extension", () => {
    const taken = new Set(["photo"]);
    const result = ensureUniqueName("photo", taken);
    expect(result).toBe("photo (1)");
  });

  it("uses randomUUID fallback if 10000 candidates are taken", () => {
    const mockTaken = new Set<string>();
    const originalHas = mockTaken.has.bind(mockTaken);
    mockTaken.has = (val) => (val !== "fallback" ? true : originalHas(val));

    const originalUUID = globalThis.crypto?.randomUUID;
    if (!globalThis.crypto) {
      (globalThis as unknown as { crypto: Crypto }).crypto = {} as Crypto;
    }
    globalThis.crypto.randomUUID = () => "12345678-1234-1234-1234-123456789012";

    try {
      const name = ensureUniqueName("image.jpg", mockTaken);
      expect(name).toBe("image-12345678-1234-1234-1234-123456789012.jpg");
    } finally {
      if (originalUUID) globalThis.crypto.randomUUID = originalUUID;
    }
  });
});

describe("additional naming coverage", () => {
  it("sanitizeFilename returns 'file' for pure dot-segment input (line 13)", () => {
    expect(sanitizeFilename("..")).toBe("file");
    expect(sanitizeFilename(".")).toBe("file");
  });

  it("applyFindReplace case-insensitive returns original when no match (line 46)", () => {
    expect(applyFindReplace("hello-world", "xyz", "abc", false)).toBe(
      "hello-world",
    );
  });

  it("buildOutputName without prefix uses replaced name directly (lines 74-75)", () => {
    const name = buildOutputName(
      "photo.jpg",
      {
        ...DEFAULT_SETTINGS,
        prefix: "",
        findText: "",
        replaceText: "",
      },
      "webp",
    );
    expect(name).toBe("photo.webp");
  });
});
