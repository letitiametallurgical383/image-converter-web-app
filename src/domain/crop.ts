import type { CropPercent } from "@core/types";

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dw: number;
  dh: number;
}

export function computeCropRect(
  sourceWidth: number,
  sourceHeight: number,
  crop: CropPercent,
): CropRect {
  const left = (crop.left / 100) * sourceWidth;
  const right = (crop.right / 100) * sourceWidth;
  const top = (crop.top / 100) * sourceHeight;
  const bottom = (crop.bottom / 100) * sourceHeight;
  const sx = Math.floor(left);
  const sy = Math.floor(top);
  const sw = Math.max(1, Math.round(sourceWidth - left - right));
  const sh = Math.max(1, Math.round(sourceHeight - top - bottom));
  return { sx, sy, sw, sh, dw: sw, dh: sh };
}
