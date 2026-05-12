export type OutputFormat = "jpeg" | "webp" | "avif" | "png";

export type ConversionStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "cancelled";

export interface CropPercent {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ConverterSettings {
  format: OutputFormat;
  quality: number;
  crop: CropPercent;
  prefix: string;
  findText: string;
  replaceText: string;
  findReplaceCaseSensitive: boolean;
  concurrency: number;
  keepMetadata: boolean;
  compressionMode: "lossy" | "lossless";
}

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  settings: ConverterSettings;
}

export interface PresetFile {
  schemaVersion: number;
  presets: Preset[];
}

export interface SourceFile {
  id: string;
  file: File;
  sizeBytes: number;
  mimeType: string;
  name: string;
}

export interface ConvertedArtifact {
  blob: Blob;
  outputName: string;
  outputFormat: OutputFormat;
  originalBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  durationMs: number;
}

export interface BatchItem {
  source: SourceFile;
  status: ConversionStatus;
  progress: number;
  artifact?: ConvertedArtifact;
  error?: string;
}

export interface WorkerRequest {
  id: string;
  kind: "convert";
  bytes: ArrayBuffer;
  mimeType: string;
  settings: ConverterSettings;
  originalName: string;
}

export type WorkerResponse =
  | {
      id: string;
      kind: "progress";
      progress: number;
    }
  | {
      id: string;
      kind: "done";
      blob: Blob;
      width: number;
      height: number;
      durationMs: number;
      outputFormat: OutputFormat;
      metadataWarnings?: string[];
    }
  | {
      id: string;
      kind: "error";
      message: string;
    };
