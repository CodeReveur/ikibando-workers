"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw, ZoomIn, X, Check } from "lucide-react";

/**
 * Square crop/align editor for badge photos.
 *
 * A badge prints one fixed square portrait, so an uncropped phone photo arrives
 * off-centre or with the face tiny in frame. This lets the user drag to position,
 * zoom and rotate before anything is uploaded, and outputs a clean square JPEG -
 * which also keeps the file small enough for the API's body limit.
 *
 * Deliberately dependency-free (canvas + pointer events) rather than pulling in a
 * cropping library for one screen.
 */
export function ImageCropper({
  open, file, onCancel, onCropped, size = 640,
}: {
  open: boolean;
  /** The picked/captured file to edit. */
  file: File | null;
  onCancel: () => void;
  onCropped: (cropped: File) => void;
  /** Output edge length in pixels. */
  size?: number;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [boxSize, setBoxSize] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Decode the file whenever a new one arrives, and reset the transform.
  // The object URL must stay alive for as long as the preview <img> uses it -
  // revoking it as soon as the image decoded left the box rendering black.
  useEffect(() => {
    if (!open || !file) { setImg(null); setImgUrl(null); return; }
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);   // only once the cropper closes
  }, [open, file]);

  // The frame is square but photos rarely are, so measure it and size the image
  // ourselves rather than leaving it to CSS.
  useEffect(() => {
    if (!open) return;
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBoxSize(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, imgUrl]);

  // Scale that makes the photo cover the square frame; the overflow is what the
  // user pans through. Zoom multiplies it.
  const cover = img && boxSize
    ? Math.max(boxSize / img.naturalWidth, boxSize / img.naturalHeight)
    : 1;
  const dispW = img ? img.naturalWidth * cover * zoom : 0;
  const dispH = img ? img.naturalHeight * cover * zoom : 0;

  /**
   * Pan limits: half of however much the photo overflows the frame on each axis.
   * A tall photo overflows vertically even at zoom 1, which is exactly the slack
   * needed to move a face into the circle; clamping stops a blank edge being
   * dragged in and baked into the badge.
   */
  const clamp = useCallback((p: { x: number; y: number }, w: number, h: number) => {
    const maxX = Math.max(0, (w - boxSize) / 2);
    const maxY = Math.max(0, (h - boxSize) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) };
  }, [boxSize]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }, dispW, dispH));
  };
  const onPointerUp = () => { dragRef.current = null; };

  // Zooming back out must pull the photo back into frame too.
  const changeZoom = (z: number) => {
    setZoom(z);
    if (!img) return;
    const w = img.naturalWidth * cover * z;
    const h = img.naturalHeight * cover * z;
    setOffset((o) => clamp(o, w, h));
  };

  /**
   * Render the current view into a square canvas. The preview box and the canvas
   * use the same transform order (translate → rotate → scale), so what the user
   * frames is exactly what gets written.
   */
  const apply = useCallback(async () => {
    if (!img || !file) return;
    setBusy(true);
    try {
      const box = boxSize || boxRef.current?.clientWidth || 280;
      const scale = size / box;                    // preview px → output px
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);

      // Base size: cover the square preview box, then apply the user's zoom.
      const base = Math.max(box / img.naturalWidth, box / img.naturalHeight);
      const drawW = img.naturalWidth * base * zoom * scale;
      const drawH = img.naturalHeight * base * zoom * scale;

      ctx.save();
      ctx.translate(size / 2 + offset.x * scale, size / 2 + offset.y * scale);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
      if (!blob) return;
      const name = file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg";
      onCropped(new File([blob], name, { type: "image/jpeg" }));
    } finally {
      setBusy(false);
    }
  }, [img, file, size, zoom, rotation, offset, boxSize, onCropped]);

  if (!open || !file) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,0.9)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: "Inter, DM Sans, system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 380, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Position your photo</span>
        <button onClick={onCancel} aria-label="Cancel"
          style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", display: "flex" }}>
          <X size={20} />
        </button>
      </div>

      {/* Square viewport with a circular guide matching how the badge shows it. */}
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "relative", width: "100%", maxWidth: 380, aspectRatio: "1/1",
          overflow: "hidden", borderRadius: 14, background: "#111",
          border: "1px solid #2a2a2a", touchAction: "none", cursor: "grab",
        }}
      >
        {imgUrl && (
          // object-fit:cover on a box-sized element is the honest way to preview this.
          // min-width/height with auto sizing rendered the image at its INTRINSIC pixel
          // size (a 1280px photo inside a ~570px box), so the preview looked roughly
          // twice as zoomed as the exported crop. The canvas below applies the same
          // cover-scale then scale → rotate → translate, so export matches preview.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt=""
            draggable={false}
            style={{
              position: "absolute", left: "50%", top: "50%",
              width: dispW || undefined, height: dispH || undefined, maxWidth: "none",
              transform: `translate(-50%,-50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
              transformOrigin: "center",
              userSelect: "none", pointerEvents: "none",
            }}
          />
        )}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.35) inset",
          borderRadius: "50%",
          border: "2px dashed rgba(255,255,255,0.55)",
        }} />
      </div>

      <p style={{ color: "#777", fontSize: 11.5, margin: "10px 0 0", textAlign: "center", maxWidth: 380 }}>
        Drag to move · keep your face inside the circle
      </p>

      <div style={{ width: "100%", maxWidth: 380, marginTop: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#999", fontSize: 12 }}>
          <ZoomIn size={15} />
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, width: "100%", maxWidth: 380 }}>
        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: "#1c1c1c", border: "1px solid #333", color: "#ccc",
            borderRadius: 10, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          }}
        >
          <RotateCw size={15} /> Rotate
        </button>
        <button
          onClick={apply} disabled={!img || busy}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: !img || busy ? "#3a3a3a" : "#f97316", border: "none", color: "#fff",
            borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 800,
            cursor: !img || busy ? "not-allowed" : "pointer",
          }}
        >
          <Check size={16} /> {busy ? "Saving…" : "Use this photo"}
        </button>
      </div>
    </div>
  );
}
