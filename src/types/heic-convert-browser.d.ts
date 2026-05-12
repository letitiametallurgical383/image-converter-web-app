declare module "heic-convert/browser" {
  export interface ConvertOptions {
    buffer: ArrayBuffer;
    format: string;
    quality: number;
  }
  export default function convert(opts: ConvertOptions): Promise<ArrayBuffer>;
  export function convert(opts: ConvertOptions): Promise<ArrayBuffer>;
}
