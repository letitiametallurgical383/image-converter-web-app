import {
  ACCEPTED_INPUT_MIME,
  MAGIC_BYTES,
  MAX_CONCURRENCY,
  MAX_FILE_SIZE_BYTES,
  MIN_CONCURRENCY,
  PRESET_SCHEMA_VERSION,
  SUPPORTED_OUTPUT_FORMATS,
} from "@core/constants";
import { InvalidFileError, ValidationError } from "@core/errors";
import type {
  ConverterSettings,
  CropPercent,
  Preset,
  PresetFile,
} from "@core/types";

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function assertFileSize(file: File): void {
  if (file.size <= 0) {
    throw new InvalidFileError("File is empty");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new InvalidFileError(
      `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`,
    );
  }
}

export function isAcceptedMime(mime: string): boolean {
  return ACCEPTED_INPUT_MIME.includes(mime.toLowerCase());
}

function hasBytes(
  bytes: Uint8Array,
  offset: number,
  signature: readonly number[],
): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return "";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index]);
  }
  return value;
}

function detectIsoImageMime(bytes: Uint8Array): string | null {
  if (readAscii(bytes, 4, 4) !== "ftyp") return null;
  const brands = [readAscii(bytes, 8, 4)];
  for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
    brands.push(readAscii(bytes, offset, 4));
  }
  if (brands.some((brand) => brand === "avif" || brand === "avis")) {
    return "image/avif";
  }
  if (
    brands.some((brand) =>
      ["heic", "heix", "hevc", "hevx", "heis", "hevm", "mif1", "msf1"].includes(
        brand,
      ),
    )
  ) {
    return "image/heic";
  }
  return null;
}

export async function detectMagicMime(file: File): Promise<string | null> {
  const head = await file.slice(0, 64).arrayBuffer();
  const bytes = new Uint8Array(head);
  if (
    hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  const isoMime = detectIsoImageMime(bytes);
  if (isoMime) return isoMime;
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const signature of signatures) {
      if (hasBytes(bytes, 0, signature)) {
        return mime;
      }
    }
  }
  return null;
}

export function isCompatibleDeclaredMime(
  declared: string,
  detected: string,
): boolean {
  if (!declared) return true;
  if (!isAcceptedMime(declared)) return true;
  if (declared === detected) return true;
  return (
    (declared === "image/heif" || declared === "image/heic") &&
    detected === "image/heic"
  );
}

export async function validateImageFile(file: File): Promise<void> {
  assertFileSize(file);
  const declared = (file.type || "").toLowerCase();
  const magic = await detectMagicMime(file);
  if (magic && isAcceptedMime(magic)) {
    if (!isCompatibleDeclaredMime(declared, magic)) {
      throw new InvalidFileError(
        `File type mismatch: declared ${declared}, detected ${magic}`,
      );
    }
    return;
  }
  if (declared && isAcceptedMime(declared)) {
    throw new InvalidFileError(
      `File content does not match declared type: ${declared}`,
    );
  }
  throw new InvalidFileError(`Unsupported file type: ${declared || "unknown"}`);
}

export function validateCropPercent(crop: CropPercent): void {
  const values = [crop.top, crop.right, crop.bottom, crop.left];
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      throw new ValidationError("Crop percentages must be between 0 and 100");
    }
  }
  if (crop.top + crop.bottom >= 100) {
    throw new ValidationError("Top + bottom crop must be less than 100%");
  }
  if (crop.left + crop.right >= 100) {
    throw new ValidationError("Left + right crop must be less than 100%");
  }
}

export function validateSettings(settings: ConverterSettings): void {
  if (!SUPPORTED_OUTPUT_FORMATS.includes(settings.format)) {
    throw new ValidationError(`Unsupported output format: ${settings.format}`);
  }
  if (
    !Number.isFinite(settings.quality) ||
    settings.quality < 0 ||
    settings.quality > 1
  ) {
    throw new ValidationError("Quality must be between 0 and 1");
  }
  if (
    !Number.isInteger(settings.concurrency) ||
    settings.concurrency < MIN_CONCURRENCY ||
    settings.concurrency > MAX_CONCURRENCY
  ) {
    throw new ValidationError(
      `Concurrency must be between ${MIN_CONCURRENCY} and ${MAX_CONCURRENCY}`,
    );
  }
  validateCropPercent(settings.crop);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePresetFile(raw: unknown): PresetFile {
  if (!isObject(raw)) {
    throw new ValidationError("Preset file must be an object");
  }
  if (raw.schemaVersion !== PRESET_SCHEMA_VERSION) {
    throw new ValidationError(
      `Unsupported preset schema version: ${String(raw.schemaVersion)}`,
    );
  }
  if (!Array.isArray(raw.presets)) {
    throw new ValidationError("Presets must be an array");
  }
  const presets: Preset[] = raw.presets.map((entry) => parsePreset(entry));
  return { schemaVersion: PRESET_SCHEMA_VERSION, presets };
}

export function parsePreset(raw: unknown): Preset {
  if (!isObject(raw)) {
    throw new ValidationError("Preset must be an object");
  }
  const id = typeof raw.id === "string" ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const createdAt =
    typeof raw.createdAt === "number" ? raw.createdAt : Date.now();
  if (!id || !name) {
    throw new ValidationError("Preset missing id or name");
  }
  if (!isObject(raw.settings)) {
    throw new ValidationError("Preset missing settings object");
  }
  const settings = parseSettings(raw.settings);
  validateSettings(settings);
  return { id, name, createdAt, settings };
}

function parseSettings(raw: Record<string, unknown>): ConverterSettings {
  const format = raw.format;
  if (
    typeof format !== "string" ||
    !SUPPORTED_OUTPUT_FORMATS.includes(format as ConverterSettings["format"])
  ) {
    throw new ValidationError("Invalid preset format");
  }
  const crop = raw.crop;
  if (!isObject(crop)) {
    throw new ValidationError("Invalid preset crop");
  }
  return {
    format: format as ConverterSettings["format"],
    quality: clamp(Number(raw.quality), 0, 1),
    crop: {
      top: clamp(Number(crop.top), 0, 100),
      right: clamp(Number(crop.right), 0, 100),
      bottom: clamp(Number(crop.bottom), 0, 100),
      left: clamp(Number(crop.left), 0, 100),
    },
    prefix: typeof raw.prefix === "string" ? raw.prefix : "",
    findText: typeof raw.findText === "string" ? raw.findText : "",
    replaceText: typeof raw.replaceText === "string" ? raw.replaceText : "",
    findReplaceCaseSensitive: raw.findReplaceCaseSensitive === true,
    concurrency: clamp(
      Math.round(Number(raw.concurrency)),
      MIN_CONCURRENCY,
      MAX_CONCURRENCY,
    ),
    keepMetadata: raw.keepMetadata === true,
    compressionMode: raw.compressionMode === "lossless" ? "lossless" : "lossy",
  };
}
