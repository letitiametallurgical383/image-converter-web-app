import { FORMAT_EXTENSION, MAX_FILENAME_LENGTH } from "@core/constants";
import type { ConverterSettings, OutputFormat } from "@core/types";

const INVALID_CHARS = /[\u0000-\u001f\u007f<>:"/\\|?*]+/g;

export function sanitizeFilename(input: string): string {
  const trimmed = input.trim();
  const withoutTraversal = trimmed.replace(/\.{2,}/g, ".");
  const noInvalid = withoutTraversal.replace(INVALID_CHARS, "_");
  const collapsed = noInvalid.replace(/\s+/g, " ").trim();
  const noLeadingDot = collapsed.replace(/^\.+/, "");
  return noLeadingDot.slice(0, MAX_FILENAME_LENGTH) || "file";
}

export function sanitizePrefix(input: string): string {
  if (!input) return "";
  return sanitizeFilename(input).replace(/[\s.]+$/, "");
}

export function splitBaseAndExt(name: string): {
  base: string;
  ext: string;
} {
  const cleaned = sanitizeFilename(name);
  const dot = cleaned.lastIndexOf(".");
  if (dot <= 0) {
    return { base: cleaned, ext: "" };
  }
  return { base: cleaned.slice(0, dot), ext: cleaned.slice(dot + 1) };
}

export function applyFindReplace(
  name: string,
  find: string,
  replace: string,
  caseSensitive: boolean,
): string {
  if (!find) return name;
  const safeReplace = sanitizeFilename(replace);
  if (caseSensitive) {
    return name.split(find).join(safeReplace);
  }
  const lowerName = name.toLowerCase();
  const lowerFind = find.toLowerCase();
  if (!lowerName.includes(lowerFind)) return name;
  let out = "";
  let idx = 0;
  while (idx < name.length) {
    if (lowerName.startsWith(lowerFind, idx)) {
      out += safeReplace;
      idx += lowerFind.length;
      continue;
    }
    out += name[idx];
    idx += 1;
  }
  return out;
}

export function buildOutputName(
  originalName: string,
  settings: ConverterSettings,
  format: OutputFormat,
): string {
  const { base } = splitBaseAndExt(originalName);
  const replaced = applyFindReplace(
    base,
    settings.findText,
    settings.replaceText,
    settings.findReplaceCaseSensitive,
  );
  const prefix = sanitizePrefix(settings.prefix);
  const combined = prefix ? `${prefix}${replaced}` : replaced;
  const safeBase = sanitizeFilename(combined);
  const ext = FORMAT_EXTENSION[format];
  return `${safeBase}.${ext}`;
}

export function ensureUniqueName(desired: string, taken: Set<string>): string {
  if (!taken.has(desired)) {
    taken.add(desired);
    return desired;
  }
  const { base, ext } = splitBaseAndExt(desired);
  let counter = 1;
  while (counter < 10_000) {
    const candidate = ext
      ? `${base} (${counter}).${ext}`
      : `${base} (${counter})`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
    counter += 1;
  }
  const fallback = `${base}-${crypto.randomUUID()}.${ext}`;
  taken.add(fallback);
  return fallback;
}
