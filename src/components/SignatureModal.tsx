import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { usePdfStore } from "../lib/store";
import { newId, type SignatureAsset } from "../lib/annotations";

type Mode = "draw" | "type" | "upload";

interface Props {
  onClose: () => void;
}

const TYPE_FONTS = [
  { label: "Dancing Script", css: "'Dancing Script', cursive" },
  { label: "Caveat", css: "'Caveat', cursive" },
  { label: "Great Vibes", css: "'Great Vibes', cursive" },
];

const DRAW_W = 520;
const DRAW_H = 180;

export function SignatureModal({ onClose }: Props) {
  const signatures = usePdfStore((s) => s.signatures);
  const addSignature = usePdfStore((s) => s.addSignature);
  const removeSignature = usePdfStore((s) => s.removeSignature);
  const setPendingSignature = usePdfStore((s) => s.setPendingSignature);

  const [mode, setMode] = useState<Mode>("draw");
  const [name, setName] = useState("");
  const [typeText, setTypeText] = useState("");
  const [fontIdx, setFontIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasInk, setHasInk] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    if (mode !== "draw") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, DRAW_W, DRAW_H);
    setHasInk(false);
  }, [mode]);

  function drawStart(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * DRAW_W;
    const y = ((e.clientY - rect.top) / rect.height) * DRAW_H;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
  }

  function drawMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * DRAW_W;
    const y = ((e.clientY - rect.top) / rect.height) * DRAW_H;
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  }

  function drawEnd(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  function clearDraw() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, DRAW_W, DRAW_H);
    setHasInk(false);
  }

  async function saveAndUseDrawn() {
    if (!canvasRef.current || !hasInk) return;
    const trimmed = trimCanvas(canvasRef.current);
    if (!trimmed) return;
    const dataUrl = trimmed.canvas.toDataURL("image/png");
    commitAsset(dataUrl, trimmed.width, trimmed.height, name || "Signature");
  }

  async function saveAndUseTyped() {
    const text = typeText.trim();
    if (!text) return;
    const font = TYPE_FONTS[fontIdx];
    const c = renderTypedSignature(text, font.css, 64);
    if (!c) return;
    const dataUrl = c.toDataURL("image/png");
    commitAsset(dataUrl, c.width, c.height, name || text);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      const img = new Image();
      img.onload = () => {
        commitAsset(
          dataUrl,
          img.naturalWidth,
          img.naturalHeight,
          name || file.name.replace(/\.[^.]+$/, ""),
        );
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function commitAsset(dataUrl: string, w: number, h: number, assetName: string) {
    const asset: SignatureAsset = {
      id: newId(),
      name: assetName,
      dataUrl,
      nativeWidth: w,
      nativeHeight: h,
      createdAt: Date.now(),
    };
    addSignature(asset);
    setPendingSignature(asset.id);
    onClose();
  }

  function useExisting(id: string) {
    setPendingSignature(id);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Signature</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-tabs">
          {(["draw", "type", "upload"] as Mode[]).map((m) => (
            <button
              key={m}
              className={clsx("tab", mode === m && "active")}
              onClick={() => setMode(m)}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {mode === "draw" && (
          <div className="modal-body">
            <canvas
              ref={canvasRef}
              width={DRAW_W}
              height={DRAW_H}
              className="sig-canvas"
              onPointerDown={drawStart}
              onPointerMove={drawMove}
              onPointerUp={drawEnd}
              onPointerCancel={drawEnd}
            />
            <div className="modal-row">
              <button onClick={clearDraw}>Clear</button>
              <input
                type="text"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="primary"
                onClick={saveAndUseDrawn}
                disabled={!hasInk}
              >
                Save & use
              </button>
            </div>
          </div>
        )}

        {mode === "type" && (
          <div className="modal-body">
            <input
              type="text"
              placeholder="Type your name"
              value={typeText}
              onChange={(e) => setTypeText(e.target.value)}
              className="type-input"
              style={{ fontFamily: TYPE_FONTS[fontIdx].css, fontSize: "2rem" }}
            />
            <div className="type-font-picker">
              {TYPE_FONTS.map((f, i) => (
                <button
                  key={f.label}
                  className={clsx("font-opt", i === fontIdx && "active")}
                  style={{ fontFamily: f.css }}
                  onClick={() => setFontIdx(i)}
                >
                  {typeText || "Your Name"}
                </button>
              ))}
            </div>
            <div className="modal-row">
              <input
                type="text"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="primary"
                onClick={saveAndUseTyped}
                disabled={!typeText.trim()}
              >
                Save & use
              </button>
            </div>
          </div>
        )}

        {mode === "upload" && (
          <div className="modal-body">
            <p className="muted">
              Pick a PNG or JPG of your signature. A transparent PNG looks best.
            </p>
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={onUpload}
            />
          </div>
        )}

        {signatures.length > 0 && (
          <div className="modal-saved">
            <h3>Saved signatures</h3>
            <div className="sig-grid">
              {signatures.map((s) => (
                <div key={s.id} className="sig-card">
                  <img src={s.dataUrl} alt={s.name} />
                  <div className="sig-card-row">
                    <span className="sig-name">{s.name}</span>
                    <div>
                      <button onClick={() => useExisting(s.id)}>Use</button>
                      <button
                        className="danger-inline"
                        onClick={() => removeSignature(s.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Crop a mostly-white canvas down to its ink bounding box. Returns null if empty.
function trimCanvas(source: HTMLCanvasElement): { canvas: HTMLCanvasElement; width: number; height: number } | null {
  const ctx = source.getContext("2d");
  if (!ctx) return null;
  const { width, height } = source;
  const img = ctx.getImageData(0, 0, width, height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      // Treat near-white as background
      if (r < 245 || g < 245 || b < 245) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const w = Math.min(width, maxX + pad) - x0;
  const h = Math.min(height, maxY + pad) - y0;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return null;
  // Make the trimmed canvas transparent: draw only non-white pixels
  const src = ctx.getImageData(x0, y0, w, h);
  const dst = octx.createImageData(w, h);
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i];
    const g = src.data[i + 1];
    const b = src.data[i + 2];
    const near = (r + g + b) / 3;
    if (near < 245) {
      dst.data[i] = r;
      dst.data[i + 1] = g;
      dst.data[i + 2] = b;
      // Soften the alpha based on closeness to black for smoother edges
      dst.data[i + 3] = 255;
    }
  }
  octx.putImageData(dst, 0, 0);
  return { canvas: out, width: w, height: h };
}

function renderTypedSignature(text: string, fontCss: string, size: number): HTMLCanvasElement | null {
  const probe = document.createElement("canvas");
  const pctx = probe.getContext("2d");
  if (!pctx) return null;
  pctx.font = `${size}px ${fontCss}`;
  const metrics = pctx.measureText(text);
  const width = Math.ceil(metrics.width + 40);
  const height = Math.ceil(size * 1.6);

  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.font = `${size}px ${fontCss}`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 20, height / 2);
  return c;
}
