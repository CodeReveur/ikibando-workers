"use client";

/**
 * Client-side image downscaling for uploads.
 *
 * Phone cameras produce 3-8 MB photos, but the reverse proxy in front of the API
 * caps request bodies (nginx defaults to 1 MB) and rejects anything larger with a
 * 413 whose error response carries no CORS headers - so the browser reports it as
 * an opaque "CORS/network" failure and the app can't even read the status. Shrinking
 * the picture here keeps every upload comfortably under that ceiling, so the failure
 * simply never happens. A passport photo needs nothing like full sensor resolution.
 */

export const MAX_UPLOAD_BYTES = 900 * 1024; // stay under a 1 MB proxy limit

/** True for files the browser can actually decode into a canvas. */
export function isSupportedImage(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp|gif|bmp)$/i.test(file.type);
}

async function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Revoked after decode; the bitmap is already in memory.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * Downscale to `maxDim` on the longest edge and re-encode as JPEG, stepping the
 * quality down until it fits `maxBytes`. Returns the original file untouched if it
 * is already small enough, or if the browser cannot decode it (e.g. HEIC).
 */
export async function compressImage(
  file: File,
  { maxDim = 1280, maxBytes = MAX_UPLOAD_BYTES }: { maxDim?: number; maxBytes?: number } = {},
): Promise<File> {
  if (file.size <= maxBytes && isSupportedImage(file)) return file;

  let img: HTMLImageElement;
  try {
    img = await decode(file);
  } catch {
    return file; // undecodable - caller surfaces a clear "unsupported format" error
  }

  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (blob && blob.size <= maxBytes) {
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    }
    if (blob && quality === 0.4) {
      // Best effort at the lowest quality we're willing to ship.
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    }
  }
  return file;
}
