import type { ConverterSettings, OutputFormat } from "./types";

export const PRESET_SCHEMA_VERSION = 1;
export const PRESET_STORAGE_KEY = "image-converter::presets::v1";
export const SETTINGS_STORAGE_KEY = "image-converter::settings::v1";
export const THEME_STORAGE_KEY = "image-converter::theme::v1";

export const MAX_FILE_SIZE_BYTES = 256 * 1024 * 1024;
export const MAX_FILENAME_LENGTH = 200;
export const MAX_PREFIX_LENGTH = 64;

export const DEFAULT_CONCURRENCY = 3;
export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 8;

export const SUPPORTED_OUTPUT_FORMATS: readonly OutputFormat[] = [
  "jpeg",
  "webp",
  "avif",
  "png",
];

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  jpeg: "JPG",
  webp: "WEBP",
  avif: "AVIF",
  png: "PNG",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  png: "image/png",
};

export const FORMAT_EXTENSION: Record<OutputFormat, string> = {
  jpeg: "jpg",
  webp: "webp",
  avif: "avif",
  png: "png",
};

export const METADATA_SUPPORTED_FORMATS: readonly OutputFormat[] = [
  "jpeg",
  "webp",
  "png",
];

export const ACCEPTED_INPUT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
];

export const DEFAULT_SETTINGS: ConverterSettings = {
  format: "webp",
  quality: 0.82,
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  prefix: "",
  findText: "",
  replaceText: "",
  findReplaceCaseSensitive: false,
  concurrency: DEFAULT_CONCURRENCY,
  keepMetadata: false,
  compressionMode: "lossy",
};

export const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  "image/bmp": [[0x42, 0x4d]],
};

export const MEMORY_LIMITS = {
  MAX_SAFE_ARRAY_BUFFER_SIZE: 256 * 1024 * 1024,
  MAX_IMAGE_DIMENSION: 16384,
  LARGE_FILE_WARNING_THRESHOLD: 30 * 1024 * 1024,
} as const;
