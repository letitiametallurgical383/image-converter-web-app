/// <reference lib="webworker" />
import { FORMAT_MIME, MEMORY_LIMITS } from "@core/constants";
import type { OutputFormat, WorkerRequest, WorkerResponse } from "@core/types";
import { computeCropRect } from "@domain/crop";
import { usesQuality } from "@domain/formats";
import { logger } from "@utils/logger";
import {
  type ExtractedMetadata,
  extractMetadataFromHeic,
  extractMetadataFromJpeg,
  injectMetadataIntoJpeg,
  injectMetadataIntoPng,
  injectMetadataIntoWebP,
  isSrgbProfile,
  verifyMetadataIntegrity,
} from "./metadata";

declare const self: DedicatedWorkerGlobalScope;

const HEIC_MIMES = new Set(["image/heic", "image/heif"]);

async function decodeToBitmap(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<ImageBitmap> {
  if (HEIC_MIMES.has(mimeType.toLowerCase())) {
    return await decodeHeic(bytes);
  }
  const blob = new Blob([bytes], {
    type: mimeType || "application/octet-stream",
  });
  return createImageBitmap(blob, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "default",
    imageOrientation: "from-image",
  });
}

async function decodeHeic(bytes: ArrayBuffer): Promise<ImageBitmap> {
  const mod = await import("heic-to");
  const heicToFn =
    (
      mod as unknown as {
        heicTo?: (input: {
          blob: Blob;
          type: string;
          quality?: number;
        }) => Promise<ImageBitmap | Blob>;
        default?: (input: {
          blob: Blob;
          type: string;
          quality?: number;
        }) => Promise<ImageBitmap | Blob>;
      }
    ).heicTo ??
    (
      mod as unknown as {
        default?: (input: {
          blob: Blob;
          type: string;
          quality?: number;
        }) => Promise<ImageBitmap | Blob>;
      }
    ).default;
  if (typeof heicToFn !== "function") {
    throw new Error("HEIC decoder unavailable");
  }
  const blob = new Blob([bytes], { type: "image/heic" });
  return heicToFn({ blob, type: "bitmap" }) as Promise<ImageBitmap>;
}

function estimateEncodingDuration(
  format: OutputFormat,
  width: number,
  height: number,
  quality: number,
  compressionMode: "lossy" | "lossless",
): number {
  const pixels = width * height;
  const megapixels = pixels / 1_000_000;

  let baseDuration = 0;

  if (format === "avif") {
    baseDuration = compressionMode === "lossless" ? 800 : 400;
  } else if (format === "webp") {
    baseDuration = compressionMode === "lossless" ? 300 : 200;
  } else if (format === "png") {
    baseDuration = 250;
  } else if (format === "jpeg") {
    baseDuration = 100;
  } else {
    baseDuration = 150;
  }

  const qualityFactor =
    compressionMode === "lossless" ? 1.5 : 1.0 + (1.0 - quality) * 0.3;

  return baseDuration * megapixels * qualityFactor;
}

function simulateEncodingProgress(
  id: string,
  startProgress: number,
  endProgress: number,
  estimatedDurationMs: number,
): { stop: () => void } {
  const startTime = performance.now();
  let stopped = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const updateProgress = () => {
    if (stopped) {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      return;
    }

    const elapsed = performance.now() - startTime;
    const progressRatio = Math.min(elapsed / estimatedDurationMs, 0.95);
    const currentProgress =
      startProgress + (endProgress - startProgress) * progressRatio;

    postProgress(id, currentProgress);

    if (progressRatio < 0.95) {
      timerId = setTimeout(updateProgress, 50);
    } else {
      timerId = null;
    }
  };

  updateProgress();

  return {
    stop: () => {
      stopped = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}

async function encodeCanvas(
  canvas: OffscreenCanvas,
  format: OutputFormat,
  quality: number,
  compressionMode: "lossy" | "lossless",
  id: string,
  startProgress: number,
  endProgress: number,
): Promise<Blob> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const estimatedDuration = estimateEncodingDuration(
    format,
    canvas.width,
    canvas.height,
    quality,
    compressionMode,
  );

  const progressSimulator = simulateEncodingProgress(
    id,
    startProgress,
    endProgress,
    estimatedDuration,
  );

  try {
    let blob: Blob;

    if (format === "avif") {
      const { default: encodeAvif } = await import("@jsquash/avif/encode.js");
      const encodeOpts =
        compressionMode === "lossless"
          ? { lossless: true }
          : { quality: Math.round(quality * 100) };
      const buffer = await encodeAvif(imageData, encodeOpts);
      blob = new Blob([buffer], { type: "image/avif" });
    } else if (format === "webp") {
      const { default: encodeWebp } = await import("@jsquash/webp/encode.js");
      const encodeOpts =
        compressionMode === "lossless"
          ? { lossless: 1 }
          : { quality: Math.round(quality * 100) };
      const buffer = await encodeWebp(imageData, encodeOpts);
      blob = new Blob([buffer], { type: "image/webp" });
    } else if (format === "jpeg") {
      const { default: encodeJpeg } = await import("@jsquash/jpeg/encode.js");
      const buffer = await encodeJpeg(imageData, {
        quality: Math.round(quality * 100),
      });
      blob = new Blob([buffer], { type: "image/jpeg" });
    } else if (format === "png") {
      const rawBlob = await canvas.convertToBlob({ type: "image/png" });
      const rawBuffer = await rawBlob.arrayBuffer();
      const { optimise } = await import("@jsquash/oxipng");
      const optimized: unknown = await optimise(rawBuffer);
      if (
        !(optimized instanceof ArrayBuffer || optimized instanceof Uint8Array)
      ) {
        throw new Error("PNG optimization returned unexpected type");
      }
      blob = new Blob([optimized as BlobPart], { type: "image/png" });
    } else {
      const type = FORMAT_MIME[format];
      const options = usesQuality(format) ? { type, quality } : { type };
      blob = await canvas.convertToBlob(options);
    }

    progressSimulator.stop();
    postProgress(id, endProgress);

    return blob;
  } catch (error) {
    progressSimulator.stop();
    throw error;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

function exifStringToArray(exifStr: string): Uint8Array {
  let startIdx = 0;
  if (exifStr.startsWith("Exif\0\0")) startIdx = 6;
  const exifBinary = exifStr.substring(startIdx);
  const exifArr = new Uint8Array(exifBinary.length);
  for (let i = 0; i < exifBinary.length; i++)
    exifArr[i] = exifBinary.charCodeAt(i);
  return exifArr;
}

async function buildExifStringFromJpegSource(
  originalBytes: ArrayBuffer,
  piexif: typeof import("piexifjs").default,
): Promise<string> {
  const blobUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(new Blob([originalBytes], { type: "image/jpeg" }));
  });
  const originalExifObj = piexif.load(blobUrl);
  if (originalExifObj["0th"]) {
    originalExifObj["0th"][piexif.ImageIFD.Orientation] = 1;
  }
  return piexif.dump(originalExifObj);
}

async function buildExifStringFromTags(
  originalBytes: ArrayBuffer,
  ExifReader: typeof import("exifreader"),
  piexif: typeof import("piexifjs").default,
): Promise<string> {
  const tags = await ExifReader.load(originalBytes);

  const idToIfd: Record<number, "0th" | "Exif" | "GPS" | "1st"> = {};
  const idToType: Record<number, string> = {};

  const IFD_PRIORITY: Array<[string, "0th" | "Exif" | "GPS" | "1st"]> = [
    ["1st", "1st"],
    ["Image", "0th"],
    ["0th", "0th"],
    ["Exif", "Exif"],
    ["GPS", "GPS"],
  ];

  for (const [ifdName, ifdKey] of IFD_PRIORITY) {
    const piexifTags = piexif.TAGS[ifdName] as
      | Record<string, { name: string; type: string }>
      | undefined;
    if (!piexifTags) continue;
    for (const [idStr, tag] of Object.entries(piexifTags)) {
      const numId = parseInt(idStr, 10);
      idToIfd[numId] = ifdKey;
      idToType[numId] = tag.type;
    }
  }

  const zeroth: Record<number, unknown> = {};
  const exif: Record<number, unknown> = {};
  const gps: Record<number, unknown> = {};
  const first: Record<number, unknown> = {};

  for (const [name, tag] of Object.entries(tags)) {
    const tagObj = tag as unknown as {
      id?: number;
      description?: string;
      value?: unknown;
    };
    if (typeof tagObj.id !== "number") continue;
    const tagId = tagObj.id;
    const ifd = idToIfd[tagId];
    if (!ifd) continue;

    const expectedType = idToType[tagId];
    if (!expectedType) continue;

    let raw: unknown = tagObj.value;
    if (
      raw &&
      typeof raw === "object" &&
      "numerator" in raw &&
      "denominator" in raw
    ) {
      const r = raw as { numerator: number; denominator: number };
      raw = [r.numerator, r.denominator];
    } else if (Array.isArray(raw)) {
      if (raw.length === 1 && typeof raw[0] === "string") {
        raw = raw[0];
      } else if (
        raw.length === 1 &&
        typeof raw[0] === "number" &&
        expectedType !== "ASCII" &&
        expectedType !== "Undefined" &&
        expectedType !== "Rational" &&
        expectedType !== "SRational"
      ) {
        raw = raw[0];
      } else if (
        raw.every((x: unknown) => typeof x === "number") &&
        (expectedType === "ASCII" || expectedType === "Undefined")
      ) {
        let str = "";
        const arr = raw as number[];
        if (arr.length > 60000) continue;
        for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
        raw = str;
      } else if (
        name === "ExifVersion" &&
        raw.every((x: unknown) => typeof x === "string")
      ) {
        raw = raw.join("");
      }
    }

    if (expectedType === "Rational" || expectedType === "SRational") {
      if (typeof raw === "number") {
        raw = [Math.round(raw * 1000000), 1000000];
      } else if (typeof raw === "string") {
        if (raw.includes("/")) {
          const [num, den] = raw.split("/");
          raw = [parseInt(num, 10) || 0, parseInt(den, 10) || 1];
        } else {
          const floatVal = parseFloat(raw);
          raw = !isNaN(floatVal)
            ? [Math.round(floatVal * 1000000), 1000000]
            : [0, 1];
        }
      } else if (Array.isArray(raw)) {
        if (raw.length === 1 && typeof raw[0] === "number") {
          raw = [Math.round(raw[0] * 1000000), 1000000];
        } else if (raw.length === 1 && typeof raw[0] === "string") {
          const strVal = raw[0] as string;
          if (strVal.includes("/")) {
            const [num, den] = strVal.split("/");
            raw = [parseInt(num, 10) || 0, parseInt(den, 10) || 1];
          } else {
            const floatVal = parseFloat(strVal);
            raw = !isNaN(floatVal)
              ? [Math.round(floatVal * 1000000), 1000000]
              : [0, 1];
          }
        } else if (
          raw.length === 2 &&
          typeof raw[0] === "number" &&
          typeof raw[1] === "number"
        ) {
          raw = [Math.round(raw[0]), Math.round(raw[1])];
        } else if (!(raw.length > 0 && Array.isArray(raw[0]))) {
          raw = [0, 1];
        }
      } else {
        raw = [0, 1];
      }
    }

    if (ifd === "0th") zeroth[tagId] = raw;
    else if (ifd === "Exif") exif[tagId] = raw;
    else if (ifd === "GPS") gps[tagId] = raw;
    else if (ifd === "1st") first[tagId] = raw;
  }

  const exifObj = {
    "0th": zeroth,
    Exif: exif,
    GPS: gps,
    "1st": first,
    thumbnail: null,
  };

  exifObj["0th"][piexif.ImageIFD.Orientation] = 1;

  return piexif.dump(exifObj);
}

async function preserveMetadataJpeg(
  outputBlob: Blob,
  originalBytes: ArrayBuffer,
  isJpegSource: boolean,
  extractedData: ExtractedMetadata,
  piexif: typeof import("piexifjs").default,
  ExifReader: typeof import("exifreader"),
): Promise<Blob> {
  const exifStr = isJpegSource
    ? await buildExifStringFromJpegSource(originalBytes, piexif)
    : await buildExifStringFromTags(originalBytes, ExifReader, piexif);

  const jpegArray = new Uint8Array(await outputBlob.arrayBuffer());
  const jpegBase64 = bytesToBase64(jpegArray);
  const dataUrl = "data:image/jpeg;base64," + jpegBase64;
  const newDataUrl = piexif.insert(exifStr, dataUrl);
  let outArray = base64ToBytes(newDataUrl.split(",")[1]);

  if (extractedData.icc || extractedData.xmp || extractedData.iptc) {
    outArray = injectMetadataIntoJpeg(outArray, extractedData);
  }
  return new Blob([outArray], { type: "image/jpeg" });
}

async function preserveMetadataWebp(
  outputBlob: Blob,
  originalBytes: ArrayBuffer,
  isJpegSource: boolean,
  extractedData: ExtractedMetadata,
  width: number,
  height: number,
  piexif: typeof import("piexifjs").default,
  ExifReader: typeof import("exifreader"),
): Promise<Blob> {
  const exifStr = isJpegSource
    ? await buildExifStringFromJpegSource(originalBytes, piexif)
    : await buildExifStringFromTags(originalBytes, ExifReader, piexif);

  const exifArr = exifStringToArray(exifStr);
  const webpArray = new Uint8Array(await outputBlob.arrayBuffer());
  const outArray = injectMetadataIntoWebP(
    webpArray,
    extractedData,
    exifArr,
    width,
    height,
  );
  return new Blob(
    [
      new Uint8Array(
        outArray.buffer.slice(
          outArray.byteOffset,
          outArray.byteOffset + outArray.byteLength,
        ),
      ) as Uint8Array<ArrayBuffer>,
    ],
    { type: "image/webp" },
  );
}

async function preserveMetadataPng(
  outputBlob: Blob,
  originalBytes: ArrayBuffer,
  isJpegSource: boolean,
  extractedData: ExtractedMetadata,
  piexif: typeof import("piexifjs").default,
  ExifReader: typeof import("exifreader"),
): Promise<Blob> {
  const exifStr = isJpegSource
    ? await buildExifStringFromJpegSource(originalBytes, piexif)
    : await buildExifStringFromTags(originalBytes, ExifReader, piexif);

  const exifArr = exifStringToArray(exifStr);
  const pngArray = new Uint8Array(await outputBlob.arrayBuffer());
  const outArray = await injectMetadataIntoPng(
    pngArray,
    extractedData,
    exifArr,
  );
  return new Blob(
    [
      new Uint8Array(
        outArray.buffer.slice(
          outArray.byteOffset,
          outArray.byteOffset + outArray.byteLength,
        ),
      ) as Uint8Array<ArrayBuffer>,
    ],
    { type: "image/png" },
  );
}

async function preserveMetadata(
  originalBytes: ArrayBuffer,
  originalMime: string,
  outputBlob: Blob,
  keep: boolean,
  format: OutputFormat,
  width: number,
  height: number,
): Promise<Blob> {
  if (!keep || (format !== "jpeg" && format !== "webp" && format !== "png"))
    return outputBlob;

  if (typeof DOMParser === "undefined") {
    const workerGlobal = self as typeof self & {
      DOMParser?: {
        new (): {
          parseFromString(_s: string, _t: string): null;
        };
      };
    };
    workerGlobal.DOMParser = class {
      parseFromString(_s: string, _t: string) {
        return null;
      }
    };
  }

  try {
    const [ExifReader, { default: piexif }] = await Promise.all([
      import("exifreader"),
      import("piexifjs"),
    ]);

    const origArr = new Uint8Array(originalBytes);
    let extractedData: ExtractedMetadata =
      originalMime === "image/jpeg" || originalMime === "image/jpg"
        ? extractMetadataFromJpeg(origArr)
        : extractMetadataFromHeic(origArr);

    if (extractedData.icc && !isSrgbProfile(extractedData.icc)) {
      extractedData = { ...extractedData, icc: null };
    }

    const isJpegSource =
      originalMime === "image/jpeg" || originalMime === "image/jpg";

    if (format === "jpeg") {
      return await preserveMetadataJpeg(
        outputBlob,
        originalBytes,
        isJpegSource,
        extractedData,
        piexif,
        ExifReader,
      );
    }
    if (format === "webp") {
      return await preserveMetadataWebp(
        outputBlob,
        originalBytes,
        isJpegSource,
        extractedData,
        width,
        height,
        piexif,
        ExifReader,
      );
    }
    if (format === "png") {
      return await preserveMetadataPng(
        outputBlob,
        originalBytes,
        isJpegSource,
        extractedData,
        piexif,
        ExifReader,
      );
    }
    return outputBlob;
  } catch (e) {
    logger.warn(
      "Metadata preservation failed",
      {
        format,
        originalMime,
        error: e instanceof Error ? e.message : String(e),
      },
      e instanceof Error ? e : undefined,
    );
    return outputBlob;
  }
}

async function handleConvert(req: WorkerRequest): Promise<void> {
  const started = performance.now();

  const activeSimulators: Array<{ stop: () => void }> = [];

  try {
    postProgress(req.id, 0.0);

    let effectiveMime = req.mimeType;
    const ext = req.originalName?.split(".").pop()?.toLowerCase();
    if (ext === "heic" || ext === "heif") {
      effectiveMime = "image/heic";
    }

    postProgress(req.id, 0.05);

    postProgress(req.id, 0.1);

    const decodingSimulator = simulateEncodingProgress(req.id, 0.1, 0.38, 200);
    activeSimulators.push(decodingSimulator);

    const bitmap = await decodeToBitmap(req.bytes, effectiveMime);

    decodingSimulator.stop();
    activeSimulators.splice(activeSimulators.indexOf(decodingSimulator), 1);
    postProgress(req.id, 0.4);

    if (
      bitmap.width > MEMORY_LIMITS.MAX_IMAGE_DIMENSION ||
      bitmap.height > MEMORY_LIMITS.MAX_IMAGE_DIMENSION
    ) {
      bitmap.close();
      throw new Error(
        `Image dimensions (${bitmap.width}×${bitmap.height}) exceed maximum allowed (${MEMORY_LIMITS.MAX_IMAGE_DIMENSION}×${MEMORY_LIMITS.MAX_IMAGE_DIMENSION})`,
      );
    }

    postProgress(req.id, 0.45);

    const crop = computeCropRect(
      bitmap.width,
      bitmap.height,
      req.settings.crop,
    );
    const canvas = new OffscreenCanvas(crop.dw, crop.dh);
    const ctx = canvas.getContext("2d", {
      alpha: req.settings.format !== "jpeg",
      willReadFrequently: false,
      desynchronized: true,
    });
    if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");

    postProgress(req.id, 0.5);

    if (req.settings.format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      crop.dw,
      crop.dh,
    );
    bitmap.close();

    postProgress(req.id, 0.6);

    const blob = await encodeCanvas(
      canvas,
      req.settings.format,
      req.settings.quality,
      req.settings.compressionMode,
      req.id,
      0.6,
      0.85,
    );

    postProgress(req.id, 0.86);

    const metadataSimulator = simulateEncodingProgress(req.id, 0.86, 0.94, 150);
    activeSimulators.push(metadataSimulator);

    const finalBlob = await preserveMetadata(
      req.bytes,
      effectiveMime,
      blob,
      req.settings.keepMetadata,
      req.settings.format,
      crop.dw,
      crop.dh,
    );

    metadataSimulator.stop();
    activeSimulators.splice(activeSimulators.indexOf(metadataSimulator), 1);
    postProgress(req.id, 0.95);

    let metadataWarnings: string[] | undefined;
    if (req.settings.keepMetadata && req.settings.format !== "avif") {
      try {
        const outputBytes = new Uint8Array(await finalBlob.arrayBuffer());
        const integrity = await verifyMetadataIntegrity(
          req.bytes,
          effectiveMime,
          outputBytes,
          req.settings.format,
        );
        if (!integrity.ok) {
          metadataWarnings = integrity.warnings;
          for (const w of integrity.warnings) {
            logger.warn("Metadata integrity issue", {
              warning: w,
              format: req.settings.format,
            });
          }
        }
      } catch (e) {
        logger.warn(
          "Metadata integrity check failed",
          {
            format: req.settings.format,
            error: e instanceof Error ? e.message : String(e),
          },
          e instanceof Error ? e : undefined,
        );
      }
    }

    const response: WorkerResponse = {
      id: req.id,
      kind: "done",
      blob: finalBlob,
      width: crop.dw,
      height: crop.dh,
      outputFormat: req.settings.format,
      durationMs: performance.now() - started,
      metadataWarnings,
    };
    self.postMessage(response);
  } catch (error) {
    for (const simulator of activeSimulators) {
      simulator.stop();
    }
    activeSimulators.length = 0;
    throw error;
  }
}

function postProgress(id: string, progress: number): void {
  const message: WorkerResponse = { id, kind: "progress", progress };
  self.postMessage(message);
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  handleConvert(req).catch((err: unknown) => {
    const message: WorkerResponse = {
      id: req.id,
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(message);
  });
});
