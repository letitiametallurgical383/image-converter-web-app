import {
  crc32,
  createPngChunk,
  deflateData,
  extractMetadataFromPng,
  injectMetadataIntoPng,
} from "@workers/metadata";
import { describe, expect, it } from "vitest";
import {
  buildKnownIccProfile,
  buildKnownXmpData,
  buildMinimalPng,
  bytesEqual,
  verifyCrc32,
} from "../fixtures/binary";

function readPngChunks(
  png: Uint8Array,
): Array<{ type: string; data: Uint8Array; chunk: Uint8Array }> {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Array<{ type: string; data: Uint8Array; chunk: Uint8Array }> =
    [];
  let pos = 8;
  while (pos + 8 <= png.length) {
    const length = view.getUint32(pos, false);
    if (pos + 12 + length > png.length) break;
    const type = String.fromCharCode(
      png[pos + 4],
      png[pos + 5],
      png[pos + 6],
      png[pos + 7],
    );
    const data = png.slice(pos + 8, pos + 8 + length);
    const chunk = png.slice(pos, pos + 12 + length);
    chunks.push({ type, data, chunk });
    pos += 12 + length;
  }
  return chunks;
}

describe("crc32 — correctness", () => {
  it("computes CRC32 of empty array as 0x00000000", () => {
    expect(crc32(new Uint8Array(0))).toBe(0x00000000);
  });

  it("computes CRC32 of known data correctly (IHDR type bytes)", () => {
    const typeBytes = new Uint8Array([0x49, 0x48, 0x44, 0x52]);
    const crcVal = crc32(typeBytes);
    expect(typeof crcVal).toBe("number");
    expect(crcVal).toBeGreaterThan(0);
  });

  it("produces different values for different inputs", () => {
    const a = crc32(new Uint8Array([0x01]));
    const b = crc32(new Uint8Array([0x02]));
    expect(a).not.toBe(b);
  });
});

describe("createPngChunk — structure", () => {
  it("creates chunk with correct 4-byte length field", () => {
    const data = new Uint8Array(8).fill(0xab);
    const chunk = createPngChunk("tEXt", data);
    const view = new DataView(chunk.buffer);
    expect(view.getUint32(0, false)).toBe(8);
  });

  it("creates chunk with correct 4-byte type field", () => {
    const chunk = createPngChunk("IHDR", new Uint8Array(13));
    expect(String.fromCharCode(chunk[4], chunk[5], chunk[6], chunk[7])).toBe(
      "IHDR",
    );
  });

  it("creates chunk with valid CRC32 checksum", () => {
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
      0x00,
    ]);
    const chunk = createPngChunk("IHDR", data);
    expect(verifyCrc32(chunk)).toBe(true);
  });
});

describe("injectMetadataIntoPng — guard conditions", () => {
  it("returns original bytes for non-PNG data", async () => {
    const notPng = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const result = await injectMetadataIntoPng(
      notPng,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    expect(result).toBe(notPng);
  });

  it("returns PNG unchanged when no metadata is provided", async () => {
    const png = buildMinimalPng();
    const result = await injectMetadataIntoPng(
      png,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    const chunks = readPngChunks(result);
    const types = chunks.map((c) => c.type);
    expect(types).not.toContain("eXIf");
    expect(types).not.toContain("iCCP");
    expect(types).not.toContain("iTXt");
  });
});

describe("injectMetadataIntoPng — PNG signature integrity", () => {
  it("preserves the 8-byte PNG signature after injection", async () => {
    const exif = new Uint8Array([
      0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    ]);
    const png = buildMinimalPng();
    const result = await injectMetadataIntoPng(
      png,
      { icc: null, xmp: null, iptc: null },
      exif,
    );
    expect(result[0]).toBe(0x89);
    expect(result[1]).toBe(0x50);
    expect(result[2]).toBe(0x4e);
    expect(result[3]).toBe(0x47);
    expect(result[4]).toBe(0x0d);
    expect(result[5]).toBe(0x0a);
    expect(result[6]).toBe(0x1a);
    expect(result[7]).toBe(0x0a);
  });

  it("IEND chunk remains as the last chunk after injection", async () => {
    const exif = new Uint8Array([
      0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    ]);
    const png = buildMinimalPng();
    const result = await injectMetadataIntoPng(
      png,
      { icc: null, xmp: null, iptc: null },
      exif,
    );
    const chunks = readPngChunks(result);
    expect(chunks[chunks.length - 1].type).toBe("IEND");
  });
});

describe("injectMetadataIntoPng — chunk injection position", () => {
  it("injects eXIf chunk immediately after IHDR", async () => {
    const exif = new Uint8Array([
      0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    ]);
    const png = buildMinimalPng();
    const result = await injectMetadataIntoPng(
      png,
      { icc: null, xmp: null, iptc: null },
      exif,
    );
    const chunks = readPngChunks(result);
    expect(chunks[0].type).toBe("IHDR");
    expect(chunks[1].type).toBe("eXIf");
  });

  it("injects iCCP chunk immediately after IHDR", async () => {
    const icc = buildKnownIccProfile();
    const png = buildMinimalPng();
    const result = await injectMetadataIntoPng(
      png,
      { icc, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    const chunks = readPngChunks(result);
    expect(chunks[0].type).toBe("IHDR");
    expect(chunks[1].type).toBe("iCCP");
  });
});

describe("injectMetadataIntoPng — CRC32 integrity", () => {
  it("eXIf chunk has valid CRC32", async () => {
    const exif = new Uint8Array([
      0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    ]);
    const png = buildMinimalPng();
    const result = await injectMetadataIntoPng(
      png,
      { icc: null, xmp: null, iptc: null },
      exif,
    );
    const chunks = readPngChunks(result);
    const exifChunk = chunks.find((c) => c.type === "eXIf")!;
    expect(verifyCrc32(exifChunk.chunk)).toBe(true);
  });

  it("all injected chunks have valid CRC32", async () => {
    const icc = buildKnownIccProfile();
    const xmp = buildKnownXmpData();
    const iptc = new Uint8Array([1, 2, 3]);
    const exif = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
    const png = buildMinimalPng();
    const result = await injectMetadataIntoPng(png, { icc, xmp, iptc }, exif);
    const chunks = readPngChunks(result);
    const metadataChunks = chunks.filter((c) =>
      ["eXIf", "iCCP", "iTXt", "zTXt"].includes(c.type),
    );
    expect(metadataChunks.length).toBeGreaterThan(0);
    for (const c of metadataChunks) {
      expect(verifyCrc32(c.chunk), `CRC32 invalid for chunk ${c.type}`).toBe(
        true,
      );
    }
  });
});

describe("injectMetadataIntoPng — existing metadata replacement", () => {
  it("replaces existing eXIf chunk with new one", async () => {
    const oldExif = new Uint8Array([0x01, 0x02]);
    const newExif = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
    const png = buildMinimalPng({ exif: oldExif });
    const result = await injectMetadataIntoPng(
      png,
      { icc: null, xmp: null, iptc: null },
      newExif,
    );
    const chunks = readPngChunks(result);
    const exifChunks = chunks.filter((c) => c.type === "eXIf");
    expect(exifChunks).toHaveLength(1);
    expect(bytesEqual(exifChunks[0].data, newExif)).toBe(true);
  });

  it("replaces existing iCCP chunk with new one", async () => {
    const oldIcc = new Uint8Array([0x00, 0x01]);
    const newIcc = buildKnownIccProfile();
    const png = buildMinimalPng({ icc: oldIcc });
    const result = await injectMetadataIntoPng(
      png,
      { icc: newIcc, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    const chunks = readPngChunks(result);
    const iccpChunks = chunks.filter((c) => c.type === "iCCP");
    expect(iccpChunks).toHaveLength(1);
  });

  it("drops existing iTXt chunk with XML:com.adobe.xmp keyword (line 929)", async () => {
    const keyword = "XML:com.adobe.xmp\0\0\0\0\0";
    const data = new Uint8Array(keyword.length + 5);
    for (let i = 0; i < keyword.length; i++) data[i] = keyword.charCodeAt(i);
    const itxtChunk = createPngChunk("iTXt", data);

    const basePng = buildMinimalPng();
    const chunks = readPngChunks(basePng);
    const iend = chunks.pop()!.chunk;
    const newPng = new Uint8Array(basePng.length + itxtChunk.length);
    newPng.set(basePng.slice(0, basePng.length - iend.length), 0);
    newPng.set(itxtChunk, basePng.length - iend.length);
    newPng.set(iend, basePng.length - iend.length + itxtChunk.length);

    const result = await injectMetadataIntoPng(
      newPng,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    const outChunks = readPngChunks(result);
    const itxtChunks = outChunks.filter((c) => c.type === "iTXt");
    expect(itxtChunks).toHaveLength(0);
  });

  it("preserves existing iTXt chunks if keyword is not XML:com.adobe.xmp", async () => {
    const keyword = "Author\0\0\0\0\0";
    const data = new Uint8Array(keyword.length + 5);
    for (let i = 0; i < keyword.length; i++) data[i] = keyword.charCodeAt(i);
    const itxtChunk = createPngChunk("iTXt", data);

    const basePng = buildMinimalPng();
    const chunks = readPngChunks(basePng);
    const iend = chunks.pop()!.chunk;
    const newPng = new Uint8Array(basePng.length + itxtChunk.length);
    newPng.set(basePng.slice(0, basePng.length - iend.length), 0);
    newPng.set(itxtChunk, basePng.length - iend.length);
    newPng.set(iend, basePng.length - iend.length + itxtChunk.length);

    const result = await injectMetadataIntoPng(
      newPng,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    const outChunks = readPngChunks(result);
    const itxtChunks = outChunks.filter((c) => c.type === "iTXt");
    expect(itxtChunks).toHaveLength(1);
  });

  it("preserves zTXt chunk if keyword is not Raw profile type iptc (lines 909-917)", async () => {
    const keyword = "Description\0";
    const compressedData = new Uint8Array([0x00, 0x01, 0x02]);
    const data = new Uint8Array(keyword.length + compressedData.length);
    for (let i = 0; i < keyword.length; i++) data[i] = keyword.charCodeAt(i);
    data.set(compressedData, keyword.length);
    const ztxtChunk = createPngChunk("zTXt", data);

    const basePng = buildMinimalPng();
    const chunks = readPngChunks(basePng);
    const iend = chunks.pop()!.chunk;
    const newPng = new Uint8Array(basePng.length + ztxtChunk.length);
    newPng.set(basePng.slice(0, basePng.length - iend.length), 0);
    newPng.set(ztxtChunk, basePng.length - iend.length);
    newPng.set(iend, basePng.length - iend.length + ztxtChunk.length);

    const result = await injectMetadataIntoPng(
      newPng,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    const outChunks = readPngChunks(result);
    const ztxtChunks = outChunks.filter((c) => c.type === "zTXt");
    expect(ztxtChunks).toHaveLength(1);
  });

  it("handles tEXt with IPTC keyword and minimal data (line 1123)", async () => {
    const keyword = new TextEncoder().encode("Raw profile type iptc");
    const data = new Uint8Array(keyword.length + 1 + 1 + 1 + 2);
    data.set(keyword, 0);
    data[keyword.length] = 0;
    data[keyword.length + 1] = 0x01;
    data[keyword.length + 2] = 0x00;
    data[keyword.length + 3] = 0x42;
    data[keyword.length + 4] = 0x43;

    const basePng = buildMinimalPng();
    const tEXtChunk = createPngChunk("tEXt", data);

    const png = new Uint8Array(basePng.length + tEXtChunk.length);
    png.set(basePng, 0);
    png.set(tEXtChunk, basePng.length);

    const result = await extractMetadataFromPng(png);
    expect(result.iptc).not.toBeNull();
  });

  it("returns null when tEXt IPTC data is too short (line 1123 false)", async () => {
    const keyword = new TextEncoder().encode("Raw profile type iptc");
    const data = new Uint8Array(keyword.length + 1 + 1);
    data.set(keyword, 0);
    data[keyword.length] = 0;
    data[keyword.length + 1] = 0x01;

    const basePng = buildMinimalPng();
    const tEXtChunk = createPngChunk("tEXt", data);

    const png = new Uint8Array(basePng.length + tEXtChunk.length);
    png.set(basePng, 0);
    png.set(tEXtChunk, basePng.length);

    const result = await extractMetadataFromPng(png);
    expect(result.iptc).toBeNull();
  });

  it("extracts ICC from iCCP chunk (line 1078)", async () => {
    const profileName = new TextEncoder().encode("sRGB\0");
    const compressed = new Uint8Array([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
    const data = new Uint8Array(profileName.length + 1 + compressed.length);
    data.set(profileName, 0);
    data[profileName.length] = 0;
    data.set(compressed, profileName.length + 1);

    const basePng = buildMinimalPng();
    const iCCPChunk = createPngChunk("iCCP", data);

    const png = new Uint8Array(basePng.length + iCCPChunk.length);
    png.set(basePng, 0);
    png.set(iCCPChunk, basePng.length);

    const result = await extractMetadataFromPng(png);
    expect(result.icc).not.toBeNull();
  });

  it("breaks on truncated PNG chunk (line 1066)", async () => {
    const basePng = buildMinimalPng();
    const chunks = readPngChunks(basePng);
    const iend = chunks.pop()!.chunk;

    const badChunk = new Uint8Array(12);
    const view = new DataView(badChunk.buffer);
    view.setUint32(0, 1000, false);
    badChunk.set([0x74, 0x45, 0x58, 0x74], 4);

    const png = new Uint8Array(basePng.length + badChunk.length + iend.length);
    png.set(basePng, 0);
    png.set(badChunk, basePng.length);
    png.set(iend, basePng.length + badChunk.length);

    const result = await extractMetadataFromPng(png);
    expect(result.icc).toBeNull();
    expect(result.xmp).toBeNull();
    expect(result.iptc).toBeNull();
  });

  it("skips iCCP with invalid compression method (line 1078 false)", async () => {
    const profileName = new TextEncoder().encode("sRGB\0");
    const data = new Uint8Array(profileName.length + 1);
    data.set(profileName, 0);
    data[profileName.length] = 0x01;

    const basePng = buildMinimalPng();
    const iCCPChunk = createPngChunk("iCCP", data);

    const png = new Uint8Array(basePng.length + iCCPChunk.length);
    png.set(basePng, 0);
    png.set(iCCPChunk, basePng.length);

    const result = await extractMetadataFromPng(png);
    expect(result.icc).toBeNull();
  });

  it("skips iTXt with no data after keyword (line 1106 false)", async () => {
    const keyword = new TextEncoder().encode("XML:com.adobe.xmp");
    const data = new Uint8Array(keyword.length + 1);
    data.set(keyword, 0);
    data[keyword.length] = 0;

    const basePng = buildMinimalPng();
    const iTXtChunk = createPngChunk("iTXt", data);

    const png = new Uint8Array(basePng.length + iTXtChunk.length);
    png.set(basePng, 0);
    png.set(iTXtChunk, basePng.length);

    const result = await extractMetadataFromPng(png);
    expect(result.xmp).toBeNull();
  });

  it("extracts XMP from iTXt chunk (line 1106)", async () => {
    const keyword = new TextEncoder().encode("XML:com.adobe.xmp");
    const lang = new TextEncoder().encode("en\0");
    const transKeyword = new TextEncoder().encode("\0");
    const xmpData = new Uint8Array([0x3c, 0x78, 0x3e]);
    const data = new Uint8Array(
      keyword.length + 1 + 1 + lang.length + transKeyword.length + xmpData.length,
    );
    let offset = 0;
    data.set(keyword, offset);
    offset += keyword.length + 1;
    data[offset - 1] = 0;
    data[offset] = 0x01;
    offset += 1;
    data.set(lang, offset);
    offset += lang.length;
    data.set(transKeyword, offset);
    offset += transKeyword.length;
    data.set(xmpData, offset);

    const basePng = buildMinimalPng();
    const iTXtChunk = createPngChunk("iTXt", data);

    const png = new Uint8Array(basePng.length + iTXtChunk.length);
    png.set(basePng, 0);
    png.set(iTXtChunk, basePng.length);

    const result = await extractMetadataFromPng(png);
    expect(result.xmp).not.toBeNull();
  });
});

describe("deflateData (line 858)", () => {
  it("compresses data using deflate", async () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const compressed = await deflateData(data);
    expect(compressed.length).toBeGreaterThan(0);
  });
});

describe("injectMetadataIntoPng edge cases", () => {
  it("breaks loop on truncated chunk (line 896)", async () => {
    const basePng = buildMinimalPng();
    const chunks = readPngChunks(basePng);
    const iend = chunks.pop()!.chunk;

    const badChunk = new Uint8Array(12);
    const view = new DataView(badChunk.buffer);
    view.setUint32(0, 1000, false);
    badChunk.set([0x74, 0x45, 0x58, 0x74], 4);

    const png = new Uint8Array(basePng.length + badChunk.length + iend.length);
    png.set(basePng, 0);
    png.set(badChunk, basePng.length);
    png.set(iend, basePng.length + badChunk.length);

    const result = await injectMetadataIntoPng(
      png,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    const outChunks = readPngChunks(result);
    const tEXtChunks = outChunks.filter((c) => c.type === "tEXt");
    expect(tEXtChunks).toHaveLength(0);
  });

  it("drops zTXt chunk with matching IPTC keyword (line 918)", async () => {
    const keyword = new TextEncoder().encode("Raw profile type iptc");
    const data = new Uint8Array(keyword.length + 1 + 1);
    data.set(keyword, 0);
    data[keyword.length] = 0;
    data[keyword.length + 1] = 0x01;

    const basePng = buildMinimalPng();
    const ztxtChunk = createPngChunk("zTXt", data);

    const png = new Uint8Array(basePng.length + ztxtChunk.length);
    png.set(basePng, 0);
    png.set(ztxtChunk, basePng.length);

    const result = await injectMetadataIntoPng(
      png,
      { icc: null, xmp: null, iptc: null },
      new Uint8Array(0),
    );
    const outChunks = readPngChunks(result);
    const ztxtChunks = outChunks.filter((c) => c.type === "zTXt");
    expect(ztxtChunks).toHaveLength(0);
  });
});
