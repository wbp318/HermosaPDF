import { useState } from "react";
import clsx from "clsx";
import { usePdfStore } from "../lib/store";
import { DEFAULT_COLORS, type Tool } from "../lib/annotations";
import { SignatureModal } from "./SignatureModal";

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: "select", label: "↖", title: "Select / move" },
  { id: "freehand", label: "✎", title: "Freehand draw" },
  { id: "text", label: "T", title: "Text box" },
  { id: "sticky", label: "•", title: "Sticky note" },
];

export function AnnotationTools() {
  const tool = usePdfStore((s) => s.tool);
  const setTool = usePdfStore((s) => s.setTool);
  const color = usePdfStore((s) => s.annotationColor);
  const setColor = usePdfStore((s) => s.setAnnotationColor);
  const strokeWidth = usePdfStore((s) => s.strokeWidth);
  const setStrokeWidth = usePdfStore((s) => s.setStrokeWidth);
  const selectedId = usePdfStore((s) => s.selectedAnnotationId);
  const removeAnnotation = usePdfStore((s) => s.removeAnnotation);
  const pendingSignatureId = usePdfStore((s) => s.pendingSignatureId);
  const signatures = usePdfStore((s) => s.signatures);
  const setPendingSignature = usePdfStore((s) => s.setPendingSignature);

  const [showSigModal, setShowSigModal] = useState(false);

  const pendingSig = pendingSignatureId
    ? signatures.find((s) => s.id === pendingSignatureId)
    : null;

  return (
    <>
      <div className="annotation-tools">
        <div className="tool-group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={clsx("tool-btn", tool === t.id && "active")}
              title={t.title}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
          <button
            className={clsx("tool-btn sign-btn", tool === "sign" && "active")}
            title="Sign"
            onClick={() => setShowSigModal(true)}
          >
            Sign
          </button>
        </div>
        <div className="tool-group">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              className={clsx("color-swatch", color === c && "active")}
              style={{ background: c }}
              title={c}
              onClick={() => setColor(c)}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.currentTarget.value)}
            title="Custom color"
            className="color-picker"
          />
        </div>
        {tool === "freehand" && (
          <div className="tool-group">
            <span className="muted">Width</span>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.currentTarget.value))}
              style={{ width: 80 }}
            />
            <span className="muted">{strokeWidth}</span>
          </div>
        )}
        {pendingSig && (
          <div className="tool-group">
            <span className="muted">Placing:</span>
            <img src={pendingSig.dataUrl} alt={pendingSig.name} className="pending-sig-preview" />
            <button onClick={() => setPendingSignature(null)} title="Cancel placement">
              Cancel
            </button>
          </div>
        )}
        {selectedId && (
          <div className="tool-group right">
            <button
              className="danger"
              onClick={() => removeAnnotation(selectedId)}
              title="Delete selected"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {showSigModal && <SignatureModal onClose={() => setShowSigModal(false)} />}
    </>
  );
}
