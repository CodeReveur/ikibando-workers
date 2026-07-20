"use client";

/**
 * Client-side face presence check for identity photos, run BEFORE the file is
 * uploaded to storage. Primary engine is MediaPipe's face detector (loaded on
 * demand from CDN so it costs nothing until the badge step is opened); if that
 * cannot load, the browser's native FaceDetector is tried. When neither engine
 * is available the check reports "unavailable" and callers should let the photo
 * through rather than lock everyone out of badges.
 */

/**
 * "face"       usable portrait
 * "no-face"    nothing face-like found
 * "unclear"    a face, but too small / too low-confidence to identify
 * "multiple"   more than one person in frame
 * "unavailable" no detector could run — caller should let the photo through
 */
export type FaceCheckResult = "face" | "no-face" | "unclear" | "multiple" | "unavailable";

// A usable passport photo: the face fills a reasonable share of the frame and the
// detector is confident about it. Below these it is "unclear", not "no face".
const MIN_FACE_RATIO = 0.10;   // face width vs image width
const MIN_CONFIDENCE = 0.5;

const MP_VERSION = "0.10.14";
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

// Evade the bundler: this must resolve at runtime from the CDN, not at build time.
const dynImport = (m: string): Promise<any> => new Function("m", "return import(m)")(m);

let detectorPromise: Promise<any | null> | null = null;

/** The MediaPipe detector, created once and cached. Null when it cannot load. */
function mediaPipeDetector(): Promise<any | null> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const vision = await dynImport(`${MP_URL}/vision_bundle.mjs`);
        const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
        return await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MP_MODEL },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.4,
        });
      } catch {
        return null; // offline / CDN blocked → caller treats as unavailable
      }
    })();
  }
  return detectorPromise;
}

/** Decode + downscale to a canvas (detectors are faster and steadier on ~640px). */
async function fileToCanvas(file: File, max = 640): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** True verdict when an engine ran; "unavailable" when no engine could. */
export async function detectFaceInFile(file: File): Promise<FaceCheckResult> {
  try {
    const canvas = await fileToCanvas(file);

    const mp = await mediaPipeDetector();
    if (mp) {
      const dets = mp.detect(canvas)?.detections ?? [];
      if (dets.length === 0) return "no-face";
      if (dets.length > 1) return "multiple";
      const box = dets[0].boundingBox;
      const score = dets[0].categories?.[0]?.score ?? 1;
      const ratio = box ? box.width / canvas.width : 1;
      if (ratio < MIN_FACE_RATIO || score < MIN_CONFIDENCE) return "unclear";
      return "face";
    }

    // Fallback: native FaceDetector (Chrome/Edge on some platforms only).
    const FD = (window as any).FaceDetector;
    if (FD) {
      try {
        const faces = await new FD({ fastMode: true, maxDetectedFaces: 3 }).detect(canvas);
        if (!faces || faces.length === 0) return "no-face";
        if (faces.length > 1) return "multiple";
        const bb = faces[0].boundingBox;
        if (bb && bb.width / canvas.width < MIN_FACE_RATIO) return "unclear";
        return "face";
      } catch {
        /* engine present but failed on this image → treat as unavailable */
      }
    }
    return "unavailable";
  } catch {
    return "unavailable"; // undecodable image etc. is handled by the upload path
  }
}
