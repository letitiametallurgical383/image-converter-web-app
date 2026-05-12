import {
  extractMetadataFromJpeg,
  injectMetadataIntoJpeg,
  injectMetadataIntoPng,
  injectMetadataIntoWebP,
} from "@workers/metadata";
import { describe, expect, it } from "vitest";
import {
  buildKnownIccProfile,
  buildKnownIptcData,
  buildKnownXmpData,
  buildMinimalJpeg,
  buildMinimalPng,
  buildMinimalWebP,
  bytesEqual,
} from "../fixtures/binary";

describe("Cross-format metadata preservation integration", () => {
  describe("JPEG source → JPEG output (EXIF + ICC + XMP + IPTC)", () => {
    it("extract from source JPEG and inject into output JPEG preserves all metadata", () => {
      const icc = buildKnownIccProfile();
      const xmp = buildKnownXmpData();
      const iptc = buildKnownIptcData();

      const sourceJpeg = buildMinimalJpeg({ icc, xmp, iptc });
      const outputJpeg = buildMinimalJpeg();

      const extracted = extractMetadataFromJpeg(sourceJpeg);
      const result = injectMetadataIntoJpeg(outputJpeg, extracted);

      const verify = extractMetadataFromJpeg(result);
      expect(bytesEqual(verify.icc!, icc)).toBe(true);
      expect(bytesEqual(verify.xmp!, xmp)).toBe(true);
      expect(bytesEqual(verify.iptc!, iptc)).toBe(true);
    });
  });

  describe("JPEG source → WebP output (ICC + XMP + EXIF)", () => {
    it("ICC data is preserved in ICCP chunk of output WebP", () => {
      const icc = buildKnownIccProfile();
      const sourceJpeg = buildMinimalJpeg({ icc });
      const outputWebP = buildMinimalWebP();

      const extracted = extractMetadataFromJpeg(sourceJpeg);
      const exifBytes = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
      const result = injectMetadataIntoWebP(
        outputWebP,
        extracted,
        exifBytes,
        1,
        1,
      );

      expect(result[0]).toBe(0x52);
      expect(result[8]).toBe(0x57);

      const view = new DataView(result.buffer, result.byteOffset);
      let pos = 12;
      let foundIccp = false;
      let iccp: Uint8Array | null = null;
      while (pos + 8 <= result.length) {
        const id = String.fromCharCode(
          result[pos],
          result[pos + 1],
          result[pos + 2],
          result[pos + 3],
        );
        const size = view.getUint32(pos + 4, true);
        if (id === "ICCP") {
          foundIccp = true;
          iccp = result.slice(pos + 8, pos + 8 + size);
        }
        pos += 8 + size + (size % 2);
      }
      expect(foundIccp).toBe(true);
      expect(bytesEqual(iccp!, icc)).toBe(true);
    });

    it("XMP data is preserved in XMP chunk of output WebP", () => {
      const xmp = buildKnownXmpData();
      const sourceJpeg = buildMinimalJpeg({ xmp });
      const outputWebP = buildMinimalWebP();

      const extracted = extractMetadataFromJpeg(sourceJpeg);
      const result = injectMetadataIntoWebP(
        outputWebP,
        extracted,
        new Uint8Array(0),
        1,
        1,
      );

      const view = new DataView(result.buffer, result.byteOffset);
      let pos = 12;
      let foundXmp = false;
      while (pos + 8 <= result.length) {
        const id = String.fromCharCode(
          result[pos],
          result[pos + 1],
          result[pos + 2],
          result[pos + 3],
        );
        const size = view.getUint32(pos + 4, true);
        if (id === "XMP ") {
          foundXmp = true;
          break;
        }
        pos += 8 + size + (size % 2);
      }
      expect(foundXmp).toBe(true);
    });
  });

  describe("JPEG source → PNG output (ICC + XMP + EXIF)", () => {
    it("eXIf chunk is present in output PNG", async () => {
      const sourceJpeg = buildMinimalJpeg();
      const outputPng = buildMinimalPng();
      const exifBytes = new Uint8Array([
        0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
      ]);

      const extracted = extractMetadataFromJpeg(sourceJpeg);
      const result = await injectMetadataIntoPng(
        outputPng,
        extracted,
        exifBytes,
      );

      const view = new DataView(result.buffer, result.byteOffset);
      let pos = 8;
      let foundExif = false;
      while (pos + 8 <= result.length) {
        const length = view.getUint32(pos, false);
        const type = String.fromCharCode(
          result[pos + 4],
          result[pos + 5],
          result[pos + 6],
          result[pos + 7],
        );
        if (type === "eXIf") {
          foundExif = true;
          break;
        }
        pos += 12 + length;
      }
      expect(foundExif).toBe(true);
    });

    it("iCCP chunk with ICC data is present in output PNG", async () => {
      const icc = buildKnownIccProfile();
      const sourceJpeg = buildMinimalJpeg({ icc });
      const outputPng = buildMinimalPng();

      const extracted = extractMetadataFromJpeg(sourceJpeg);
      const result = await injectMetadataIntoPng(
        outputPng,
        extracted,
        new Uint8Array(0),
      );

      const view = new DataView(result.buffer, result.byteOffset);
      let pos = 8;
      let foundIccp = false;
      while (pos + 8 <= result.length) {
        const length = view.getUint32(pos, false);
        const type = String.fromCharCode(
          result[pos + 4],
          result[pos + 5],
          result[pos + 6],
          result[pos + 7],
        );
        if (type === "iCCP") {
          foundIccp = true;
          break;
        }
        pos += 12 + length;
      }
      expect(foundIccp).toBe(true);
    });

    it("iTXt XMP chunk is present in output PNG", async () => {
      const xmp = buildKnownXmpData();
      const sourceJpeg = buildMinimalJpeg({ xmp });
      const outputPng = buildMinimalPng();

      const extracted = extractMetadataFromJpeg(sourceJpeg);
      const result = await injectMetadataIntoPng(
        outputPng,
        extracted,
        new Uint8Array(0),
      );

      const view = new DataView(result.buffer, result.byteOffset);
      let pos = 8;
      let foundItxt = false;
      while (pos + 8 <= result.length) {
        const length = view.getUint32(pos, false);
        const type = String.fromCharCode(
          result[pos + 4],
          result[pos + 5],
          result[pos + 6],
          result[pos + 7],
        );
        if (type === "iTXt") {
          foundItxt = true;
          break;
        }
        pos += 12 + length;
      }
      expect(foundItxt).toBe(true);
    });
  });

  describe("Metadata-free source produces metadata-free output", () => {
    it("JPEG with no metadata → JPEG with no metadata injected", () => {
      const sourceJpeg = buildMinimalJpeg();
      const outputJpeg = buildMinimalJpeg();
      const extracted = extractMetadataFromJpeg(sourceJpeg);
      const result = injectMetadataIntoJpeg(outputJpeg, extracted);
      const verify = extractMetadataFromJpeg(result);
      expect(verify.icc).toBeNull();
      expect(verify.xmp).toBeNull();
      expect(verify.iptc).toBeNull();
    });

    it("JPEG with no metadata → WebP unchanged (no-op)", () => {
      const sourceJpeg = buildMinimalJpeg();
      const outputWebP = buildMinimalWebP();
      const extracted = extractMetadataFromJpeg(sourceJpeg);
      const result = injectMetadataIntoWebP(
        outputWebP,
        extracted,
        new Uint8Array(0),
        1,
        1,
      );
      expect(result).toBe(outputWebP);
    });
  });
});
