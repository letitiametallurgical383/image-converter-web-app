import type { ConvertedArtifact } from "@core/types";
import { artifactsAsZipEntries, createZip, toZipEntries } from "@data/zip";
import { describe, expect, it, vi } from "vitest";

describe("createZip", () => {
  it("creates a zip file from entries and reports progress", async () => {
    const entries = [
      { name: "test1.txt", blob: new Blob(["hello"], { type: "text/plain" }) },
      { name: "test2.txt", blob: new Blob(["world"], { type: "text/plain" }) },
    ];

    const progressSpy = vi.fn();
    const result = await createZip(entries, progressSpy);

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe("application/zip");

    expect(progressSpy).toHaveBeenCalled();
  });

  it("works without a progress callback", async () => {
    const entries = [{ name: "test.txt", blob: new Blob(["hello"]) }];
    const result = await createZip(entries);
    expect(result).toBeInstanceOf(Blob);
  });
});

describe("toZipEntries", () => {
  it("maps simple objects to zip entries", () => {
    const data = [
      { outputName: "a.jpg", blob: new Blob(["a"]) },
      { outputName: "b.jpg", blob: new Blob(["b"]) },
    ];
    const result = toZipEntries(data);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("a.jpg");
    expect(result[1].name).toBe("b.jpg");
  });
});

describe("artifactsAsZipEntries", () => {
  it("maps full artifact objects to zip entries", () => {
    const artifacts: ConvertedArtifact[] = [
      {
        originalBytes: 10,
        outputName: "out.jpg",
        blob: new Blob(["data"]),

        outputFormat: "jpeg",
        durationMs: 10,
        outputBytes: 4,
        width: 100,
        height: 100,
      },
    ];
    const result = artifactsAsZipEntries(artifacts);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("out.jpg");
    expect(result[0].blob).toBeInstanceOf(Blob);
  });
});
