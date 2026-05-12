import { WEBP_CONSTANTS } from "@workers/binaryConstants";
import {
  extractMetadataFromWebP,
  injectMetadataIntoWebP,
} from "@workers/metadata";
import { describe, expect, it } from "vitest";
import {
  buildKnownIccProfile,
  buildKnownXmpData,
  buildMinimalWebP,
} from "../fixtures/binary";

function readRiffChunks(
  webp: Uint8Array,
): Array<{ id: string; size: number; data: Uint8Array }> {
  const view = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  const chunks: Array<{ id: string; size: number; data: Uint8Array }> = [];
  let pos = 12;
  while (pos + 8 <= webp.length) {
    const id = String.fromCharCode(
      webp[pos],
      webp[pos + 1],
      webp[pos + 2],
      webp[pos + 3],
    );
    const size = view.getUint32(pos + 4, true);
    const paddedSize = size + (size % 2);
    if (pos + 8 + paddedSize > webp.length) break;
    const data = webp.slice(pos + 8, pos + 8 + size);
    chunks.push({ id, size, data });
    pos += 8 + paddedSize;
  }
  return chunks;
}

function readRiffFileSize(webp: Uint8Array): number {
  const view = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  return view.getUint32(4, true);
}

describe("injectMetadataIntoWebP — guard conditions", () => {
  it("returns original bytes unchanged for non-RIFF data", () => {
    const notWebP = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const result = injectMetadataIntoWebP(
      notWebP,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
      100,
      100,
    );
    expect(result).toBe(notWebP);
  });

  it("returns original bytes unchanged when all metadata is null/empty", () => {
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );
    expect(result).toBe(webp);
  });
});

describe("injectMetadataIntoWebP — structure validity", () => {
  it("output starts with RIFF....WEBP signature", () => {
    const icc = buildKnownIccProfile();
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );

    expect(
      String.fromCharCode(result[0], result[1], result[2], result[3]),
    ).toBe("RIFF");
    expect(
      String.fromCharCode(result[8], result[9], result[10], result[11]),
    ).toBe("WEBP");
  });

  it("RIFF file size field matches actual payload size", () => {
    const icc = buildKnownIccProfile();
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );

    const reportedSize = readRiffFileSize(result);
    expect(result.length).toBe(8 + reportedSize);
  });

  it("VP8X chunk appears as first chunk after injection", () => {
    const icc = buildKnownIccProfile();
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    expect(chunks[0].id).toBe("VP8X");
  });

  it("VP8X chunk has exactly 10 bytes of data", () => {
    const icc = buildKnownIccProfile();
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    const vp8x = chunks.find((c) => c.id === "VP8X");
    expect(vp8x?.size).toBe(10);
  });
});

describe("injectMetadataIntoWebP — metadata flags and positioning", () => {
  it("sets ICC flag (bit 5) in VP8X flags byte when ICC is present", () => {
    const icc = buildKnownIccProfile();
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    const vp8x = chunks.find((c) => c.id === "VP8X")!;
    expect(vp8x.data[0] & 0x20).toBe(0x20);
  });

  it("sets EXIF flag (bit 3) in VP8X flags when EXIF bytes are present", () => {
    const exif = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc: null, xmp: null, iptc: null },
      exif,
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    const vp8x = chunks.find((c) => c.id === "VP8X")!;
    expect(vp8x.data[0] & 0x08).toBe(0x08);
  });

  it("sets XMP flag (bit 2) in VP8X flags when XMP is present", () => {
    const xmp = buildKnownXmpData();
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc: null, xmp, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    const vp8x = chunks.find((c) => c.id === "VP8X")!;
    expect(vp8x.data[0] & 0x04).toBe(0x04);
  });

  it("ICCP chunk appears immediately after VP8X when ICC is present", () => {
    const icc = buildKnownIccProfile();
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    expect(chunks[0].id).toBe("VP8X");
    expect(chunks[1].id).toBe("ICCP");
  });

  it("EXIF chunk appears after image data", () => {
    const exif = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc: null, xmp: null, iptc: null },
      exif,
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    const exifIdx = chunks.findIndex((c) => c.id === "EXIF");
    const vp8Idx = chunks.findIndex((c) => c.id === "VP8 ");
    expect(exifIdx).toBeGreaterThan(vp8Idx);
  });

  it("XMP and IPTC chunks appear after EXIF chunk", () => {
    const xmp = buildKnownXmpData();
    const iptc = new Uint8Array([1, 2, 3]);
    const exif = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc: null, xmp, iptc },
      exif,
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    const exifIdx = chunks.findIndex((c) => c.id === "EXIF");
    const xmpIdx = chunks.findIndex((c) => c.id === "XMP ");
    const iptcIdx = chunks.findIndex((c) => c.id === "IPTC");
    expect(xmpIdx).toBeGreaterThan(exifIdx);
    expect(iptcIdx).toBeGreaterThan(xmpIdx);
  });

  it("width/height stored correctly in VP8X header (little-endian, stored as value-1)", () => {
    const icc = buildKnownIccProfile();
    const webp = buildMinimalWebP();
    const W = 100;
    const H = 200;
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      W,
      H,
    );

    const chunks = readRiffChunks(result);
    const vp8x = chunks.find((c) => c.id === "VP8X")!;
    const storedW = vp8x.data[4] | (vp8x.data[5] << 8) | (vp8x.data[6] << 16);
    const storedH = vp8x.data[7] | (vp8x.data[8] << 8) | (vp8x.data[9] << 16);
    expect(storedW).toBe(W - 1);
    expect(storedH).toBe(H - 1);
  });

  it("all injected chunk data bytes are intact and unmodified", () => {
    const icc = buildKnownIccProfile();
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );

    const chunks = readRiffChunks(result);
    const iccp = chunks.find((c) => c.id === "ICCP")!;
    expect(Array.from(iccp.data)).toEqual(Array.from(icc));
  });

  it("chunks with odd-length data have a zero padding byte", () => {
    const oddData = new Uint8Array([0x01, 0x02, 0x03]);
    const webp = buildMinimalWebP();
    const result = injectMetadataIntoWebP(
      webp,
      { icc: null, xmp: null, iptc: null },
      oddData,
      1,
      1,
    );
    expect(result.length % 2).toBe(0);
  });

  it("returns original bytes for RIFF data without WEBP brand (line 707)", () => {
    const riffNotWebP = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x46,
    ]);
    const result = injectMetadataIntoWebP(
      riffNotWebP,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );
    expect(result).toBe(riffNotWebP);
  });

  it("handles chunk size overflow by breaking loop (line 729)", () => {
    const webp = new Uint8Array(20);
    webp[0] = 0x52;
    webp[1] = 0x49;
    webp[2] = 0x46;
    webp[3] = 0x46;
    const view = new DataView(webp.buffer);
    view.setUint32(4, 12, true);
    webp[8] = 0x57;
    webp[9] = 0x45;
    webp[10] = 0x42;
    webp[11] = 0x50;
    // chunk at pos 12 with size larger than remaining bytes
    webp[12] = 0x56;
    webp[13] = 0x50;
    webp[14] = 0x38;
    webp[15] = 0x20;
    view.setUint32(16, 100, true); // size 100 > remaining 4 bytes
    const result = injectMetadataIntoWebP(
      webp,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
      1,
      1,
    );
    expect(result).toBe(webp);
  });

  it("detects alpha from VP8L chunk flag (line 738)", () => {
    const vp8lData = new Uint8Array([0x2f, 0x00, 0x00, 0x00, 0x10]);
    const chunkParts: Array<{ id: string; data: Uint8Array }> = [
      { id: "VP8L", data: vp8lData },
    ];
    let totalChunkSize = 4;
    for (const c of chunkParts)
      totalChunkSize += 8 + c.data.length + (c.data.length % 2);
    const webp = new Uint8Array(8 + totalChunkSize);
    const view = new DataView(webp.buffer);
    webp[0] = 0x52;
    webp[1] = 0x49;
    webp[2] = 0x46;
    webp[3] = 0x46;
    view.setUint32(4, totalChunkSize, true);
    webp[8] = 0x57;
    webp[9] = 0x45;
    webp[10] = 0x42;
    webp[11] = 0x50;
    let offset = 12;
    for (const c of chunkParts) {
      for (let i = 0; i < 4; i++) webp[offset++] = c.id.charCodeAt(i);
      view.setUint32(offset, c.data.length, true);
      offset += 4;
      webp.set(c.data, offset);
      offset += c.data.length;
      if (c.data.length % 2 !== 0) webp[offset++] = 0;
    }
    const exif = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
    const result = injectMetadataIntoWebP(
      webp,
      { icc: null, xmp: null, iptc: null },
      exif,
      1,
      1,
    );
    const chunks = readRiffChunks(result);
    const vp8x = chunks.find((c) => c.id === "VP8X");
    expect(vp8x).toBeDefined();
    expect(vp8x!.data[0] & 0x10).toBe(0x10);
  });

  it("returns nulls for RIFF data without WEBP brand in extract (line 1013)", () => {
    const riffNotWebP = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x46,
    ]);
    const meta = extractMetadataFromWebP(riffNotWebP);
    expect(meta).toEqual({ icc: null, xmp: null, iptc: null });
  });

  it("returns nulls for WebP shorter than 12 bytes (line 1003)", () => {
    const shortWebp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45]);
    const meta = extractMetadataFromWebP(shortWebp);
    expect(meta).toEqual({ icc: null, xmp: null, iptc: null });
  });

  it("breaks on chunk size overflow (line 1031)", () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x14, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x49, 0x43, 0x43, 0x50, 0xf4, 0x01, 0x00, 0x00,
    ]);
    const meta = extractMetadataFromWebP(webp);
    expect(meta).toEqual({ icc: null, xmp: null, iptc: null });
  });
});

describe("injectMetadataIntoWebP ALPH/ANIM coverage", () => {
  it("sets alpha flag from ALPH chunk (line 736)", () => {
    const vp8Data = new Uint8Array([
      0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00,
      0x34, 0x25, 0xa4, 0x00, 0x03, 0x70, 0x00, 0xfe, 0xfb, 0x94, 0x00, 0x00,
    ]);
    const alphData = new Uint8Array([0x01, 0x02]);
    const webpSize = 12 + 8 + vp8Data.length + 8 + alphData.length;
    const webp = new Uint8Array(8 + webpSize);
    const view = new DataView(webp.buffer);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    view.setUint32(4, webpSize, true);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    let offset = 12;
    webp.set([0x41, 0x4c, 0x50, 0x48], offset);
    view.setUint32(offset + 4, alphData.length, true);
    webp.set(alphData, offset + 8);
    offset += 8 + alphData.length;
    webp.set([0x56, 0x50, 0x38, 0x20], offset);
    view.setUint32(offset + 4, vp8Data.length, true);
    webp.set(vp8Data, offset + 8);

    const icc = buildKnownIccProfile();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      100,
      200,
    );
    const vp8xChunk = readRiffChunks(result).find((c) => c.id === "VP8X");
    expect(vp8xChunk).toBeDefined();
    expect(vp8xChunk!.data[0]).toBe(WEBP_CONSTANTS.FLAG_ALPHA | WEBP_CONSTANTS.FLAG_ICC);
  });

  it("handles WebP with existing VP8X chunk (line 741)", () => {
    const vp8Data = new Uint8Array([
      0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00,
      0x34, 0x25, 0xa4, 0x00, 0x03, 0x70, 0x00, 0xfe, 0xfb, 0x94, 0x00, 0x00,
    ]);
    const vp8xData = new Uint8Array(10);
    vp8xData[0] = 0x00;
    const webpSize = 12 + 8 + vp8xData.length + 8 + vp8Data.length;
    const webp = new Uint8Array(8 + webpSize);
    const view = new DataView(webp.buffer);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    view.setUint32(4, webpSize, true);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    let offset = 12;
    webp.set([0x56, 0x50, 0x38, 0x58], offset);
    view.setUint32(offset + 4, vp8xData.length, true);
    webp.set(vp8xData, offset + 8);
    offset += 8 + vp8xData.length;
    webp.set([0x56, 0x50, 0x38, 0x20], offset);
    view.setUint32(offset + 4, vp8Data.length, true);
    webp.set(vp8Data, offset + 8);

    const icc = buildKnownIccProfile();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      100,
      200,
    );
    const vp8xChunk = readRiffChunks(result).find((c) => c.id === "VP8X");
    expect(vp8xChunk).toBeDefined();
  });

  it("sets animation flag from ANIM chunk (line 737, 758)", () => {
    const vp8Data = new Uint8Array([
      0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00,
      0x34, 0x25, 0xa4, 0x00, 0x03, 0x70, 0x00, 0xfe, 0xfb, 0x94, 0x00, 0x00,
    ]);
    const animData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    const webpSize = 12 + 8 + animData.length + 8 + vp8Data.length;
    const webp = new Uint8Array(8 + webpSize);
    const view = new DataView(webp.buffer);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    view.setUint32(4, webpSize, true);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    let offset = 12;
    webp.set([0x41, 0x4e, 0x49, 0x4d], offset);
    view.setUint32(offset + 4, animData.length, true);
    webp.set(animData, offset + 8);
    offset += 8 + animData.length;
    webp.set([0x56, 0x50, 0x38, 0x20], offset);
    view.setUint32(offset + 4, vp8Data.length, true);
    webp.set(vp8Data, offset + 8);

    const icc = buildKnownIccProfile();
    const result = injectMetadataIntoWebP(
      webp,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
      100,
      200,
    );
    const vp8xChunk = readRiffChunks(result).find((c) => c.id === "VP8X");
    expect(vp8xChunk).toBeDefined();
    expect(vp8xChunk!.data[0]).toBe(WEBP_CONSTANTS.FLAG_ANIMATION | WEBP_CONSTANTS.FLAG_ICC);
  });
});
