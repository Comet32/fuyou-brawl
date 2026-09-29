// Minimal typing for the subset-font package (it ships none).
declare module 'subset-font' {
  interface Options {
    targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype';
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
    preserveNameIds?: number[];
  }
  export default function subsetFont(font: Buffer, text: string, options?: Options): Promise<Buffer>;
}
