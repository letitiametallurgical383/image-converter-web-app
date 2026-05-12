import {
  AVIF_CONSTANTS,
  HEIC_CONSTANTS,
  ICC_PROFILE_CONSTANTS,
  IPTC_CONSTANTS,
  JPEG_CONSTANTS,
  PNG_CONSTANTS,
  WEBP_CONSTANTS,
} from "./binaryConstants";

export interface ExtractedMetadata {
  icc: Uint8Array | null;
  xmp: Uint8Array | null;
  iptc: Uint8Array | null;
}

export function isSrgbProfile(icc: Uint8Array): boolean {
  if (icc.length < ICC_PROFILE_CONSTANTS.MIN_PROFILE_SIZE) return false;
  const view = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
  const tagCount = view.getUint32(
    ICC_PROFILE_CONSTANTS.TAG_TABLE_SIZE_OFFSET,
    false,
  );
  if (tagCount === 0 || tagCount > ICC_PROFILE_CONSTANTS.MAX_TAG_COUNT)
    return false;

  for (let i = 0; i < tagCount; i++) {
    const entryOffset =
      ICC_PROFILE_CONSTANTS.TAG_ENTRY_START +
      i * ICC_PROFILE_CONSTANTS.TAG_ENTRY_SIZE;
    if (entryOffset + ICC_PROFILE_CONSTANTS.TAG_ENTRY_SIZE > icc.length) break;
    const sig = String.fromCharCode(
      icc[entryOffset],
      icc[entryOffset + 1],
      icc[entryOffset + 2],
      icc[entryOffset + 3],
    );
    if (sig !== ICC_PROFILE_CONSTANTS.DESC_SIGNATURE) continue;

    const tagOffset = view.getUint32(
      entryOffset + ICC_PROFILE_CONSTANTS.TAG_DATA_OFFSET,
      false,
    );
    const tagSize = view.getUint32(
      entryOffset + ICC_PROFILE_CONSTANTS.TAG_SIZE_OFFSET,
      false,
    );
    if (tagOffset + tagSize > icc.length) break;

    const typeSig = String.fromCharCode(
      icc[tagOffset],
      icc[tagOffset + 1],
      icc[tagOffset + 2],
      icc[tagOffset + 3],
    );
    if (typeSig === ICC_PROFILE_CONSTANTS.DESC_SIGNATURE) {
      const asciiOffset = view.getUint32(
        tagOffset + ICC_PROFILE_CONSTANTS.ASCII_OFFSET_POSITION,
        false,
      );
      const strStart =
        tagOffset + ICC_PROFILE_CONSTANTS.DESCRIPTION_START + asciiOffset;
      const maxLen = Math.min(
        ICC_PROFILE_CONSTANTS.MAX_DESCRIPTION_LENGTH,
        tagOffset + tagSize - strStart,
      );
      if (maxLen <= 0) continue;
      const bytes = icc.slice(strStart, strStart + maxLen);
      const str = new TextDecoder()
        .decode(bytes)
        .replace(/\0/g, "")
        .toLowerCase();
      if (str.includes("srgb") || str.includes("iec61966")) return true;
    }
  }

  return icc.length > 200 && icc.length < 1000;
}

export function extractMetadataFromJpeg(arr: Uint8Array): ExtractedMetadata {
  if (
    arr[0] !== JPEG_CONSTANTS.SOI_MARKER ||
    arr[1] !== JPEG_CONSTANTS.SOI_SECOND
  )
    return { icc: null, xmp: null, iptc: null };
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  const iccChunks: Array<{ seq: number; data: Uint8Array }> = [];
  const iptcChunks: Uint8Array[] = [];
  let xmp: Uint8Array | null = null;
  let pos = 2;

  while (pos + 3 < arr.length) {
    if (arr[pos] !== JPEG_CONSTANTS.MARKER_PREFIX) break;
    const marker = arr[pos + 1];
    if (
      marker === JPEG_CONSTANTS.SOS_MARKER ||
      marker === JPEG_CONSTANTS.EOI_MARKER
    )
      break;
    const segLen = view.getUint16(
      pos + JPEG_CONSTANTS.SEGMENT_LENGTH_OFFSET,
      false,
    );
    const segData = arr.slice(
      pos + JPEG_CONSTANTS.SEGMENT_DATA_OFFSET,
      pos + 2 + segLen,
    );

    if (marker === JPEG_CONSTANTS.APP2_MARKER && segLen >= 16) {
      let isIcc = true;
      for (let i = 0; i < 12; i++) {
        if (
          arr[pos + JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + i] !==
          JPEG_CONSTANTS.ICC_HEADER.charCodeAt(i)
        ) {
          isIcc = false;
          break;
        }
      }
      if (isIcc) {
        iccChunks.push({
          seq: arr[pos + JPEG_CONSTANTS.ICC_SEQUENCE_OFFSET],
          data: arr.slice(
            pos + JPEG_CONSTANTS.ICC_DATA_START,
            pos + 2 + segLen,
          ),
        });
      }
    }

    if (
      marker === JPEG_CONSTANTS.APP1_MARKER &&
      segLen >= JPEG_CONSTANTS.XMP_HEADER.length + 2
    ) {
      let match = true;
      for (let i = 0; i < JPEG_CONSTANTS.XMP_HEADER.length; i++) {
        if (
          arr[pos + JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + i] !==
          JPEG_CONSTANTS.XMP_HEADER.charCodeAt(i)
        ) {
          match = false;
          break;
        }
      }
      if (match) xmp = segData;
    }

    if (
      marker === JPEG_CONSTANTS.APP13_MARKER &&
      segLen >= JPEG_CONSTANTS.IPTC_HEADER.length + 2
    ) {
      let match = true;
      for (let i = 0; i < JPEG_CONSTANTS.IPTC_HEADER.length; i++) {
        if (
          arr[pos + JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + i] !==
          JPEG_CONSTANTS.IPTC_HEADER.charCodeAt(i)
        ) {
          match = false;
          break;
        }
      }
      if (match) {
        const iptcData = arr.slice(
          pos +
            JPEG_CONSTANTS.SEGMENT_DATA_OFFSET +
            JPEG_CONSTANTS.IPTC_HEADER.length,
          pos + 2 + segLen,
        );
        iptcChunks.push(iptcData);
      }
    }

    pos += 2 + segLen;
  }

  let icc: Uint8Array | null = null;
  if (iccChunks.length > 0) {
    iccChunks.sort((a, b) => a.seq - b.seq);
    const total = iccChunks.reduce((s, c) => s + c.data.length, 0);
    icc = new Uint8Array(total);
    let off = 0;
    for (const c of iccChunks) {
      icc.set(c.data, off);
      off += c.data.length;
    }
  }

  let iptc: Uint8Array | null = null;
  if (iptcChunks.length > 0) {
    const total = iptcChunks.reduce((s, c) => s + c.length, 0);
    iptc = new Uint8Array(total);
    let off = 0;
    for (const c of iptcChunks) {
      iptc.set(c, off);
      off += c.length;
    }
  }

  return { icc, xmp, iptc };
}

export function findIsobmffBox(
  arr: Uint8Array,
  view: DataView,
  parentStart: number,
  parentEnd: number,
  boxType: string,
): { start: number; end: number; dataStart: number } | null {
  let pos = parentStart;
  while (pos + 8 <= parentEnd) {
    let boxSize = view.getUint32(pos, false);
    const bType = String.fromCharCode(
      arr[pos + 4],
      arr[pos + 5],
      arr[pos + 6],
      arr[pos + 7],
    );
    if (boxSize === 0) boxSize = parentEnd - pos;
    if (boxSize === 1) {
      boxSize =
        view.getUint32(pos + 8, false) * 4294967296 +
        view.getUint32(pos + 12, false);
    }
    if (boxSize < 8) break;
    if (bType === boxType)
      return { start: pos, end: pos + boxSize, dataStart: pos + 8 };
    pos += boxSize;
  }
  return null;
}

export function extractMetadataFromHeic(arr: Uint8Array): ExtractedMetadata {
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  let icc: Uint8Array | null = null;
  let xmp: Uint8Array | null = null;

  const meta = findIsobmffBox(
    arr,
    view,
    0,
    arr.length,
    AVIF_CONSTANTS.META_TYPE,
  );
  if (meta) {
    const iprp = findIsobmffBox(
      arr,
      view,
      meta.dataStart + AVIF_CONSTANTS.META_VERSION_SIZE,
      meta.end,
      AVIF_CONSTANTS.IPRP_TYPE,
    );
    if (iprp) {
      const ipco = findIsobmffBox(
        arr,
        view,
        iprp.dataStart,
        iprp.end,
        AVIF_CONSTANTS.IPCO_TYPE,
      );
      if (ipco) {
        let pos = ipco.dataStart;
        while (pos + AVIF_CONSTANTS.BOX_HEADER_SIZE <= ipco.end) {
          let boxSize = view.getUint32(pos, false);
          const bType = String.fromCharCode(
            arr[pos + 4],
            arr[pos + 5],
            arr[pos + 6],
            arr[pos + 7],
          );
          if (boxSize === 0) boxSize = ipco.end - pos;
          if (boxSize < AVIF_CONSTANTS.BOX_HEADER_SIZE) break;
          if (
            bType === AVIF_CONSTANTS.COLR_TYPE &&
            boxSize >= AVIF_CONSTANTS.COLR_DATA_OFFSET
          ) {
            const colrType = String.fromCharCode(
              arr[pos + AVIF_CONSTANTS.COLR_TYPE_OFFSET],
              arr[pos + AVIF_CONSTANTS.COLR_TYPE_OFFSET + 1],
              arr[pos + AVIF_CONSTANTS.COLR_TYPE_OFFSET + 2],
              arr[pos + AVIF_CONSTANTS.COLR_TYPE_OFFSET + 3],
            );
            if (
              colrType === AVIF_CONSTANTS.COLR_PROF_TYPE ||
              colrType === AVIF_CONSTANTS.COLR_RICC_TYPE
            ) {
              icc = arr.slice(
                pos + AVIF_CONSTANTS.COLR_DATA_OFFSET,
                pos + boxSize,
              );
              break;
            }
          }
          pos += boxSize;
        }
      }
    }
  }

  let pos = 0;
  while (pos + AVIF_CONSTANTS.BOX_HEADER_SIZE <= arr.length) {
    let boxSize = view.getUint32(pos, false);
    const bType = String.fromCharCode(
      arr[pos + 4],
      arr[pos + 5],
      arr[pos + 6],
      arr[pos + 7],
    );
    if (boxSize === 0) boxSize = arr.length - pos;
    if (boxSize === AVIF_CONSTANTS.BOX_EXTENDED_SIZE)
      boxSize =
        view.getUint32(pos + 8, false) * 4294967296 +
        view.getUint32(pos + 12, false);
    if (boxSize < AVIF_CONSTANTS.BOX_HEADER_SIZE) break;

    if (bType === AVIF_CONSTANTS.UUID_TYPE && boxSize >= 24) {
      let match = true;
      for (let i = 0; i < 16; i++) {
        if (
          arr[pos + AVIF_CONSTANTS.BOX_HEADER_SIZE + i] !==
          AVIF_CONSTANTS.XMP_UUID[i]
        ) {
          match = false;
          break;
        }
      }
      if (match) {
        xmp = arr.slice(pos + 24, pos + boxSize);
        break;
      }
    }

    const containers = [
      AVIF_CONSTANTS.META_TYPE,
      "moov",
      "trak",
      "mdia",
      "minf",
      "stbl",
    ];
    if (containers.includes(bType)) {
      pos +=
        bType === AVIF_CONSTANTS.META_TYPE
          ? 12
          : AVIF_CONSTANTS.BOX_HEADER_SIZE;
      continue;
    }
    pos += boxSize;
  }

  let iptc: Uint8Array | null = null;
  if (meta) {
    const infeBoxes: Array<{ start: number; end: number }> = [];
    let mPos = meta.dataStart + AVIF_CONSTANTS.META_VERSION_SIZE;
    while (mPos + AVIF_CONSTANTS.BOX_HEADER_SIZE <= meta.end) {
      let boxSize = view.getUint32(mPos, false);
      const bType = String.fromCharCode(
        arr[mPos + 4],
        arr[mPos + 5],
        arr[mPos + 6],
        arr[mPos + 7],
      );
      if (boxSize === 0) boxSize = meta.end - mPos;
      if (boxSize === AVIF_CONSTANTS.BOX_EXTENDED_SIZE) {
        boxSize =
          view.getUint32(mPos + 8, false) * 4294967296 +
          view.getUint32(mPos + 12, false);
      }
      if (boxSize < AVIF_CONSTANTS.BOX_HEADER_SIZE || mPos + boxSize > meta.end)
        break;
      if (bType === HEIC_CONSTANTS.IINF_TYPE) {
        let iPos = mPos + AVIF_CONSTANTS.BOX_HEADER_SIZE;
        while (iPos + AVIF_CONSTANTS.BOX_HEADER_SIZE <= mPos + boxSize) {
          let iSize = view.getUint32(iPos, false);
          const iType = String.fromCharCode(
            arr[iPos + 4],
            arr[iPos + 5],
            arr[iPos + 6],
            arr[iPos + 7],
          );
          if (iSize === 0) iSize = mPos + boxSize - iPos;
          if (
            iSize < AVIF_CONSTANTS.BOX_HEADER_SIZE ||
            iPos + iSize > mPos + boxSize
          )
            break;
          if (iType === HEIC_CONSTANTS.INFE_TYPE) {
            infeBoxes.push({ start: iPos, end: iPos + iSize });
          }
          iPos += iSize;
        }
      }
      mPos += boxSize;
    }

    for (const infe of infeBoxes) {
      const itemType = String.fromCharCode(
        arr[infe.start + HEIC_CONSTANTS.MIME_TYPE_OFFSET],
        arr[infe.start + HEIC_CONSTANTS.MIME_TYPE_OFFSET + 1],
        arr[infe.start + HEIC_CONSTANTS.MIME_TYPE_OFFSET + 2],
        arr[infe.start + HEIC_CONSTANTS.MIME_TYPE_OFFSET + 3],
      );
      if (itemType === HEIC_CONSTANTS.MIME_TYPE) {
        let p = infe.start + HEIC_CONSTANTS.ITEM_NAME_START;
        while (p < infe.end && arr[p] !== 0) p++;
        const mimeStr = new TextDecoder()
          .decode(arr.slice(infe.start + HEIC_CONSTANTS.ITEM_NAME_START, p))
          .toLowerCase();
        if (mimeStr.includes("iptc") || mimeStr.includes("photometadata")) {
          const idat = findIsobmffBox(
            arr,
            view,
            meta.dataStart + AVIF_CONSTANTS.META_VERSION_SIZE,
            meta.end,
            HEIC_CONSTANTS.IDAT_TYPE,
          );
          if (idat && idat.end > idat.dataStart) {
            const data = arr.slice(idat.dataStart, idat.end);
            if (data.length > 2 && data[0] === IPTC_CONSTANTS.RECORD_MARKER) {
              iptc = data;
              break;
            }
          }
        }
      }
    }
  }

  if (!iptc) {
    for (let i = 0; i < arr.length - 3; i++) {
      if (
        arr[i] === IPTC_CONSTANTS.RECORD_MARKER &&
        (arr[i + 1] & 0x80) === 0 &&
        (arr[i + 2] & 0x80) === 0
      ) {
        const recNum = arr[i + 1];
        const dsNum = arr[i + 2];
        if (
          recNum >= IPTC_CONSTANTS.RECORD_MIN &&
          recNum <= IPTC_CONSTANTS.RECORD_MAX &&
          dsNum >= IPTC_CONSTANTS.DATASET_MIN &&
          dsNum <= IPTC_CONSTANTS.DATASET_MAX
        ) {
          let end = i + IPTC_CONSTANTS.HEADER_SIZE;
          if (end < arr.length) {
            const dsLen = (arr[end - 2] << 8) | arr[end - 1];
            end += dsLen;
          }
          while (end + 3 < arr.length) {
            if (
              arr[end] === IPTC_CONSTANTS.RECORD_MARKER &&
              (arr[end + 1] & 0x80) === 0 &&
              (arr[end + 2] & 0x80) === 0
            ) {
              const r2 = arr[end + 1];
              const d2 = arr[end + 2];
              if (
                r2 >= IPTC_CONSTANTS.RECORD_MIN &&
                r2 <= IPTC_CONSTANTS.RECORD_MAX &&
                d2 >= IPTC_CONSTANTS.DATASET_MIN &&
                d2 <= IPTC_CONSTANTS.DATASET_MAX
              ) {
                let l2 = (arr[end + 3] << 8) | arr[end + 4];
                end += IPTC_CONSTANTS.HEADER_SIZE + l2;
                continue;
              }
            }
            break;
          }
          if (end - i > IPTC_CONSTANTS.MIN_VALID_SIZE) {
            iptc = arr.slice(i, end);
            break;
          }
        }
      }
    }
  }

  return { icc, xmp, iptc };
}

export function buildIptcApp13Segments(
  iptc: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  const headerLen = JPEG_CONSTANTS.IPTC_HEADER.length;
  const MAX_IPTC_DATA_SIZE = 65000 - headerLen;
  const totalChunks = Math.ceil(iptc.length / MAX_IPTC_DATA_SIZE);

  if (totalChunks === 1) {
    const segBodyLen = 2 + headerLen + iptc.length;
    const seg = new Uint8Array(2 + segBodyLen);
    seg[0] = JPEG_CONSTANTS.SOI_MARKER;
    seg[1] = JPEG_CONSTANTS.APP13_MARKER;
    seg[2] = (segBodyLen >> 8) & 0xff;
    seg[3] = segBodyLen & 0xff;
    for (let i = 0; i < headerLen; i++) {
      seg[JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + i] =
        JPEG_CONSTANTS.IPTC_HEADER.charCodeAt(i);
    }
    seg.set(iptc, JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + headerLen);
    return seg as Uint8Array<ArrayBuffer>;
  }

  const parts: Uint8Array[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunk = iptc.slice(
      i * MAX_IPTC_DATA_SIZE,
      (i + 1) * MAX_IPTC_DATA_SIZE,
    );
    const segBodyLen = 2 + headerLen + chunk.length;
    const seg = new Uint8Array(2 + segBodyLen);
    seg[0] = JPEG_CONSTANTS.SOI_MARKER;
    seg[1] = JPEG_CONSTANTS.APP13_MARKER;
    seg[2] = (segBodyLen >> 8) & 0xff;
    seg[3] = segBodyLen & 0xff;
    for (let j = 0; j < headerLen; j++) {
      seg[JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + j] =
        JPEG_CONSTANTS.IPTC_HEADER.charCodeAt(j);
    }
    seg.set(chunk, JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + headerLen);
    parts.push(seg);
  }

  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total) as Uint8Array<ArrayBuffer>;
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }
  return result;
}

export function buildIccApp2Segments(
  icc: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  const totalChunks = Math.ceil(icc.length / JPEG_CONSTANTS.MAX_ICC_CHUNK_SIZE);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunk = icc.slice(
      i * JPEG_CONSTANTS.MAX_ICC_CHUNK_SIZE,
      (i + 1) * JPEG_CONSTANTS.MAX_ICC_CHUNK_SIZE,
    );
    const segBodyLen = 2 + 12 + 1 + 1 + chunk.length;
    const seg = new Uint8Array(2 + segBodyLen);
    seg[0] = JPEG_CONSTANTS.SOI_MARKER;
    seg[1] = JPEG_CONSTANTS.APP2_MARKER;
    seg[2] = (segBodyLen >> 8) & 0xff;
    seg[3] = segBodyLen & 0xff;
    for (let j = 0; j < 12; j++)
      seg[JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + j] =
        JPEG_CONSTANTS.ICC_HEADER.charCodeAt(j);
    seg[JPEG_CONSTANTS.ICC_SEQUENCE_OFFSET] = i + 1;
    seg[17] = totalChunks;
    seg.set(chunk, JPEG_CONSTANTS.ICC_DATA_START);
    parts.push(seg);
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total) as Uint8Array<ArrayBuffer>;
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }
  return result;
}

export function injectMetadataIntoJpeg(
  jpeg: Uint8Array<ArrayBufferLike>,
  appSegs: ExtractedMetadata,
): Uint8Array<ArrayBuffer> {
  const view = new DataView(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);

  const segments: Uint8Array<ArrayBufferLike>[] = [jpeg.slice(0, 2)];
  let pos = 2;
  while (pos + 2 <= jpeg.length) {
    if (jpeg[pos] !== JPEG_CONSTANTS.MARKER_PREFIX) {
      segments.push(jpeg.slice(pos));
      pos = jpeg.length;
      break;
    }
    const marker = jpeg[pos + 1];
    if (
      marker === JPEG_CONSTANTS.SOS_MARKER ||
      marker === JPEG_CONSTANTS.EOI_MARKER
    ) {
      segments.push(jpeg.slice(pos));
      pos = jpeg.length;
      break;
    }
    if (pos + 4 > jpeg.length) {
      segments.push(jpeg.slice(pos));
      pos = jpeg.length;
      break;
    }
    const segLen = view.getUint16(
      pos + JPEG_CONSTANTS.SEGMENT_LENGTH_OFFSET,
      false,
    );
    const segEnd = pos + 2 + segLen;

    let dropSegment = false;

    if (marker === JPEG_CONSTANTS.APP2_MARKER && segLen >= 16) {
      let match = true;
      for (let i = 0; i < 12; i++) {
        if (
          jpeg[pos + JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + i] !==
          JPEG_CONSTANTS.ICC_HEADER.charCodeAt(i)
        ) {
          match = false;
          break;
        }
      }
      if (match) dropSegment = true;
    }

    if (
      marker === JPEG_CONSTANTS.APP1_MARKER &&
      segLen >= JPEG_CONSTANTS.XMP_HEADER.length + 2
    ) {
      let match = true;
      for (let i = 0; i < JPEG_CONSTANTS.XMP_HEADER.length; i++) {
        if (
          jpeg[pos + JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + i] !==
          JPEG_CONSTANTS.XMP_HEADER.charCodeAt(i)
        ) {
          match = false;
          break;
        }
      }
      if (match) dropSegment = true;
    }

    if (
      marker === JPEG_CONSTANTS.APP13_MARKER &&
      segLen >= JPEG_CONSTANTS.IPTC_HEADER.length + 2
    ) {
      let match = true;
      for (let i = 0; i < JPEG_CONSTANTS.IPTC_HEADER.length; i++) {
        if (
          jpeg[pos + JPEG_CONSTANTS.SEGMENT_DATA_OFFSET + i] !==
          JPEG_CONSTANTS.IPTC_HEADER.charCodeAt(i)
        ) {
          match = false;
          break;
        }
      }
      if (match) dropSegment = true;
    }

    if (!dropSegment) segments.push(jpeg.slice(pos, segEnd));
    pos = segEnd;
  }

  const newSegs: Uint8Array[] = [];

  if (appSegs.icc) {
    newSegs.push(buildIccApp2Segments(appSegs.icc));
  }

  if (appSegs.xmp) {
    const segBodyLen = 2 + appSegs.xmp.length;
    const seg = new Uint8Array(2 + segBodyLen);
    seg[0] = JPEG_CONSTANTS.SOI_MARKER;
    seg[1] = JPEG_CONSTANTS.APP1_MARKER;
    seg[2] = (segBodyLen >> 8) & 0xff;
    seg[3] = segBodyLen & 0xff;
    seg.set(appSegs.xmp, JPEG_CONSTANTS.SEGMENT_DATA_OFFSET);
    newSegs.push(seg);
  }

  if (appSegs.iptc) {
    newSegs.push(buildIptcApp13Segments(appSegs.iptc));
  }

  segments.splice(1, 0, ...newSegs);

  const totalLen = segments.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen) as Uint8Array<ArrayBuffer>;
  let off = 0;
  for (const seg of segments) {
    result.set(seg, off);
    off += seg.length;
  }
  return result;
}

export function injectMetadataIntoWebP(
  webp: Uint8Array,
  appSegs: ExtractedMetadata,
  exifBytes: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  if (
    webp[0] !== WEBP_CONSTANTS.RIFF_SIGNATURE[0] ||
    webp[1] !== WEBP_CONSTANTS.RIFF_SIGNATURE[1] ||
    webp[2] !== WEBP_CONSTANTS.RIFF_SIGNATURE[2] ||
    webp[3] !== WEBP_CONSTANTS.RIFF_SIGNATURE[3]
  )
    return webp;
  if (
    webp[8] !== WEBP_CONSTANTS.WEBP_SIGNATURE[0] ||
    webp[9] !== WEBP_CONSTANTS.WEBP_SIGNATURE[1] ||
    webp[10] !== WEBP_CONSTANTS.WEBP_SIGNATURE[2] ||
    webp[11] !== WEBP_CONSTANTS.WEBP_SIGNATURE[3]
  )
    return webp;

  const view = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  let hasAlpha = false;
  let isAnimated = false;

  interface Chunk {
    id: string;
    data: Uint8Array;
  }
  const chunks: Chunk[] = [];
  let pos = WEBP_CONSTANTS.RIFF_HEADER_SIZE;
  while (pos + WEBP_CONSTANTS.CHUNK_HEADER_SIZE <= webp.length) {
    const id = String.fromCharCode(
      webp[pos],
      webp[pos + 1],
      webp[pos + 2],
      webp[pos + 3],
    );
    const size = view.getUint32(pos + WEBP_CONSTANTS.CHUNK_SIZE_OFFSET, true);
    const paddedSize = size + (size % 2);
    if (pos + WEBP_CONSTANTS.CHUNK_HEADER_SIZE + paddedSize > webp.length)
      break;
    const data = webp.slice(
      pos + WEBP_CONSTANTS.CHUNK_HEADER_SIZE,
      pos + WEBP_CONSTANTS.CHUNK_HEADER_SIZE + size,
    );

    if (id === "ALPH") hasAlpha = true;
    if (id === "ANIM") isAnimated = true;
    if (id === "VP8L" && data.length >= 5 && (data[4] & 0x10) !== 0)
      hasAlpha = true;

    if (
      id !== "VP8X" &&
      id !== "ICCP" &&
      id !== "EXIF" &&
      id !== "XMP " &&
      id !== "IPTC"
    ) {
      chunks.push({ id, data });
    }
    pos += WEBP_CONSTANTS.CHUNK_HEADER_SIZE + paddedSize;
  }

  let flags = 0;
  if (appSegs.icc) flags |= WEBP_CONSTANTS.FLAG_ICC;
  if (hasAlpha) flags |= WEBP_CONSTANTS.FLAG_ALPHA;
  if (exifBytes.length > 0) flags |= WEBP_CONSTANTS.FLAG_EXIF;
  if (appSegs.xmp) flags |= WEBP_CONSTANTS.FLAG_XMP;
  if (isAnimated) flags |= WEBP_CONSTANTS.FLAG_ANIMATION;

  if (!appSegs.icc && exifBytes.length === 0 && !appSegs.xmp && !appSegs.iptc)
    return webp;

  const vp8x = new Uint8Array(WEBP_CONSTANTS.VP8X_DATA_SIZE);
  vp8x[WEBP_CONSTANTS.VP8X_FLAGS_OFFSET] = flags;
  vp8x[WEBP_CONSTANTS.VP8X_WIDTH_OFFSET] = (width - 1) & 0xff;
  vp8x[WEBP_CONSTANTS.VP8X_WIDTH_OFFSET + 1] = ((width - 1) >> 8) & 0xff;
  vp8x[WEBP_CONSTANTS.VP8X_WIDTH_OFFSET + 2] = ((width - 1) >> 16) & 0xff;
  vp8x[WEBP_CONSTANTS.VP8X_HEIGHT_OFFSET] = (height - 1) & 0xff;
  vp8x[WEBP_CONSTANTS.VP8X_HEIGHT_OFFSET + 1] = ((height - 1) >> 8) & 0xff;
  vp8x[WEBP_CONSTANTS.VP8X_HEIGHT_OFFSET + 2] = ((height - 1) >> 16) & 0xff;

  const newChunks: Chunk[] = [{ id: "VP8X", data: vp8x }];
  if (appSegs.icc) newChunks.push({ id: "ICCP", data: appSegs.icc });

  for (const c of chunks) newChunks.push(c);

  if (exifBytes.length > 0) newChunks.push({ id: "EXIF", data: exifBytes });
  if (appSegs.xmp) newChunks.push({ id: "XMP ", data: appSegs.xmp });
  if (appSegs.iptc) newChunks.push({ id: "IPTC", data: appSegs.iptc });

  let totalSize = WEBP_CONSTANTS.CHUNK_ID_SIZE;
  for (const c of newChunks)
    totalSize +=
      WEBP_CONSTANTS.CHUNK_HEADER_SIZE + c.data.length + (c.data.length % 2);

  const result = new Uint8Array(WEBP_CONSTANTS.CHUNK_HEADER_SIZE + totalSize);
  const outView = new DataView(result.buffer);
  result[0] = WEBP_CONSTANTS.RIFF_SIGNATURE[0];
  result[1] = WEBP_CONSTANTS.RIFF_SIGNATURE[1];
  result[2] = WEBP_CONSTANTS.RIFF_SIGNATURE[2];
  result[3] = WEBP_CONSTANTS.RIFF_SIGNATURE[3];
  outView.setUint32(WEBP_CONSTANTS.CHUNK_SIZE_OFFSET, totalSize, true);
  result[8] = WEBP_CONSTANTS.WEBP_SIGNATURE[0];
  result[9] = WEBP_CONSTANTS.WEBP_SIGNATURE[1];
  result[10] = WEBP_CONSTANTS.WEBP_SIGNATURE[2];
  result[11] = WEBP_CONSTANTS.WEBP_SIGNATURE[3];

  let offset = WEBP_CONSTANTS.RIFF_HEADER_SIZE;
  for (const c of newChunks) {
    result[offset++] = c.id.charCodeAt(0);
    result[offset++] = c.id.charCodeAt(1);
    result[offset++] = c.id.charCodeAt(2);
    result[offset++] = c.id.charCodeAt(3);
    outView.setUint32(offset, c.data.length, true);
    offset += WEBP_CONSTANTS.CHUNK_SIZE_OFFSET;
    result.set(c.data, offset);
    offset += c.data.length;
    if (c.data.length % 2 !== 0) result[offset++] = 0;
  }

  return result;
}

let crcTable: Uint32Array | null = null;

function makeCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = PNG_CONSTANTS.CRC_POLYNOMIAL ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

export function crc32(data: Uint8Array): number {
  const table = makeCrcTable();
  let crc: number = PNG_CONSTANTS.CRC_INITIAL;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ PNG_CONSTANTS.CRC_INITIAL) >>> 0;
}

export function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);

  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);

  const crcData = chunk.slice(4, 8 + data.length);
  const crcValue = crc32(crcData);
  view.setUint32(8 + data.length, crcValue, false);

  return chunk;
}

export async function deflateData(data: Uint8Array): Promise<Uint8Array> {
  const safeData = new Uint8Array(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  ) as Uint8Array<ArrayBuffer>;
  const stream = new Blob([safeData])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const response = new Response(stream);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function injectMetadataIntoPng(
  png: Uint8Array,
  appSegs: ExtractedMetadata,
  exifBytes: Uint8Array,
): Promise<Uint8Array> {
  if (
    png.length < 8 ||
    png[0] !== 0x89 ||
    png[1] !== 0x50 ||
    png[2] !== 0x4e ||
    png[3] !== 0x47 ||
    png[4] !== 0x0d ||
    png[5] !== 0x0a ||
    png[6] !== 0x1a ||
    png[7] !== 0x0a
  )
    return png;

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

  interface Chunk {
    type: string;
    data: Uint8Array;
    originalBytes: Uint8Array;
  }
  const chunks: Chunk[] = [];
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
    const originalBytes = png.slice(pos, pos + 12 + length);
    const data = png.slice(pos + 8, pos + 8 + length);

    let drop = false;
    if (type === "eXIf") drop = true;
    if (type === "iCCP") drop = true;
    if (type === "zTXt" || type === "tEXt") {
      const keyword = "Raw profile type iptc";
      let match = true;
      for (let i = 0; i < keyword.length && i < data.length; i++) {
        if (data[i] !== keyword.charCodeAt(i)) {
          match = false;
          break;
        }
      }
      if (match) drop = true;
    }
    if (type === "iTXt") {
      const keyword = "XML:com.adobe.xmp";
      let match = true;
      for (let i = 0; i < keyword.length && i < data.length; i++) {
        if (data[i] !== keyword.charCodeAt(i)) {
          match = false;
          break;
        }
      }
      if (match && data[keyword.length] === 0) drop = true;
    }

    if (!drop) chunks.push({ type, data, originalBytes });
    pos += 12 + length;
  }

  const newChunks: Uint8Array[] = [];

  if (appSegs.icc) {
    const deflated = await deflateData(appSegs.icc);
    const profileName = "icc";
    const prefix = new Uint8Array(profileName.length + 2);
    for (let i = 0; i < profileName.length; i++)
      prefix[i] = profileName.charCodeAt(i);
    prefix[profileName.length] = 0;
    prefix[profileName.length + 1] = 0;

    const iccpData = new Uint8Array(prefix.length + deflated.length);
    iccpData.set(prefix, 0);
    iccpData.set(deflated, prefix.length);
    newChunks.push(createPngChunk("iCCP", iccpData));
  }

  if (exifBytes.length > 0) {
    newChunks.push(createPngChunk("eXIf", exifBytes));
  }

  if (appSegs.xmp) {
    const prefixStr = "XML:com.adobe.xmp\0\0\0\0\0";
    const prefix = new Uint8Array(prefixStr.length);
    for (let i = 0; i < prefixStr.length; i++)
      prefix[i] = prefixStr.charCodeAt(i);
    const itxtData = new Uint8Array(prefix.length + appSegs.xmp.length);
    itxtData.set(prefix, 0);
    itxtData.set(appSegs.xmp, prefix.length);
    newChunks.push(createPngChunk("iTXt", itxtData));
  }

  if (appSegs.iptc) {
    const keyword = "Raw profile type iptc";
    const prefix = new Uint8Array(keyword.length + 2);
    for (let i = 0; i < keyword.length; i++) prefix[i] = keyword.charCodeAt(i);
    prefix[keyword.length] = 0;
    prefix[keyword.length + 1] = 0;
    const iptcData = new Uint8Array(prefix.length + appSegs.iptc.length);
    iptcData.set(prefix, 0);
    iptcData.set(appSegs.iptc, prefix.length);
    newChunks.push(createPngChunk("zTXt", iptcData));
  }

  const resultChunks: Uint8Array[] = [png.slice(0, 8)];

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    resultChunks.push(c.originalBytes);

    if (c.type === "IHDR") {
      resultChunks.push(...newChunks);
    }
  }

  const totalLen = resultChunks.reduce((acc, c) => acc + c.length, 0);
  const finalResult = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of resultChunks) {
    finalResult.set(c, offset);
    offset += c.length;
  }

  return finalResult;
}

export function extractMetadataFromWebP(webp: Uint8Array): ExtractedMetadata {
  if (webp.length < 12) return { icc: null, xmp: null, iptc: null };
  if (
    webp[0] !== 0x52 ||
    webp[1] !== 0x49 ||
    webp[2] !== 0x46 ||
    webp[3] !== 0x46 ||
    webp[8] !== 0x57 ||
    webp[9] !== 0x45 ||
    webp[10] !== 0x42 ||
    webp[11] !== 0x50
  )
    return { icc: null, xmp: null, iptc: null };

  const view = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  let icc: Uint8Array | null = null;
  let xmp: Uint8Array | null = null;
  let iptc: Uint8Array | null = null;
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
    if (id === "ICCP") icc = data;
    if (id === "XMP ") xmp = data;
    if (id === "IPTC") iptc = data;
    pos += 8 + paddedSize;
  }

  return { icc, xmp, iptc };
}

export async function extractMetadataFromPng(
  png: Uint8Array,
): Promise<ExtractedMetadata> {
  if (
    png.length < 8 ||
    png[0] !== 0x89 ||
    png[1] !== 0x50 ||
    png[2] !== 0x4e ||
    png[3] !== 0x47 ||
    png[4] !== 0x0d ||
    png[5] !== 0x0a ||
    png[6] !== 0x1a ||
    png[7] !== 0x0a
  )
    return { icc: null, xmp: null, iptc: null };

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let icc: Uint8Array | null = null;
  let xmp: Uint8Array | null = null;
  let iptc: Uint8Array | null = null;
  let pos = 8;

  while (pos + 12 <= png.length) {
    const length = view.getUint32(pos, false);
    if (pos + 12 + length > png.length) break;
    const type = String.fromCharCode(
      png[pos + 4],
      png[pos + 5],
      png[pos + 6],
      png[pos + 7],
    );
    const data = png.slice(pos + 8, pos + 8 + length);

    if (type === "iCCP") {
      let nameEnd = 0;
      while (nameEnd < data.length && data[nameEnd] !== 0) nameEnd++;
      if (nameEnd + 2 < data.length && data[nameEnd + 1] === 0) {
        const compressed = data.slice(nameEnd + 2);
        try {
          const stream = new Blob([compressed])
            .stream()
            .pipeThrough(new DecompressionStream("deflate"));
          const response = new Response(stream);
          const buf = await response.arrayBuffer();
          icc = new Uint8Array(buf);
        } catch {}
      }
    }

    if (type === "iTXt") {
      const keyword = "XML:com.adobe.xmp";
      let match = true;
      for (let i = 0; i < keyword.length && i < data.length; i++) {
        if (data[i] !== keyword.charCodeAt(i)) {
          match = false;
          break;
        }
      }
      if (match && data[keyword.length] === 0) {
        let p = keyword.length + 1 + 2;
        while (p < data.length && data[p] !== 0) p++;
        p++;
        while (p < data.length && data[p] !== 0) p++;
        p++;
        if (p < data.length) xmp = data.slice(p);
      }
    }

    if (type === "zTXt" || type === "tEXt") {
      const keyword = "Raw profile type iptc";
      let match = true;
      for (let i = 0; i < keyword.length && i < data.length; i++) {
        if (data[i] !== keyword.charCodeAt(i)) {
          match = false;
          break;
        }
      }
      if (match && data[keyword.length] === 0) {
        let p = keyword.length + 1 + 1;
        while (p < data.length && data[p] !== 0) p++;
        p++;
        if (p < data.length) {
          const compressed = data.slice(p);
          try {
            const stream = new Blob([compressed])
              .stream()
              .pipeThrough(new DecompressionStream("deflate"));
            const response = new Response(stream);
            const buf = await response.arrayBuffer();
            iptc = new Uint8Array(buf);
          } catch {
            iptc = compressed;
          }
        }
      }
    }

    pos += 12 + length;
  }

  return { icc, xmp, iptc };
}

function arraysEqual(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function verifyMetadataIntegrity(
  originalBytes: ArrayBuffer,
  originalMime: string,
  outputBytes: Uint8Array,
  outputFormat: "jpeg" | "webp" | "png",
): Promise<{ ok: boolean; warnings: string[] }> {
  const origArr = new Uint8Array(originalBytes);
  const original =
    originalMime === "image/jpeg" || originalMime === "image/jpg"
      ? extractMetadataFromJpeg(origArr)
      : extractMetadataFromHeic(origArr);

  if (original.icc && !isSrgbProfile(original.icc)) {
    original.icc = null;
  }

  let output: ExtractedMetadata;
  switch (outputFormat) {
    case "jpeg":
      output = extractMetadataFromJpeg(outputBytes);
      break;
    case "webp":
      output = extractMetadataFromWebP(outputBytes);
      break;
    case "png":
      output = await extractMetadataFromPng(outputBytes);
      break;
    default:
      output = { icc: null, xmp: null, iptc: null };
  }

  const warnings: string[] = [];

  if (
    original.icc &&
    original.icc.length > 0 &&
    !arraysEqual(original.icc, output.icc)
  ) {
    if (!output.icc) warnings.push("ICC profile missing in output");
    else warnings.push("ICC profile byte mismatch");
  }

  if (
    original.xmp &&
    original.xmp.length > 0 &&
    !arraysEqual(original.xmp, output.xmp)
  ) {
    if (!output.xmp) warnings.push("XMP metadata missing in output");
    else warnings.push("XMP byte mismatch");
  }

  if (
    original.iptc &&
    original.iptc.length > 0 &&
    !arraysEqual(original.iptc, output.iptc)
  ) {
    if (!output.iptc) {
      warnings.push(
        `IPTC metadata missing in output (original size: ${original.iptc.length} bytes)`,
      );
    } else {
      warnings.push(
        `IPTC byte mismatch (original: ${original.iptc.length} bytes, output: ${output.iptc.length} bytes)`,
      );
    }
  }

  return { ok: warnings.length === 0, warnings };
}
