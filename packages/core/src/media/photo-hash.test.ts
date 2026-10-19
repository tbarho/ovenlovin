import { deflateSync } from "zlib";
import { describe, expect, it } from "vitest";
import {
  averageHashFromRgba,
  isNearDuplicatePhotoHash,
  perceptualHashFromImageBytes,
} from "./photo-hash";

function crc32(data: Uint8Array): Buffer {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  crc ^= 0xffffffff;
  const out = Buffer.alloc(4);
  out.writeUInt32BE(crc >>> 0);
  return out;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, typeBytes, data, crc32(Buffer.concat([typeBytes, data]))]);
}

function encodeRgbPng(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function fillRgb(width: number, height: number, r: number, g: number, b: number): Buffer {
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = r;
    rgb[i + 1] = g;
    rgb[i + 2] = b;
  }
  return rgb;
}

describe("photo perceptual hash", () => {
  it("treats a 1-pixel change as a near duplicate", () => {
    const base = fillRgb(16, 16, 200, 80, 40);
    const changed = Buffer.from(base);
    changed[0] = 199;
    const a = perceptualHashFromImageBytes(encodeRgbPng(16, 16, base), "image/png");
    const b = perceptualHashFromImageBytes(encodeRgbPng(16, 16, changed), "image/png");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(isNearDuplicatePhotoHash(a!, b!)).toBe(true);
  });

  it("does not match clearly different photos", () => {
    const left = fillRgb(16, 16, 200, 80, 40);
    const right = fillRgb(16, 16, 20, 180, 220);
    const a = perceptualHashFromImageBytes(encodeRgbPng(16, 16, left), "image/png");
    const b = perceptualHashFromImageBytes(encodeRgbPng(16, 16, right), "image/png");
    expect(isNearDuplicatePhotoHash(a!, b!)).toBe(false);
  });

  it("hashes raw RGBA the same way", () => {
    const rgba = new Uint8Array(8 * 8 * 4);
    rgba.fill(180);
    expect(averageHashFromRgba(8, 8, rgba)).toHaveLength(16);
  });
});
