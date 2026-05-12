import { MEMORY_LIMITS } from "@core/constants";
import type { OutputFormat } from "@core/types";

export async function shouldUseStreaming(
  _file: File,
  _targetFormat: OutputFormat,
): Promise<boolean> {
  return false;
}

async function detectFormatMultiplier(file: File): Promise<number> {
  const head = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(head);

  if (bytes.length < 2) return 8;

  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 1;

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 12;
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return 8;
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 8;
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 8;
  }

  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return 12;
  }

  return 8;
}

export async function estimateMemoryUsage(file: File): Promise<{
  estimatedBytes: number;
  isSafe: boolean;
  recommendation: "normal" | "caution" | "reject";
}> {
  const fileSize = file.size;
  const multiplier = await detectFormatMultiplier(file);
  const estimatedDecodedSize = fileSize * multiplier;
  const estimatedPeakMemory = estimatedDecodedSize * 3;

  const isSafe = estimatedPeakMemory < MEMORY_LIMITS.MAX_SAFE_ARRAY_BUFFER_SIZE;
  const shouldWarn = fileSize > MEMORY_LIMITS.LARGE_FILE_WARNING_THRESHOLD;

  let recommendation: "normal" | "caution" | "reject";
  if (!isSafe) {
    recommendation = "reject";
  } else if (shouldWarn) {
    recommendation = "caution";
  } else {
    recommendation = "normal";
  }

  return {
    estimatedBytes: estimatedPeakMemory,
    isSafe,
    recommendation,
  };
}
