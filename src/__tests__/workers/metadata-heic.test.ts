import { extractMetadataFromHeic } from "@workers/metadata";
import { describe, expect, it } from "vitest";

function makeBox(type: string, data: Uint8Array): Uint8Array {
  const len = 8 + data.length;
  const box = new Uint8Array(len);
  const view = new DataView(box.buffer);
  view.setUint32(0, len, false);
  for (let i = 0; i < 4; i++) box[4 + i] = type.charCodeAt(i);
  box.set(data, 8);
  return box;
}

describe("extractMetadataFromHeic", () => {
  it("returns nulls for empty array", () => {
    const meta = extractMetadataFromHeic(new Uint8Array([]));
    expect(meta).toEqual({ icc: null, xmp: null, iptc: null });
  });

  it("extracts ICC profile from colr box in meta/iprp/ipco", () => {
    const iccData = new Uint8Array([0x01, 0x02, 0x03]);
    const colrSize = 12 + iccData.length;
    const colr = new Uint8Array(colrSize);
    const colrView = new DataView(colr.buffer);
    colrView.setUint32(0, colrSize, false);
    colr.set([0x63, 0x6f, 0x6c, 0x72], 4);
    colr.set([0x70, 0x72, 0x6f, 0x66], 8);
    colr.set(iccData, 12);

    const ipcoSize = 8 + colr.length;
    const ipco = new Uint8Array(ipcoSize);
    const ipcoView = new DataView(ipco.buffer);
    ipcoView.setUint32(0, ipcoSize, false);
    ipco.set([0x69, 0x70, 0x63, 0x6f], 4);
    ipco.set(colr, 8);

    const iprpSize = 8 + ipco.length;
    const iprp = new Uint8Array(iprpSize);
    const iprpView = new DataView(iprp.buffer);
    iprpView.setUint32(0, iprpSize, false);
    iprp.set([0x69, 0x70, 0x72, 0x70], 4);
    iprp.set(ipco, 8);

    const metaSize = 12 + iprp.length;
    const metaBox = new Uint8Array(metaSize);
    const metaView = new DataView(metaBox.buffer);
    metaView.setUint32(0, metaSize, false);
    metaBox.set([0x6d, 0x65, 0x74, 0x61], 4);
    metaView.setUint32(8, 0, false);
    metaBox.set(iprp, 12);

    const heic = new Uint8Array(metaBox.length);
    heic.set(metaBox);

    const extracted = extractMetadataFromHeic(heic);
    expect(extracted.icc).toEqual(iccData);
  });

  it("extracts XMP from uuid box", () => {
    const xmpData = new Uint8Array([0x3c, 0x78, 0x3e]);
    const uuid = [
      0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94,
      0x91, 0xe3, 0xaf, 0xac,
    ];
    const boxSize = 24 + xmpData.length;
    const box = new Uint8Array(boxSize);
    const view = new DataView(box.buffer);
    view.setUint32(0, boxSize, false);
    box.set([0x75, 0x75, 0x69, 0x64], 4);
    box.set(uuid, 8);
    box.set(xmpData, 24);

    const extracted = extractMetadataFromHeic(box);
    expect(extracted.xmp).toEqual(xmpData);
  });

  it("handles 64-bit box sizes (size = 1)", () => {
    const box = new Uint8Array(24);
    const view = new DataView(box.buffer);
    view.setUint32(0, 1, false);
    box.set([0x6d, 0x64, 0x69, 0x61], 4);
    view.setUint32(8, 0, false);
    view.setUint32(12, 24, false);

    const extracted = extractMetadataFromHeic(box);
    expect(extracted.xmp).toBeNull();
  });

  it("extracts IPTC from infe/idat items", () => {
    const ftyp = new Uint8Array([
      0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
      0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
    ]);

    const meta = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x6d, 0x65, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
    ]);

    const iprp = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x69, 0x70, 0x72, 0x70,
    ]);

    const ipco = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x69, 0x70, 0x63, 0x6f,
    ]);

    const colr = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x63, 0x6f, 0x6c, 0x72, 0x70, 0x72, 0x6f, 0x66,
      0x01, 0x02, 0x03, 0x04,
    ]);

    const colrLen = colr.length;
    const colrSize = new Uint8Array([
      (colrLen >> 24) & 0xff,
      (colrLen >> 16) & 0xff,
      (colrLen >> 8) & 0xff,
      colrLen & 0xff,
    ]);
    colr.set(colrSize, 0);

    const ipcoLen = ipco.length + colr.length;
    const ipcoSize = new Uint8Array([
      (ipcoLen >> 24) & 0xff,
      (ipcoLen >> 16) & 0xff,
      (ipcoLen >> 8) & 0xff,
      ipcoLen & 0xff,
    ]);
    ipco.set(ipcoSize, 0);

    const iprpLen = iprp.length + ipco.length;
    const iprpSize = new Uint8Array([
      (iprpLen >> 24) & 0xff,
      (iprpLen >> 16) & 0xff,
      (iprpLen >> 8) & 0xff,
      iprpLen & 0xff,
    ]);
    iprp.set(iprpSize, 0);

    const metaLen = meta.length + iprp.length;
    const metaSize = new Uint8Array([
      (metaLen >> 24) & 0xff,
      (metaLen >> 16) & 0xff,
      (metaLen >> 8) & 0xff,
      metaLen & 0xff,
    ]);
    meta.set(metaSize, 0);

    const file = new Uint8Array([...ftyp, ...meta, ...iprp, ...ipco, ...colr]);
    const result = extractMetadataFromHeic(file);

    expect(result.icc).not.toBeNull();
    expect(result.icc?.length).toBe(4);
  });

  it("handles 64-bit box sizes", () => {
    const ftyp = new Uint8Array([
      0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
      0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
    ]);

    const box = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x66, 0x74, 0x79, 0x70,
    ]);

    const size64 = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const file = new Uint8Array([...ftyp, ...box, ...size64]);
    const result = extractMetadataFromHeic(file);

    expect(result.icc).toBeNull();
    expect(result.xmp).toBeNull();
    expect(result.iptc).toBeNull();
  });

  it("handles box with size 0 inside meta (line 380)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const infeData = new Uint8Array([
      0x6d, 0x69, 0x6d, 0x65,
      0x69, 0x70, 0x74, 0x63, 0x00,
    ]);

    const infeBox = new Uint8Array(8 + infeData.length);
    const infeView = new DataView(infeBox.buffer);
    infeView.setUint32(0, 0, false);
    infeBox.set([0x69, 0x6e, 0x66, 0x65], 4);
    infeBox.set(infeData, 8);

    const iinf = makeBox("iinf", new Uint8Array(infeBox));

    const idatData = new Uint8Array([0x1c, 0x02, 0x00, 0x00, 0x00, 0x01, ...new Array(20).fill(0x42)]);
    const idat = makeBox("idat", idatData);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iinf, ...idat]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).not.toBeNull();
  });

  it("handles meta without ipco (line 260 false)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const iprpData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const iprp = makeBox("iprp", iprpData);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iprp]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.icc).toBeNull();
  });

  it("handles size 0 box inside meta (line 362)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const iprpData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const iprp = makeBox("iprp", iprpData);

    const other = new Uint8Array(8);
    other.set([0x00, 0x00, 0x00, 0x00], 0);
    other.set([0x69, 0x69, 0x6e, 0x66], 4);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...other, ...iprp]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.icc).toBeNull();
  });

  it("handles size 0 box inside ipco (line 270)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const colr = new Uint8Array(8);
    colr.set([0x00, 0x00, 0x00, 0x00], 0);
    colr.set([0x63, 0x6f, 0x6c, 0x72], 4);

    const ipco = makeBox("ipco", new Uint8Array(colr));

    const iprp = new Uint8Array(8 + ipco.length);
    const iprpView = new DataView(iprp.buffer);
    iprpView.setUint32(0, iprp.length, false);
    iprp.set([0x69, 0x70, 0x72, 0x70], 4);
    iprp.set(ipco, 8);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iprp]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.icc).toBeNull();
  });

  it("skips infe with non-mime item type (line 402 false)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const infeData = new Uint8Array([
      0x68, 0x76, 0x63, 0x31,
      0x00,
    ]);
    const infe = makeBox("infe", infeData);
    const iinf = makeBox("iinf", new Uint8Array(infe));

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iinf]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).toBeNull();
  });

  it("skips non-infe box inside iinf (line 386 false)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const otherData = new Uint8Array([0x01, 0x02]);
    const other = makeBox("infc", otherData);
    const iinf = makeBox("iinf", new Uint8Array(other));

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iinf]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).toBeNull();
  });

  it("skips infe with non-iptc mime name (line 408 false)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const infeData = new Uint8Array([
      0x6d, 0x69, 0x6d, 0x65,
      0x65, 0x78, 0x69, 0x66, 0x00,
    ]);
    const infe = makeBox("infe", infeData);
    const iinf = makeBox("iinf", new Uint8Array(infe));

    const idatData = new Uint8Array([0x1c, 0x02, 0x00, 0x00, 0x00, 0x01, ...new Array(20).fill(0x42)]);
    const idat = makeBox("idat", idatData);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iinf, ...idat]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).toBeNull();
  });

  it("skips infe when idat is missing (line 416 false)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const infeData = new Uint8Array([
      0x6d, 0x69, 0x6d, 0x65,
      0x69, 0x70, 0x74, 0x63, 0x00,
    ]);
    const infe = makeBox("infe", infeData);
    const iinf = makeBox("iinf", new Uint8Array(infe));

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iinf]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).toBeNull();
  });

  it("skips idat with invalid IPTC data (line 418 false)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const infeData = new Uint8Array([
      0x6d, 0x69, 0x6d, 0x65,
      0x69, 0x70, 0x74, 0x63, 0x00,
    ]);
    const infe = makeBox("infe", infeData);
    const iinf = makeBox("iinf", new Uint8Array(infe));

    const idatData = new Uint8Array([0x00, 0x00]);
    const idat = makeBox("idat", idatData);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iinf, ...idat]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).toBeNull();
  });

  it("extracts IPTC from infe/idat items (lines 396-419)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const infeData = new Uint8Array([
      0x6d,
      0x69,
      0x6d,
      0x65, // "mime" at box offset 8
      0x69,
      0x70,
      0x74,
      0x63,
      0x00, // "iptc\0"
    ]);
    const infe = makeBox("infe", infeData);

    const iinf = makeBox("iinf", new Uint8Array(infe));

    const idatData = new Uint8Array([
      0x1c,
      0x02,
      0x00,
      0x00,
      0x00,
      0x01,
      ...new Array(20).fill(0x42),
    ]);
    const idat = makeBox("idat", idatData);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iinf, ...idat]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).not.toBeNull();
    expect(result.iptc?.length).toBeGreaterThan(0);
  });

  it("skips non-matching colr type in ipco (line 264)", () => {
    const iccData = new Uint8Array([0x01, 0x02, 0x03]);
    const colrSize = 12 + iccData.length;
    const colr = new Uint8Array(colrSize);
    const colrView = new DataView(colr.buffer);
    colrView.setUint32(0, colrSize, false);
    colr.set([0x63, 0x6f, 0x6c, 0x72], 4);
    colr.set([0x6e, 0x63, 0x6c, 0x78], 8); // "nclx" (non-matching)
    colr.set(iccData, 12);

    const ipcoSize = 8 + colr.length;
    const ipco = new Uint8Array(ipcoSize);
    const ipcoView = new DataView(ipco.buffer);
    ipcoView.setUint32(0, ipcoSize, false);
    ipco.set([0x69, 0x70, 0x63, 0x6f], 4);
    ipco.set(colr, 8);

    const iprpSize = 8 + ipco.length;
    const iprp = new Uint8Array(iprpSize);
    const iprpView = new DataView(iprp.buffer);
    iprpView.setUint32(0, iprpSize, false);
    iprp.set([0x69, 0x70, 0x72, 0x70], 4);
    iprp.set(ipco, 8);

    const metaSize = 12 + iprp.length;
    const metaBox = new Uint8Array(metaSize);
    const metaView = new DataView(metaBox.buffer);
    metaView.setUint32(0, metaSize, false);
    metaBox.set([0x6d, 0x65, 0x74, 0x61], 4);
    metaView.setUint32(8, 0, false);
    metaBox.set(iprp, 12);

    const heic = new Uint8Array(metaBox.length);
    heic.set(metaBox);

    const extracted = extractMetadataFromHeic(heic);
    expect(extracted.icc).toBeNull();
  });

  it("breaks on invalid infe size inside iinf (line 385)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    // Create an infe with size = 1 (invalid, less than 8)
    const invalidInfe = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x69, 0x6e, 0x66, 0x65,
    ]);
    const iinf = makeBox("iinf", new Uint8Array(invalidInfe));

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iinf]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).toBeNull();
  });

  it("extracts raw IPTC with multiple records (lines 449-467)", () => {
    const rawIptc = new Uint8Array([
      // First record: header(5) + data(5)
      0x1c, 0x02, 0x00, 0x00, 0x05, 0x41, 0x42, 0x43, 0x44, 0x45,
      // Second record: header(5) + data(5)
      0x1c, 0x02, 0x01, 0x00, 0x05, 0x46, 0x47, 0x48, 0x49, 0x4a,
    ]);

    const result = extractMetadataFromHeic(rawIptc);
    expect(result.iptc).not.toBeNull();
    expect(result.iptc?.length).toBeGreaterThan(10);
  });

  it("skips non-XMP uuid box (lines 322-323)", () => {
    const xmpData = new Uint8Array([0x3c, 0x78, 0x3e]);
    const nonXmpUuid = [
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ];
    const boxSize = 24 + xmpData.length;
    const box = new Uint8Array(boxSize);
    const view = new DataView(box.buffer);
    view.setUint32(0, boxSize, false);
    box.set([0x75, 0x75, 0x69, 0x64], 4);
    box.set(nonXmpUuid, 8);
    box.set(xmpData, 24);

    const extracted = extractMetadataFromHeic(box);
    expect(extracted.xmp).toBeNull();
  });

  it("handles extended box size = 1 inside meta (line 364)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    // Child box with extended size inside meta
    const child = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x69, 0x6e, 0x66, 0x6f, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...child]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.icc).toBeNull();
    expect(result.xmp).toBeNull();
    expect(result.iptc).toBeNull();
  });

  it("breaks IPTC loop on non-matching record (line 467)", () => {
    const rawIptc = new Uint8Array([
      // First record: header(5) + data(5)
      0x1c, 0x02, 0x00, 0x00, 0x05, 0x41, 0x42, 0x43, 0x44, 0x45,
      // Second record: header(5) + data(5)
      0x1c, 0x02, 0x01, 0x00, 0x05, 0x46, 0x47, 0x48, 0x49, 0x4a,
      // Garbage that doesn't match record marker (5 bytes so end+3 < len)
      0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const result = extractMetadataFromHeic(rawIptc);
    expect(result.iptc).not.toBeNull();
    expect(result.iptc?.length).toBeGreaterThan(10);
  });

  it("skips invalid IPTC record in while loop (line 456)", () => {
    const rawIptc = new Uint8Array([
      0x1c, 0x02, 0x00, 0x00, 0x05,
      0x41, 0x42, 0x43, 0x44, 0x45,
      // Invalid record: marker valid but r2 = 0x00 (out of range, min is 1)
      0x1c, 0x00, 0x01, 0x00, 0x05,
      0x46, 0x47, 0x48, 0x49, 0x4a,
    ]);

    const result = extractMetadataFromHeic(rawIptc);
    expect(result.iptc).toBeNull();
  });

  it("skips raw IPTC when end >= arr.length (line 444 false)", () => {
    const rawIptc = new Uint8Array([
      0x1c, 0x02, 0x00, 0x00, 0x00,
    ]);

    const result = extractMetadataFromHeic(rawIptc);
    expect(result.iptc).toBeNull();
  });

  it("skips IPTC data smaller than MIN_VALID_SIZE (line 469)", () => {
    const rawIptc = new Uint8Array([
      0x1c, 0x02, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const result = extractMetadataFromHeic(rawIptc);
    expect(result.iptc).toBeNull();
  });

  it("extracts raw IPTC from byte scan fallback (lines 434-470)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    // Valid IPTC block: marker(1) + record(1) + dataset(1) + len(2) + data
    // dsLen=10 => end = i + 5 + 10 = 15, end - i = 15 > MIN_VALID_SIZE(10)
    const rawIptc = new Uint8Array([
      0x1c, 0x02, 0x00, 0x00, 0x0a, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47,
      0x48, 0x49, 0x4a,
    ]);

    const tail = new Uint8Array(20);
    const file = new Uint8Array(ftyp.length + tail.length + rawIptc.length);
    file.set(ftyp, 0);
    file.set(tail, ftyp.length);
    file.set(rawIptc, ftyp.length + tail.length);

    const result = extractMetadataFromHeic(file);
    expect(result.iptc).not.toBeNull();
    expect(result.iptc?.length).toBeGreaterThan(0);
  });

  it("breaks on box size < 8 inside ipco (line 271)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const badBox = new Uint8Array(8);
    const badView = new DataView(badBox.buffer);
    badView.setUint32(0, 4, false);
    badBox.set([0x63, 0x6f, 0x6c, 0x72], 4);

    const ipco = makeBox("ipco", new Uint8Array(badBox));

    const iprp = new Uint8Array(8 + ipco.length);
    const iprpView = new DataView(iprp.buffer);
    iprpView.setUint32(0, iprp.length, false);
    iprp.set([0x69, 0x70, 0x72, 0x70], 4);
    iprp.set(ipco, 8);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iprp]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.icc).toBeNull();
  });

  it("skips colr box smaller than COLR_DATA_OFFSET (line 272)", () => {
    const ftyp = makeBox(
      "ftyp",
      new Uint8Array([
        0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
      ]),
    );

    const colr = new Uint8Array(8);
    const colrView = new DataView(colr.buffer);
    colrView.setUint32(0, 8, false);
    colr.set([0x63, 0x6f, 0x6c, 0x72], 4);

    const ipco = makeBox("ipco", new Uint8Array(colr));

    const iprp = new Uint8Array(8 + ipco.length);
    const iprpView = new DataView(iprp.buffer);
    iprpView.setUint32(0, iprp.length, false);
    iprp.set([0x69, 0x70, 0x72, 0x70], 4);
    iprp.set(ipco, 8);

    const metaData = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...iprp]);
    const meta = makeBox("meta", metaData);

    const file = new Uint8Array(ftyp.length + meta.length);
    file.set(ftyp, 0);
    file.set(meta, ftyp.length);

    const result = extractMetadataFromHeic(file);
    expect(result.icc).toBeNull();
  });
});
