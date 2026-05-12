declare module "piexifjs" {
  export type ExifData = {
    "0th"?: Record<number, unknown>;
    "1st"?: Record<number, unknown>;
    Exif?: Record<number, unknown>;
    GPS?: Record<number, unknown>;
    Interop?: Record<number, unknown>;
    thumbnail?: string | null;
  };
  const piexif: {
    dump: (exifObj: ExifData) => string;
    insert: (exifStr: string, jpegBase64: string) => string;
    load: (jpegData: string) => ExifData;
    TAGS: Record<string, Record<string, { name: string; type: string }>>;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
  };
  export default piexif;
}
