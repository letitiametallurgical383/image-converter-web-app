import {
  buildIccApp2Segments,
  extractMetadataFromJpeg,
  injectMetadataIntoJpeg,
  isSrgbProfile,
} from "@workers/metadata";
import { describe, expect, it } from "vitest";
import {
  buildKnownIccProfile,
  buildKnownIptcData,
  buildKnownXmpData,
  buildMinimalJpeg,
  bytesEqual,
} from "../fixtures/binary";

describe("extractMetadataFromJpeg — extraction correctness", () => {
  it("returns all-null when JPEG has no metadata segments", () => {
    const jpeg = buildMinimalJpeg();
    const meta = extractMetadataFromJpeg(jpeg);
    expect(meta.icc).toBeNull();
    expect(meta.xmp).toBeNull();
    expect(meta.iptc).toBeNull();
  });

  it("returns null for non-JPEG bytes (wrong SOI)", () => {
    const notJpeg = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const meta = extractMetadataFromJpeg(notJpeg);
    expect(meta.icc).toBeNull();
    expect(meta.xmp).toBeNull();
    expect(meta.iptc).toBeNull();
  });

  it("correctly extracts ICC profile from JPEG APP2 segment", () => {
    const icc = buildKnownIccProfile();
    const jpeg = buildMinimalJpeg({ icc });
    const meta = extractMetadataFromJpeg(jpeg);
    expect(meta.icc).not.toBeNull();
    expect(bytesEqual(meta.icc!, icc)).toBe(true);
  });

  it("correctly extracts XMP data from JPEG APP1 segment", () => {
    const xmp = buildKnownXmpData();
    const jpeg = buildMinimalJpeg({ xmp });
    const meta = extractMetadataFromJpeg(jpeg);
    expect(meta.xmp).not.toBeNull();
    expect(bytesEqual(meta.xmp!, xmp)).toBe(true);
  });

  it("correctly extracts IPTC data from JPEG APP13 segment", () => {
    const iptc = buildKnownIptcData();
    const jpeg = buildMinimalJpeg({ iptc });
    const meta = extractMetadataFromJpeg(jpeg);
    expect(meta.iptc).not.toBeNull();
    expect(bytesEqual(meta.iptc!, iptc)).toBe(true);
  });

  it("extracts all three metadata types simultaneously from the same JPEG", () => {
    const icc = buildKnownIccProfile();
    const xmp = buildKnownXmpData();
    const iptc = buildKnownIptcData();
    const jpeg = buildMinimalJpeg({ icc, xmp, iptc });
    const meta = extractMetadataFromJpeg(jpeg);
    expect(bytesEqual(meta.icc!, icc)).toBe(true);
    expect(bytesEqual(meta.xmp!, xmp)).toBe(true);
    expect(bytesEqual(meta.iptc!, iptc)).toBe(true);
  });

  it("breaks on non-marker byte (line 93)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0xff, 0xd9]);
    const meta = extractMetadataFromJpeg(jpeg);
    expect(meta).toEqual({ icc: null, xmp: null, iptc: null });
  });

  it("returns false for non-sRGB ICC profile (line 73 false)", () => {
    const icc = new Uint8Array(200);
    const view = new DataView(icc.buffer);
    icc[0] = 0x64; icc[1] = 0x65; icc[2] = 0x73; icc[3] = 0x63;
    view.setUint32(8, 0, false);
    const str = new TextEncoder().encode("Adobe RGB");
    icc.set(str, 12);
    view.setUint32(128, 1, false);
    icc[132] = 0x64; icc[133] = 0x65; icc[134] = 0x73; icc[135] = 0x63;
    view.setUint32(136, 0, false);
    view.setUint32(140, 200, false);
    const result = isSrgbProfile(icc);
    expect(result).toBe(false);
  });

  it("breaks when entryOffset exceeds profile size (line 31)", () => {
    const icc = new Uint8Array(140);
    const view = new DataView(icc.buffer);
    view.setUint32(128, 1, false);
    icc[132] = 0x64;
    icc[133] = 0x65;
    icc[134] = 0x73;
    icc[135] = 0x63;
    const result = isSrgbProfile(icc);
    expect(result).toBe(false);
  });

  it("breaks when tag data exceeds profile size (line 48)", () => {
    const icc = new Uint8Array(200);
    const view = new DataView(icc.buffer);
    view.setUint32(128, 1, false);
    icc[132] = 0x64;
    icc[133] = 0x65;
    icc[134] = 0x73;
    icc[135] = 0x63;
    view.setUint32(136, 0, false);
    view.setUint32(140, 250, false);
    const result = isSrgbProfile(icc);
    expect(result).toBe(false);
  });

  it("skips desc tag with non-matching type signature (line 56 false)", () => {
    const icc = new Uint8Array(200);
    const view = new DataView(icc.buffer);
    icc[0] = 0x41;
    icc[1] = 0x42;
    icc[2] = 0x43;
    icc[3] = 0x44;
    view.setUint32(128, 1, false);
    icc[132] = 0x64;
    icc[133] = 0x65;
    icc[134] = 0x73;
    icc[135] = 0x63;
    view.setUint32(136, 0, false);
    view.setUint32(140, 200, false);
    const result = isSrgbProfile(icc);
    expect(result).toBe(false);
  });

  it("skips desc tag with maxLen <= 0 (line 67)", () => {
    const icc = new Uint8Array(200);
    const view = new DataView(icc.buffer);
    icc[0] = 0x64;
    icc[1] = 0x65;
    icc[2] = 0x73;
    icc[3] = 0x63;
    view.setUint32(8, 0, false);
    view.setUint32(128, 1, false);
    icc[132] = 0x64;
    icc[133] = 0x65;
    icc[134] = 0x73;
    icc[135] = 0x63;
    view.setUint32(136, 0, false);
    view.setUint32(140, 12, false);
    const result = isSrgbProfile(icc);
    expect(result).toBe(false);
  });
});

describe("buildIccApp2Segments — multi-chunk ICC building", () => {
  it("builds a single APP2 segment for small ICC profile", () => {
    const icc = buildKnownIccProfile();
    const seg = buildIccApp2Segments(icc);
    expect(seg[0]).toBe(0xff);
    expect(seg[1]).toBe(0xe2);
  });

  it("stores sequence number 1 and total chunks 1 for single-chunk ICC", () => {
    const icc = buildKnownIccProfile();
    const seg = buildIccApp2Segments(icc);
    expect(seg[16]).toBe(1);
    expect(seg[17]).toBe(1);
  });

  it("splits large ICC (>65519 bytes) into multiple chunks", () => {
    const icc = new Uint8Array(65520);
    icc.fill(0xaa);
    const seg = buildIccApp2Segments(icc);
    let offset = 0;
    const chunks: number[] = [];
    while (offset < seg.length) {
      expect(seg[offset]).toBe(0xff);
      expect(seg[offset + 1]).toBe(0xe2);
      const len = (seg[offset + 2] << 8) | seg[offset + 3];
      chunks.push(seg[offset + 16]);
      offset += 2 + len;
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toBe(1);
  });

  it("roundtrip: extract reassembles split ICC correctly", () => {
    const icc = new Uint8Array(70000);
    for (let i = 0; i < icc.length; i++) icc[i] = i % 256;

    const jpeg = buildMinimalJpeg({ icc });
    const meta = extractMetadataFromJpeg(jpeg);
    expect(meta.icc).not.toBeNull();
    expect(bytesEqual(meta.icc!, icc)).toBe(true);
  });
});

describe("injectMetadataIntoJpeg — injection correctness", () => {
  it("maintains JPEG SOI marker (FFD8) at start after injection", () => {
    const icc = buildKnownIccProfile();
    const jpeg = buildMinimalJpeg();
    const output = injectMetadataIntoJpeg(jpeg, { icc, xmp: null, iptc: null });
    expect(output[0]).toBe(0xff);
    expect(output[1]).toBe(0xd8);
  });

  it("maintains JPEG EOI marker (FFD9) at end after injection", () => {
    const icc = buildKnownIccProfile();
    const jpeg = buildMinimalJpeg();
    const output = injectMetadataIntoJpeg(jpeg, { icc, xmp: null, iptc: null });
    expect(output[output.length - 2]).toBe(0xff);
    expect(output[output.length - 1]).toBe(0xd9);
  });

  it("injected ICC can be re-extracted and is identical", () => {
    const icc = buildKnownIccProfile();
    const jpeg = buildMinimalJpeg();
    const injected = injectMetadataIntoJpeg(jpeg, {
      icc,
      xmp: null,
      iptc: null,
    });
    const meta = extractMetadataFromJpeg(injected);
    expect(meta.icc).not.toBeNull();
    expect(bytesEqual(meta.icc!, icc)).toBe(true);
  });

  it("injected XMP can be re-extracted and is identical", () => {
    const xmp = buildKnownXmpData();
    const jpeg = buildMinimalJpeg();
    const injected = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp,
      iptc: null,
    });
    const meta = extractMetadataFromJpeg(injected);
    expect(meta.xmp).not.toBeNull();
    expect(bytesEqual(meta.xmp!, xmp)).toBe(true);
  });

  it("injected IPTC can be re-extracted and is identical", () => {
    const iptc = buildKnownIptcData();
    const jpeg = buildMinimalJpeg();
    const injected = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc,
    });
    const meta = extractMetadataFromJpeg(injected);
    expect(meta.iptc).not.toBeNull();
    expect(bytesEqual(meta.iptc!, iptc)).toBe(true);
  });

  it("all three metadata types survive inject → extract roundtrip", () => {
    const icc = buildKnownIccProfile();
    const xmp = buildKnownXmpData();
    const iptc = buildKnownIptcData();
    const jpeg = buildMinimalJpeg();

    const injected = injectMetadataIntoJpeg(jpeg, { icc, xmp, iptc });
    const meta = extractMetadataFromJpeg(injected);

    expect(bytesEqual(meta.icc!, icc)).toBe(true);
    expect(bytesEqual(meta.xmp!, xmp)).toBe(true);
    expect(bytesEqual(meta.iptc!, iptc)).toBe(true);
  });

  it("removes pre-existing metadata segments before injecting new ones", () => {
    const originalIcc = buildKnownIccProfile();
    const jpeg = buildMinimalJpeg({ icc: originalIcc });

    const newIcc = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const injected = injectMetadataIntoJpeg(jpeg, {
      icc: newIcc,
      xmp: null,
      iptc: null,
    });
    const meta = extractMetadataFromJpeg(injected);

    expect(bytesEqual(meta.icc!, newIcc)).toBe(true);
    expect(meta.icc!.length).toBe(4);
  });

  it("injects nothing and leaves JPEG structure intact when all metadata is null", () => {
    const jpeg = buildMinimalJpeg();
    const output = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc: null,
    });
    const meta = extractMetadataFromJpeg(output);
    expect(meta.icc).toBeNull();
    expect(meta.xmp).toBeNull();
    expect(meta.iptc).toBeNull();
  });

  it("double roundtrip produces identical result (idempotency)", () => {
    const icc = buildKnownIccProfile();
    const xmp = buildKnownXmpData();
    const jpeg = buildMinimalJpeg();

    const first = injectMetadataIntoJpeg(jpeg, { icc, xmp, iptc: null });
    const firstMeta = extractMetadataFromJpeg(first);
    const second = injectMetadataIntoJpeg(first, {
      icc: firstMeta.icc!,
      xmp: firstMeta.xmp!,
      iptc: null,
    });
    const secondMeta = extractMetadataFromJpeg(second);

    expect(bytesEqual(secondMeta.icc!, icc)).toBe(true);
    expect(bytesEqual(secondMeta.xmp!, xmp)).toBe(true);
  });

  it("preserves APP13 segment if it does not match Photoshop 3.0 header", () => {
    const app13Len = 2 + 5;
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xed,
      (app13Len >> 8) & 0xff,
      app13Len & 0xff,
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0xff,
      0xd9,
    ]);
    const output = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc: null,
    });

    expect(output.length).toBe(jpeg.length);
    let hasApp13 = false;
    for (let i = 0; i < output.length - 1; i++) {
      if (output[i] === 0xff && output[i + 1] === 0xed) hasApp13 = true;
    }
    expect(hasApp13).toBe(true);
  });

  it("preserves APP2 segment if it does not match ICC header (lines 609-610)", () => {
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
    const output = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc: null,
    });

    let hasApp2 = false;
    for (let i = 0; i < output.length - 1; i++) {
      if (output[i] === 0xff && output[i + 1] === 0xe2) hasApp2 = true;
    }
    expect(hasApp2).toBe(true);
  });

  it("preserves APP1 segment if it does not match XMP header (lines 626-627)", () => {
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
    const output = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc: null,
    });

    let hasApp1 = false;
    for (let i = 0; i < output.length - 1; i++) {
      if (output[i] === 0xff && output[i + 1] === 0xe1) hasApp1 = true;
    }
    expect(hasApp1).toBe(true);
  });

  it("preserves APP13 segment with long enough body but non-Photoshop header (lines 637-647)", () => {
    const header = "Photoshop 3.0\0";
    const app13Len = 2 + header.length + 2;
    const body = new Uint8Array(header.length + 2);
    body[0] = 0x50; // 'P' matches, but rest differs
    body[1] = 0x00;
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xed,
      (app13Len >> 8) & 0xff,
      app13Len & 0xff,
      ...body,
      0xff,
      0xd9,
    ]);
    const output = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc: null,
    });

    let hasApp13 = false;
    for (let i = 0; i < output.length - 1; i++) {
      if (output[i] === 0xff && output[i + 1] === 0xed) hasApp13 = true;
    }
    expect(hasApp13).toBe(true);
  });

  it("drops APP13 segment with matching Photoshop header (line 648)", () => {
    const header = new TextEncoder().encode("Photoshop 3.0\0");
    const body = new Uint8Array(header.length + 5);
    body.set(header, 0);
    const app13Len = 2 + body.length;
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xed,
      (app13Len >> 8) & 0xff, app13Len & 0xff,
      ...body,
      0xff, 0xd9,
    ]);
    const output = injectMetadataIntoJpeg(jpeg, {
      icc: null,
      xmp: null,
      iptc: null,
    });

    let hasApp13 = false;
    for (let i = 0; i < output.length - 1; i++) {
      if (output[i] === 0xff && output[i + 1] === 0xed) hasApp13 = true;
    }
    expect(hasApp13).toBe(false);
  });
});
