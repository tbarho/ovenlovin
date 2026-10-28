/* eslint-disable no-undef */
import { deflateSync, inflateSync } from "zlib";
import { parseImageDataUrl } from "./recipe-images";

export const PHOTO_PHASH_MAX_DISTANCE = 8;

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function averageHashFromRgba(
  width: number,
  height: number,
  rgba: Uint8Array | Uint8ClampedArray
): string {
  const size = 8;
  const cells: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / size));
      const y0 = Math.floor((y * height) / size);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / size));
      let sum = 0;
      let count = 0;
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const i = (py * width + px) * 4;
          sum += luma(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
          count += 1;
        }
      }
      cells.push(count > 0 ? sum / count : 0);
    }
  }
  const mean = cells.reduce((total, value) => total + value, 0) / cells.length;
  let bits = 0n;
  for (const value of cells) {
    bits = (bits << 1n) | (value >= mean ? 1n : 0n);
  }
  return bits.toString(16).padStart(16, "0");
}

export function hammingHex(left: string, right: string): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  const a = BigInt(`0x${left}`);
  const b = BigInt(`0x${right}`);
  let xor = a ^ b;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

export function isNearDuplicatePhotoHash(
  left: string,
  right: string,
  maxDistance = PHOTO_PHASH_MAX_DISTANCE
): boolean {
  if (!left || !right) return false;
  return hammingHex(left, right) <= maxDistance;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngRgba(
  bytes: Uint8Array
): { width: number; height: number; rgba: Uint8Array } | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || sig.some((value, index) => bytes[index] !== value)) return null;

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.subarray(offset, offset + 4).reduce((n, b) => (n << 8) | b, 0);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.subarray(0, 4).reduce((n, b) => (n << 8) | b, 0);
      height = data.subarray(4, 8).reduce((n, b) => (n << 8) | b, 0);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (width < 1 || height < 1 || bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    return null;
  }
  const bpp = colorType === 6 ? 4 : 3;
  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const stride = width * bpp;
  const rgba = new Uint8Array(width * height * 4);
  let src = 0;
  const prev = new Uint8Array(stride);
  const curr = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[src++] ?? 0;
    for (let x = 0; x < stride; x++) {
      const raw = inflated[src++] ?? 0;
      const left = x >= bpp ? (curr[x - bpp] ?? 0) : 0;
      const up = prev[x] ?? 0;
      const upLeft = x >= bpp ? (prev[x - bpp] ?? 0) : 0;
      let value = raw;
      if (filter === 1) value = (raw + left) & 255;
      else if (filter === 2) value = (raw + up) & 255;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (raw + paeth(left, up, upLeft)) & 255;
      curr[x] = value;
    }
    for (let x = 0; x < width; x++) {
      const i = x * bpp;
      const o = (y * width + x) * 4;
      rgba[o] = curr[i] ?? 0;
      rgba[o + 1] = curr[i + 1] ?? 0;
      rgba[o + 2] = curr[i + 2] ?? 0;
      rgba[o + 3] = bpp === 4 ? (curr[i + 3] ?? 255) : 255;
    }
    prev.set(curr);
  }
  return { width, height, rgba };
}

export function perceptualHashFromImageBytes(
  bytes: Uint8Array,
  contentType?: string
): string | null {
  const type = (contentType ?? "").toLowerCase();
  const png = type.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
  if (png) {
    const decoded = decodePngRgba(bytes);
    if (!decoded) return null;
    return averageHashFromRgba(decoded.width, decoded.height, decoded.rgba);
  }
  return null;
}

export function perceptualHashFromImageBlob(blob: string): string | null {
  const trimmed = blob.trim();
  if (/^https?:\/\//i.test(trimmed)) return null;
  const dataUrl = parseImageDataUrl(
    /^\s*data:image\//i.test(trimmed)
      ? trimmed
      : `data:image/png;base64,${trimmed.replace(/\s+/g, "")}`
  );
  if (!dataUrl) return null;
  return perceptualHashFromImageBytes(new Uint8Array(dataUrl.body), dataUrl.contentType);
}

/** pdf.js image object (kind 1 = 1-bit gray, 2 = RGB, 3 = RGBA) to RGBA. */
export function rgbaFromPdfImage(image: {
  width: number;
  height: number;
  kind: number;
  data: Uint8Array | Uint8ClampedArray;
}): Uint8Array | null {
  const { width, height, kind, data } = image;
  const pixels = width * height;
  const rgba = new Uint8Array(pixels * 4);
  if (kind === 3) {
    rgba.set(data.subarray(0, pixels * 4));
    return rgba;
  }
  if (kind === 2) {
    for (let i = 0; i < pixels; i++) {
      rgba[i * 4] = data[i * 3] ?? 0;
      rgba[i * 4 + 1] = data[i * 3 + 1] ?? 0;
      rgba[i * 4 + 2] = data[i * 3 + 2] ?? 0;
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  }
  if (kind === 1) {
    const stride = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = ((data[y * stride + (x >> 3)] ?? 0) >> (7 - (x & 7))) & 1;
        const o = (y * width + x) * 4;
        rgba[o] = rgba[o + 1] = rgba[o + 2] = bit ? 255 : 0;
        rgba[o + 3] = 255;
      }
    }
    return rgba;
  }
  return null;
}

/** Box-filter shrink so the long side is at most `max`. Smaller images pass through. */
export function downscaleRgba(width: number, height: number, rgba: Uint8Array, max: number) {
  const scale = Math.max(width, height) / max;
  if (scale <= 1) return { width, height, rgba };
  const w = Math.max(1, Math.round(width / scale));
  const h = Math.max(1, Math.round(height / scale));
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w));
      const sums = [0, 0, 0, 0];
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const i = (py * width + px) * 4;
          for (let c = 0; c < 4; c++) sums[c]! += rgba[i + c] ?? 0;
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      for (let c = 0; c < 4; c++) out[(y * w + x) * 4 + c] = Math.round(sums[c]! / count);
    }
  }
  return { width: w, height: h, rgba: out };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

/** RGBA pixels to a PNG (8-bit, no filter). Pairs with decodePngRgba above. */
export function encodePngRgba(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", deflateSync(raw)),
      pngChunk("IEND", new Uint8Array()),
    ])
  );
}
