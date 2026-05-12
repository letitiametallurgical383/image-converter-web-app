import { crc32, createPngChunk } from "@workers/metadata";

export interface JpegBuildOptions {
  icc?: Uint8Array;
  xmp?: Uint8Array;
  iptc?: Uint8Array;
  exifOrientation?: number;
}

export function buildKnownIccProfile(): Uint8Array {
  const data = new Uint8Array(4);
  data[0] = 0x61;
  data[1] = 0x63;
  data[2] = 0x73;
  data[3] = 0x70;
  return data;
}

export function buildKnownXmpData(): Uint8Array {
  const xml = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:creator>TestAuthor</dc:creator>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const header = "http://ns.adobe.com/xap/1.0/\0";
  const headerBytes = new Uint8Array(header.length);
  for (let i = 0; i < header.length; i++) headerBytes[i] = header.charCodeAt(i);
  const xmlBytes = new TextEncoder().encode(xml);
  const result = new Uint8Array(headerBytes.length + xmlBytes.length);
  result.set(headerBytes, 0);
  result.set(xmlBytes, headerBytes.length);
  return result;
}

export function buildKnownIptcData(): Uint8Array {
  const payload = new Uint8Array([
    0x38, 0x42, 0x49, 0x4d, 0x04, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06,
    0x54, 0x65, 0x73, 0x74, 0x49, 0x64,
  ]);
  return payload;
}

export function buildMinimalJpeg(opts: JpegBuildOptions = {}): Uint8Array {
  const parts: Uint8Array[] = [];

  parts.push(new Uint8Array([0xff, 0xd8]));

  if (opts.icc) {
    const ICC_HEADER = "ICC_PROFILE\0";
    const MAX_CHUNK = 65519;
    const totalChunks = Math.ceil(opts.icc.length / MAX_CHUNK);
    for (let i = 0; i < totalChunks; i++) {
      const chunk = opts.icc.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK);
      const segBodyLen = 2 + 12 + 1 + 1 + chunk.length;
      const seg = new Uint8Array(2 + segBodyLen);
      seg[0] = 0xff;
      seg[1] = 0xe2;
      seg[2] = (segBodyLen >> 8) & 0xff;
      seg[3] = segBodyLen & 0xff;
      for (let j = 0; j < 12; j++) seg[4 + j] = ICC_HEADER.charCodeAt(j);
      seg[16] = i + 1;
      seg[17] = totalChunks;
      seg.set(chunk, 18);
      parts.push(seg);
    }
  }

  if (opts.xmp) {
    const segBodyLen = 2 + opts.xmp.length;
    const seg = new Uint8Array(2 + segBodyLen);
    seg[0] = 0xff;
    seg[1] = 0xe1;
    seg[2] = (segBodyLen >> 8) & 0xff;
    seg[3] = segBodyLen & 0xff;
    seg.set(opts.xmp, 4);
    parts.push(seg);
  }

  if (opts.iptc) {
    const header = "Photoshop 3.0\0";
    const headerBytes = new Uint8Array(header.length);
    for (let i = 0; i < header.length; i++)
      headerBytes[i] = header.charCodeAt(i);
    const fullIptc = new Uint8Array(headerBytes.length + opts.iptc.length);
    fullIptc.set(headerBytes, 0);
    fullIptc.set(opts.iptc, headerBytes.length);

    const segBodyLen = 2 + fullIptc.length;
    const seg = new Uint8Array(2 + segBodyLen);
    seg[0] = 0xff;
    seg[1] = 0xed;
    seg[2] = (segBodyLen >> 8) & 0xff;
    seg[3] = segBodyLen & 0xff;
    seg.set(fullIptc, 4);
    parts.push(seg);
  }

  parts.push(new Uint8Array([0xff, 0xd9]));

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }
  return result;
}

export function buildMinimalPng(
  opts: { exif?: Uint8Array; icc?: Uint8Array; xmp?: Uint8Array } = {},
): Uint8Array {
  const signature = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, 1, false);
  ihdrView.setUint32(4, 1, false);
  ihdrData[8] = 8;
  ihdrData[9] = 2;

  const ihdrChunk = createPngChunk("IHDR", ihdrData);

  const idatData = new Uint8Array([0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0xff]);
  const idatChunk = createPngChunk("IDAT", idatData);

  const iendChunk = createPngChunk("IEND", new Uint8Array(0));

  const parts: Uint8Array[] = [signature, ihdrChunk];

  if (opts.exif) {
    parts.push(createPngChunk("eXIf", opts.exif));
  }
  if (opts.icc) {
    const profileName = "icc";
    const prefix = new Uint8Array(profileName.length + 2);
    for (let i = 0; i < profileName.length; i++)
      prefix[i] = profileName.charCodeAt(i);
    prefix[profileName.length] = 0;
    prefix[profileName.length + 1] = 0;
    const iccpData = new Uint8Array(prefix.length + opts.icc.length);
    iccpData.set(prefix, 0);
    iccpData.set(opts.icc, prefix.length);
    parts.push(createPngChunk("iCCP", iccpData));
  }

  parts.push(idatChunk, iendChunk);

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }
  return result;
}

export function buildMinimalWebP(
  opts: { exif?: Uint8Array; icc?: Uint8Array } = {},
): Uint8Array {
  const vp8Data = new Uint8Array([
    0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00,
    0x34, 0x25, 0xa4, 0x00, 0x03, 0x70, 0x00, 0xfe, 0xfb, 0x94, 0x00, 0x00,
  ]);

  const chunkParts: Array<{ id: string; data: Uint8Array }> = [];
  chunkParts.push({ id: "VP8 ", data: vp8Data });
  if (opts.icc) chunkParts.push({ id: "ICCP", data: opts.icc });
  if (opts.exif) chunkParts.push({ id: "EXIF", data: opts.exif });

  let totalChunkSize = 4;
  for (const c of chunkParts)
    totalChunkSize += 8 + c.data.length + (c.data.length % 2);

  const result = new Uint8Array(8 + totalChunkSize);
  const view = new DataView(result.buffer);
  result[0] = 0x52;
  result[1] = 0x49;
  result[2] = 0x46;
  result[3] = 0x46;
  view.setUint32(4, totalChunkSize, true);
  result[8] = 0x57;
  result[9] = 0x45;
  result[10] = 0x42;
  result[11] = 0x50;

  let offset = 12;
  for (const c of chunkParts) {
    for (let i = 0; i < 4; i++) result[offset++] = c.id.charCodeAt(i);
    view.setUint32(offset, c.data.length, true);
    offset += 4;
    result.set(c.data, offset);
    offset += c.data.length;
    if (c.data.length % 2 !== 0) result[offset++] = 0;
  }

  return result;
}

export function buildMinimalAvif(): Uint8Array {
  const ftypData = new Uint8Array([
    0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00, 0x61, 0x76, 0x69, 0x66,
    0x6d, 0x69, 0x66, 0x31,
  ]);
  const ftypSize = 8 + ftypData.length;
  const result = new Uint8Array(ftypSize);
  const view = new DataView(result.buffer);
  view.setUint32(0, ftypSize, false);
  result[4] = 0x66;
  result[5] = 0x74;
  result[6] = 0x79;
  result[7] = 0x70;
  result.set(ftypData, 8);
  return result;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function verifyCrc32(chunk: Uint8Array): boolean {
  if (chunk.length < 12) return false;
  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  const dataLen = view.getUint32(0, false);
  if (chunk.length < 12 + dataLen) return false;
  const typeAndData = chunk.slice(4, 8 + dataLen);
  const storedCrc = view.getUint32(8 + dataLen, false);
  const computed = crc32(typeAndData);
  return storedCrc === computed;
}
