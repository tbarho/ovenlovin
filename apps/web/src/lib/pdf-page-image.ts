import { downscaleRgba, encodePngRgba, rgbaFromPdfImage } from "@ovenlovin/core/photo-hash";

export type Pixels = { width: number; height: number; rgba: Uint8Array };

/** Long side for page scans sent to the vision model. */
export const SCAN_MAX_SIDE = 1600;

const imageArea = (args: any[]) => Number(args[1]) * Number(args[2]);

async function imagePixels(page: any, name: string): Promise<Pixels | null> {
  const store = name.startsWith("g_") ? page.commonObjs : page.objs;
  const image: any = await new Promise((resolve) => store.get(name, resolve));
  if (!image?.data) return null;
  const rgba = rgbaFromPdfImage(image);
  return rgba ? { width: image.width, height: image.height, rgba } : null;
}

/**
 * Largest XObject image painted on a pdf.js page, by pixel count. A scanned
 * page is one full-page image, so this is its pixels without a canvas.
 */
export async function largestImage(page: any, ops: any, paint: number) {
  const best = ops.fnArray.reduce(
    (memo: any[] | null, fn: number, at: number) =>
      fn === paint && (!memo || imageArea(ops.argsArray[at]) > imageArea(memo))
        ? ops.argsArray[at]
        : memo,
    null
  );
  return best ? { args: best, pixels: () => imagePixels(page, best[0]) } : null;
}

export const png = (pixels: Pixels, max: number) => {
  const small = downscaleRgba(pixels.width, pixels.height, pixels.rgba, max);
  return encodePngRgba(small.width, small.height, small.rgba);
};

export const dataUrl = (bytes: Uint8Array) =>
  `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
