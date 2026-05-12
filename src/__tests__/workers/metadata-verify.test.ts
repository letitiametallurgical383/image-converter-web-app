import { describe, expect, it } from "vitest";
import {
  buildIptcApp13Segments,
  extractMetadataFromJpeg,
  injectMetadataIntoJpeg,
  isSrgbProfile,
  verifyMetadataIntegrity,
} from "@workers/metadata";

describe("verifyMetadataIntegrity additional coverage", () => {
  it("handles missing ICC profile in output (line 1192)", async () => {
    // We need original with ICC, output without ICC.
    const iccPayload = new Array(250).fill(0);
    iccPayload[131] = 1;

    const len = 2 + 14 + iccPayload.length;
    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe2,
      (len >> 8) & 0xff,
      len & 0xff, // APP2
      0x49,
      0x43,
      0x43,
      0x5f,
      0x50,
      0x52,
      0x4f,
      0x46,
      0x49,
      0x4c,
      0x45,
      0x00,
      0x01,
      0x01, // ICC_PROFILE\0\x01\x01
      // ICC payload (valid SRGB to pass isSrgbProfile)
      ...iccPayload,
    ]);

    const output = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // Minimal jpeg with NO metadata

    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      output,
      "jpeg",
    );
    expect(result.warnings).toContain("ICC profile missing in output");
  });

  it("handles ICC profile byte mismatch (line 1192)", async () => {
    const iccPayload = new Array(250).fill(0);
    // Set tagCount at offset 128 to 1 so it doesn't fail tagCount === 0
    iccPayload[131] = 1;

    const len = 2 + 14 + iccPayload.length;
    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe2,
      (len >> 8) & 0xff,
      len & 0xff,
      0x49,
      0x43,
      0x43,
      0x5f,
      0x50,
      0x52,
      0x4f,
      0x46,
      0x49,
      0x4c,
      0x45,
      0x00,
      0x01,
      0x01,
      ...iccPayload,
    ]);

    // Output has ICC but different payload
    const output = new Uint8Array(orig);
    output[50] = 1; // Mutate payload

    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      output,
      "jpeg",
    );
    expect(result.warnings).toContain("ICC profile byte mismatch");
  });

  it("handles missing XMP in output (line 1200)", async () => {
    const payload = [0x3c, 0x3e];
    const len = 2 + 29 + payload.length;
    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe1,
      (len >> 8) & 0xff,
      len & 0xff, // APP1
      0x68,
      0x74,
      0x74,
      0x70,
      0x3a,
      0x2f,
      0x2f,
      0x6e,
      0x73,
      0x2e,
      0x61,
      0x64,
      0x6f,
      0x62,
      0x65,
      0x2e,
      0x63,
      0x6f,
      0x6d,
      0x2f,
      0x78,
      0x61,
      0x70,
      0x2f,
      0x31,
      0x2e,
      0x30,
      0x2f,
      0x00,
      ...payload,
    ]);
    const output = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      output,
      "jpeg",
    );
    expect(result.warnings).toContain("XMP metadata missing in output");
  });

  it("handles XMP byte mismatch (line 1201)", async () => {
    const payload = [0x3c, 0x3e];
    const len = 2 + 29 + payload.length;
    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe1,
      (len >> 8) & 0xff,
      len & 0xff,
      0x68,
      0x74,
      0x74,
      0x70,
      0x3a,
      0x2f,
      0x2f,
      0x6e,
      0x73,
      0x2e,
      0x61,
      0x64,
      0x6f,
      0x62,
      0x65,
      0x2e,
      0x63,
      0x6f,
      0x6d,
      0x2f,
      0x78,
      0x61,
      0x70,
      0x2f,
      0x31,
      0x2e,
      0x30,
      0x2f,
      0x00,
      ...payload,
    ]);
    const output = new Uint8Array(orig);
    output[35] = 0x3d; // Mutate payload

    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      output,
      "jpeg",
    );
    expect(result.warnings).toContain("XMP byte mismatch");
  });

  it("handles missing IPTC in output (line 1210)", async () => {
    const payload = [0x42];
    const len = 2 + 14 + 4 + 2 + 2 + 4 + payload.length + 1; // +1 for pad
    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xed,
      (len >> 8) & 0xff,
      len & 0xff, // APP13
      0x50,
      0x68,
      0x6f,
      0x74,
      0x6f,
      0x73,
      0x68,
      0x6f,
      0x70,
      0x20,
      0x33,
      0x2e,
      0x30,
      0x00, // Photoshop 3.0\0
      0x38,
      0x42,
      0x49,
      0x4d, // 8BIM
      0x04,
      0x04, // 1028 (IPTC)
      0x00,
      0x00, // Name (empty string)
      0x00,
      0x00,
      0x00,
      0x01, // Size
      ...payload,
      0x00, // pad
    ]);
    const output = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      output,
      "jpeg",
    );
    expect(result.warnings).toContain(
      "IPTC metadata missing in output (original size: 14 bytes)",
    );
  });

  it("handles IPTC byte mismatch (line 1214)", async () => {
    const payload = [0x42, 0x43];
    const len = 2 + 14 + 4 + 2 + 2 + 4 + payload.length;
    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xed,
      (len >> 8) & 0xff,
      len & 0xff,
      0x50,
      0x68,
      0x6f,
      0x74,
      0x6f,
      0x73,
      0x68,
      0x6f,
      0x70,
      0x20,
      0x33,
      0x2e,
      0x30,
      0x00,
      0x38,
      0x42,
      0x49,
      0x4d,
      0x04,
      0x04,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x02,
      ...payload,
    ]);
    const output = new Uint8Array(orig);
    output[32] = 0x44; // Mutate payload

    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      output,
      "jpeg",
    );
    expect(result.warnings).toContain(
      "IPTC byte mismatch (original: 14 bytes, output: 14 bytes)",
    );
  });

  it("clears original.icc if it is not SRGB profile (line 1166)", async () => {
    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe2,
      0x00,
      0x54,
      0x49,
      0x43,
      0x43,
      0x5f,
      0x50,
      0x52,
      0x4f,
      0x46,
      0x49,
      0x4c,
      0x45,
      0x00,
      0x01,
      0x01,
      ...new Array(64).fill(0),
    ]);
    // Leave SRGB profile signature empty so isSrgbProfile returns false

    const output = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      output,
      "jpeg",
    );

    // original.icc was cleared, so it won't warn about "missing in output"
    expect(result.warnings).not.toContain("ICC profile missing in output");
  });

  it("handles outputFormat default case (line 1181) and WebP output (lines 1175-1176)", async () => {
    const orig = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x24, 0x68, 0x74, 0x74, 0x70, 0x3a, 0x2f,
      0x2f, 0x6e, 0x73, 0x2e, 0x61, 0x64, 0x6f, 0x62, 0x65, 0x2e, 0x63, 0x6f,
      0x6d, 0x2f, 0x78, 0x61, 0x70, 0x2f, 0x31, 0x2e, 0x30, 0x2f, 0x00, 0x3c,
      0x3e,
    ]);
    const outputWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x0c, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]);
    const resultWebp = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      outputWebp,
      "webp",
    );
    expect(resultWebp.warnings).toContain("XMP metadata missing in output");

    const outputPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45,
      0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const resultPng = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      outputPng,
      "png",
    );
    expect(resultPng.warnings).toContain("XMP metadata missing in output");

    const resultUnknown = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      outputWebp,
      "unknown" as never,
    );
    expect(resultUnknown.warnings).toContain("XMP metadata missing in output");
  });

  it("handles identical metadata returning OK (covers arraysEqual true branch lines 1147-1150)", async () => {
    const payload = [0x3c, 0x3e];
    const len = 2 + 29 + payload.length;
    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe1,
      (len >> 8) & 0xff,
      len & 0xff,
      0x68,
      0x74,
      0x74,
      0x70,
      0x3a,
      0x2f,
      0x2f,
      0x6e,
      0x73,
      0x2e,
      0x61,
      0x64,
      0x6f,
      0x62,
      0x65,
      0x2e,
      0x63,
      0x6f,
      0x6d,
      0x2f,
      0x78,
      0x61,
      0x70,
      0x2f,
      0x31,
      0x2e,
      0x30,
      0x2f,
      0x00,
      ...payload,
    ]);
    const output = new Uint8Array(orig);

    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      output,
      "jpeg",
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBe(0);
  });

  it("extracts IPTC from PNG zTXt chunk (lines 1109-1138)", async () => {
    // Generate a valid PNG with zTXt chunk
    const keyword = "Raw profile type iptc";
    const chunkData = new Uint8Array([
      ...keyword.split("").map((c) => c.charCodeAt(0)),
      0, // null separator
      0, // compression method (zlib)

      // metadata.ts skips characters until a null byte, so we provide one:
      0x41,
      0x42,
      0x43,
      0x00, // "ABC\0"

      // fake compressed data that will fail DecompressionStream, triggering catch block line 1132
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
    ]);

    // Chunk length
    const len = chunkData.length;
    const lenArr = new Uint8Array([
      (len >> 24) & 0xff,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
    ]);
    const typeArr = new Uint8Array([0x7a, 0x54, 0x58, 0x74]); // zTXt

    const pngBytes = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // Signature
      ...lenArr,
      ...typeArr,
      ...chunkData,
      0,
      0,
      0,
      0, // Fake CRC
      0,
      0,
      0,
      0,
      0x49,
      0x45,
      0x4e,
      0x44,
      0xae,
      0x42,
      0x60,
      0x82, // IEND
    ]);

    const { extractMetadataFromPng } = await import("@workers/metadata");
    const result = await extractMetadataFromPng(pngBytes);

    expect(result.iptc).toBeDefined();
    // length of fake compressed data
    expect(result.iptc?.length).toBe(8);
  });

  it("extracts ICC, XMP, IPTC from WebP (lines 1022-1035)", async () => {
    const { extractMetadataFromWebP } = await import("@workers/metadata");

    // Create valid WebP with chunks
    const riffHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF
    const webpHeader = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // WEBP

    // ICCP chunk
    const iccpId = new Uint8Array([0x49, 0x43, 0x43, 0x50]); // ICCP
    const iccpSize = new Uint8Array([4, 0, 0, 0]); // 4 bytes, little endian
    const iccpData = new Uint8Array([1, 2, 3, 4]);

    // XMP chunk
    const xmpId = new Uint8Array([0x58, 0x4d, 0x50, 0x20]); // XMP
    const xmpSize = new Uint8Array([2, 0, 0, 0]);
    const xmpData = new Uint8Array([5, 6]);

    // IPTC chunk
    const iptcId = new Uint8Array([0x49, 0x50, 0x54, 0x43]); // IPTC
    const iptcSize = new Uint8Array([3, 0, 0, 0]);
    const iptcData = new Uint8Array([7, 8, 9]); // 3 bytes -> requires 1 byte pad!
    const iptcPad = new Uint8Array([0]);

    // Build file
    const fileLen =
      webpHeader.length +
      iccpId.length +
      iccpSize.length +
      iccpData.length +
      xmpId.length +
      xmpSize.length +
      xmpData.length +
      iptcId.length +
      iptcSize.length +
      iptcData.length +
      iptcPad.length;

    const lenArr = new Uint8Array([
      fileLen & 0xff,
      (fileLen >> 8) & 0xff,
      0,
      0,
    ]);

    const webpBytes = new Uint8Array([
      ...riffHeader,
      ...lenArr,
      ...webpHeader,
      ...iccpId,
      ...iccpSize,
      ...iccpData,
      ...xmpId,
      ...xmpSize,
      ...xmpData,
      ...iptcId,
      ...iptcSize,
      ...iptcData,
      ...iptcPad,
    ]);

    const result = extractMetadataFromWebP(webpBytes);
    expect(result.icc?.length).toBe(4);
    expect(result.xmp?.length).toBe(2);
    expect(result.iptc?.length).toBe(3);
  });

  it("handles invalid PNG signature (line 1055)", async () => {
    const { extractMetadataFromPng } = await import("@workers/metadata");
    const result = await extractMetadataFromPng(new Uint8Array([1, 2, 3]));
    expect(result.icc).toBeNull();
  });

  it("extracts iCCP and iTXt from PNG (lines 1075-1085, 1091-1105, 1114-1115, 1130)", async () => {
    // Mock DecompressionStream globally to succeed so we hit line 1130
    const originalDecompressionStream = globalThis.DecompressionStream;
    globalThis.DecompressionStream = class {
      constructor() {}
      writable = new WritableStream();
      readable = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });
    } as unknown as typeof DecompressionStream;

    try {
      const { extractMetadataFromPng } = await import("@workers/metadata");

      const validZlib = [
        0x78, 0x9c, 0xcb, 0x48, 0xcd, 0xc9, 0xc9, 0x07, 0x00, 0x06, 0x20, 0x02,
        0x15,
      ];

      // iCCP chunk
      const iccpName = "Profile".split("").map((c) => c.charCodeAt(0));
      const iccpChunkData = new Uint8Array([...iccpName, 0, 0, ...validZlib]);
      const iccpLenArr = new Uint8Array([0, 0, 0, iccpChunkData.length]);
      const iccpType = new Uint8Array([0x69, 0x43, 0x43, 0x50]); // iCCP

      // iTXt chunk
      const xmpKeyword = "XML:com.adobe.xmp"
        .split("")
        .map((c) => c.charCodeAt(0));
      const itxtChunkData = new Uint8Array([
        ...xmpKeyword,
        0,
        0,
        0, // comp flag, meth
        0,
        0, // lang, trans
        1,
        2,
        3, // XMP data
      ]);
      const itxtLenArr = new Uint8Array([0, 0, 0, itxtChunkData.length]);
      const itxtType = new Uint8Array([0x69, 0x54, 0x58, 0x74]); // iTXt

      // iTXt chunk with wrong keyword
      const wrongXmpKeyword = "Wrong:com.adobe.xmp"
        .split("")
        .map((c) => c.charCodeAt(0));
      const wrongItxtChunkData = new Uint8Array([
        ...wrongXmpKeyword,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        3,
      ]);
      const wrongItxtLenArr = new Uint8Array([
        0,
        0,
        0,
        wrongItxtChunkData.length,
      ]);

      // zTXt chunk with successful DecompressionStream
      const iptcKeyword = "Raw profile type iptc"
        .split("")
        .map((c) => c.charCodeAt(0));
      const ztxtChunkData = new Uint8Array([
        ...iptcKeyword,
        0,
        0,
        ..."skipto\0".split("").map((c) => c.charCodeAt(0)),
        ...validZlib,
      ]);
      const ztxtLenArr = new Uint8Array([0, 0, 0, ztxtChunkData.length]);
      const ztxtType = new Uint8Array([0x7a, 0x54, 0x58, 0x74]); // zTXt

      // tEXt chunk with mismatched keyword
      const textKeyword = "Wrong keyword".split("").map((c) => c.charCodeAt(0));
      const textChunkData = new Uint8Array([...textKeyword, 0, 1, 2, 3]);
      const textLenArr = new Uint8Array([0, 0, 0, textChunkData.length]);
      const textType = new Uint8Array([0x74, 0x45, 0x58, 0x74]); // tEXt

      const pngBytes = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...iccpLenArr,
        ...iccpType,
        ...iccpChunkData,
        0,
        0,
        0,
        0,
        ...itxtLenArr,
        ...itxtType,
        ...itxtChunkData,
        0,
        0,
        0,
        0,
        ...wrongItxtLenArr,
        ...itxtType,
        ...wrongItxtChunkData,
        0,
        0,
        0,
        0,
        ...ztxtLenArr,
        ...ztxtType,
        ...ztxtChunkData,
        0,
        0,
        0,
        0,
        ...textLenArr,
        ...textType,
        ...textChunkData,
        0,
        0,
        0,
        0,
      ]);

      const result = await extractMetadataFromPng(pngBytes);

      expect(result.icc).toBeDefined();
      expect(result.xmp).toBeDefined();
      expect(result.xmp?.length).toBe(3);
      expect(result.iptc).toBeDefined();
    } finally {
      if (originalDecompressionStream) {
        globalThis.DecompressionStream = originalDecompressionStream;
      } else {
        delete (globalThis as Record<string, unknown>).DecompressionStream;
      }
    }
  });
});

function buildSrgbIccProfile(size: number): Uint8Array {
  const icc = new Uint8Array(size);
  const view = new DataView(icc.buffer);
  icc[0] = 0x64;
  icc[1] = 0x65;
  icc[2] = 0x73;
  icc[3] = 0x63;
  view.setUint32(8, 0, false);
  const str = new TextEncoder().encode("sRGB IEC61966-2.1");
  icc.set(str, 12);
  view.setUint32(128, 1, false);
  icc[132] = 0x64;
  icc[133] = 0x65;
  icc[134] = 0x73;
  icc[135] = 0x63;
  view.setUint32(136, 0, false);
  view.setUint32(140, size, false);
  return icc;
}

describe("buildSrgbIccProfile helper", () => {
  it("creates a valid sRGB ICC profile", () => {
    const icc = buildSrgbIccProfile(200);
    expect(icc.length).toBe(200);
    expect(icc[128]).toBe(0);
    expect(icc[131]).toBe(1);
    expect(icc[132]).toBe(0x64);
    expect(String.fromCharCode(icc[0], icc[1], icc[2], icc[3])).toBe("desc");
    const view = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
    expect(view.getUint32(128, false)).toBe(1);
    expect(view.getUint32(136, false)).toBe(0);
    expect(icc[12]).toBe(0x73);
    expect(isSrgbProfile(icc)).toBe(true);
  });
});

describe("verifyMetadataIntegrity ICC length mismatch (line 1147)", () => {
  it("warns when ICC profiles have different lengths", async () => {
    const icc1 = buildSrgbIccProfile(200);
    const icc2 = buildSrgbIccProfile(150);

    const app2Len1 = 16 + icc1.length;
    const app2Len2 = 16 + icc2.length;

    const orig = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe2,
      (app2Len1 >> 8) & 0xff,
      app2Len1 & 0xff,
      0x49,
      0x43,
      0x43,
      0x5f,
      0x50,
      0x52,
      0x4f,
      0x46,
      0x49,
      0x4c,
      0x45,
      0x00,
      0x01,
      0x01,
      ...icc1,
      0xff,
      0xd9,
    ]);

    const out = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe2,
      (app2Len2 >> 8) & 0xff,
      app2Len2 & 0xff,
      0x49,
      0x43,
      0x43,
      0x5f,
      0x50,
      0x52,
      0x4f,
      0x46,
      0x49,
      0x4c,
      0x45,
      0x00,
      0x01,
      0x01,
      ...icc2,
      0xff,
      0xd9,
    ]);

    const origMeta = extractMetadataFromJpeg(orig);
    const outMeta = extractMetadataFromJpeg(out);
    expect(origMeta.icc?.length).toBe(200);
    expect(outMeta.icc?.length).toBe(150);
    expect(origMeta.icc).toEqual(icc1);
    expect(outMeta.icc).toEqual(icc2);
    expect(isSrgbProfile(icc1)).toBe(true);
    expect(isSrgbProfile(origMeta.icc!)).toBe(true);
    expect(isSrgbProfile(outMeta.icc!)).toBe(true);

    const result = await verifyMetadataIntegrity(
      orig.buffer,
      "image/jpeg",
      out,
      "jpeg",
    );
    expect(result.ok).toBe(false);
    expect(result.warnings.some((w) => w.includes("ICC"))).toBe(true);
  });
});

describe("verifyMetadataIntegrity non-JPEG original (line 1162)", () => {
  it("extracts metadata from HEIC for non-JPEG original", async () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x00, 0x00, 0x00, 0x00,
    ]);
    const result = await verifyMetadataIntegrity(
      webp.buffer,
      "image/webp",
      webp,
      "webp",
    );
    expect(result.ok).toBe(true);
  });
});

describe("isSrgbProfile coverage", () => {
  it("returns false for ICC too small (line 25)", () => {
    expect(isSrgbProfile(new Uint8Array(100))).toBe(false);
  });

  it("returns false for tagCount 0 (line 25)", () => {
    const icc = new Uint8Array(200);
    const view = new DataView(icc.buffer);
    view.setUint32(128, 0, false);
    expect(isSrgbProfile(icc)).toBe(false);
  });

  it("returns false for tagCount exceeding max (line 25)", () => {
    const icc = new Uint8Array(200);
    const view = new DataView(icc.buffer);
    view.setUint32(128, 101, false);
    expect(isSrgbProfile(icc)).toBe(false);
  });

  it("returns true for sRGB description in desc tag (lines 40-73)", () => {
    const icc = new Uint8Array(400);
    const view = new DataView(icc.buffer);
    view.setUint32(128, 1, false);
    // desc tag at entry 132
    icc[132] = 0x64; // 'd'
    icc[133] = 0x65; // 'e'
    icc[134] = 0x73; // 's'
    icc[135] = 0x63; // 'c'
    view.setUint32(136, 0, false); // tag offset = 0 (relative to icc start)
    view.setUint32(140, 300, false); // tag size
    // typeSig at offset 0
    icc[0] = 0x64;
    icc[1] = 0x65;
    icc[2] = 0x73;
    icc[3] = 0x63;
    view.setUint32(8, 0, false); // ascii offset = 0
    const str = new TextEncoder().encode("sRGB IEC61966-2.1");
    icc.set(str, 12);
    expect(isSrgbProfile(icc)).toBe(true);
  });
});

describe("extractMetadataFromJpeg edge cases", () => {
  it("returns nulls for empty array", () => {
    const result = extractMetadataFromJpeg(new Uint8Array(0));
    expect(result).toEqual({ icc: null, xmp: null, iptc: null });
  });

  it("breaks at SOS marker (line 99)", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xda, 0x00, 0x00, 0x00, 0x00, 0xff, 0xd9,
    ]);
    const result = extractMetadataFromJpeg(jpeg);
    expect(result.icc).toBeNull();
    expect(result.xmp).toBeNull();
    expect(result.iptc).toBeNull();
  });

  it("breaks at EOI marker (line 99)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const result = extractMetadataFromJpeg(jpeg);
    expect(result.icc).toBeNull();
    expect(result.xmp).toBeNull();
    expect(result.iptc).toBeNull();
  });

  it("skips APP2 that does not match ICC header (lines 116-117)", () => {
    const app2Len = 2 + 16;
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe2,
      (app2Len >> 8) & 0xff,
      app2Len & 0xff,
      ...new Array(16).fill(0xab),
      0xff,
      0xd9,
    ]);
    const result = extractMetadataFromJpeg(jpeg);
    expect(result.icc).toBeNull();
  });

  it("skips APP1 that does not match XMP header (lines 141-142)", () => {
    const app1Len = 2 + 32;
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe1,
      (app1Len >> 8) & 0xff,
      app1Len & 0xff,
      ...new Array(32).fill(0xcd),
      0xff,
      0xd9,
    ]);
    const result = extractMetadataFromJpeg(jpeg);
    expect(result.xmp).toBeNull();
  });

  it("skips APP13 that does not match Photoshop header (lines 158-159)", () => {
    const app13Len = 2 + 16;
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xed,
      (app13Len >> 8) & 0xff,
      app13Len & 0xff,
      ...new Array(16).fill(0xab),
      0xff,
      0xd9,
    ]);
    const result = extractMetadataFromJpeg(jpeg);
    expect(result.iptc).toBeNull();
  });
});

describe("buildIptcApp13Segments multi-chunk", () => {
  it("creates single segment for small IPTC data (line 487)", () => {
    const small = new Uint8Array([0x01, 0x02]);
    const seg = buildIptcApp13Segments(small);
    expect(seg[0]).toBe(0xff);
    expect(seg[1]).toBe(0xed);
    expect(seg.length).toBeGreaterThan(2 + 14 + 2);
  });

  it("creates multiple segments for large IPTC data (lines 502-529)", () => {
    const large = new Uint8Array(70000);
    large[0] = 0x42;
    const seg = buildIptcApp13Segments(large);
    // Should have at least 2 SOI/APP13 markers
    let app13Count = 0;
    for (let i = 0; i < seg.length - 1; i++) {
      if (seg[i] === 0xff && seg[i + 1] === 0xed) app13Count++;
    }
    expect(app13Count).toBeGreaterThanOrEqual(2);
  });
});

describe("injectMetadataIntoJpeg edge cases", () => {
  it("handles malformed marker prefix (lines 576-578)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0xff, 0xd9]);
    const result = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc: null,
    });
    expect(result[0]).toBe(0xff);
    expect(result[1]).toBe(0xd8);
  });

  it("handles truncated segment after pos + 4 > length (lines 590-592)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]);
    const result = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc: null,
    });
    expect(result[0]).toBe(0xff);
    expect(result[1]).toBe(0xd8);
  });
});
