import { MEMORY_LIMITS } from "@core/constants";
import {
  estimateMemoryUsage,
  shouldUseStreaming,
} from "@data/streamingConverter";
import { describe, expect, it } from "vitest";

describe("StreamingConverter", () => {
  describe("shouldUseStreaming", () => {
    it("returns false for small files", async () => {
      const smallFile = new File(
        [new ArrayBuffer(10 * 1024 * 1024)],
        "small.jpg",
        { type: "image/jpeg" },
      );
      const result = await shouldUseStreaming(smallFile, "webp");
      expect(result).toBe(false);
    });

    it("returns false for large files to keep conversion behavior consistent", async () => {
      const largeFile = new File(
        [new ArrayBuffer(60 * 1024 * 1024)],
        "large.jpg",
        { type: "image/jpeg" },
      );
      const result = await shouldUseStreaming(largeFile, "webp");
      expect(result).toBe(false);
    });

    it("does not switch pipeline at the large file warning boundary", async () => {
      const boundaryFile = new File(
        [new ArrayBuffer(MEMORY_LIMITS.LARGE_FILE_WARNING_THRESHOLD + 1)],
        "boundary.jpg",
        { type: "image/jpeg" },
      );
      const result = await shouldUseStreaming(boundaryFile, "webp");
      expect(result).toBe(false);
    });

    it("returns false for AVIF even with large files", async () => {
      const largeFile = new File(
        [new ArrayBuffer(60 * 1024 * 1024)],
        "large.jpg",
        { type: "image/jpeg" },
      );
      const result = await shouldUseStreaming(largeFile, "avif");
      expect(result).toBe(false);
    });
  });

  describe("estimateMemoryUsage — format multiplier branches", () => {
    it("uses 8x multiplier for GIF (line 35)", async () => {
      const gifHeader = new Uint8Array([0x47, 0x49, 0x46]);
      const fileSize = 1 * 1024 * 1024;
      const file = new File(
        [gifHeader.buffer, new ArrayBuffer(fileSize - 3)],
        "test.gif",
        { type: "image/gif" },
      );
      const estimate = await estimateMemoryUsage(file);
      expect(estimate.estimatedBytes).toBe(fileSize * 8 * 3);
    });

    it("uses 12x multiplier for AVIF/HEIC (ftyp box at offset 4 — line 44)", async () => {
      const fileSize = 1 * 1024 * 1024;
      const header = new Uint8Array(12);
      header[4] = 0x66;
      header[5] = 0x74;
      header[6] = 0x79;
      header[7] = 0x70;
      const file = new File(
        [header.buffer, new ArrayBuffer(fileSize - 12)],
        "test.avif",
        { type: "image/avif" },
      );
      const estimate = await estimateMemoryUsage(file);
      expect(estimate.estimatedBytes).toBe(fileSize * 12 * 3);
    });

    it("uses 8x multiplier for WebP RIFF container (line 58)", async () => {
      const fileSize = 1 * 1024 * 1024;
      const header = new Uint8Array(12);
      header[0] = 0x52;
      header[1] = 0x49;
      header[2] = 0x46;
      header[3] = 0x46;
      header[8] = 0x57;
      header[9] = 0x45;
      header[10] = 0x42;
      header[11] = 0x50;
      const file = new File(
        [header.buffer, new ArrayBuffer(fileSize - 12)],
        "test.webp",
        { type: "image/webp" },
      );
      const estimate = await estimateMemoryUsage(file);
      expect(estimate.estimatedBytes).toBe(fileSize * 8 * 3);
    });

    it("uses 8x fallback multiplier for unrecognized format (line 68)", async () => {
      const fileSize = 1 * 1024 * 1024;
      const header = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const file = new File(
        [header.buffer, new ArrayBuffer(fileSize - 4)],
        "unknown.bin",
        { type: "application/octet-stream" },
      );
      const estimate = await estimateMemoryUsage(file);
      expect(estimate.estimatedBytes).toBe(fileSize * 8 * 3);
    });

    it("uses 8x fallback multiplier for exactly 2-byte unrecognized format (line 44 fallback)", async () => {
      const header = new Uint8Array([0x01, 0x02]);
      const file = new File([header.buffer], "short.bin");
      const estimate = await estimateMemoryUsage(file);
      expect(estimate.estimatedBytes).toBe(2 * 8 * 3);
    });

    it("uses 8x fallback multiplier for 1-byte file (line 15)", async () => {
      const header = new Uint8Array([0x01]);
      const file = new File([header.buffer], "tiny.bin");
      const estimate = await estimateMemoryUsage(file);
      expect(estimate.estimatedBytes).toBe(1 * 8 * 3);
    });

    it("evaluates JPEG magic bytes condition correctly even if partial match (line 44)", async () => {
      // Matches 0xff 0xd8 but not the third byte
      const header = new Uint8Array([0xff, 0xd8, 0x00, 0x00]);
      const file = new File([header.buffer], "almost-jpeg.bin");
      const estimate = await estimateMemoryUsage(file);
      expect(estimate.estimatedBytes).toBe(4 * 8 * 3);
    });

    it("uses 8x multiplier for valid JPEG magic bytes (line 44)", async () => {
      const fileSize = 1 * 1024 * 1024;
      const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);
      const file = new File(
        [header.buffer, new ArrayBuffer(fileSize - 6)],
        "test.jpg",
        { type: "image/jpeg" },
      );
      const estimate = await estimateMemoryUsage(file);
      expect(estimate.estimatedBytes).toBe(fileSize * 8 * 3);
    });
  });

  describe("estimateMemoryUsage", () => {
    it("estimates memory for small files", async () => {
      const file = new File([new ArrayBuffer(1 * 1024 * 1024)], "test.jpg", {
        type: "image/jpeg",
      });
      const estimate = await estimateMemoryUsage(file);

      expect(estimate.isSafe).toBe(true);
      expect(estimate.recommendation).toBe("normal");
      expect(estimate.estimatedBytes).toBeGreaterThan(0);
    });

    it("recommends caution for moderately large files", async () => {
      const bmpHeader = new Uint8Array([0x42, 0x4d]);
      const file = new File(
        [bmpHeader.buffer, new ArrayBuffer(31 * 1024 * 1024 - 2)],
        "large.bmp",
        { type: "image/bmp" },
      );
      const estimate = await estimateMemoryUsage(file);

      expect(estimate.isSafe).toBe(true);
      expect(estimate.recommendation).toBe("caution");
    });

    it("recommends rejection for very large files", async () => {
      const file = new File(
        [new ArrayBuffer(60 * 1024 * 1024)],
        "verylarge.jpg",
        { type: "image/jpeg" },
      );
      const estimate = await estimateMemoryUsage(file);

      expect(estimate.isSafe).toBe(false);
      expect(estimate.recommendation).toBe("reject");
    });

    it("recommends rejection for extremely large files", async () => {
      const file = new File([new ArrayBuffer(300 * 1024 * 1024)], "huge.jpg", {
        type: "image/jpeg",
      });
      const estimate = await estimateMemoryUsage(file);

      expect(estimate.isSafe).toBe(false);
      expect(estimate.recommendation).toBe("reject");
    });

    it("calculates estimated bytes correctly for JPEG", async () => {
      const fileSize = 10 * 1024 * 1024;
      const file = new File([new ArrayBuffer(fileSize)], "test.jpg", {
        type: "image/jpeg",
      });
      const estimate = await estimateMemoryUsage(file);

      const expectedDecoded = fileSize * 8;
      const expectedPeak = expectedDecoded * 3;
      expect(estimate.estimatedBytes).toBe(expectedPeak);
    });

    it("uses lower multiplier for BMP (uncompressed)", async () => {
      const fileSize = 5 * 1024 * 1024;
      const bmpHeader = new Uint8Array([0x42, 0x4d]);
      const file = new File(
        [bmpHeader.buffer, new ArrayBuffer(fileSize - 2)],
        "test.bmp",
        { type: "image/bmp" },
      );
      const estimate = await estimateMemoryUsage(file);
      const expectedPeak = fileSize * 1 * 3;
      expect(estimate.estimatedBytes).toBe(expectedPeak);
    });

    it("uses higher multiplier for PNG", async () => {
      const fileSize = 5 * 1024 * 1024;
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const file = new File(
        [pngHeader.buffer, new ArrayBuffer(fileSize - 4)],
        "test.png",
        { type: "image/png" },
      );
      const estimate = await estimateMemoryUsage(file);
      const expectedPeak = fileSize * 12 * 3;
      expect(estimate.estimatedBytes).toBe(expectedPeak);
    });
  });
});
