import { FORMAT_MIME } from "@core/constants";
import type { OutputFormat } from "@core/types";

export function usesQuality(format: OutputFormat): boolean {
  return format === "jpeg" || format === "webp" || format === "avif";
}

export function getMimeForFormat(format: OutputFormat): string {
  return FORMAT_MIME[format];
}
